const { handleUnifiedModelStream } = require('@quicke/utils');

async function streamChat({ modelId, messages, sendEvent, openRouter, openRouterModels, ERROR_TYPES }) {
  const formattedMessages = Array.isArray(messages)
    ? messages
    : [{ role: 'user', content: messages }];
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

module.exports = { streamChat }; 