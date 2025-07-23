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
const {
  providerMap,
  openAIModels,
  claudeModels,
  deepseekModels,
  openRouterModels,
  geminiModels,
} = require('../../config/models');
const { getStreamHandler } = require('../services/llm/router');

// Defines models guests can use on the backend for validation
const GUEST_ALLOWED_MODELS_BACKEND = ['gemini-flash', 'gemini-flash-2.5'];

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

// Use the imported values with a fallback if needed - To be improved
const ERROR_TYPES = errorService?.ERROR_TYPES || IMPORTED_ERROR_TYPES || FALLBACK_ERROR_TYPES;

const router = express.Router();

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
// Remove all handle*Stream functions (handleOpenAIStream, handleClaudeStream, handleGeminiStream, handleOpenRouterStream, handleDeepSeekStream)

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
      const systemGeminiKey = process.env.SYSTEM_GEMINI_API_KEY;
      if (!systemGeminiKey) {
        console.error('Guest Access Error: SYSTEM_GEMINI_API_KEY is not set.');
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
    } else if (userId) {
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
      console.error('Stream Error: Not a guest, but no user ID found.');
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
                isText: file.documentType === 'text' ||
                        file.fileType.startsWith('text/') ||
                        file.fileType === 'text/markdown' ||
                        (file.fileName && file.fileName.toLowerCase().endsWith('.md')),
                isPpt: file.documentType === 'ppt' || file.fileType.includes('presentation')
              }));
            }
          } catch (fileError) {
            console.error('Error retrieving file data:', fileError);
          }
        }

        const formattedMessages = formatMessagesWithMedia(prompt, fileDataArray, modelId);

        if (!isGuestRequest && userId && useContextQuery === 'true' && (threadId || conversationId)) {
          try {
            const contextMessages = await getConversationContext(prisma, conversationId, threadId);
            if (contextMessages && contextMessages.length > 0) {
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

        // Use the new modular handler
        const streamHandler = getStreamHandler(provider);
        if (!streamHandler) {
          errorHandler.sendErrorEvent(modelId, ERROR_TYPES.MODEL_UNAVAILABLE, `No handler for provider: ${provider}`);
          completionManager.markCompleted(modelId);
          return;
        }
        // Build options for each provider
        const options = {
          modelId,
          messages: formattedMessages,
          sendEvent,
          openai,
          anthropic,
          genAI,
          deepseek,
          openRouter,
          openAIModels,
          claudeModels,
          geminiModels,
          deepseekModels,
          openRouterModels,
          ERROR_TYPES,
        };
        try {
          await streamHandler(options);
        } catch (err) {
          errorHandler.sendErrorEvent(modelId, ERROR_TYPES.UNKNOWN_ERROR, err.message);
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
