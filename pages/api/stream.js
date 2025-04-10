const providerMap = {
  'gpt-4.5-preview': 'openai',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'o1': 'openai',
  'o3-mini': 'openai',
  'o1-mini': 'openai',
  'gpt-4o-mini-or': 'openrouter', // Add this line
  // Google
  'gemini-flash': 'google',
  'gemini-pro': 'google',
  'gemini-thinking': 'google',
  'gemini-2.5-pro': 'google', // Add new model
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
const getLLMProvider = (modelId, providerMap) => {
  if (providerMap[modelId]) {
    return providerMap[modelId].charAt(0).toUpperCase() + providerMap[modelId].slice(1);
  }
  
  if (modelId && modelId.startsWith('custom-')) {
    return 'Custom Model';
  }
  
  return modelId || 'Unknown';
};

import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import prisma from '../../lib/prisma';
import errorService, { ERROR_TYPES as IMPORTED_ERROR_TYPES, TIMEOUT_SETTINGS } from '../../utils/errorService';
import contextTracker from '../../utils/contextTracker';
import { getConversationContext } from '../../utils/contextManager';

// Fallback error types in case errorService isn't initialized
const FALLBACK_ERROR_TYPES = {
  API_KEY_MISSING: 'API_KEY_MISSING',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INSUFFICIENT_QUOTA: 'INSUFFICIENT_QUOTA'
};

// Use the imported values with a fallback if needed
const ERROR_TYPES = errorService?.ERROR_TYPES || IMPORTED_ERROR_TYPES || FALLBACK_TYPES;

// Create a completion manager first
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
    
    // Clear model timeout
    if (errorService?.modelTimers) {
      const timerId = errorService.modelTimers.get(`timeout_${modelId}`);
      if (timerId) {
        clearTimeout(timerId);
        errorService.modelTimers.delete(`timeout_${modelId}`);
      }
    }
    
    // Add a small delay before checking if all models are completed
    // This allows any pending messages to be processed first
    setTimeout(() => {
      if (completedResponses === totalModels) {
        console.log('All model streams processed, sending allComplete event');
        safelyEndResponse();
      }
    }, 1000); // 1 second delay to ensure all messages are sent
  };

  // Increase safety timeout duration
  const safetyTimeout = setTimeout(() => {
    if (!responseEnded) {
      console.warn(`[SSE Stream] Safety timeout triggered after ${completedResponses}/${totalModels} models`);
      safelyEndResponse();
    }
  }, 120000); // Increased to 120 seconds

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

