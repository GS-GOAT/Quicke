import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyRequest } from './auth/verifyRequest';

export default async function handler(req, res) {
  // Only allow GET requests for SSE
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic request verification
  if (!verifyRequest(req)) {
    return res.status(403).json({ error: 'Unauthorized request' });
  }

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
    'mistral-medium': {
      id: 'mistralai/mistral-medium',
      name: 'Mistral Medium'
    },
    'mixtral': {
      id: 'mistralai/mixtral-8x7b',
      name: 'Mixtral 8x7B'
    },
    'llama2-70b': {
      id: 'meta-llama/llama-2-70b-chat',
      name: 'Llama-2 70B'
    },
    'solar': {
      id: 'upstage/solar-0-70b-16bit',
      name: 'Solar 70B'
    },
    'phi2': {
      id: 'microsoft/phi-2',
      name: 'Phi-2'
    },
    'qwen': {
      id: 'qwen/qwen1.5-72b',
      name: 'Qwen 72B'
    },
    'openchat': {
      id: 'openchat/openchat-3.5-0106',
      name: 'OpenChat 3.5'
    }
  };

  // Setup Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Helper function to send SSE
  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const modelPromises = [];

    // Handle standard API models
    if (modelArray.includes('gpt-4')) {
      modelPromises.push(handleOpenAIStream('gpt-4', prompt, sendEvent, openai));
    }

    if (modelArray.includes('claude')) {
      modelPromises.push(handleClaudeStream(prompt, sendEvent, anthropic));
    }

    if (modelArray.includes('gemini')) {
      modelPromises.push(handleGeminiStream(prompt, sendEvent, genAI));
    }

    // Handle OpenRouter models
    const openRouterPromises = modelArray
      .filter(modelId => openRouterModels[modelId])
      .map(modelId => handleOpenRouterStream(modelId, prompt, sendEvent, openRouter, openRouterModels));

    modelPromises.push(...openRouterPromises);

    await Promise.all(modelPromises);
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
    
    const modelOptions = ['gemini-pro', 'gemini-1.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
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
              sendEvent({ model: 'gemini', text, loading: true });
            }
          }
          
          // Final update with done flag
          if (text.length > 0) {
            console.log(`Gemini model ${modelName} succeeded with ${text.length} characters`);
            sendEvent({ model: 'gemini', text, loading: false, done: true });
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
              sendEvent({ model: 'gemini', text, loading: false, done: true });
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
  try {
    // Send initial loading state
    sendEvent({ model: modelId, loading: true, text: '' });
    
    // Check if model exists in openRouterModels
    if (!openRouterModels[modelId]) {
      console.error(`OpenRouter model ${modelId} not found in model definitions`);
      sendEvent({ 
        model: modelId, 
        error: `Model definition not found for ${modelId}`,
        loading: false,
        done: true 
      });
      return;
    }
    
    const stream = await openRouter.chat.completions.create({
      model: openRouterModels[modelId].id,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      temperature: 0.7,
    });

    let text = '';
    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        text += chunk.choices[0].delta.content;
        sendEvent({ model: modelId, text, loading: true });
      }
    }
    
    // Send final response with done flag and loading set to false
    sendEvent({ model: modelId, text, loading: false, done: true });
    
    // If we didn't get any text, send an error
    if (!text.trim()) {
      sendEvent({ 
        model: modelId, 
        error: 'No response received from model. Please check your API key or try again.',
        loading: false,
        done: true
      });
    }
  } catch (error) {
    console.error(`OpenRouter (${modelId}) streaming error:`, error);
    sendEvent({ 
      model: modelId, 
      error: error.message || 'Error connecting to OpenRouter API',
      loading: false,
      done: true 
    });
  }
} 