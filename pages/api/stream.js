import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { ParallelRequestProcessor } from '../../utils/parallelProcessor';
import prisma from '../../lib/prisma';

const streamProcessor = new ParallelRequestProcessor({
  maxConcurrentRequests: 8,
  retryCount: 1,
  retryDelay: 500
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set headers for proper SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });

  // Get user session
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { prompt, models } = req.query;
  const modelArray = models ? models.split(',') : [];
  
  // Get user's API keys from database
  const userApiKeys = {};
  try {
    const apiKeysRes = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      select: { provider: true, encryptedKey: true }
    });
    
    apiKeysRes.forEach(({ provider, encryptedKey }) => {
      userApiKeys[provider] = encryptedKey;
    });
  } catch (error) {
    console.error('Error fetching user API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
    return;
  }

  // Initialize API clients with ONLY user's keys (no fallback to env variables)
  const openai = new OpenAI({ apiKey: userApiKeys.openai });
  const anthropic = new Anthropic({ apiKey: userApiKeys.anthropic });
  const genAI = new GoogleGenerativeAI(userApiKeys.google);
  const openRouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: userApiKeys.openrouter,
    defaultQuery: {
      transforms: ['middle']  // Ensures consistent response format
    },
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
      'X-Title': 'Quicke - LLM Response Comparison'
    }
  });

  // Map of OpenRouter model IDs and their display names
  const openRouterModels = {
    'mistral-7b': {
      id: 'mistralai/mistral-7b-instruct:free',
      name: 'Mistral 7B Instruct'
    },
    'llama2-70b': {
      id: 'meta-llama/llama-3.3-70b-instruct:free',
      name: 'Llama-2 70B'
    },
    'phi3': {
      id: 'microsoft/phi-3-medium-128k-instruct:free',
      name: 'Phi-3'
    },
    'qwen-32b': {
      id: 'qwen/qwq-32b:free',
      name: 'Qwen QwQ 32B'
    },
    'openchat': {
      id: 'openchat/openchat-7b:free',
      name: 'OpenChat 3.5'
    },
    'deepseek-r1': {  // Add DeepSeek to OpenRouter models
      id: 'deepseek/deepseek-r1:free',
      name: 'DeepSeek R1'
    }
  };

  // Helper function to send SSE with immediate flush
  const sendEvent = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (res.flush) res.flush();
    } catch (error) {
      console.error('Error sending event:', error);
    }
  };

  const sendErrorEvent = (model, message) => {
    sendEvent({
      model,
      error: message,
      loading: false,
      streaming: false,
      done: true
    });
  };

  // Helper function to check if a model has its required API key
  const hasRequiredApiKey = (modelId) => {
    const providerMap = {
      'gpt-4': 'openai',
      'claude': 'anthropic',
      'gemini': 'google',
      // Map all OpenRouter models to the openrouter provider
      'deepseek-r1': 'openrouter',
      'mistral-7b': 'openrouter',
      'llama2-70b': 'openrouter',
      'phi3': 'openrouter',
      'qwen-32b': 'openrouter',
      'openchat': 'openrouter'
    };
    
    const provider = providerMap[modelId];
    
    // Check if there's a valid API key
    if (!provider) return false;
    
    const apiKey = userApiKeys[provider];
    return Boolean(apiKey && apiKey.trim().length > 0);
  };

  // Helper function to verify if user has the required API key
  const verifyApiKey = (modelId) => {
    const providerMap = {
      'gpt-4': 'openai',
      'claude': 'anthropic',
      'gemini': 'google',
      'deepseek-r1': 'openrouter',
      'mistral-7b': 'openrouter',
      'llama2-70b': 'openrouter',
      'phi3': 'openrouter',
      'qwen-32b': 'openrouter',
      'openchat': 'openrouter'
    };

    const provider = providerMap[modelId];
    return userApiKeys[provider] ? true : false;
  };

  let completedResponses = 0;
  const totalModels = modelArray.length;

  const handleModelCompletion = () => {
    completedResponses++;
    if (completedResponses === totalModels) {
      // All models have completed - send single completion event
      sendEvent({
        done: true,
        allComplete: true  // This flag indicates all models are done
      });
      res.end();
    }
  };

  try {
    // Process each model stream independently
    const modelPromises = modelArray.map(async (modelId) => {
      // First verify if user has the required API key
      if (!verifyApiKey(modelId)) {
        sendEvent({
          model: modelId,
          error: `No API key found for ${modelId}. Please add your API key in settings.`,
          loading: false,
          streaming: false,
          done: true
        });
        handleModelCompletion();
        return;
      }

      // Initial state for each model
      sendEvent({
        model: modelId,
        text: '',
        loading: true,
        streaming: false
      });

      try {
        // Directly attempt to use the model - let API errors handle missing/invalid keys
        if (modelId === 'gpt-4') {
          await handleOpenAIStream(modelId, prompt, sendEvent, openai);
        } else if (modelId === 'claude') {
          await handleClaudeStream(prompt, sendEvent, anthropic);
        } else if (modelId === 'gemini') {
          await handleGeminiStream(prompt, sendEvent, genAI);
        } else if (openRouterModels[modelId]) {
          await handleOpenRouterStream(modelId, prompt, sendEvent, openRouter, openRouterModels);
        }
      } catch (error) {
        console.error(`Error with ${modelId}:`, error);
        const errorMessage = error.status === 401 || error.status === 403
          ? `Invalid API key for ${modelId}. Please check your settings.`
          : `Error: ${error.message}`;
        sendEvent({
          model: modelId,
          error: errorMessage,
          loading: false,
          streaming: false,
          done: true
        });
      }

      handleModelCompletion();
    });

    // Process all streams concurrently
    await Promise.all(modelPromises);
  } catch (error) {
    console.error('Streaming error:', error);
    sendEvent({ error: 'Failed to process streaming requests' });
    res.end();
  }
}

