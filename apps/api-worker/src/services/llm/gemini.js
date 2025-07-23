const { handleUnifiedModelStream } = require('@quicke/utils');

async function streamChat({ modelId, messages, sendEvent, genAI, geminiModels }) {
  const modelInfo = geminiModels[modelId];
  if (!modelInfo) {
    throw new Error(`Invalid Gemini model: ${modelId}`);
  }
  const geminiMessages = Array.isArray(messages)
    ? messages
    : [{ role: 'user', parts: [{ text: messages }] }];

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

module.exports = { streamChat }; 