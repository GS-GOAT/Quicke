const { handleUnifiedModelStream } = require('@quicke/utils');

async function streamChat({ modelId, messages, sendEvent, deepseek }) {
  const formattedMessages = Array.isArray(messages)
    ? messages
    : [{ role: 'user', content: messages }];

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

module.exports = { streamChat }; 