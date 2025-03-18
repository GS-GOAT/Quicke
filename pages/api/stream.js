import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { ParallelRequestProcessor } from '../../utils/parallelProcessor';
import prisma from '../../lib/prisma';
import errorService, { ERROR_TYPES as IMPORTED_ERROR_TYPES, TIMEOUT_SETTINGS } from '../../utils/errorService';

const streamProcessor = new ParallelRequestProcessor({
  maxConcurrentRequests: 8,
  retryCount: 1,
  retryDelay: 500
});

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

  // Define sendErrorEvent at the top level to ensure it's in scope everywhere
  const sendErrorEvent = (modelId, errorType, text = '') => {
    try {
      const provider = getLLMProvider(modelId);
      let retryCount = 0;
      if (errorService && typeof errorService.getRetryCount === 'function') {
        retryCount = errorService.getRetryCount(modelId);
      }
      
      let errorMessage = '';
      if (errorService && typeof errorService.getErrorMessage === 'function') {
        errorMessage = errorService.getErrorMessage(errorType, modelId, provider);
      } else {
        // Fallback error messages if errorService isn't available
        switch(errorType) {
          case 'RATE_LIMIT':
            errorMessage = `${provider} rate limit exceeded. Please try again later.`;
            break;
          case 'API_KEY_MISSING':
            errorMessage = `${provider} API key is missing or invalid.`;
            break;
          case 'TIMEOUT':
            errorMessage = `${provider} response timed out.`;
            break;
          case 'EMPTY_RESPONSE':
            errorMessage = `${provider} returned an empty response.`;
            break;
          default:
            errorMessage = `Error with ${provider}: ${errorType}`;
        }
      }
      
      sendEvent({
        model: modelId,
        error: errorMessage,
        errorType,
        text,
        loading: false,
        streaming: false,
        done: true,
        retryCount: retryCount > 0 ? retryCount : undefined,
        maxRetries: (errorService && errorService.TIMEOUT_SETTINGS) ? 
          errorService.TIMEOUT_SETTINGS.MAX_RETRIES : 2
      });
    } catch (sendError) {
      console.error(`Failed to send error event for ${modelId}:`, sendError);
      // Emergency fallback - send a basic error message
      sendEvent({
        model: modelId,
        error: `Error with ${modelId}: ${errorType}`,
        errorType: 'UNKNOWN_ERROR',
        loading: false,
        streaming: false,
        done: true
      });
    }
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

  let completedResponses = 0;
  const totalModels = modelArray.length;
  
  // Track which models have completed to avoid double-counting
  const completedModels = new Set();

  const handleModelCompletion = (modelId) => {
    // Skip if this model was already marked as completed
    if (completedModels.has(modelId)) {
      return;
    }
    
    // Mark this model as completed
    completedModels.add(modelId);
    completedResponses++;
    
    console.log(`[${modelId}] Completed (${completedResponses}/${totalModels})`);
    
    if (completedResponses === totalModels) {
      // All models have completed - send single completion event
      console.log('All models have completed, ending response');
      sendEvent({
        done: true,
        allComplete: true  // This flag indicates all models are done
      });
      res.end();
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
        if (!errorService) {
          console.error('Error service is not initialized');
          return;
        }
        
        const stream = errorService.activeStreams.get(modelId);
        
        // Only timeout if we haven't received any chunks yet
        if (stream && !stream.hasReceivedChunk) {
          console.log(`[${modelId}] Model availability timeout after ${timeoutDuration/1000}s`);
          
          // Send model unavailable error
          sendErrorEvent(modelId, ERROR_TYPES.MODEL_UNAVAILABLE);
          
          // THIS IS CRITICAL: Mark this model as completed for the counter
          handleModelCompletion(modelId);
          
          // Clean up the stream - with safety check
          if (errorService && typeof errorService.unregisterStream === 'function') {
            errorService.unregisterStream(modelId);
          }
        }
      }, timeoutDuration);
      
      // Store the timer ID
      if (errorService && errorService.modelTimers) {
        errorService.modelTimers.set(`timeout_${modelId}`, timerId);
      }
    });

    // Process each model stream independently
    const modelPromises = modelArray.map(async (modelId) => {
      // First verify if user has the required API key
      if (!verifyApiKey(modelId, providerMap, userApiKeys)) {
        sendErrorEvent(modelId, ERROR_TYPES.API_KEY_MISSING);
        handleModelCompletion(modelId);
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
        // Process model-specific streams
        if (modelId === 'gpt-4') {
          await handleOpenAIStream(modelId, prompt, sendEvent, openai);
        } else if (modelId === 'claude') {
          await handleClaudeStream(prompt, sendEvent, anthropic);
        } else if (modelId === 'gemini') {
          await handleGeminiStream(prompt, sendEvent, genAI);
        } else if (openRouterModels[modelId]) {
          await handleOpenRouterStream(modelId, prompt, sendEvent, openRouter, openRouterModels);
        } else if (modelId.startsWith('custom-')) {
          await handleCustomModelStream(modelId, prompt, sendEvent, customModels);
        }
      } catch (error) {
        console.error(`Error with ${modelId}:`, error);
        
        // Determine error type
        let errorType = ERROR_TYPES.UNKNOWN_ERROR;
        if (errorService && typeof errorService.classifyError === 'function') {
          errorType = errorService.classifyError(error);
        }
        
        // Send error event
        sendErrorEvent(modelId, errorType);
      }

      // Always mark as completed, regardless of success or failure
      handleModelCompletion(modelId);
    });

    // Process all streams concurrently
    await Promise.all(modelPromises);

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
      sendErrorEvent('gemini', ERROR_TYPES.MODEL_UNAVAILABLE);
    }
  } catch (error) {
    console.error('Gemini streaming error:', error);
    sendErrorEvent('gemini', ERROR_TYPES.UNKNOWN_ERROR);
  }
}