async function handleOpenAIStream(model, prompt, sendEvent, openai) {
  try {
    const stream = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let text = '';
    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        text += chunk.choices[0].delta.content;
        sendEvent({ model, text });
      }
    }
    sendEvent({ model, text, done: true });
  } catch (error) {
    // Improve error message based on status code
    const errorMessage = error.status === 401 
      ? "Invalid or missing OpenAI API key. Please check your API key in settings."
      : error.message;
    sendEvent({ model, error: errorMessage });
  }
}

async function handleClaudeStream(prompt, sendEvent, anthropic) {
  try {
    const stream = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let text = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.text) {
        text += chunk.delta.text;
        sendEvent({ model: 'claude', text });
      }
    }
    sendEvent({ model: 'claude', text, done: true });
  } catch (error) {
    const errorMessage = error.status === 401 
      ? "Invalid or missing Anthropic API key. Please check your API key in settings."
      : error.message;
    sendEvent({ model: 'claude', error: errorMessage });
  }
}

async function handleGeminiStream(prompt, sendEvent, genAI) {
  try {
    // First send an explicit loading state
    sendEvent({ model: 'gemini', loading: true, text: '' });
    
    const modelOptions = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-1.5-flash'];
    let success = false;

    for (const modelName of modelOptions) {
      try {
        console.log(`Attempting to use Gemini model: ${modelName}`);
        const geminiModel = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        });
        
        try {
          // Try the streaming method first
          console.log(`Starting stream for Gemini model: ${modelName}`);
          const result = await geminiModel.generateContentStream(prompt);
          
          let text = '';
          let firstChunk = true;
          
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            
            // Log the first chunk to debug
            if (firstChunk) {
              console.log(`First chunk received from ${modelName}:`, chunkText !== undefined ? 'has content' : 'undefined content');
              firstChunk = false;
            }
            
            if (chunkText !== undefined) {
              text += chunkText;
              // Send the updated text with each chunk
              sendEvent({ 
                model: 'gemini', 
                text, 
                loading: false,
                streaming: true 
              });
            }
          }
          
          // Final update with streaming and done flags
          if (text.length > 0) {
            console.log(`Gemini model ${modelName} succeeded with ${text.length} characters`);
            sendEvent({ 
              model: 'gemini', 
              text, 
              loading: false,
              streaming: false,  // Explicitly set streaming to false
              done: true 
            });
            success = true;
            break;
          } else {
            console.log(`Gemini model ${modelName} returned empty response`);
          }
        } catch (streamError) {
          console.error(`Streaming error with Gemini model ${modelName}:`, streamError);
          
          // Fallback to non-streaming method if streaming fails
          try {
            console.log(`Trying non-streaming fallback for ${modelName}`);
            const response = await geminiModel.generateContent(prompt);
            const text = response.response.text();
            
            if (text && text.length > 0) {
              // For non-streaming, send one update
              sendEvent({ 
                model: 'gemini', 
                text, 
                loading: false, 
                streaming: false, 
                done: true 
              });
              console.log(`Gemini model ${modelName} succeeded with non-streaming API`);
              success = true;
              break;
            } else {
              console.log(`Gemini model ${modelName} returned empty response with non-streaming API`);
            }
          } catch (nonStreamError) {
            console.error(`Non-streaming error with Gemini model ${modelName}:`, nonStreamError);
          }
        }
      } catch (modelError) {
        console.error(`Error initializing Gemini model ${modelName}:`, modelError);
      }
    }

    if (!success) {
      console.error('All Gemini model attempts failed');
      sendEvent({ 
        model: 'gemini', 
        error: 'Failed to generate content with Gemini models. Please check your API key and quota limits.',
        loading: false,
        done: true
      });
    }
  } catch (error) {
    console.error('Gemini streaming error:', error);
    sendEvent({ 
      model: 'gemini', 
      error: `${error.message} - Please check your API key and model access.`,
      loading: false,
      done: true
    });
  }
}

