const openai = require('./openai');
const anthropic = require('./anthropic');
const gemini = require('./gemini');
const deepseek = require('./deepseek');
const openrouter = require('./openrouter');

const providers = {
  openai,
  anthropic,
  google: gemini,
  deepseek,
  openrouter,
};

function getStreamHandler(provider) {
  return providers[provider]?.streamChat;
}

module.exports = { getStreamHandler }; 