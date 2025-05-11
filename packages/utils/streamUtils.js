const errorServiceModule = require('./errorService');
const errorService = errorServiceModule.default;
const { ERROR_TYPES, TIMEOUT_SETTINGS, streamUtils } = errorServiceModule;

/**
 * Creates a unified model stream handler that works with different LLM providers
 * 
 * @param {Object} options Configuration options
 * @param {String} options.modelId The model identifier
 * @param {Array|String} options.prompt The prompt or messages
 * @param {Function} options.sendEvent The function to send events to the client
 * @param {Object} options.client The API client
 * @param {Function} options.generateStream Function that returns the stream
 * @param {Function} options.processChunk Function to process each chunk
 * @param {String} options.provider Provider identifier (openai, anthropic, etc)
 * @param {Function} options.customErrorHandler Optional custom error handler
 * @returns {Promise<String>} The complete generated text
 */
async function handleUnifiedModelStream(options) {
  const {
    modelId,
    prompt,
    sendEvent,
    client,
    generateStream,
    processChunk,
    provider = '',
    customErrorHandler
  } = options;

  // Reset the chunk counter
  streamUtils.resetChunkCounter(modelId);

  // Create stream handler with timeout
  const streamHandler = createStreamHandler({
    modelId,
    cleanup: () => {
      if (errorService?.unregisterStream) {
        errorService.unregisterStream(modelId);
      }
    }
  });

  try {
    // Send initial loading event
    await streamUtils.sendStreamEvent({
      modelId,
      loading: true,
      sendEvent
    });

    // Initialize the stream with timeout handling
    const stream = await streamHandler.init(generateStream());
    let text = '';
    let isStreamDone = false;

    // Process the stream with safety counter
    try {
      // safety check to ensure the stream is iterable
      if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
        console.error(`[${modelId}] Stream is not async iterable, handling as error`);
        throw new Error('Stream is not async iterable');
      }
      
      for await (const chunk of stream) {
        const content = processChunk(chunk);
        if (content) {
          text += content;
          streamHandler.markStarted();
          
          await streamUtils.sendStreamEvent({
            modelId,
            text,
            streaming: true,
            sendEvent
          });
        }
        
        // Check safety counter
        const counter = streamUtils.incrementChunkCounter(modelId);
        if (counter.exceeded) {
          console.warn(`[${modelId}] Safety limit of ${streamUtils.SAFETY_LIMITS.MAX_CHUNKS} chunks reached, forcing completion`);
          break;
        }
      }
      
      isStreamDone = true;
    } catch (streamError) {
      // Log the streaming error
      console.error(`Stream processing error (${modelId}):`, streamError);
      
      // Use custom error handler if provided
      if (customErrorHandler) {
        const customError = customErrorHandler(streamError);
        if (customError) {
          throw customError;
        }
      }
      
      throw streamError;
    }

    // Send final completion event
    await streamUtils.sendStreamEvent({
      modelId,
      text,
      streaming: false,
      done: true,
      sendEvent
    });

  } catch (error) {
    // Handle and classify the error
    const { errorType, errorMessage } = streamUtils.handleStreamError(error, modelId, provider);
    
    // Send error event with the classified error
    await streamUtils.sendStreamEvent({
      modelId,
      error: errorMessage,
      errorType,
      loading: false,
      streaming: false,
      done: true,
      sendEvent
    });
  }
}

/**
 * Creates a stream handler with timeout logic
 */
function createStreamHandler(options) {
  const { modelId, cleanup, timeoutDuration = TIMEOUT_SETTINGS.INITIAL_RESPONSE } = options;
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
}

module.exports = {
  handleUnifiedModelStream,
  createStreamHandler
};