async function handleOpenRouterStream(modelId, prompt, sendEvent, openRouter, openRouterModels) {
  const startTime = Date.now();
  try {
    sendEvent({ model: modelId, loading: true, text: '' });
    
    // Validate model and log start
    if (!openRouterModels[modelId]) {
      throw new Error(`Model ${modelId} not found in OpenRouter models`);
    }
    
    console.log(`[OpenRouter] Starting stream for ${modelId}`);
    
    const stream = await openRouter.chat.completions.create({
      model: openRouterModels[modelId].id,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      temperature: 0.7
    });

    let text = '';
    let tokenCount = 0;
    
    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        text += chunk.choices[0].delta.content;
        tokenCount++;
        // Send immediate update for this chunk
        sendEvent({ 
          model: modelId, 
          text, 
          loading: false,
          streaming: true
        });
      }
    }
    
    // Log completion and send final state
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[OpenRouter] ${modelId} completed in ${duration}s`);
    
    sendEvent({ 
      model: modelId, 
      text, 
      loading: false, 
      streaming: false,
      done: true 
    });
  } catch (error) {
    console.error(`[OpenRouter] ${modelId} error:`, error);
    sendEvent({ 
      model: modelId, 
      error: error.message,
      loading: false,
      streaming: false,
      done: true 
    });
  }
}

// Update the streaming function to use the streamProcessor
async function streamModelResponse(model, prompt, apiKeys, streamTracker) {
  try {
    const modelRequest = async () => {
      let accumulatedText = '';
      
      if (model.startsWith('gpt-')) {
        const openai = new OpenAI({ apiKey: apiKeys.openai });
        const stream = await openai.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        });

        for await (const chunk of stream) {
          if (chunk.choices[0]?.delta?.content) {
            accumulatedText += chunk.choices[0].delta.content;
            streamTracker.updateResponse(model, accumulatedText);
          }
        }
      }
      // Add handlers for other models here
      
      streamTracker.updateResponse(model, accumulatedText, true);
    };

    await streamProcessor.processRequests({ [model]: modelRequest });
  } catch (error) {
    streamTracker.handleError(model, error);
  }
}