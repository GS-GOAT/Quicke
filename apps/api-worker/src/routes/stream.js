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
  getConversationContext,
  formatMessagesWithMedia
} = require('@quicke/utils');

// Define models guests can use on the backend for validation
const GUEST_ALLOWED_MODELS_BACKEND = ['gemini-flash', 'gemini-flash-2.5'];

// Remove MAX_RETRIES_EXCEEDED from error types since we're removing automatic retries
const FALLBACK_ERROR_TYPES = {
  API_KEY_MISSING: 'API_KEY_MISSING',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INSUFFICIENT_QUOTA: 'INSUFFICIENT_QUOTA',
  AUTH_REQUIRED: 'AUTH_REQUIRED'
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
  // New OpenRouter models
  'deepseek/deepseek-prover-v2:free': 'openrouter',
  'qwen/qwen3-30b-a3b:free': 'openrouter',
  'qwen/qwen3-235b-a22b:free': 'openrouter',
  'microsoft/mai-ds-r1:free': 'openrouter', 
  'tngtech/deepseek-r1t-chimera:free': 'openrouter',
  'qwen/qwen3-0.6b-04-28:free': 'openrouter',
  'microsoft/phi-4-reasoning:free': 'openrouter',
  'microsoft/phi-4-reasoning-plus:free': 'openrouter',
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

  const { isGuest: isGuestQuery } = req.query; // string 'true' or undefined
  const isGuestRequest = isGuestQuery === 'true';

  // Handle summarizer requests
  if (req.query.isSummarizer === 'true') {
    // Guests cannot use the summarizer
    if (isGuestRequest || !req.user || !req.user.id) {
      console.warn('[Summary] Attempted by unauthenticated user or guest.');
      res.write(`data: ${JSON.stringify({
        model: 'summary',
        error: 'Login required to use the summarizer feature.',
        errorType: ERROR_TYPES.AUTH_REQUIRED,
        loading: false,
        streaming: false,
        done: true
      })}\n\n`);
      return res.end();
    }

    try {
      console.log('[Summary] Starting summary generation for user:', req.user.id);
      const responsesData = JSON.parse(req.query.responses);

      const userId = req.user.id;
      const apiKeyEntry = await prisma.apiKey.findFirst({
        where: { userId, provider: 'google' },
        select: { encryptedKey: true }
      });

      if (!apiKeyEntry) {
        console.error('[Summary] Missing Google API key for user:', userId);
        res.write(`data: ${JSON.stringify({
          model: 'summary',
          error: 'Google API key required for summarization.',
          errorType: ERROR_TYPES.API_KEY_MISSING,
          loading: false,
          streaming: false,
          done: true
        })}\n\n`);
        return res.end();
      }

      const genAIClient = new GoogleGenerativeAI(apiKeyEntry.encryptedKey);
      const modelInstance = genAIClient.getGenerativeModel({
        model: 'gemini-2.0-flash',
        api_version: 'v1alpha'
      });

      const formattedResponsesText = Object.entries(responsesData)
        .map(([modelKey, textVal]) => `${modelKey}:\n${textVal}\n`)
        .join('\n---\n');

      const summaryPrompt = `Compare these AI responses and provide a concise synthesis highlighting key similarities and differences:\n\n${formattedResponsesText}\n\nFormat your response as a clear, concise analysis.`;

      console.log('[Summary] Sending request to Gemini');
      res.write(`data: ${JSON.stringify({ model: 'summary', text: '', loading: true, streaming: true })}\n\n`);

      const resultStream = await modelInstance.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
        generationConfig: { temperature: 0.7, topK: 40, topP: 0.8, maxOutputTokens: 1000 },
      });

      let accumulatedSummaryText = '';
      for await (const chunk of resultStream.stream) {
        if (res.writableEnded) break;
        const contentPart = chunk.text();
        if (contentPart) {
          accumulatedSummaryText += contentPart;
          res.write(`data: ${JSON.stringify({ model: 'summary', text: accumulatedSummaryText, loading: false, streaming: true })}\n\n`);
        }
      }

      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ model: 'summary', text: accumulatedSummaryText, loading: false, streaming: false, done: true })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error('[Summary] Fatal error:', error);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ model: 'summary', error: 'Summary generation failed: ' + error.message, loading: false, streaming: false, done: true })}\n\n`);
        res.end();
      }
    }
    return;
  }

  // Main streaming logic
  try {
    const userId = req.user?.id;
    const { prompt, models, fileId, fileIds, threadId, conversationId, useContext: useContextQuery } = req.query;
    const modelArray = models ? models.split(',') : [];

    const sendEvent = createSafeEventSender(res);
    const completionManager = createCompletionManager(modelArray.length, sendEvent, res);
    const errorHandler = createErrorHandler(completionManager, sendEvent);

    let effectiveApiKeys = {};
    let genAI;

    if (isGuestRequest) {
      console.log("API WORKER STREAM: Processing GUEST request.");
      const systemGeminiKey = process.env.SYSTEM_GEMINI_API_KEY;
      if (!systemGeminiKey) {
        console.error('Guest Access Error: SYSTEM_GEMINI_API_KEY is not set in environment.');
        modelArray.forEach(modelId => {
          errorHandler.sendErrorEvent(modelId, ERROR_TYPES.API_KEY_MISSING, "System configuration error prevents guest access.");
          completionManager.markCompleted(modelId);
        });
        if (!res.writableEnded) {
          sendEvent({ error: 'Guest access is currently misconfigured. Please try again later.', done: true, allComplete: true });
          res.end();
        }
        return;
      }
      effectiveApiKeys.google = systemGeminiKey;
      genAI = new GoogleGenerativeAI(effectiveApiKeys.google);
      console.log("API WORKER STREAM: Guest using SYSTEM_GEMINI_API_KEY.");
    } else if (userId) {
      console.log(`API WORKER STREAM: Processing request for user: ${userId}`);
      try {
        const apiKeysRes = await prisma.apiKey.findMany({
          where: { userId },
          select: { provider: true, encryptedKey: true }
        });
        apiKeysRes.forEach(({ provider, encryptedKey }) => {
          effectiveApiKeys[provider] = encryptedKey;
        });
        if (effectiveApiKeys.google) {
          genAI = new GoogleGenerativeAI(effectiveApiKeys.google);
        }
      } catch (dbError) {
        console.error('Error fetching user API keys:', dbError);
        modelArray.forEach(modelId => {
          errorHandler.sendErrorEvent(modelId, ERROR_TYPES.UNKNOWN_ERROR, "Failed to retrieve API key settings.");
          completionManager.markCompleted(modelId);
        });
        if (!res.writableEnded) {
          sendEvent({ error: 'Could not load your API keys.', done: true, allComplete: true });
          res.end();
        }
        return;
      }
    } else {
      console.error('Stream Error: Critical authentication state. Not a guest, but no user ID found.');
      modelArray.forEach(modelId => {
        errorHandler.sendErrorEvent(modelId, ERROR_TYPES.API_KEY_MISSING, "User authentication failed.");
        completionManager.markCompleted(modelId);
      });
      if (!res.writableEnded) {
        sendEvent({ error: 'Authentication error. Please log in again.', done: true, allComplete: true });
        res.end();
      }
      return;
    }

    // Initialize other API clients for logged-in users
    let openai, anthropic, openRouter, deepseek;
    if (!isGuestRequest) {
      if (effectiveApiKeys.openai) openai = new OpenAI({ apiKey: effectiveApiKeys.openai });
      if (effectiveApiKeys.anthropic) anthropic = new Anthropic({ apiKey: effectiveApiKeys.anthropic });
      if (effectiveApiKeys.openrouter) {
        openRouter = new OpenAI({
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: effectiveApiKeys.openrouter,
          defaultQuery: { transforms: ['middle'] },
          defaultHeaders: {
            'HTTP-Referer': process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
            'X-Title': 'Quicke - The AI ChatHub'
          }
        });
      }
      if (effectiveApiKeys.deepseek) {
        deepseek = new OpenAI({
          baseURL: 'https://api.deepseek.com/v1',
          apiKey: effectiveApiKeys.deepseek
        });
      }
    }

    const modelPromises = modelArray.map(async (modelId) => {
      try {
        if (completionManager.isCompleted(modelId)) return;

        const provider = providerMap[modelId];

        if (isGuestRequest) {
          if (!GUEST_ALLOWED_MODELS_BACKEND.includes(modelId)) {
            errorHandler.sendErrorEvent(modelId, ERROR_TYPES.MODEL_UNAVAILABLE, "This model is not available for guest access.");
            completionManager.markCompleted(modelId);
            return;
          }
          if (provider !== 'google') {
            errorHandler.sendErrorEvent(modelId, ERROR_TYPES.API_KEY_MISSING, "Guest access is restricted for this model provider.");
            completionManager.markCompleted(modelId);
            return;
          }
        } else {
          if (!effectiveApiKeys[provider]) {
            errorHandler.sendErrorEvent(modelId, ERROR_TYPES.API_KEY_MISSING);
            completionManager.markCompleted(modelId);
            return;
          }
        }

        sendEvent({ model: modelId, text: '', loading: true, streaming: false });

        let fileDataArray = [];
        if (!isGuestRequest && userId && (fileId || (fileIds && fileIds.length > 0))) {
          try {
            const fileIdsToFetch = fileIds ? fileIds.split(',') : (fileId ? [fileId] : []);
            if (fileIdsToFetch.length > 0) {
              const files = await prisma.uploadedFile.findMany({
                where: { id: { in: fileIdsToFetch }, userId },
                select: { id: true, fileName: true, fileType: true, content: true, documentType: true }
              });
              fileDataArray = files.map(file => ({
                id: file.id,
                fileName: file.fileName,
                fileType: file.fileType,
                content: file.content,
                isImage: file.documentType === 'image' || file.fileType.startsWith('image/'),
                isPdf: file.documentType === 'pdf' || file.fileType === 'application/pdf',
                isText: file.documentType === 'text' || file.fileType.startsWith('text/'),
                isPpt: file.documentType === 'ppt' || file.fileType.includes('presentation')
              }));
              console.log(`Retrieved ${fileDataArray.length} files for prompt for user ${userId}`);
            }
          } catch (fileError) {
            console.error('Error retrieving file data:', fileError);
          }
        }

        const formattedMessages = formatMessagesWithMedia(prompt, fileDataArray, modelId);

        if (!isGuestRequest && userId && useContextQuery === 'true' && (threadId || conversationId)) {
          try {
            console.log(`[${modelId}] Retrieving conversation context for ${threadId || conversationId} for user ${userId}`);
            const contextMessages = await getConversationContext(prisma, conversationId, threadId);
            if (contextMessages && contextMessages.length > 0) {
              console.log(`[${modelId}] Retrieved ${contextMessages.length} context messages`);
              if (modelId && modelId.startsWith('gemini')) {
                const currentPromptMessage = formattedMessages[0];
                const geminiContextMessages = contextMessages.map(msg => ({
                  role: msg.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: msg.content }]
                }));
                formattedMessages.splice(0, formattedMessages.length, ...geminiContextMessages, currentPromptMessage);
              } else {
                formattedMessages.unshift(...contextMessages);
              }
            }
          } catch (contextError) {
            console.error(`[${modelId}] Error retrieving context:`, contextError);
          }
        }

        if (geminiModels[modelId] && genAI) {
          const validatedMessages = [];
          let lastRole = null;
          formattedMessages.forEach(msg => {
            if (msg.role === lastRole && validatedMessages.length > 0) {
              const prevMsg = validatedMessages[validatedMessages.length - 1];
              if (prevMsg.parts && msg.parts) {
                msg.parts.forEach(part => {
                  if (part.text && prevMsg.parts.some(p => p.text)) {
                    const textPart = prevMsg.parts.find(p => p.text);
                    textPart.text += '\n' + part.text;
                  } else {
                    prevMsg.parts.push(part);
                  }
                });
              } else if (prevMsg.content && typeof prevMsg.content === 'string' && msg.content && typeof msg.content === 'string') {
                prevMsg.content += '\n' + msg.content;
              }
            } else {
              const validatedMsg = {
                role: msg.role,
                parts: msg.parts || (msg.content ? [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }] : [{ text: '' }])
              };
              validatedMessages.push(validatedMsg);
              lastRole = msg.role;
            }
          });
          await handleGeminiStream(modelId, validatedMessages, sendEvent, genAI, geminiModels);
        } else if (openAIModels[modelId] && openai && !isGuestRequest) {
          await handleOpenAIStream(modelId, formattedMessages, sendEvent, openai);
        } else if (claudeModels[modelId] && anthropic && !isGuestRequest) {
          await handleClaudeStream(modelId, formattedMessages, sendEvent, anthropic);
        } else if (deepseekModels[modelId] && deepseek && !isGuestRequest) {
          await handleDeepSeekStream(modelId, formattedMessages, sendEvent, deepseek);
        } else if (openRouterModels[modelId] && openRouter && !isGuestRequest) {
          await handleOpenRouterStream(modelId, formattedMessages, sendEvent, openRouter, openRouterModels);
        } else {
          if (isGuestRequest && !GUEST_ALLOWED_MODELS_BACKEND.includes(modelId)) {
            errorHandler.sendErrorEvent(modelId, ERROR_TYPES.MODEL_UNAVAILABLE, "Model not available for guests.");
          } else {
            errorHandler.sendErrorEvent(modelId, ERROR_TYPES.API_KEY_MISSING, `API client for ${modelId} is not available or key is missing.`);
          }
        }
        completionManager.markCompleted(modelId);
      } catch (error) {
        console.error(`Error with ${modelId} (Guest=${isGuestRequest}):`, error);
        const classifiedError = streamUtils.handleStreamError(error, modelId, providerMap[modelId]);
        errorHandler.sendErrorEvent(modelId, classifiedError.errorType, classifiedError.errorMessage);
        completionManager.markCompleted(modelId);
      }
    });

    await Promise.all(modelPromises);

    modelArray.forEach(modelId => {
      if (!completionManager.isCompleted(modelId)) {
        console.warn(`[${modelId}] Was not marked as completed - forcing completion at the end.`);
        completionManager.markCompleted(modelId);
      }
    });

    if (completionManager.cleanup) {
      completionManager.cleanup();
    }

    if (!res.writableEnded) {
      console.log('Forcing response completion at the very end of the route.');
      sendEvent({ done: true, allComplete: true });
      res.end();
    }

  } catch (error) {
    console.error('[SSE Stream] Fatal error in main try block:', error);
    if (!res.writableEnded) {
      const safeSender = createSafeEventSender(res);
      safeSender({ error: 'Stream processing failed due to an internal error.', done: true, allComplete: true });
      res.end();
    }
  }
});

module.exports = router;
