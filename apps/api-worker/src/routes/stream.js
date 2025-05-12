const express = require('express');
const { OpenAI } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PrismaClient } = require('../../node_modules/.prisma/client');
const prisma = new PrismaClient();
const { 
  ERROR_TYPES: IMPORTED_ERROR_TYPES, 
  TIMEOUT_SETTINGS, 
  streamUtils, 
  errorService, 
  handleUnifiedModelStream, 
  contextTracker, 
  getConversationContext,
  formatMessagesWithMedia
} = require('@quicke/utils');

// Remove MAX_RETRIES_EXCEEDED from error types since we're removing automatic retries
const FALLBACK_ERROR_TYPES = {
  API_KEY_MISSING: 'API_KEY_MISSING',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INSUFFICIENT_QUOTA: 'INSUFFICIENT_QUOTA'
};

// Use the imported values with a fallback if needed
const ERROR_TYPES = errorService?.ERROR_TYPES || IMPORTED_ERROR_TYPES || FALLBACK_ERROR_TYPES;

const router = express.Router();

const providerMap = {
  'gpt-4.5-preview': 'openai',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'o1': 'openai',
  'o3-mini': 'openai',
  'o1-mini': 'openai',
  'gpt-4o-mini-or': 'openrouter',
  // Google
  'gemini-flash': 'google',
  'gemini-flash-2.5': 'google',
  'gemini-lite': 'google',
  'gemini-thinking': 'google',
  'gemini-2.5-pro': 'google',
  // Official DeepSeek models
  'deepseek-chat': 'deepseek',
  'deepseek-coder': 'deepseek',
  'deepseek-reasoner': 'deepseek',
  // Map of OpenRouter models 
  'deepseek-distill': 'openrouter',
  'deepseek-v3-openrouter': 'openrouter',
  'mistral-7b': 'openrouter',
  'llama2-70b': 'openrouter',
  'phi3': 'openrouter',
  'qwen-32b': 'openrouter',
  'openchat': 'openrouter',
  'nemotron-70b': 'openrouter',
  'mistral-small-3': 'openrouter',
  'mistral-small-31': 'openrouter',
  'mistral-nemo': 'openrouter',
  'deepseek-v3-0324': 'openrouter',
  'nvidia/llama-3.1-nemotron-nano-8b-v1:free': 'openrouter',
  'nvidia/llama-3.3-nemotron-super-49b-v1:free': 'openrouter',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1:free': 'openrouter',
  'deepseek/deepseek-r1:free': 'openrouter',
  'deepseek/deepseek-r1-zero:free': 'openrouter',
  'meta-llama/llama-3.2-11b-vision-instruct:free': 'openrouter',
  'meta-llama/llama-3.1-8b-instruct:free': 'openrouter',
  // Anthropic
  'claude-3-7': 'anthropic',
  'claude-3-5': 'anthropic',
};

// Model version mappings
const openAIModels = {
  'gpt-4.5-preview': 'gpt-4.5-preview-2025-02-27',
  'gpt-4o': 'gpt-4o-2024-08-06',
  'gpt-4o-mini': 'gpt-4o-mini-2024-07-18',
  'o1': 'o1-2024-12-17',
  'o3-mini': 'o3-mini-2025-01-31',
  'o1-mini': 'o1-mini-2024-09-12'
};

const claudeModels = {
  'claude-3-7': 'claude-3-7-sonnet-20250219',
  'claude-3-5': 'claude-3-5-sonnet-20250219'
};

