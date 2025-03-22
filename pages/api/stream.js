import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from '../../lib/prisma';
import errorService, { ERROR_TYPES as IMPORTED_ERROR_TYPES, TIMEOUT_SETTINGS } from '../../utils/errorService';

// Fallback error types in case errorService isn't initialized
const FALLBACK_ERROR_TYPES = {
  API_KEY_MISSING: 'API_KEY_MISSING',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Use the imported values with a fallback if needed
const ERROR_TYPES = errorService?.ERROR_TYPES || IMPORTED_ERROR_TYPES || FALLBACK_ERROR_TYPES;

// Create a completion manager first
const createCompletionManager = (totalModels, sendEvent, res) => {
  const completedModels = new Set();
  let completedResponses = 0;

  const markCompleted = (modelId) => {
    if (completedModels.has(modelId)) return;
    
    completedModels.add(modelId);
    completedResponses++;
    
    console.log(`[${modelId}] Completed (${completedResponses}/${totalModels})`);
    
    // Clear any pending timeouts
    if (errorService?.modelTimers) {
      const timerId = errorService.modelTimers.get(`timeout_${modelId}`);
      if (timerId) {
        clearTimeout(timerId);
        errorService.modelTimers.delete(`timeout_${modelId}`);
      }
    }
    
    if (completedResponses === totalModels) {
      console.log('All models completed, ending response');
      sendEvent({ done: true, allComplete: true });
      res.end();
    }
  };

  return {
    markCompleted,
    isCompleted: (modelId) => completedModels.has(modelId),
    getCompletedCount: () => completedResponses,
    completedModels // Expose Set for checking completion status
  };
};

// Move error handling to dedicated object
const createErrorHandler = (completionManager, sendEvent) => {
  const sendErrorEvent = (modelId, errorType, text = '') => {
    try {
      console.log(`[${modelId}] Sending error event: ${errorType}`);
      
      const provider = getLLMProvider(modelId);
      const retryCount = errorService?.getRetryCount?.(modelId) || 0;
      const errorMessage = errorService?.getErrorMessage?.(errorType, modelId, provider) 
        || `Error with ${provider}: ${errorType}`;
      
      sendEvent({
        model: modelId,
        error: errorMessage,
        errorType,
        text,
        loading: false,
        streaming: false,
        done: true,
        ...(retryCount > 0 && { retryCount }),
        maxRetries: TIMEOUT_SETTINGS.MAX_RETRIES
      });
      
      completionManager.markCompleted(modelId);
      
    } catch (sendError) {
      console.error(`Failed to send error event for ${modelId}:`, sendError);
      sendEvent({
        model: modelId,
        error: `Error with ${modelId}: ${errorType}`,
        errorType: 'UNKNOWN_ERROR',
        loading: false,
        streaming: false,
        done: true
      });
      completionManager.markCompleted(modelId);
    }
  };

  return { sendErrorEvent };
};

// Add helper function for API key verification
const verifyModelApiKeys = (modelArray, providerMap, userApiKeys) => {
  modelArray.forEach(modelId => {
    const provider = providerMap[modelId];
    if (!userApiKeys[provider]) {
      errorHandler.sendErrorEvent(modelId, ERROR_TYPES.API_KEY_MISSING);
    }
  });
};

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
  
  // Define providerMap at the top level to ensure it's in scope everywhere
  const providerMap = {
    'gpt-4.5-preview': 'openai',
    'gpt-4o': 'openai',
    'gpt-4o-mini': 'openai',
    'o1': 'openai',
    'o3-mini': 'openai',
    'o1-mini': 'openai',
    'claude': 'anthropic',
    'gemini': 'google',
    'gemini-pro': 'google',
    'gemini-thinking': 'google',
    // Official DeepSeek models
    'deepseek-chat': 'deepseek',
    'deepseek-coder': 'deepseek',
    'deepseek-reasoner': 'deepseek',
    // Map of OpenRouter models r
    'deepseek-distill': 'openrouter',
    'deepseek-v3-openrouter': 'openrouter',
    'mistral-7b': 'openrouter',
    'llama2-70b': 'openrouter',
    'phi3': 'openrouter',
    'qwen-32b': 'openrouter',
    'openchat': 'openrouter',
    'nemotron-70b': 'openrouter',
    'mistral-small-3': 'openrouter',
    'mistral-nemo': 'openrouter',
    // 'olympiccoder': 'openrouter'
  };

  // Add model version mapping
  const openAIModels = {
    'gpt-4.5-preview': 'gpt-4.5-preview-2025-02-27',
    'gpt-4o': 'gpt-4o-2024-08-06',
    'gpt-4o-mini': 'gpt-4o-mini-2024-07-18',
    'o1': 'o1-2024-12-17',
    'o3-mini': 'o3-mini-2025-01-31',
    'o1-mini': 'o1-mini-2024-09-12'
  };
  
  // Helper function to get provider name from model ID
  const getLLMProvider = (modelId) => {
    if (providerMap[modelId]) {
      return providerMap[modelId].charAt(0).toUpperCase() + providerMap[modelId].slice(1);
    }
    
    if (modelId && modelId.startsWith('custom-')) {
      return 'Custom Model';
    }
    
    return modelId || 'Unknown';
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

  // Initialize completion manager first
  const completionManager = createCompletionManager(modelArray.length, sendEvent, res);
  
  // Then create error handler with completion manager
  const errorHandler = createErrorHandler(completionManager, sendEvent);

  // Now verifyModelApiKeys will have access to errorHandler
  // Define verifyModelApiKeys with closure over errorHandler
  const verifyModelApiKeys = (modelArray, providerMap, userApiKeys) => {
    modelArray.forEach(modelId => {
      const provider = providerMap[modelId];
      if (!userApiKeys[provider]) {
        errorHandler.sendErrorEvent(modelId, ERROR_TYPES.API_KEY_MISSING);
      }
    });
  };

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

  // Initialize API clients only if keys exist
  let openai, anthropic, genAI, openRouter, deepseek;

  if (userApiKeys.openai) {
    openai = new OpenAI({ apiKey: userApiKeys.openai });
  }
  if (userApiKeys.anthropic) {
    anthropic = new Anthropic({ apiKey: userApiKeys.anthropic });
  }
  if (userApiKeys.google) {
    genAI = new GoogleGenerativeAI(userApiKeys.google);
  }
  if (userApiKeys.openrouter) {
    openRouter = new OpenAI({
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
  }
  if (userApiKeys.deepseek) {
    deepseek = new OpenAI({
      baseURL: 'https://api.deepseek.com/v1',  // Add v1 to match DeepSeek's docs
      apiKey: userApiKeys.deepseek
    });
  }

  // Additional verification before processing streams
  const completedModels = new Set();
  verifyModelApiKeys(modelArray, providerMap, userApiKeys);

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
      id: 'qwen/qwen-2.5-coder-32b-instruct:free',
      name: 'Qwen Coder 32B'
    },
    'openchat': {
      id: 'openchat/openchat-7b:free',
      name: 'OpenChat 3.5'
    },
    'deepseek-distill': {  
      id: 'deepseek/deepseek-r1-distill-llama-70b:free',
      name: 'DeepSeek R1'
    },
    'deepseek-v3-openrouter': {
      id: 'deepseek/deepseek-chat:free',
      name: 'DeepSeek V3'
    },
    'nemotron-70b': {
      id: 'nvidia/llama-3.1-nemotron-70b-instruct:free',
      name: 'Nemotron 70B'
    },
    'mistral-small-3': {
      id: 'mistralai/mistral-small-24b-instruct-2501:free',
      name: 'Mistral Small 3'
    },
    'mistral-nemo': {
      id: 'mistralai/mistral-nemo',
      name: 'Mistral Nemo'
    },
    // 'olympiccoder': {
    //   id: 'open-r1/olympiccoder-7b:free',
    //   name: 'OlympicCoder 7B'
    // }
  };

  // Update geminiModels with debug logging
  const geminiModels = {
    'gemini': {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash'
    },
    'gemini-pro': {
      id: 'gemini-2.0-pro-exp-02-05',
      name: 'Gemini 2.0 Pro'
    },
    'gemini-thinking': {
      id: 'gemini-2.0-flash-thinking-exp-01-21',
      name: 'Gemini 2.0 Flash Thinking'
    }
  };

  try {
    // Get custom models from localStorage (passed in request)
    const customModels = JSON.parse(req.query.customModels || '[]');

    // Set up timeouts for each model - with proper completion handling
    modelArray.forEach(modelId => {
      // Use a standard timeout for all models
      const timeoutDuration = TIMEOUT_SETTINGS.INITIAL_RESPONSE;
      
      console.log(`[${modelId}] Setting up availability timeout for ${timeoutDuration/1000}s`);
      
      // Create a timeout that will fire if model hasn't responded in time
      const timerId = setTimeout(() => {
        try {
          console.log(`[${modelId}] Checking if model timed out after ${timeoutDuration/1000}s`);
          
          // Skip if this model is already completed
          if (completionManager.isCompleted(modelId)) {
            console.log(`[${modelId}] Skipping timeout - model already completed`);
            return;
          }
          
          if (!errorService) {
            console.error('Error service is not initialized');
            // Even if error service isn't initialized, we should still handle timeout
            errorHandler.sendErrorEvent(modelId, ERROR_TYPES.MODEL_UNAVAILABLE);
            completionManager.markCompleted(modelId);
            return;
          }
          
          const stream = errorService.activeStreams.get(modelId);
          
          // In production, the stream might not exist yet or might have a different structure
          // So make sure to handle that case
          if (!stream || !stream.hasReceivedChunk) {
            console.log(`[${modelId}] Model availability timeout after ${timeoutDuration/1000}s`);
            
            // Send model unavailable error
            errorHandler.sendErrorEvent(modelId, ERROR_TYPES.MODEL_UNAVAILABLE);
            
            // THIS IS CRITICAL: Mark this model as completed for the counter
            completionManager.markCompleted(modelId);
            
            // Clean up the stream - with safety check
            if (errorService && typeof errorService.unregisterStream === 'function') {
              errorService.unregisterStream(modelId);
            }
          }
        } catch (timeoutError) {
          // Log but don't rethrow - ensure the timeout logic completes
          console.error(`[${modelId}] Error in timeout handler:`, timeoutError);
          errorHandler.sendErrorEvent(modelId, ERROR_TYPES.MODEL_UNAVAILABLE);
          completionManager.markCompleted(modelId);
        }
      }, timeoutDuration);
      
      // Store the timer ID
      if (errorService && errorService.modelTimers) {
        errorService.modelTimers.set(`timeout_${modelId}`, timerId);
      }
    });

    // Process each model stream independently
    const modelPromises = modelArray.map(async (modelId) => {
      try {
        // First verify if user has the required API key
        if (!verifyApiKey(modelId, providerMap, userApiKeys)) {
          errorHandler.sendErrorEvent(modelId, ERROR_TYPES.API_KEY_MISSING);
          completionManager.markCompleted(modelId);
          return;
        }

        // Initial state for each model
        sendEvent({
          model: modelId,
          text: '',
          loading: true,
          streaming: false
        });

        // Process model-specific streams with individual error handling
        try {
          if (modelId === 'gpt-4') {
            await handleOpenAIStream(modelId, prompt, sendEvent, openai);
          } else if (modelId === 'claude') {
            await handleClaudeStream(prompt, sendEvent, anthropic);
          } else if (geminiModels[modelId]) {
            await handleGeminiStream(modelId, prompt, sendEvent, genAI, geminiModels);
          } else if (modelId.startsWith('deepseek-') && !openRouterModels[modelId]) {
            await handleDeepSeekStream(modelId, prompt, sendEvent, deepseek);
          } else if (openRouterModels[modelId]) {
            await handleOpenRouterStream(modelId, prompt, sendEvent, openRouter, openRouterModels);
          } else if (modelId.startsWith('custom-')) {
            await handleCustomModelStream(modelId, prompt, sendEvent, customModels);
          }
        } catch (error) {
          // Handle errors for individual models without affecting others
          console.error(`Error with ${modelId}:`, error);
          errorHandler.sendErrorEvent(modelId, ERROR_TYPES.UNKNOWN_ERROR);
        }

        // Always mark as completed
        completionManager.markCompleted(modelId);
      } catch (error) {
        // Catch any unexpected errors and ensure model completion
        console.error(`Unexpected error with ${modelId}:`, error);
        errorHandler.sendErrorEvent(modelId, ERROR_TYPES.UNKNOWN_ERROR);
        completionManager.markCompleted(modelId);
      }
    });

    // Process all streams concurrently
    await Promise.all(modelPromises);

    // Add a final check to make sure all models were marked as completed
    modelArray.forEach(modelId => {
      if (!completionManager.isCompleted(modelId)) {
        console.log(`[${modelId}] Was not marked as completed - forcing completion`);
        completionManager.markCompleted(modelId);
      }
    });

    // Make sure to clear timeouts at the end of processing
    try {
      modelArray.forEach(modelId => {
        if (errorService && errorService.modelTimers) {
          const timerId = errorService.modelTimers.get(`timeout_${modelId}`);
          if (timerId) {
            clearTimeout(timerId);
            errorService.modelTimers.delete(`timeout_${modelId}`);
          }
        }
      });
    } catch (cleanupError) {
      console.error('Error during timeout cleanup:', cleanupError);
    }
    
    // If we get here and still haven't ended the response, do it now
    if (!res.writableEnded) {
      console.log('Forcing response completion');
      sendEvent({
        done: true,
        allComplete: true
      });
      res.end();
    }
  } catch (error) {
    console.error('Streaming error:', error);
    sendEvent({ error: 'Failed to process streaming requests' });
    
    // Force ending the response in case of overall error
    if (!res.writableEnded) {
      res.end();
    }
  }
}

// Centralized stream handler utility
const createStreamHandler = (options) => {
  const { modelId, cleanup, timeoutDuration = 60000 } = options;
  let hasStartedResponse = false;
  let timeoutCheck;
  let timeoutRejected = false;

  const handleTimeout = (resolve, reject) => {
    timeoutCheck = setTimeout(() => {
      if (!hasStartedResponse) {
        timeoutRejected = true;
        cleanup?.();
        reject(new Error('TIMEOUT'));
      }
    }, timeoutDuration);
    return timeoutCheck;
  };

  return {
    init: async (streamPromise) => {
      try {
        const timeoutPromise = new Promise((_, reject) => handleTimeout(_, reject));
        const stream = await Promise.race([streamPromise, timeoutPromise]);
        clearTimeout(timeoutCheck);
        return stream;
      } catch (error) {
        if (timeoutRejected) {
          throw new Error('TIMEOUT');
        }
        throw error;
      }
    },
    markStarted: () => {
      hasStartedResponse = true;
      clearTimeout(timeoutCheck);
    },
    cleanup: () => {
      clearTimeout(timeoutCheck);
    }
  };
};

// Unified event sender with retry logic
const sendStreamEvent = async ({
  modelId,
  text,
  error,
  loading = false,
  streaming = false,
  done = false,
  sendEvent,
  retryCount,
  maxRetries
}) => {
  sendEvent({
    model: modelId,
    text,
    error,
    loading,
    streaming,
    done,
    ...(retryCount !== undefined && { retryCount }),
    ...(maxRetries !== undefined && { maxRetries })
  });
};

// Replace individual handlers with unified handler
async function handleModelStream(options) {
  const {
    modelId,
    prompt,
    sendEvent,
    client,
    generateStream,
    processChunk,
    processGeminiStream
  } = options;

  const streamHandler = createStreamHandler({
    modelId,
    cleanup: () => {
      if (errorService?.unregisterStream) {
        errorService.unregisterStream(modelId);
      }
    }
  });

  try {
    await sendStreamEvent({
      modelId,
      loading: true,
      sendEvent
    });

    const stream = await streamHandler.init(generateStream());
    let text = '';

    if (processGeminiStream) {
      // Handle Gemini's unique stream format
      for await (const chunk of stream.stream) {
        const content = processChunk(chunk);
        if (content) {
          text += content;
          streamHandler.markStarted();
          await sendStreamEvent({
            modelId,
            text,
            streaming: true,
            sendEvent
          });
        }
      }
    } else {
      // Handle standard streams
      for await (const chunk of stream) {
        const content = processChunk(chunk);
        if (content) {
          text += content;
          streamHandler.markStarted();
          await sendStreamEvent({
            modelId,
            text,
            streaming: true,
            sendEvent
          });
        }
      }
    }

    await sendStreamEvent({
      modelId,
      text,
      done: true,
      sendEvent
    });

  } catch (error) {
    console.error(`Stream error (${modelId}):`, error);
    const errorType = error.message === 'TIMEOUT' ? ERROR_TYPES.TIMEOUT :
                     error.message.includes('API key') ? ERROR_TYPES.API_KEY_MISSING :
                     ERROR_TYPES.UNKNOWN_ERROR;
    
    await sendStreamEvent({
      modelId,
      error: `Model error: ${error.message}`,
      errorType,
      done: true,
      sendEvent
    });
  } finally {
    streamHandler.cleanup();
  }
}

// Replace individual model handlers with unified handler calls
async function handleOpenAIStream(modelId, prompt, sendEvent, openai) {
  return handleModelStream({
    modelId,
    prompt,
    sendEvent,
    client: openai,
    generateStream: () => openai.chat.completions.create({
      model: openAIModels[modelId] || modelId,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }),
    processChunk: chunk => chunk.choices[0]?.delta?.content
  });
}

async function handleClaudeStream(prompt, sendEvent, anthropic) {
  return handleModelStream({
    modelId: 'claude',
    prompt,
    sendEvent,
    client: anthropic,
    generateStream: () => anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }),
    processChunk: chunk => chunk.type === 'content_block_delta' && chunk.delta.text ? chunk.delta.text : ''
  });
}