// Move error handling to dedicated object
const createErrorHandler = (completionManager, sendEvent) => {
  const sendErrorEvent = (modelId, errorType, text = '') => {
    try {
      console.log(`[${modelId}] Sending error event: ${errorType}`);
      
      const retryCount = errorService?.getRetryCount?.(modelId) || 0;
      // Use display name or fallback to ID
      const modelName = modelDisplayNames[modelId] || openRouterModels[modelId]?.name || modelId;
      const errorMessage = errorService?.getErrorMessage?.(errorType, modelName) 
        || `Error with ${modelName}: ${errorType}`;
      
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

// Update getFileContext to support multiple file types
async function getFileContext(userId, fileId) {
  if (!fileId) return null;
  
  try {
    const file = await prisma.uploadedFile.findFirst({
      where: {
        id: fileId,
        userId
      }
    });
    
    if (!file) {
      return null;
    }
    
    // Return appropriate context based on file type
    const documentType = file.documentType || getDocumentTypeFromMimetype(file.fileType);
    
    switch (documentType) {
      case 'pdf':
        return {
          content: file.content,
          type: 'pdf',
          fileName: file.fileName,
          fileType: file.fileType
        };
      case 'text':
        return {
          content: file.content,
          type: 'text',
          fileName: file.fileName,
          fileType: file.fileType
        };
      case 'ppt':
        return {
          content: file.content,
          type: 'ppt',
          fileName: file.fileName,
          fileType: file.fileType
        };
      case 'image':
        return {
          content: file.content,
          type: 'image',
          fileName: file.fileName,
          fileType: file.fileType,
          isImage: true
        };
      default:
        return null;
    }
  } catch (error) {
    console.error('Error getting file context:', error);
    return null;
  }
}

// Helper function to determine document type from mimetype
function getDocumentTypeFromMimetype(mimetype) {
  if (mimetype === 'application/pdf') {
    return 'pdf';
  } else if (mimetype === 'text/plain') {
    return 'text';
  } else if (mimetype === 'application/vnd.ms-powerpoint' || 
             mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return 'ppt';
  } else if (mimetype.startsWith('image/')) {
    return 'image';
  }
  return null;
}

// Update sendEvent helper function with safety checks
const createSafeEventSender = (res) => {
  return (data) => {
    if (res.writableEnded) {
      console.warn(`[SSE Stream] Attempted write after stream ended: ${JSON.stringify(data).substring(0, 60)}...`);
      return;
    }

    try {
      const event = `data: ${JSON.stringify(data)}\n\n`;
      res.write(event);
      res.flush?.(); // Flush if available
    } catch (e) {
      console.error('[SSE Stream] Error sending event:', e);
    }
  };
};

export default async function handler(req, res) {
  // Set headers right at the start for all requests
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });

  // Get user session early
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.write(`data: ${JSON.stringify({ error: "Unauthorized" })}\n\n`);
    return res.end();
  }

  // Update summarizer request handling
  if (req.query.isSummarizer === 'true') {
    try {
      console.log('[Summary] Starting summary generation');
      const responses = JSON.parse(req.query.responses);
      
      console.log('[Summary] Input responses:', Object.keys(responses).length);
      
      const apiKey = await prisma.apiKey.findFirst({
        where: { userId: session.user.id, provider: 'google' },
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

      console.log('[Summary] Formatted responses:', formattedResponses);

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
            console.log('[Summary] Chunk:', content.substring(0, 50) + '...');
            
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

  // Continue with regular model streaming...
  const { prompt, models, fileId, fileType } = req.query;
  const threadId = req.query.threadId;
  const conversationId = req.query.conversationId;
  const useContext = req.query.useContext === 'true';
  const modelArray = models ? models.split(',') : [];
  
  let enhancedPrompt = prompt;
  let fileData = null;

  // Get file content if fileId is provided
  if (fileId) {
    try {
      const userId = session?.user?.id;
      if (userId) {
        // Use the updated getFileContext function for any document type
        const fileContext = await getFileContext(userId, fileId);
        if (fileContext) {
          fileData = {
            ...fileContext,
            isFile: true
          };
        }
      }
    } catch (error) {
      console.error('Error retrieving file context:', error);
    }
  }

  // Update file handling in prompt enhancement
  if (fileData && fileData.isFile) {
    // Use the formatPromptWithContext function
    enhancedPrompt = formatPromptWithContext(prompt, fileData);
  }

  // Get context for this request if useContext flag is set
  let context = [];
  
  if (useContext) {
    console.log(`Context request: threadId=${threadId}, conversationId=${conversationId}`);
    
    if (threadId || conversationId) {
      // Try to use our in-memory context tracker first (fastest)
      context = contextTracker.getContext(threadId, conversationId);
      console.log(`Retrieved ${context.length} messages from in-memory context tracker`);
      
      // If no context in memory, try to load from database
      if (context.length === 0 && session?.user?.id) {
        try {
          // Only do this if we have a threadId
          if (threadId) {
            console.log(`Attempting to load context from database for thread ${threadId}`);
            const thread = await prisma.thread.findUnique({
              where: {
                id: threadId,
                userId: session.user.id
              },
              include: {
                conversations: {
                  orderBy: {
                    createdAt: 'desc'
                  },
                  take: 3,
                  include: {
                    messages: {
                      orderBy: {
                        createdAt: 'asc'
                      }
                    }
                  }
                }
              }
            });
            
            if (thread) {
              // Extract messages from the most recent conversations
              const messages = [];
              thread.conversations.forEach(conv => {
                console.log(`Processing conversation ${conv.id} with ${conv.messages.length} messages`);
                conv.messages.forEach(msg => {
                  messages.push(msg);
                });
              });
              
              // Sort by creation time
              messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
              
              console.log(`Found ${messages.length} messages to import for thread ${threadId}`);
              
              // Import these messages into our context tracker
              contextTracker.importMessages(threadId, messages);
              
              // Get the updated context
              context = contextTracker.getContext(threadId, conversationId);
              
              console.log(`Loaded ${context.length} messages from database for thread ${threadId}`);
            } else {
              console.log(`No thread found with ID ${threadId} for user ${session.user.id}`);
            }
          }
        } catch (error) {
          console.error('Error loading context from database:', error);
        }
      }
    } else {
      console.log('No threadId or conversationId provided for context tracking');
    }
  }
  
  console.log(`Using ${context.length} context messages for this request`);

  // If we have no context but we should have context, log a warning
  if (context.length === 0 && useContext) {
    console.warn('Context tracking enabled but no context messages found!');
  }

  // Define providerMap at the top level to ensure it's in scope everywhere

  // Add model version mapping
  const openAIModels = {
    'gpt-4.5-preview': 'gpt-4.5-preview-2025-02-27',
    'gpt-4o': 'gpt-4o-2024-08-06',
    'gpt-4o-mini': 'gpt-4o-mini-2024-07-18',
    'o1': 'o1-2024-12-17',
    'o3-mini': 'o3-mini-2025-01-31',
    'o1-mini': 'o1-mini-2024-09-12'
  };
  
  // Add model version mapping for Claude
  const claudeModels = {
    'claude-3-7': 'claude-3-7-sonnet-20250219',
    'claude-3-5': 'claude-3-5-sonnet-20241022'
  };

  const deepseekModels = {
    'deepseek-chat': 'chat',
    'deepseek-coder': 'coder',
    'deepseek-reasoner': 'reasoner'
  };

  // Initialize completion manager first
  const sendEvent = createSafeEventSender(res);
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
        'X-Title': 'Quicke - The AI ChatHub'
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
    'mistral-small-31': {  // Add new model configuration
      id: 'mistralai/mistral-small-3.1-24b-instruct:free',
      name: 'Mistral Small 3.1'
    },
    'mistral-nemo': {
      id: 'mistralai/mistral-nemo:free',
      name: 'Mistral Nemo'
    },
    'deepseek-v3-0324': {  // Add new model configuration
      id: 'deepseek/deepseek-chat-v3-0324:free',
      name: 'DeepSeek V3 0324'
    },
    // NVIDIA Models
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
    }
  };

  // Update geminiModels with debug logging
  const geminiModels = {
    'gemini-flash': {
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
    },
    'gemini-2.5-pro': {
      id: 'gemini-2.5-pro-exp-03-25',
      name: 'Gemini 2.5 Pro'
    }
  };

  const startTime = Date.now();

  // Update formatMessagesForModel to handle images
  const formatMessagesForModel = (modelId, messages, fileData) => {
    if (!fileData) return messages;

    const provider = providerMap[modelId];
    
    if (fileData.isImage) {
      if (provider === 'google') {
        return [{
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: fileData.fileType,
                data: fileData.content
              }
            },
            { text: enhancedPrompt }
          ]
        }];
      }
      
      // For other providers (OpenAI, Anthropic, etc)
      return [{
        role: "user",
        content: [
          { type: "text", text: enhancedPrompt },
          {
            type: "image_url",
            image_url: { url: `data:${fileData.fileType};base64,${fileData.content}` }
          }
        ]
      }];
    }

    return messages;
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
        // Skip if this model was already marked as unavailable
        if (completionManager.isCompleted(modelId)) {
          return;
        }
        
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

        // Determine the model provider
        let modelProvider = 'openai'; // default
        if (modelId.includes('gpt')) modelProvider = 'openai';
        if (modelId.includes('claude')) modelProvider = 'anthropic';
        if (modelId.includes('gemini')) modelProvider = 'gemini';
        if (modelId.includes('deepseek') || modelId.includes('mistral') || 
            modelId.includes('llama') || modelId.includes('phi') || modelId.includes('qwen') || 
            modelId.includes('openrouter') || modelId.includes('custom-')) {
          modelProvider = 'openrouter';
        }
        
        console.log(`Using ${modelProvider} format for ${modelId}`);
        
        // Get formatted context for this model type
        const formattedContext = useContext 
          ? contextTracker.formatContextForModel(threadId, conversationId, enhancedPrompt, modelProvider)
          : modelProvider === 'gemini' 
            ? [{ role: 'user', parts: [{ text: enhancedPrompt }] }]
            : [{ role: 'user', content: enhancedPrompt }];
        
        console.log(`Formatted context for ${modelId}: ${formattedContext.length} messages`);
        
        // Process model-specific streams with individual error handling
        try {
          const formattedMessages = formatMessagesForModel(
            modelId,
            formattedContext,
            fileData
          );

          if (openAIModels[modelId]) {
            await handleOpenAIStream(modelId, formattedMessages, sendEvent, openai);
          } else if (claudeModels[modelId]) {
            await handleClaudeStream(modelId, formattedMessages, sendEvent, anthropic);
          } else if (geminiModels[modelId]) {
            await handleGeminiStream(modelId, formattedMessages, sendEvent, genAI, geminiModels);
          } else if (deepseekModels[modelId]) {
            await handleDeepSeekStream(modelId, formattedMessages, sendEvent, deepseek);
          } else if (openRouterModels[modelId]) {
            await handleOpenRouterStream(modelId, formattedMessages, sendEvent, openRouter, openRouterModels);
          } else if (modelId.startsWith('custom-')) {
            await handleCustomModelStream(modelId, formattedMessages, sendEvent, customModels);
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

    // Ensure the allComplete event is always sent
    // After await Promise.all(modelPromises);

    // Make sure we send a final allComplete event
    try {
      console.log('All model streams processed, sending allComplete event');
      
      // Send the final all-complete event
      sendEvent({
        allComplete: true,
        done: true,
        processingTime: Date.now() - startTime
      });
      
      // Close the response if it hasn't been closed yet
      if (!res.writableEnded) {
        console.log('Ending response stream');
        res.end();
      }
    } catch (error) {
      console.error('Error sending final event:', error);
    }
  } catch (error) {
    console.error('[SSE Stream] Fatal error:', error);
    
    if (!res.writableEnded) {
      sendEvent({ 
        error: 'Stream processing failed', 
        done: true, 
        allComplete: true 
      });
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
  try {
    const eventData = {
      model: modelId,
      ...(text !== undefined && { text }),
      ...(error && { error }),
      loading,
      streaming,
      done,
      ...(retryCount !== undefined && { retryCount, maxRetries })
    };
    
    await sendEvent(eventData);
  } catch (e) {
    console.error(`Error sending stream event for ${modelId}:`, e);
  }
};

// Replace individual handlers with unified handler
async function handleModelStream(options) {
  const {
    modelId,
    prompt,
    sendEvent,
    client,
    generateStream,
    processChunk
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
    let isStreamDone = false;

    // Add a safety counter to prevent infinite loops
    let chunkCounter = 0;
    const MAX_CHUNKS = 5000; // Reasonable maximum for most responses

    // Process the stream with a safety counter
    try {
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
        
        // Safety counter
        chunkCounter++;
        if (chunkCounter > MAX_CHUNKS) {
          console.warn(`[${modelId}] Safety limit of ${MAX_CHUNKS} chunks reached, forcing completion`);
          break;
        }
      }
      
      isStreamDone = true;
    } catch (streamError) {
      // If we get an error during streaming, log it but still try to send the text we received
      console.error(`Stream processing error (${modelId}):`, streamError);
      
      // Classify the stream error
      let errorType = ERROR_TYPES.UNKNOWN_ERROR;
      if (streamError.message && streamError.message.includes('exceeded your current quota')) {
        errorType = ERROR_TYPES.INSUFFICIENT_QUOTA;
      } else if (streamError.status === 429 || (streamError.message && streamError.message.includes('Too Many Requests'))) {
        errorType = ERROR_TYPES.RATE_LIMIT;
      }
      
      // Send proper error event
      await sendStreamEvent({
        modelId,
        error: streamError.message,
        errorType,
        loading: false,
        streaming: false,
        done: true,
        sendEvent
      });
      
      // Don't re-throw the stream error, just mark it as done
      isStreamDone = true;
    }

    // Always send a completion event when the stream finishes
    await sendStreamEvent({
      modelId,
      text: text,
      loading: false,
      streaming: false,
      done: true,
      sendEvent
    });

    return text;
  } catch (error) {
    console.error(`Stream error (${modelId}):`, error);
    const errorType = error.message === 'TIMEOUT' ? ERROR_TYPES.TIMEOUT :
                     error.message.includes('API key') ? ERROR_TYPES.API_KEY_MISSING :
                     error.message === 'Empty response received' ? ERROR_TYPES.EMPTY_RESPONSE :
                     errorService?.classifyError(error) || ERROR_TYPES.UNKNOWN_ERROR;
    
    await sendStreamEvent({
      modelId,
      error: error.message,
      errorType,
      loading: false,
      streaming: false,
      done: true,
      sendEvent
    });
    
    // Return empty string instead of throwing to isolate errors
    return '';
  } finally {
    streamHandler.cleanup();
  }
}

// Replace individual model handlers with unified handler calls
async function handleOpenAIStream(modelId, messages, sendEvent, openai) {
  // Check if messages is an array or a string
  const formattedMessages = Array.isArray(messages) 
    ? messages 
    : [{ role: 'user', content: messages }];
  
  console.log(`OpenAI: Using model ${modelId} with ${formattedMessages.length} messages`);
  
  return handleModelStream({
    modelId,
    prompt: formattedMessages,
    sendEvent,
    client: openai,
    generateStream: () => openai.chat.completions.create({
      model: openAIModels[modelId] || modelId,
      messages: formattedMessages,
      stream: true,
    }),
    processChunk: chunk => chunk.choices[0]?.delta?.content
  });
}

async function handleClaudeStream(modelId, messages, sendEvent, anthropic) {
  // Check if messages is an array or a string
  const formattedMessages = Array.isArray(messages) 
    ? messages 
    : [{ role: 'user', content: messages }];
  
  console.log(`Claude: Using model ${modelId} with ${formattedMessages.length} messages`);
  
  return handleModelStream({
    modelId,
    prompt: formattedMessages,
    sendEvent,
    client: anthropic,
    generateStream: () => anthropic.messages.create({
      model: claudeModels[modelId] || 'claude-3-7-sonnet-20250219',
      max_tokens: 5000,
      messages: formattedMessages,
      stream: true,
    }),
    processChunk: chunk => chunk.type === 'content_block_delta' && chunk.delta.text ? chunk.delta.text : ''
  });
}

// Replace the handleGeminiStream function entirely

async function handleGeminiStream(modelId, messages, sendEvent, genAI, geminiModels) {
  const modelInfo = geminiModels[modelId];
  if (!modelInfo) {
    throw new Error(`Invalid Gemini model: ${modelId}`);
  }
  
  let text = '';
  const startTime = Date.now();
  
  try {
    // Initial state for model
    await sendEvent({
      model: modelId,
      text: '',
      loading: true,
      streaming: true
    });
    
    console.log(`Gemini: Using model ${modelInfo.id} with ${Array.isArray(messages) ? messages.length : 'single'} messages`);
    
    // Initialize the model
    const geminiModel = genAI.getGenerativeModel({ 
      model: modelInfo.id,
      api_version: 'v1alpha',
      ...(modelInfo.id !== 'gemini-2.0-flash-thinking-exp-01-21' && {
        tools: [{ 'google_search': {} }]
      })
    });
    
    // Start streaming with context
    const generationConfig = {
      temperature: 1.0,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 12192,
    };
    
    // Ensure messages are in the correct format for Gemini
    const geminiMessages = Array.isArray(messages) 
      ? messages 
      : [{ role: 'user', parts: [{ text: messages }] }];
    
    // Log a preview of the messages
    if (geminiMessages.length > 0) {
      console.log('Gemini context preview:');
      geminiMessages.forEach((msg, i) => {
        if (i < 3) { // Limit to first 3 for brevity
          const role = msg.role;
          const content = msg.parts && msg.parts[0] && msg.parts[0].text 
            ? msg.parts[0].text.substring(0, 50) + '...'
            : 'No content';
          console.log(`[${i+1}] ${role}: ${content}`);
        }
      });
      if (geminiMessages.length > 3) {
        console.log(`...and ${geminiMessages.length - 3} more messages`);
      }
    }
    
    // Add safety mechanisms for stream processing
    let streamComplete = false;
    let chunkCounter = 0;
    const MAX_CHUNKS = 5000;
    
    try {
      const result = await geminiModel.generateContentStream({
        contents: geminiMessages,
        generationConfig
      });
      
      // Process the stream with a safety counter
      for await (const chunk of result.stream) {
        const content = chunk.text();
        if (content) {
          text += content;
          await sendEvent({
            model: modelId,
            text,
            streaming: true,
            loading: true
          });
        }
        
        // Safety counter
        chunkCounter++;
        if (chunkCounter > MAX_CHUNKS) {
          console.warn(`[${modelId}] Safety limit of ${MAX_CHUNKS} chunks reached, forcing completion`);
          break;
        }
      }
      
      streamComplete = true;
    } catch (streamError) {
      console.error(`Gemini stream processing error (${modelId}):`, streamError);
      
      // Classify the error properly
      let errorType = ERROR_TYPES.UNKNOWN_ERROR;
      if (streamError.message && streamError.message.includes('exceeded your current quota')) {
        errorType = ERROR_TYPES.INSUFFICIENT_QUOTA;
      } else if (streamError.status === 429 || (streamError.message && streamError.message.includes('Too Many Requests'))) {
        errorType = ERROR_TYPES.RATE_LIMIT;
      }
      
      // Send proper error event
      await sendEvent({
        model: modelId,
        error: streamError.message,
        errorType,
        streaming: false,
        loading: false,
        done: true
      });
      
      // Return early but don't throw to prevent affecting other models
      return text || '';
    }
    
    // Stream completed successfully
    const endTime = Date.now();
    const elapsed = endTime - startTime;
    
    // Always send a final completion event
    await sendEvent({
      model: modelId,
      text,
      streaming: false,
      loading: false,
      processingTime: elapsed,
      done: true // Add explicit done flag
    });
    
    return text;
  } catch (error) {
    // Handle errors
    console.error(`Stream error (${modelId}):`, error);
    
    // Make sure to send a final error event
    await sendEvent({
      model: modelId,
      error: error.message,
      streaming: false,
      loading: false,
      done: true // Add explicit done flag
    });
    
    // Removed the throw error line
  }
}

// Update OpenRouter handler to support context and handle premature closures
async function handleOpenRouterStream(modelId, messages, sendEvent, openRouter, openRouterModels) {
  console.log(`OpenRouter: Using model ${openRouterModels[modelId]?.id || modelId}`);

  // Check if message contains an image
  const hasImage = messages.some(msg => 
    Array.isArray(msg.content) && 
    msg.content.some(c => c.type === 'image_url')
  );

  return handleModelStream({
    modelId,
    prompt: messages,
    sendEvent,
    client: openRouter,
    generateStream: async () => {
      try {
        return await openRouter.chat.completions.create({
          model: openRouterModels[modelId]?.id || modelId,
          order: ["Chutes","Targon"],
          messages: messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 8000,
          // Add vision model parameters if image is present
          ...(hasImage && {
            vision_model: 'large', // Use high quality vision model
            vision_config: {
              detail: 'high'
            }
          })
        });
      } catch (error) {
        // Check for premature closure
        if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
          console.warn(`[${modelId}] Stream closed prematurely, attempting retry...`);
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Retry the stream creation
          return await openRouter.chat.completions.create({
            model: openRouterModels[modelId]?.id || modelId,
            order: ["Chutes","Targon"],
            messages: messages,
            stream: true,
            temperature: 0.7,
            max_tokens: 8000,
            ...(hasImage && {
              vision_model: 'large',
              vision_config: {
                detail: 'high'
              }
            })
          });
        }
        throw error; // Re-throw other errors
      }
    },
    processChunk: chunk => chunk.choices[0]?.delta?.content,
    maxRetries: 2 // Allow up to 2 retries for premature closures
  });
}

// Update DeepSeek handler to support context
async function handleDeepSeekStream(modelId, messages, sendEvent, deepseek) {
  // Check if messages is an array or a string
  const formattedMessages = Array.isArray(messages) 
    ? messages 
    : [{ role: 'user', content: messages }];
  
  console.log(`DeepSeek: Using model ${modelId} with ${formattedMessages.length} messages`);
  
  return handleModelStream({
    modelId,
    prompt: formattedMessages,
    sendEvent,
    client: deepseek,
    generateStream: () => deepseek.chat.completions.create({
      model: modelId,
      messages: formattedMessages,
      stream: true,
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

    // Add OpenRouter specific checks
    if (response.headers.get('x-ratelimit-remaining') === '0') {
      throw new Error('OpenRouter rate limit exceeded [ADD_KEY]');
    }
    
    if (response.headers.get('x-credit-remaining') === '0') {
      throw new Error('OpenRouter credits depleted [ADD_KEY]');
    }

    if (!response.ok) {
      // Add specific OpenRouter error handling
      if (response.status === 429) {
        throw new Error('OpenRouter rate limit exceeded [ADD_KEY]');
      }
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
    console.error(`[OpenRouter] Error for model ${modelId}:`, error);
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

// Update the formatPromptWithContext function to handle different file types
function formatPromptWithContext(prompt, fileData) {
  if (!fileData) return prompt;

  let enhancedPrompt = prompt;
  
  switch (fileData.type) {
    case 'pdf':
      enhancedPrompt = `The following is content from a PDF document titled "${fileData.fileName}":\n\n${fileData.content}\n\n${prompt}`;
      break;
    case 'text':
      enhancedPrompt = `The following is content from a text file titled "${fileData.fileName}":\n\n${fileData.content}\n\n${prompt}`;
      break;
    case 'ppt':
      enhancedPrompt = `The following is content from a PowerPoint presentation titled "${fileData.fileName}":\n\n${fileData.content}\n\n${prompt}`;
      break;
  }
  
  return enhancedPrompt;
}