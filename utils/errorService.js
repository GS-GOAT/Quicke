// Error types constants
export const ERROR_TYPES = {
  API_KEY_MISSING: 'API_KEY_MISSING',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Timeout settings constants
export const TIMEOUT_SETTINGS = {
  INITIAL_RESPONSE: 60000,  // 60 seconds for first chunk (model availability)
  CHUNK_TIMEOUT: 15000,     // 15 seconds between chunks 
  MAX_RETRIES: 2,           // Maximum 2 retries per model
  RETRY_DELAY: 2000,        // 2 seconds between retries
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
  }

  // Get user-friendly error message
  getErrorMessage(errorType, modelId, provider = '') {
    const modelName = provider || modelId;
    
    switch (errorType) {
      case ERROR_TYPES.API_KEY_MISSING:
        return `Please add your ${modelName} API key in settings to use this model`;
      
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
    const status = error.status || error.statusCode || 0;
    
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
          messageLower.includes('quota') ||
          messageLower.includes('too many requests')) {
        return ERROR_TYPES.RATE_LIMIT;
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