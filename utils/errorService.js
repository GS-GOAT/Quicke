// Error types constants
export const ERROR_TYPES = {
  API_KEY_MISSING: 'API_KEY_MISSING',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  RATE_LIMIT: 'RATE_LIMIT',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',  // Add this error type
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INSUFFICIENT_QUOTA: 'INSUFFICIENT_QUOTA',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  SERVER_ERROR: 'SERVER_ERROR',
  SERVER_OVERLOADED: 'SERVER_OVERLOADED',
  TOKEN_LIMIT_EXCEEDED: 'TOKEN_LIMIT_EXCEEDED'  // Add new error type for token limit
};

// Timeout settings constants
export const TIMEOUT_SETTINGS = {
  INITIAL_RESPONSE: 60000,  // 60 seconds for first chunk (model availability)
  CHUNK_TIMEOUT: 15000,     // 15 seconds between chunks 
  MAX_RETRIES: 2,           // Maximum 2 retries per model
  RETRY_DELAY: 2000,        // 2 seconds between retries
};

// Stream utilities for common processing patterns
export const streamUtils = {
  // Safety limits for stream processing
  SAFETY_LIMITS: {
    MAX_CHUNKS: 5000,
    MAX_STREAM_DURATION: 300000 // 5 minutes
  },
  
  // Track chunk count for a model
  chunkCounters: new Map(),
  
  // Reset chunk counter
  resetChunkCounter: (modelId) => {
    streamUtils.chunkCounters.set(modelId, 0);
  },
  
  // Increment and check chunk counter
  incrementChunkCounter: (modelId) => {
    const currentCount = streamUtils.chunkCounters.get(modelId) || 0;
    const newCount = currentCount + 1;
    streamUtils.chunkCounters.set(modelId, newCount);
    
    // Check if we've exceeded safety limit
    return {
      count: newCount,
      exceededLimit: newCount > streamUtils.SAFETY_LIMITS.MAX_CHUNKS
    };
  },
  
  // Helper to format mathematical expressions properly
  formatMathExpression: (text) => {
    if (!text) return text;
    
    // Replace inline math delimiters with proper LaTeX formatting
    let formattedText = text;
    
    // Replace $...$ with proper inline math formatting
    formattedText = formattedText.replace(/\$([^$]+)\$/g, (match, p1) => {
      // Clean the math content
      const cleanMath = p1.trim();
      return `\\(${cleanMath}\\)`;
    });
    
    // Replace $$...$$ with proper block math formatting
    formattedText = formattedText.replace(/\$\$([^$]+)\$\$/g, (match, p1) => {
      // Clean the math content
      const cleanMath = p1.trim();
      return `\\[${cleanMath}\\]`;
    });
    
    return formattedText;
  },
  
  // Send a stream event with proper error handling
  sendStreamEvent: async (options) => {
    const {
      modelId,
      text,
      error,
      errorType,
      loading = false,
      streaming = false,
      done = false,
      sendEvent,
      retryCount,
      maxRetries
    } = options;
    
    try {
      // Format math expressions if there's text
      const formattedText = text ? streamUtils.formatMathExpression(text) : text;
      
      const eventData = {
        model: modelId,
        ...(formattedText !== undefined && { text: formattedText }),
        ...(error && { error }),
        ...(errorType && { errorType }),
        loading,
        streaming,
        done,
        ...(retryCount !== undefined && { retryCount, maxRetries })
      };
      
      await sendEvent(eventData);
    } catch (e) {
      console.error(`Error sending stream event for ${modelId}:`, e);
    }
  },
  
  // Handle errors uniformly across different stream handlers
  handleStreamError: (error, modelId, provider = '') => {
    console.error(`Stream error (${modelId}):`, error);
    
    // Extract message and status properly
    const message = typeof error === 'string' ? error : 
                   (error.message || error.toString());
    const status = error.status || error.statusCode || error.code || 0;
    
    let errorType = ERROR_TYPES.UNKNOWN_ERROR;
    let errorMessage = message || 'Unknown error occurred';
    
    // Provider-specific error handling
    if (provider === 'openrouter') {
      // OpenRouter specific errors
      if (error.error && error.error.message && error.error.message.includes('free-models-per-day')) {
        errorType = ERROR_TYPES.RATE_LIMIT;
        errorMessage = `OpenRouter: Rate limit exceeded for free tier for today. Either add credits at openrouter.ai to continue using this model or wait till the quota resets.`;
      } else if (status === 402 || (error.error && error.error.code === 402) || message.includes('Insufficient credits')) {
        errorType = ERROR_TYPES.INSUFFICIENT_BALANCE;
        errorMessage = `OpenRouter: Insufficient credits for ${modelId}. Please add more credits at openrouter.ai/settings/credits`;
      } else if (error.error && error.error.message && 
          (error.error.message.includes("maximum context length") || 
           error.error.message.includes("token limit"))) {
        errorType = ERROR_TYPES.TOKEN_LIMIT_EXCEEDED;
        errorMessage = `OpenRouter: Token limit exceeded for ${modelId}. Try with a smaller prompt or image.`;
      } else if (status === 429 || (error.error && error.error.code === 429)) {
        errorType = ERROR_TYPES.RATE_LIMIT;
        errorMessage = `OpenRouter: Rate limit exceeded for ${modelId}. Please try again later.`;
      }
    } else if (provider === 'google') {
      // Google/Gemini specific errors
      if (status === 429) {
        errorType = ERROR_TYPES.RATE_LIMIT;
        
        // Check if it's a quota error
        if (message.includes('exceeded your current quota') || 
            (error.errorDetails && 
             error.errorDetails.some(detail => detail['@type']?.includes('QuotaFailure')))) {
          errorType = ERROR_TYPES.INSUFFICIENT_QUOTA;
          errorMessage = `Google Gemini: You've exceeded your quota for ${modelId}. Please check your plan and billing details at https://ai.google.dev/gemini-api/docs/rate-limits`;
        }
      } else if (message.includes('quota')) {
        errorType = ERROR_TYPES.INSUFFICIENT_QUOTA;
        errorMessage = `Google Gemini: You've exceeded your quota for ${modelId}. Please check your plan and billing details at https://ai.google.dev/gemini-api/docs/rate-limits`;
      }
    } else if (provider === 'openai') {
      // OpenAI specific errors
      if (message.includes('exceeded your current quota')) {
        errorType = ERROR_TYPES.INSUFFICIENT_QUOTA;
      } else if (message === 'TIMEOUT') {
        errorType = ERROR_TYPES.TIMEOUT;
      } else if (message.includes('API key')) {
        errorType = ERROR_TYPES.API_KEY_MISSING;
      } else if (message === 'Empty response received') {
        errorType = ERROR_TYPES.EMPTY_RESPONSE;
      } else {
        errorType = error.classifyError ? error.classifyError(error) : ERROR_TYPES.UNKNOWN_ERROR;
      }
    }
    
    // Handle generic error types if no provider-specific handling was done
    if (errorType === ERROR_TYPES.UNKNOWN_ERROR) {
      // Use the error service for general classification
      errorType = error.classifyError ? error.classifyError(error) : ERROR_TYPES.UNKNOWN_ERROR;
    }
    
    return { errorType, errorMessage };
  }
};

