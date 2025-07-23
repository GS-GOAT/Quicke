const { handleUnifiedModelStream } = require('@quicke/utils');

async function streamChat({ modelId, messages, sendEvent, anthropic, claudeModels }) {
  const formattedMessages = Array.isArray(messages)
    ? messages
    : [{ role: 'user', content: messages }];

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

module.exports = { streamChat }; 