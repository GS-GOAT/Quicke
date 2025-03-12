import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { ParallelRequestProcessor } from '../../utils/parallelProcessor';

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

  // Basic request verification
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const { prompt, models, apiKeys } = req.query;
  const modelArray = models ? models.split(',') : [];
  
  // Parse API keys if provided
  let parsedApiKeys = {};
  try {
    if (apiKeys) {
      parsedApiKeys = JSON.parse(decodeURIComponent(apiKeys));
    }
  } catch (error) {
    console.error('Error parsing API keys:', error);
  }

  // Initialize API clients with provided keys or fallback to environment variables
  const openai = new OpenAI({ 
    apiKey: parsedApiKeys.openai || process.env.OPENAI_API_KEY 
  });
  
  const anthropic = new Anthropic({ 
    apiKey: parsedApiKeys.anthropic || process.env.ANTHROPIC_API_KEY 
  });
  
  const genAI = new GoogleGenerativeAI(
    parsedApiKeys.google || process.env.GOOGLE_API_KEY
  );

  // Initialize OpenRouter client
  const openRouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: parsedApiKeys.openrouter || process.env.OPENROUTER_API_KEY,
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

  try {
    // Process each model stream independently
    const modelPromises = modelArray.map(async (modelId) => {
      try {
        // Initial state
        sendEvent({
          model: modelId,
          text: '',
          loading: true,
          streaming: true
        });

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
        sendEvent({
          model: modelId,
          error: error.message,
          loading: false,
          streaming: false,
          done: true
        });
      }
    });

    // Process all streams concurrently
    await Promise.all(modelPromises);
    
    // Signal completion
    sendEvent({ done: true });
    res.end();
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
    console.error('OpenAI streaming error:', error);
    sendEvent({ model, error: error.message });
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
    console.error('Claude streaming error:', error);
    sendEvent({ model: 'claude', error: error.message });
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