class ErrorService {
  constructor() {
    this.activeStreams = new Map();
    this.retryCounters = new Map();
    this.modelTimers = new Map();
  }

  // Register a new model stream
  registerStream(modelId, cleanupFn) {
    console.log(`[${modelId}] Registering stream`);
    
    this.activeStreams.set(modelId, {
      startTime: Date.now(),
      lastChunkTime: Date.now(),
      cleanup: cleanupFn,
      hasReceivedChunk: false
    });
    
    // Set standard timeout for all models
    const timeoutDuration = TIMEOUT_SETTINGS.INITIAL_RESPONSE;

    // Create a timeout that will fire if no chunks are received
    const timerId = setTimeout(() => {
      const stream = this.activeStreams.get(modelId);
      if (stream && !stream.hasReceivedChunk) {
        console.log(`[${modelId}] Initial response timeout after ${timeoutDuration}ms`);
        this.handleTimeout(modelId);
      }
    }, timeoutDuration);

    this.modelTimers.set(modelId, timerId);
  }

  // Update stream when a chunk is received
  updateStream(modelId) {
    const stream = this.activeStreams.get(modelId);
    if (stream) {
      stream.lastChunkTime = Date.now();
      stream.hasReceivedChunk = true;
    }
  }

  // Unregister a stream (call on completion or error)
  unregisterStream(modelId) {
    console.log(`[${modelId}] Unregistering stream`);
    
    // Add a small delay to ensure any pending events are processed
    setTimeout(() => {
      const timer = this.modelTimers.get(modelId);
      if (timer) {
        clearTimeout(timer);
        this.modelTimers.delete(modelId);
      }
      
      const stream = this.activeStreams.get(modelId);
      if (stream && typeof stream.cleanup === 'function') {
        try {
          stream.cleanup();
        } catch (error) {
          console.error(`[${modelId}] Error during cleanup:`, error);
        }
      }
      
      this.activeStreams.delete(modelId);
    }, 200); // Small delay to prevent race conditions
  }