// Update Gemini stream handler to properly handle the stream format
async function handleGeminiStream(modelId, prompt, sendEvent, genAI, geminiModels) {
  return handleModelStream({
    modelId,
    prompt,
    sendEvent,
    client: genAI,
    generateStream: async () => {
      const model = geminiModels[modelId];
      if (!model) {
        throw new Error(`Invalid Gemini model: ${modelId}`);
      }
      const geminiModel = genAI.getGenerativeModel({ model: model.id });
      return await geminiModel.generateContentStream([{ text: prompt }]);
    },
    processGeminiStream: true, // Add flag to identify Gemini streams
    processChunk: chunk => {
      try {
        return chunk.text?.() || '';
      } catch (error) {
        console.error('Error processing Gemini chunk:', error);
        return '';
      }
    }
  });
}

async function handleDeepSeekStream(modelId, prompt, sendEvent, deepseek) {
  return handleModelStream({
    modelId,
    prompt,
    sendEvent,
    client: deepseek,
    generateStream: () => deepseek.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }),
    processChunk: chunk => chunk.choices[0]?.delta?.content
  });
}

async function handleOpenRouterStream(modelId, prompt, sendEvent, openRouter, openRouterModels) {
  return handleModelStream({
    modelId,
    prompt,
    sendEvent,
    client: openRouter,
    generateStream: () => openRouter.chat.completions.create({
      model: openRouterModels[modelId].id,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      temperature: 0.7,
      max_tokens: 4000,
      presence_penalty: 0,
      frequency_penalty: 0,
      stop: null
    }),
    processChunk: chunk => chunk.choices[0]?.delta?.content
  });
}

