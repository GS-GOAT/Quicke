const { handleUnifiedModelStream } = require('@quicke/utils');

async function streamChat({ modelId, messages, sendEvent, openai, openAIModels }) {
  const formattedMessages = Array.isArray(messages)
    ? messages
    : [{ role: 'user', content: messages }];

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

module.exports = { streamChat }; 