  // Get user-friendly error message
  getErrorMessage(errorType, modelId, provider = '') {
    // Use just the model ID rather than the provider name
    const modelName = modelId || 'Unknown model';
    
    switch (errorType) {
      case ERROR_TYPES.API_KEY_MISSING:
        return `Please add your ${provider} API key in settings to use ${modelName} [ADD_KEY]`;
      
      case ERROR_TYPES.MODEL_UNAVAILABLE:
        return `${modelName} is currently unavailable. Please try again later.`;
      
      case ERROR_TYPES.TIMEOUT:
        return `${modelName} took too long to respond. Request timed out.`;
      
      case ERROR_TYPES.MAX_RETRIES_EXCEEDED:
        return `${modelName} failed after ${TIMEOUT_SETTINGS.MAX_RETRIES} attempts. Please try again later.`;
      
      case ERROR_TYPES.EMPTY_RESPONSE:
        return `${modelName} processed your request but returned no response. This often happens when the model is overloaded or the prompt is challenging.`;
      
      case ERROR_TYPES.RATE_LIMIT:
        return `${modelName} rate limit exceeded. Please try again later or check your API quota.`;
      
      case ERROR_TYPES.NETWORK_ERROR:
        return `Network error while connecting to ${modelName}. Please check your internet connection.`;
      
      case ERROR_TYPES.INSUFFICIENT_BALANCE:
        return `${modelName}: Insufficient credits. Please add more credits to continue.`;

      case ERROR_TYPES.INSUFFICIENT_QUOTA:
        return `${modelName} quota exceeded. Please check your billing details and add more credits.`;
      
      case ERROR_TYPES.INVALID_FORMAT:
        return `Invalid request format for ${modelName}. Please try again.`;
      
      case ERROR_TYPES.INVALID_PARAMETERS:
        return `Invalid parameters in request to ${modelName}. Please try again.`;
      
      case ERROR_TYPES.SERVER_ERROR:
        return `${modelName} server error. Please try again later.`;
      
      case ERROR_TYPES.SERVER_OVERLOADED:
        return `${modelName} is currently overloaded. Please try again in a few minutes.`;
      
      case ERROR_TYPES.TOKEN_LIMIT_EXCEEDED:
        return `${modelName} token limit exceeded. Your request was too large. Try with a smaller image or shorter prompt.`;
        
      default:
        return `Error with ${modelName}: ${errorType}`;
    }
  }

  // Handle timeout scenario
  handleTimeout(modelId) {
    console.log(`[${modelId}] Model availability timeout`);
    const stream = this.activeStreams.get(modelId);
    
    if (stream) {
      if (typeof stream.cleanup === 'function') {
        stream.cleanup();
      }
      
      this.unregisterStream(modelId);
      return ERROR_TYPES.MODEL_UNAVAILABLE;
    }
    
    return null;
  }