const deepseekModels = {
  'deepseek-chat': 'chat',
  'deepseek-coder': 'coder',
  'deepseek-reasoner': 'reasoner'
};

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
  'mistral-small-31': {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    name: 'Mistral Small 3.1'
  },
  'mistral-nemo': {
    id: 'mistralai/mistral-nemo:free',
    name: 'Mistral Nemo'
  },
  'deepseek-v3-0324': {
    id: 'deepseek/deepseek-chat-v3-0324:free',
    name: 'DeepSeek V3 0324'
  },
  'nvidia/llama-3.1-nemotron-nano-8b-v1:free': {
    id: 'nvidia/llama-3.1-nemotron-nano-8b-v1:free',
    name: 'Nemotron Nano 8B'
  },
  'nvidia/llama-3.3-nemotron-super-49b-v1:free': {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1:free',
    name: 'Nemotron Super 49B'
  },
  'nvidia/llama-3.1-nemotron-ultra-253b-v1:free': {
    id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
    name: 'Nemotron Ultra 253B'
  },
  'meta-llama/llama-3.2-11b-vision-instruct:free': {
    id: 'meta-llama/llama-3.2-11b-vision-instruct:free',
    name: 'Llama 3.2 Vision'
  },
  'meta-llama/llama-3.1-8b-instruct:free': {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B'
  },
  'deepseek/deepseek-r1:free': {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1'
  },
  'deepseek/deepseek-r1-zero:free': {
    id: 'deepseek/deepseek-r1-zero:free',
    name: 'DeepSeek R1 Zero'
  },
  'deepseek/deepseek-prover-v2:free': {
    id: 'deepseek/deepseek-prover-v2:free',
    name: 'DeepSeek Prover V2'
  },
  'qwen/qwen3-30b-a3b:free': {
    id: 'qwen/qwen3-30b-a3b:free',
    name: 'Qwen3 30B A3B'
  },
  'qwen/qwen3-235b-a22b:free': {
    id: 'qwen/qwen3-235b-a22b:free',
    name: 'Qwen3 235B A22B'
  },
  'microsoft/mai-ds-r1:free': {
    id: 'microsoft/mai-ds-r1:free',
    name: 'Microsoft MAI DS R1'
  },
  'tngtech/deepseek-r1t-chimera:free': {
    id: 'tngtech/deepseek-r1t-chimera:free',
    name: 'TNG DeepSeek R1T Chimera'
  },
  'qwen/qwen3-0.6b-04-28:free': {
    id: 'qwen/qwen3-0.6b-04-28:free',
    name: 'Qwen3 0.6B'
  },
  'microsoft/phi-4-reasoning:free': {
    id: 'microsoft/phi-4-reasoning:free',
    name: 'Phi 4 Reasoning'
  },
  'microsoft/phi-4-reasoning-plus:free': {
    id: 'microsoft/phi-4-reasoning-plus:free',
    name: 'Phi 4 Reasoning Plus'
  }
};

const geminiModels = {
  'gemini-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash'
  },
  'gemini-flash-2.5': {
    id: 'gemini-2.5-flash-preview-04-17',
    name: 'Gemini 2.5 Flash'
  },
  'gemini-lite': {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Pro'
  },
  'gemini-thinking': {
    id: 'gemini-2.0-flash-thinking-exp-01-21',
    name: 'Gemini 2.0 Flash Thinking'
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro-exp-03-25',
    name: 'Gemini 2.5 Pro'
  }
};

// Helper functions
const createCompletionManager = (totalModels, sendEvent, res) => {
  const completedModels = new Set();
  let completedResponses = 0;
  let responseEnded = false;

  const safelyEndResponse = () => {
    if (!responseEnded && !res.writableEnded) {
      responseEnded = true;
      try {
        sendEvent({ done: true, allComplete: true });
        res.end();
      } catch (error) {
        console.error('[SSE Stream] Error ending response:', error);
      }
    }
  };

  const markCompleted = (modelId) => {
    if (completedModels.has(modelId)) return;
    
    completedModels.add(modelId);
    completedResponses++;
    
    console.log(`[${modelId}] Completed (${completedResponses}/${totalModels})`);
    
    if (errorService?.modelTimers) {
      const timerId = errorService.modelTimers.get(`timeout_${modelId}`);
      if (timerId) {
        clearTimeout(timerId);
        errorService.modelTimers.delete(`timeout_${modelId}`);
      }
    }
    
    setTimeout(() => {
      if (completedResponses === totalModels) {
        console.log('All model streams processed, sending allComplete event');
        safelyEndResponse();
      }
    }, 1000);
  };

  const safetyTimeout = setTimeout(() => {
    if (!responseEnded) {
      console.warn(`[SSE Stream] Safety timeout triggered after ${completedResponses}/${totalModels} models`);
      safelyEndResponse();
    }
  }, 120000);

  return {
    markCompleted,
    isCompleted: (modelId) => completedModels.has(modelId),
    getCompletedCount: () => completedResponses,
    completedModels,
    cleanup: () => {
      clearTimeout(safetyTimeout);
    }
  };
};