const SLOW_MODELS = ['qwen-32b', 'deepseek-r1'];
const TIMEOUT_THRESHOLD = 180000; // 3 minutes in milliseconds

async function handleOpenRouterStream(modelId, prompt, sendEvent, openRouter, openRouterModels) {
  const startTime = Date.now();
  let hasStartedResponse = false;
  let timeoutCheck;
  let hasReceivedContent = false;
  let tokenCount = 0;

  // Create abort controller for manual cancellation
  const abortController = new AbortController();
  
  // Set up cleanup function
  const cleanup = () => {
    if (timeoutCheck) clearTimeout(timeoutCheck);
    abortController.abort();
    console.log(`[${modelId}] Stream cleanup completed`);
  };

  try {
    // Add safety check for errorService
    if (errorService && typeof errorService.registerStream === 'function') {
      errorService.registerStream(modelId, cleanup);
    } else {
      console.warn(`[${modelId}] Error service not available for registration`);
    }
    
    // Send initial loading state
    sendEvent({ 
      model: modelId, 
      loading: true, 
      streaming: true,
      text: ''
    });
    
    if (!openRouterModels[modelId]) {
      throw new Error(`Model ${modelId} not found in OpenRouter models`);
    }

    // Use standard timeout (60 seconds as fallback if TIMEOUT_SETTINGS not available)
    const timeoutDuration = (errorService && errorService.TIMEOUT_SETTINGS) ? 
      errorService.TIMEOUT_SETTINGS.INITIAL_RESPONSE : 60000;
    
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise((_, reject) => {
      timeoutCheck = setTimeout(() => {
        if (!hasStartedResponse) {
          console.log(`[${modelId}] Initial response timeout after ${timeoutDuration}ms`);
          reject(new Error('TIMEOUT'));
        }
      }, timeoutDuration);
    });

    // Wrap the OpenRouter API call in a try/catch to handle specific errors
    let streamPromise;
    try {
      streamPromise = openRouter.chat.completions.create({
        model: openRouterModels[modelId].id,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        temperature: 0.7,
        max_tokens: 4000,
        presence_penalty: 0,
        frequency_penalty: 0,
        stop: null,
        signal: abortController.signal
      });
    } catch (err) {
      // Handle initialization errors (like invalid API key)
      console.error(`[${modelId}] Error creating OpenRouter stream:`, err);
      
      // Check for specific error types
      if (err.status === 401 || err.status === 403) {
        throw new Error('API_KEY_MISSING');
      } else if (err.status === 429 || (err.message && err.message.toLowerCase().includes('rate limit'))) {
        throw new Error('RATE_LIMIT');
      } else {
        throw err; // Re-throw for general error handling
      }
    }

    // Race between timeout and stream
    const stream = await Promise.race([streamPromise, timeoutPromise]);

    let text = '';
    let lastUpdateTime = Date.now();
    
    // Add another try/catch specifically for stream processing
    try {
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
          if (!hasStartedResponse) {
            hasStartedResponse = true;
            clearTimeout(timeoutCheck);
            console.log(`[${modelId}] First chunk received`);
          }

          const content = chunk.choices[0].delta.content;
          
          // Update stream status in error service (with safety check)
          if (errorService && typeof errorService.updateStream === 'function') {
            errorService.updateStream(modelId);
          }
          
          // Mark as received content if not just whitespace
          if (content.trim()) {
            hasReceivedContent = true;
          }
          
          text += content;
          tokenCount++;
          
          // Throttle updates to reduce client load
          const currentTime = Date.now();
          if (currentTime - lastUpdateTime > 50) {
            sendEvent({ 
              model: modelId, 
              text, 
              loading: false,
              streaming: true,
              error: null // Clear any previous errors
            });
            lastUpdateTime = currentTime;
          }
        }
      }
    } catch (streamError) {
      console.error(`[${modelId}] Error processing stream:`, streamError);
      
      // Check for rate limit errors
      if (streamError.code === 429 || 
          (streamError.message && streamError.message.toLowerCase().includes('rate limit')) ||
          (streamError.error && streamError.error.code === 429)) {
        throw new Error('RATE_LIMIT');
      }
      
      throw streamError; // Re-throw for general error handling
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[${modelId}] Completed in ${duration}s with ${tokenCount} tokens`);
    
    // Handle empty responses - if no meaningful content was received
    if (tokenCount === 0 || (!text.trim() && !hasReceivedContent)) {
      console.log(`[${modelId}] Empty response detected (0 tokens)`);
      
      // Clean up resources (with safety check)
      if (errorService && typeof errorService.unregisterStream === 'function') {
        errorService.unregisterStream(modelId);
      }
      
      // Try again if we should retry empty responses (with safety check)
      let shouldRetry = false;
      if (errorService && typeof errorService.shouldRetry === 'function') {
        shouldRetry = errorService.shouldRetry(modelId, ERROR_TYPES.EMPTY_RESPONSE);
      }
      
      if (shouldRetry) {
        let retryCount = 0;
        if (errorService && typeof errorService.getRetryCount === 'function') {
          retryCount = errorService.getRetryCount(modelId);
        }
        
        sendEvent({
          model: modelId,
          text: '',
          loading: true,
          streaming: false,
          retrying: true,
          retryCount: retryCount,
          maxRetries: (errorService && errorService.TIMEOUT_SETTINGS) ? 
            errorService.TIMEOUT_SETTINGS.MAX_RETRIES : 2
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second fallback retry delay
        
        // Try again
        return handleOpenRouterStream(modelId, prompt, sendEvent, openRouter, openRouterModels);
      }
      
      // If we've exhausted retries, send empty response error
      sendErrorEvent(modelId, ERROR_TYPES.EMPTY_RESPONSE);
      return null;
    }

    // Stream completed successfully with content
    if (errorService && typeof errorService.unregisterStream === 'function') {
      errorService.unregisterStream(modelId);
    }
    
    // Send final update
    sendEvent({ 
      model: modelId, 
      text, 
      loading: false, 
      streaming: false,
      error: null,
      done: true 
    });
    
    return {
      text,
      loading: false,
      streaming: false,
      done: true,
      duration
    };
  } catch (error) {
    // Clean up
    if (timeoutCheck) clearTimeout(timeoutCheck);
    
    // Unregister stream (with safety check)
    if (errorService && typeof errorService.unregisterStream === 'function') {
      errorService.unregisterStream(modelId);
    } else {
      console.warn(`[${modelId}] Error service not available for error handling`);
    }
    
    console.error(`[${modelId}] Error:`, error);
    
    // Classify the error with robust error type detection
    let errorType = ERROR_TYPES.UNKNOWN_ERROR;
    
    if (error.message === 'TIMEOUT') {
      errorType = ERROR_TYPES.TIMEOUT;
    } else if (error.message === 'API_KEY_MISSING') {
      errorType = ERROR_TYPES.API_KEY_MISSING;
    } else if (error.message === 'RATE_LIMIT') {
      errorType = ERROR_TYPES.RATE_LIMIT;
    } else if (error.message === 'NO_RESPONSE' || (error.message && error.message.includes('NO_RESPONSE'))) {
      errorType = ERROR_TYPES.EMPTY_RESPONSE;
    } else if (error.code === 429 || (error.error && error.error.code === 429)) {
      errorType = ERROR_TYPES.RATE_LIMIT;
    } else if (error.message && error.message.toLowerCase().includes('rate limit')) {
      errorType = ERROR_TYPES.RATE_LIMIT;
    } else if (error.message && error.message.toLowerCase().includes('free-models-per-day')) {
      errorType = ERROR_TYPES.RATE_LIMIT;
    } else if (errorService && typeof errorService.classifyError === 'function') {
      errorType = errorService.classifyError(error);
    }
    
    // Handle retry logic (with safety check)
    let shouldRetry = false;
    
    // Don't retry rate limit errors - they won't succeed
    if (errorType === ERROR_TYPES.RATE_LIMIT) {
      shouldRetry = false;
    } else if (errorService && typeof errorService.shouldRetry === 'function') {
      shouldRetry = errorService.shouldRetry(modelId, errorType);
    }
    
    if (shouldRetry) {
      let retryCount = 0;
      if (errorService && typeof errorService.getRetryCount === 'function') {
        retryCount = errorService.getRetryCount(modelId);
      }
      
      sendEvent({
        model: modelId,
        text: '',
        loading: true,
        streaming: false,
        retrying: true,
        retryCount: retryCount,
        maxRetries: (errorService && errorService.TIMEOUT_SETTINGS) ? 
          errorService.TIMEOUT_SETTINGS.MAX_RETRIES : 2
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second fallback retry delay
      
      // Try again
      return handleOpenRouterStream(modelId, prompt, sendEvent, openRouter, openRouterModels);
    }
    
    // If we've exhausted retries or should not retry, send appropriate error
    const maxRetries = (errorService && errorService.TIMEOUT_SETTINGS) ? 
      errorService.TIMEOUT_SETTINGS.MAX_RETRIES : 2;
    let retryCount = 0;
    if (errorService && typeof errorService.getRetryCount === 'function') {
      retryCount = errorService.getRetryCount(modelId);
    }
    
    if (retryCount >= maxRetries && errorType !== ERROR_TYPES.RATE_LIMIT) {
      sendErrorEvent(modelId, ERROR_TYPES.MAX_RETRIES_EXCEEDED);
    } else {
      sendErrorEvent(modelId, errorType);
    }
    
    return null;
  }
}

async function handleCustomModelStream(modelId, prompt, sendEvent, customModels) {
  const customModel = customModels.find(model => model.id === modelId);
  if (!customModel) {
    sendErrorEvent(modelId, ERROR_TYPES.UNKNOWN_ERROR, 'Custom model configuration not found');
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
        sendErrorEvent(modelId, ERROR_TYPES.EMPTY_RESPONSE);
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
      sendErrorEvent(modelId, ERROR_TYPES.MAX_RETRIES_EXCEEDED);
    } else {
      sendErrorEvent(modelId, errorType);
    }
    
    return null;
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

// Helper function to verify if user has the required API key
const verifyApiKey = (modelId, providerMap, userApiKeys) => {
  const provider = providerMap[modelId];
  return provider && userApiKeys[provider] ? true : false;
};