  // Classify error type from error object
  classifyError(error) {
    if (!error) return ERROR_TYPES.UNKNOWN_ERROR;
    
    // Extract message and status properly
    const message = typeof error === 'string' ? error : 
                   (error.message || error.toString());
    const status = error.status || error.statusCode || error.code || 0;
    
    // Check for token limit errors
    if (error.error && error.error.message && 
        (error.error.message.includes("maximum context length") || 
         error.error.message.includes("token limit") ||
         error.error.message.includes("too long"))) {
      return ERROR_TYPES.TOKEN_LIMIT_EXCEEDED;
    }
    
    // OpenRouter specific error handling
    if (error.error && typeof error.error === 'object') {
      // Handle nested error objects from OpenRouter
      if (error.error.message && error.error.code) {
        // Special check for free-models-per-day rate limit
        if (error.error.message.includes('free-models-per-day')) {
          return ERROR_TYPES.RATE_LIMIT;
        }
        
        if (error.error.code === 429 || error.error.message.includes('rate limit')) {
          return ERROR_TYPES.RATE_LIMIT;
        }
        
        // Catch OpenRouter insufficient credits error (code 402)
        if (error.error.code === 402 || error.error.message.includes('Insufficient credits')) {
          return ERROR_TYPES.INSUFFICIENT_BALANCE;
        }
        
        // Token limit errors in OpenRouter
        if (error.error.code === 400 && error.error.message.includes('maximum context length')) {
          return ERROR_TYPES.TOKEN_LIMIT_EXCEEDED;
        }
      }
    }
    
    // Handle OpenAI specific errors
    if (error.type === 'insufficient_quota' || message.includes('exceeded your current quota')) {
      return ERROR_TYPES.INSUFFICIENT_QUOTA;
    }
    
    // Check for OpenRouter credit messages
    if (message && message.toLowerCase().includes('insufficient credits')) {
      return ERROR_TYPES.INSUFFICIENT_BALANCE;
    }

    // Check for rate limit message patterns
    if (message && (
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('free-models-per-day') ||
      message.toLowerCase().includes('too many requests')
    )) {
      return ERROR_TYPES.RATE_LIMIT;
    }

    // Handle DeepSeek specific errors by status code
    switch (status) {
      case 400:
        return ERROR_TYPES.INVALID_FORMAT;
      case 401:
        return ERROR_TYPES.API_KEY_MISSING;
      case 402:
        return ERROR_TYPES.INSUFFICIENT_BALANCE;
      case 422:
        return ERROR_TYPES.INVALID_PARAMETERS;
      case 429:
        return ERROR_TYPES.RATE_LIMIT;
      case 500:
        return ERROR_TYPES.SERVER_ERROR;
      case 503:
        return ERROR_TYPES.SERVER_OVERLOADED;
    }

    // Classify by status code
    if (status === 401 || status === 403) {
      return ERROR_TYPES.API_KEY_MISSING;
    }
    
    if (status === 429) {
      return ERROR_TYPES.RATE_LIMIT;
    }
    
    // Classify by error message patterns
    if (message) {
      const messageLower = message.toLowerCase();
      
      if (messageLower.includes('api key') || 
          messageLower.includes('apikey') || 
          messageLower.includes('authentication') ||
          messageLower.includes('auth')) {
        return ERROR_TYPES.API_KEY_MISSING;
      }
      
      if (messageLower.includes('timeout') || 
          messageLower.includes('timed out')) {
        return ERROR_TYPES.TIMEOUT;
      }
      
      if (messageLower.includes('rate limit') || 
          messageLower.includes('too many requests') ||
          messageLower.includes('free-models-per-day')) {
        return ERROR_TYPES.RATE_LIMIT;
      }
      
      if (messageLower.includes('quota') || 
          messageLower.includes('exceeded your current quota')) {
        return ERROR_TYPES.INSUFFICIENT_QUOTA;
      }
      
      if (messageLower.includes('network') || 
          messageLower.includes('connection') ||
          messageLower.includes('connect')) {
        return ERROR_TYPES.NETWORK_ERROR;
      }
    }
    
    return ERROR_TYPES.UNKNOWN_ERROR;
  }

  // Check if retry is allowed for this error and model
  shouldRetry(modelId, errorType) {
    // Some error types should never retry
    if (errorType === ERROR_TYPES.API_KEY_MISSING || 
        errorType === ERROR_TYPES.MAX_RETRIES_EXCEEDED) {
      return false;
    }
    
    // Get current retry count
    const currentRetries = this.retryCounters.get(modelId) || 0;
    
    // Check if we've reached max retries
    if (currentRetries >= TIMEOUT_SETTINGS.MAX_RETRIES) {
      console.log(`[${modelId}] Max retries (${TIMEOUT_SETTINGS.MAX_RETRIES}) reached`);
      return false;
    }
    
    // Increment retry counter
    this.retryCounters.set(modelId, currentRetries + 1);
    console.log(`[${modelId}] Retry ${currentRetries + 1}/${TIMEOUT_SETTINGS.MAX_RETRIES}`);
    return true;
  }

  // Get current retry count for a model
  getRetryCount(modelId) {
    return this.retryCounters.get(modelId) || 0;
  }

  // Reset retry counter (e.g. when starting fresh)
  resetRetryCount(modelId) {
    this.retryCounters.set(modelId, 0);
  }
}

// Create singleton instance
const errorService = new ErrorService();
export { errorService as default };