async function handleCustomModelStream(modelId, prompt, sendEvent, customModels) {
  const customModel = customModels.find(model => model.id === modelId);
  if (!customModel) {
    errorHandler.sendErrorEvent(modelId, ERROR_TYPES.UNKNOWN_ERROR, 'Custom model configuration not found');
    return null;
  }

  // Create abort controller for manual cancellation
  const abortController = new AbortController();
  let accumulatedText = '';
  
  // Setup cleanup function
  const cleanup = () => {
    abortController.abort();
    console.log(`[${modelId}] Stream cleanup completed`);
  };
  
  try {
    // Register with error service
    errorService.registerStream(modelId, cleanup);
    
    // Send initial loading state
    sendEvent({
      model: modelId,
      loading: true,
      streaming: true,
      text: ''
    });

    // Set up request with timeout
    const fetchPromise = fetch(customModel.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [customModel.apiKeyName]: customModel.apiKeyValue
      },
      body: JSON.stringify({
        prompt: prompt,
        stream: true
      }),
      signal: abortController.signal
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Custom model API timeout')), 
      TIMEOUT_SETTINGS.INITIAL_RESPONSE)
    );
    
    // Race between fetch and timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      throw new Error(`Custom model API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Update stream status
      errorService.updateStream(modelId);
      
      // Decode chunk
      const chunk = new TextDecoder().decode(value);
      try {
        // Try to parse JSON response
        const data = JSON.parse(chunk);
        if (data.text || data.content || data.response) {
          const newContent = data.text || data.content || data.response;
          accumulatedText += newContent;
          sendEvent({
            model: modelId,
            text: accumulatedText,
            loading: false,
            streaming: true
          });
        }
      } catch (e) {
        // If not JSON, treat as raw text
        accumulatedText += chunk;
        sendEvent({
          model: modelId,
          text: accumulatedText,
          loading: false,
          streaming: true
        });
      }
    }

    // Check if we got any content
    if (!accumulatedText.trim()) {
      console.log(`[${modelId}] Empty response received`);
      errorService.unregisterStream(modelId);
      
      // Try again if we should retry empty responses
      const retryCount = errorService.getRetryCount(modelId);
      if (errorService.shouldRetry(modelId, ERROR_TYPES.EMPTY_RESPONSE)) {
        sendEvent({
          model: modelId,
          text: '',
          loading: true,
          streaming: false,
          retrying: true,
          retryCount: retryCount,
          maxRetries: TIMEOUT_SETTINGS.MAX_RETRIES
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, TIMEOUT_SETTINGS.RETRY_DELAY));
        return handleCustomModelStream(modelId, prompt, sendEvent, customModels);
      } else {
        errorHandler.sendErrorEvent(modelId, ERROR_TYPES.EMPTY_RESPONSE);
        return null;
      }
    }
    
    // Stream completed successfully
    errorService.unregisterStream(modelId);
    
    sendEvent({
      model: modelId,
      text: accumulatedText,
      loading: false,
      streaming: false,
      done: true
    });
    
    return {
      text: accumulatedText,
      loading: false,
      streaming: false,
      done: true,
      duration: ((Date.now() - errorService.activeStreams.get(modelId)?.startTime || 0) / 1000).toFixed(1)
    };
  } catch (error) {
    console.error(`[${modelId}] Custom model error:`, error);
    errorService.unregisterStream(modelId);
    
    // Classify the error
    const errorType = errorService.classifyError(error);
    
    // Handle retry logic
    if (errorService.shouldRetry(modelId, errorType)) {
      const retryCount = errorService.getRetryCount(modelId);
      
      sendEvent({
        model: modelId,
        text: '',
        loading: true,
        streaming: false,
        retrying: true,
        retryCount: retryCount,
        maxRetries: TIMEOUT_SETTINGS.MAX_RETRIES
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, TIMEOUT_SETTINGS.RETRY_DELAY));
      
      // Try again
      return handleCustomModelStream(modelId, prompt, sendEvent, customModels);
    }
    
    // If we've run out of retries, send final error
    if (errorService.getRetryCount(modelId) >= TIMEOUT_SETTINGS.MAX_RETRIES) {
      errorHandler.sendErrorEvent(modelId, ERROR_TYPES.MAX_RETRIES_EXCEEDED);
    } else {
      errorHandler.sendErrorEvent(modelId, errorType);
    }
    
    return null;
  }
}

// Helper function to verify if user has the required API key
const verifyApiKey = (modelId, providerMap, userApiKeys) => {
  const provider = providerMap[modelId];
  return provider && userApiKeys[provider] ? true : false;
};