const createErrorHandler = (completionManager, sendEvent) => {
  const sendErrorEvent = (modelId, errorType, text = '') => {
    try {
      console.log(`[${modelId}] Sending error event: ${errorType}`);
      
      let modelName = modelId;
      
      if (openRouterModels && openRouterModels[modelId] && openRouterModels[modelId].name) {
        modelName = openRouterModels[modelId].name;
      } else if (geminiModels && geminiModels[modelId] && geminiModels[modelId].name) {
        modelName = geminiModels[modelId].name;
      }
      
      const errorMessage = errorService?.getErrorMessage?.(errorType, modelName) 
        || `Error with ${modelName}: ${errorType}`;
      
      sendEvent({
        model: modelId,
        error: errorMessage,
        errorType,
        text,
        loading: false,
        streaming: false,
        done: true
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

const createSafeEventSender = (res) => {
  return (data) => {
    if (res.writableEnded) {
      console.warn(`[SSE Stream] Attempted write after stream ended: ${JSON.stringify(data).substring(0, 60)}...`);
      return;
    }

    try {
      const event = `data: ${JSON.stringify(data)}\n\n`;
      res.write(event);
      res.flush?.();
    } catch (e) {
      console.error('[SSE Stream] Error sending event:', e);
    }
  };
};

// Helper function to verify if user has the required API key
const verifyApiKey = (modelId, providerMap, userApiKeys) => {
  const provider = providerMap[modelId];
  return provider && userApiKeys[provider] ? true : false;
};

// Model handler functions
async function handleOpenAIStream(modelId, messages, sendEvent, openai) {
  const formattedMessages = Array.isArray(messages) 
    ? messages 
    : [{ role: 'user', content: messages }];
  
  console.log(`OpenAI: Using model ${modelId} with ${formattedMessages.length} messages`);
  
  return handleUnifiedModelStream({
    modelId,
    prompt: formattedMessages,
    sendEvent,
    client: openai,
    provider: 'openai',
    generateStream: () => openai.chat.completions.create({
      model: openAIModels[modelId] || modelId,
      messages: formattedMessages,
      stream: true,
    }),
    processChunk: chunk => chunk.choices[0]?.delta?.content
  });
}

async function handleClaudeStream(modelId, messages, sendEvent, anthropic) {
  const formattedMessages = Array.isArray(messages) 
    ? messages 
    : [{ role: 'user', content: messages }];
  
  console.log(`Claude: Using model ${modelId} with ${formattedMessages.length} messages`);
  
  return handleUnifiedModelStream({
    modelId,
    prompt: formattedMessages,
    sendEvent,
    client: anthropic,
    provider: 'anthropic',
    generateStream: () => anthropic.messages.create({
      model: claudeModels[modelId] || 'claude-3-5-sonnet-20250219',
      max_tokens: 5000,
      messages: formattedMessages,
      stream: true,
    }),
    processChunk: chunk => chunk.type === 'content_block_delta' && chunk.delta.text ? chunk.delta.text : ''
  });
}

async function handleGeminiStream(modelId, messages, sendEvent, genAI, geminiModels) {
  const modelInfo = geminiModels[modelId];
  if (!modelInfo) {
    throw new Error(`Invalid Gemini model: ${modelId}`);
  }
  
  const geminiMessages = Array.isArray(messages) 
    ? messages 
    : [{ role: 'user', parts: [{ text: messages }] }];
  
  console.log(`Gemini: Using model ${modelInfo.id} with ${geminiMessages.length} messages`);
  
  return handleUnifiedModelStream({
    modelId,
    prompt: geminiMessages,
    sendEvent,
    client: genAI,
    provider: 'google',
    generateStream: async () => {
      const geminiModel = genAI.getGenerativeModel({ 
        model: modelInfo.id,
        api_version: 'v1alpha',
        ...(modelInfo.id !== 'gemini-2.0-flash-thinking-exp-01-21' && {
          tools: [{ 'google_search': {} }]
        })
      });
      
      const generationConfig = {
        temperature: 1.0,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 12192,
      };
      
      const response = await geminiModel.generateContentStream({
        contents: geminiMessages,
        generationConfig
      });
      
      return response.stream;
    },
    processChunk: chunk => chunk.text()
  });
}

async function handleOpenRouterStream(modelId, messages, sendEvent, openRouter, openRouterModels) {
  const formattedMessages = Array.isArray(messages) 
    ? messages 
    : [{ role: 'user', content: messages }];
  
  console.log(`OpenRouter: Using model ${modelId} with ${formattedMessages.length} messages`);
  
  const modelInfo = openRouterModels[modelId];
  
  return handleUnifiedModelStream({
    modelId,
    prompt: formattedMessages,
    sendEvent,
    client: openRouter,
    provider: 'openrouter',
    generateStream: () => openRouter.chat.completions.create({
      model: modelInfo?.id || modelId,
      messages: formattedMessages,
      stream: true,
      transforms: ["middle-out"],
    }),
    processChunk: chunk => chunk.choices && chunk.choices[0]?.delta?.content,
    customErrorHandler: (error) => {
      console.error(`OpenRouter error for ${modelId}:`, error);
      
      if (error.error?.message?.includes('free-models-per-day')) {
        return {
          errorType: ERROR_TYPES.RATE_LIMIT,
          errorMessage: `OpenRouter: Rate limit exceeded for free tier for today. Add credits at openrouter.ai to continue using this model or wait till the quota resets.`
        };
      }
      
      if (error.status === 402 || error.error?.code === 402) {
        return {
          errorType: ERROR_TYPES.INSUFFICIENT_BALANCE,
          errorMessage: `OpenRouter: Insufficient credits for ${modelId}. Please add more credits at openrouter.ai/settings/credits`
        };
      }
      
      if (error.error?.message?.includes("maximum context length") || 
          error.error?.message?.includes("token limit")) {
        return {
          errorType: ERROR_TYPES.TOKEN_LIMIT_EXCEEDED,
          errorMessage: `OpenRouter: Token limit exceeded for ${modelId}. Try with a smaller prompt or image.`
        };
      }
      
      if (error.status === 429 || error.error?.code === 429) {
        return {
          errorType: ERROR_TYPES.RATE_LIMIT,
          errorMessage: `OpenRouter: Rate limit exceeded for ${modelId}. Please try again later.`
        };
      }
      
      return null;
    }
  });
}

async function handleDeepSeekStream(modelId, messages, sendEvent, deepseek) {
  const formattedMessages = Array.isArray(messages) 
    ? messages 
    : [{ role: 'user', content: messages }];
  
  console.log(`DeepSeek: Using model ${modelId} with ${formattedMessages.length} messages`);
  
  return handleUnifiedModelStream({
    modelId,
    prompt: formattedMessages,
    sendEvent,
    client: deepseek,
    provider: 'deepseek',
    generateStream: () => deepseek.chat.completions.create({
      model: modelId,
      messages: formattedMessages,
      stream: true,
    }),
    processChunk: chunk => chunk.choices[0]?.delta?.content
  });
}

// Main route handler
router.get('/', async (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });

  // Handle summarizer requests
  if (req.query.isSummarizer === 'true') {
    try {
      console.log('[Summary] Starting summary generation');
      const responses = JSON.parse(req.query.responses);
      
      console.log('[Summary] Input responses:', Object.keys(responses).length);
      
      const userId = req.user.id;
      const apiKey = await prisma.apiKey.findFirst({
        where: { userId, provider: 'google' },
        select: { encryptedKey: true }
      });

      if (!apiKey) {
        console.error('[Summary] Missing Google API key');
        res.write(`data: ${JSON.stringify({
          error: 'Google API key required',
          loading: false,
          streaming: false,
          done: true
        })}\n\n`);
        return res.end();
      }

      const genAI = new GoogleGenerativeAI(apiKey.encryptedKey);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash',
        api_version: 'v1alpha'
      });

      // Format the responses in a more structured way
      const formattedResponses = Object.entries(responses)
        .map(([model, text]) => `${model}:\n${text}\n`)
        .join('\n---\n');

      const prompt = `Compare these AI responses and provide a concise synthesis highlighting key similarities and differences:

${formattedResponses}

Format your response as a clear, concise analysis.`;

      try {
        console.log('[Summary] Sending request to Gemini');
        
        // Send initial state immediately
        res.write(`data: ${JSON.stringify({
          text: '',
          loading: true,
          streaming: true
        })}\n\n`);

        const result = await model.generateContentStream({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.8,
            maxOutputTokens: 1000,
          },
        });

        console.log('[Summary] Stream started');
        let accumulatedText = '';

        // Process the stream
        for await (const chunk of result.stream) {
          if (res.writableEnded) {
            console.log('[Summary] Response ended early');
            break;
          }
          
          const content = chunk.text();
          if (content) {
            accumulatedText += content;
            
            res.write(`data: ${JSON.stringify({
              text: accumulatedText,
              loading: false,
              streaming: true
            })}\n\n`);
          }
        }

        // Send completion
        console.log('[Summary] Stream complete, sending final update');
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            text: accumulatedText,
            loading: false,
            streaming: false,
            done: true
          })}\n\n`);
          res.end();
        }

      } catch (streamError) {
        console.error('[Summary] Stream processing error:', streamError);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            error: 'Summary generation failed: ' + streamError.message,
            loading: false,
            streaming: false,
            done: true
          })}\n\n`);
          res.end();
        }
      }

      return;
    } catch (error) {
      console.error('[Summary] Fatal error:', error);
      res.write(`data: ${JSON.stringify({
        error: 'Summary generation failed: ' + error.message,
        loading: false,
        streaming: false,
        done: true
      })}\n\n`);
      return res.end();
    }
  }

  try {
    const userId = req.user.id;
    const { prompt, models, fileId, fileIds, threadId, conversationId, useContext } = req.query;
    const modelArray = models ? models.split(',') : [];
    
    // Initialize safe event sender and completion manager
    const sendEvent = createSafeEventSender(res);
    const completionManager = createCompletionManager(modelArray.length, sendEvent, res);
    const errorHandler = createErrorHandler(completionManager, sendEvent);

    // Get user's API keys from database
    const userApiKeys = {};
    try {
      const apiKeysRes = await prisma.apiKey.findMany({
        where: { userId },
        select: { provider: true, encryptedKey: true }
      });
      
      apiKeysRes.forEach(({ provider, encryptedKey }) => {
        userApiKeys[provider] = encryptedKey;
      });
    } catch (error) {
      console.error('Error fetching user API keys:', error);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({
          error: 'Failed to fetch API keys',
          done: true,
          allComplete: true
        })}\n\n`);
        return res.end();
      }
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
        defaultQuery: { transforms: ['middle'] },
        defaultHeaders: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
          'X-Title': 'Quicke - The AI ChatHub'
        }
      });
    }
    if (userApiKeys.deepseek) {
      deepseek = new OpenAI({
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: userApiKeys.deepseek
      });
    }

    // Set up timeouts for each model
    modelArray.forEach(modelId => {
      const timeoutDuration = TIMEOUT_SETTINGS.INITIAL_RESPONSE;
      
      console.log(`[${modelId}] Setting up availability timeout for ${timeoutDuration/1000}s`);
      
      const timerId = setTimeout(() => {
        try {
          console.log(`[${modelId}] Checking if model timed out after ${timeoutDuration/1000}s`);
          
          if (completionManager.isCompleted(modelId)) {
            console.log(`[${modelId}] Skipping timeout - model already completed`);
            return;
          }
          
          if (!errorService) {
            console.error('Error service is not initialized');
            errorHandler.sendErrorEvent(modelId, ERROR_TYPES.MODEL_UNAVAILABLE);
            completionManager.markCompleted(modelId);
            return;
          }
          
          const stream = errorService.activeStreams.get(modelId);
          
          if (!stream || !stream.hasReceivedChunk) {
            console.log(`[${modelId}] Model availability timeout after ${timeoutDuration/1000}s`);
            
            errorHandler.sendErrorEvent(modelId, ERROR_TYPES.MODEL_UNAVAILABLE);
            completionManager.markCompleted(modelId);
            
            if (errorService && typeof errorService.unregisterStream === 'function') {
              errorService.unregisterStream(modelId);
            }
          }
        } catch (timeoutError) {
          console.error(`[${modelId}] Error in timeout handler:`, timeoutError);
          errorHandler.sendErrorEvent(modelId, ERROR_TYPES.MODEL_UNAVAILABLE);
          completionManager.markCompleted(modelId);
        }
      }, timeoutDuration);
      
      if (errorService && errorService.modelTimers) {
        errorService.modelTimers.set(`timeout_${modelId}`, timerId);
      }
    });

    // Process each model stream independently
    const modelPromises = modelArray.map(async (modelId) => {
      try {
        // Skip if this model was already marked as unavailable
        if (completionManager.isCompleted(modelId)) {
          return;
        }
        
        // Verify if user has the required API key
        const provider = providerMap[modelId];
        if (!userApiKeys[provider]) {
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

        // Get formatted messages for this model
        const formattedMessages = formatMessagesWithMedia(prompt, [], modelId);

        // Process based on model type
        if (openAIModels[modelId]) {
          await handleOpenAIStream(modelId, formattedMessages, sendEvent, openai);
        } else if (claudeModels[modelId]) {
          await handleClaudeStream(modelId, formattedMessages, sendEvent, anthropic);
        } else if (geminiModels[modelId]) {
          console.log(`[DEBUG Gemini Payload for ${modelId}]: Preparing to send 'contents':`);
          if (!Array.isArray(formattedMessages)) {
            console.error("  ERROR: finalMessagesForModel IS NOT AN ARRAY!", formattedMessages);
          } else {
            formattedMessages.forEach((msg, index) => {
              console.log(`  [Msg ${index}] Role: ${msg.role}`);
              if (msg.parts && Array.isArray(msg.parts)) {
                console.log(`    Parts Array (${msg.parts.length} items):`);
                msg.parts.forEach((part, pIndex) => {
                  if (part.text !== undefined) {
                    console.log(`      Part ${pIndex}: text (length ${part.text.length})`);
                  } else if (part.inlineData) {
                    console.log(`      Part ${pIndex}: inlineData (mime ${part.inlineData.mimeType}, data snippet ${part.inlineData.data ? part.inlineData.data.substring(0,10)+'...' : 'N/A'})`);
                  }
                });
              } else if (msg.content !== undefined) {
                console.error("    ERROR: Message has 'content' field instead of 'parts'!", msg);
              } else {
                console.warn("    WARN: Message has NEITHER 'parts' NOR 'content':", msg);
              }
            });
          }

          // Ensure proper role alternation
          const validatedMessages = [];
          let lastRole = null;
          
          formattedMessages.forEach(msg => {
            if (msg.role === lastRole) {
              // Merge with previous message if same role
              const prevMsg = validatedMessages[validatedMessages.length - 1];
              if (prevMsg.parts && msg.parts) {
                msg.parts.forEach(part => {
                  if (part.text && prevMsg.parts.some(p => p.text)) {
                    // Merge text parts
                    const textPart = prevMsg.parts.find(p => p.text);
                    textPart.text += '\n' + part.text;
                  } else {
                    // Add non-text parts as is
                    prevMsg.parts.push(part);
                  }
                });
              }
            } else {
              // Ensure message has parts structure
              const validatedMsg = {
                role: msg.role,
                parts: msg.parts || (msg.content ? [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }] : [{ text: '' }])
              };
              validatedMessages.push(validatedMsg);
              lastRole = msg.role;
            }
          });

          console.log('Validated and merged messages:', 
            validatedMessages.map(m => ({
              role: m.role,
              partTypes: m.parts.map(p => Object.keys(p)[0])
            }))
          );

          await handleGeminiStream(modelId, validatedMessages, sendEvent, genAI, geminiModels);
        } else if (deepseekModels[modelId]) {
          await handleDeepSeekStream(modelId, formattedMessages, sendEvent, deepseek);
        } else if (openRouterModels[modelId]) {
          await handleOpenRouterStream(modelId, formattedMessages, sendEvent, openRouter, openRouterModels);
        }

        // Always mark as completed
        completionManager.markCompleted(modelId);
      } catch (error) {
        // Handle errors for individual models without affecting others
        console.error(`Error with ${modelId}:`, error);
        errorHandler.sendErrorEvent(modelId, ERROR_TYPES.UNKNOWN_ERROR);
        completionManager.markCompleted(modelId);
      }
    });

    // Process all streams concurrently
    await Promise.all(modelPromises);

    // final check to make sure all models were marked as completed
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
    
    // Clean up the completion manager
    if (completionManager.cleanup) {
      completionManager.cleanup();
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
    console.error('[SSE Stream] Fatal error:', error);
    
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ 
        error: 'Stream processing failed', 
        done: true, 
        allComplete: true 
      })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
