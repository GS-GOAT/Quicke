// Model and provider configuration for LLM orchestration

const providerMap = {
  'gpt-4.5-preview': 'openai',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'o1': 'openai',
  'o3-mini': 'openai',
  'o1-mini': 'openai',
  'gpt-4o-mini-or': 'openrouter',
  // Google
  'gemini-flash': 'google',
  'gemini-flash-2.5': 'google',
  'gemini-lite': 'google',
  'gemini-thinking': 'google',
  'gemini-2.5-pro': 'google',
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
  // New OpenRouter models
  'deepseek/deepseek-prover-v2:free': 'openrouter',
  'qwen/qwen3-30b-a3b:free': 'openrouter',
  'qwen/qwen3-235b-a22b:free': 'openrouter',
  'microsoft/mai-ds-r1:free': 'openrouter', 
  'tngtech/deepseek-r1t-chimera:free': 'openrouter',
  'qwen/qwen3-0.6b-04-28:free': 'openrouter',
  'microsoft/phi-4-reasoning:free': 'openrouter',
  'microsoft/phi-4-reasoning-plus:free': 'openrouter',
  // Anthropic
  'claude-3-7': 'anthropic',
  'claude-3-5': 'anthropic',
};

const openAIModels = {
  'gpt-4.5-preview': 'gpt-4.5-preview-2025-02-27',
  'gpt-4o': 'gpt-4o-2024-08-06',
  'gpt-4o-mini': 'gpt-4o-mini-2024-07-18',
  'o1': 'o1-2024-12-17',
  'o3-mini': 'o3-mini-2025-01-31',
  'o1-mini': 'o1-mini-2024-09-12'
};

const claudeModels = {
  'claude-3-7': 'claude-3-7-sonnet-20250219',
  'claude-3-5': 'claude-3-5-sonnet-20250219'
};

const deepseekModels = {
  'deepseek-chat': 'chat',
  'deepseek-coder': 'coder',
  'deepseek-reasoner': 'reasoner'
};

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
  'mistral-small-31': {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    name: 'Mistral Small 3.1'
  },
  'mistral-nemo': {
    id: 'mistralai/mistral-nemo:free',
    name: 'Mistral Nemo'
  },
  'deepseek-v3-0324': {
    id: 'deepseek/deepseek-chat-v3-0324:free',
    name: 'DeepSeek V3 0324'
  },
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
  'deepseek/deepseek-r1-0528:free': {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1'
  },
  'deepseek/deepseek-r1-zero:free': {
    id: 'deepseek/deepseek-r1-zero:free',
    name: 'DeepSeek R1 Zero'
  },
  'deepseek/deepseek-prover-v2:free': {
    id: 'deepseek/deepseek-prover-v2:free',
    name: 'DeepSeek Prover V2'
  },
  'qwen/qwen3-30b-a3b:free': {
    id: 'qwen/qwen3-30b-a3b:free',
    name: 'Qwen3 30B A3B'
  },
  'qwen/qwen3-235b-a22b:free': {
    id: 'qwen/qwen3-235b-a22b:free',
    name: 'Qwen3 235B A22B'
  },
  'microsoft/mai-ds-r1:free': {
    id: 'microsoft/mai-ds-r1:free',
    name: 'Microsoft MAI DS R1'
  },
  'tngtech/deepseek-r1t-chimera:free': {
    id: 'tngtech/deepseek-r1t-chimera:free',
    name: 'TNG DeepSeek R1T Chimera'
  },
  'qwen/qwen3-0.6b-04-28:free': {
    id: 'qwen/qwen3-0.6b-04-28:free',
    name: 'Qwen3 0.6B'
  },
  'microsoft/phi-4-reasoning:free': {
    id: 'microsoft/phi-4-reasoning:free',
    name: 'Phi 4 Reasoning'
  },
  'microsoft/phi-4-reasoning-plus:free': {
    id: 'microsoft/phi-4-reasoning-plus:free',
    name: 'Phi 4 Reasoning Plus'
  }
};

const geminiModels = {
  'gemini-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash'
  },
  'gemini-flash-2.5': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash'
  },
  'gemini-lite': {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Pro'
  },
  'gemini-thinking': {
    id: 'gemini-2.0-flash-thinking-exp-01-21',
    name: 'Gemini 2.0 Flash Thinking'
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro'
  }
};

const modelDisplayNames = {
  // OpenAI
  'gpt-4.5-preview': 'GPT-4.5 Preview',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4o-mini-or': 'GPT-4o Mini',
  'o1': 'O1',
  'o3-mini': 'O3 Mini',
  'o1-mini': 'O1 Mini',
  // Google
  'gemini-flash': 'Gemini 2.0 Flash',
  'gemini-flash-2.5':'Gemini 2.5 Flash',
  'gemini-lite': 'Gemini Lite',
  'gemini-thinking': 'Gemini 2.0 Flash Thinking',
  'gemini-2.5-pro': 'Gemini 2.5 Pro', 
  // DeepSeek official models
  'deepseek-chat': 'DeepSeek V3',
  'deepseek-coder': 'DeepSeek Coder',
  'deepseek-reasoner': 'DeepSeek R1',
  // OpenRouter models
  'deepseek-distill': 'DeepSeek R1 70B',
  'deepseek-v3-openrouter': 'DeepSeek V3 (Free)',
  'mistral-7b': 'Mistral Medium',
  'llama2-70b': 'Llama-2 70B',
  'phi3': 'Phi-3',
  'qwen-32b': 'Qwen Coder 32B',
  'openchat': 'OpenChat 3.5',
  'nemotron-70b': 'Nemotron 70B',
  'mistral-small-3': 'Mistral Small 3',
  'mistral-small-31': 'Mistral Small 3.1 24B', 
  'mistral-nemo': 'Mistral Nemo',
  'deepseek-v3-0324': 'DeepSeek V3 Latest', 
  'deepseek/deepseek-prover-v2:free': 'DeepSeek Prover V2',
  'qwen/qwen3-30b-a3b:free': 'Qwen3 30B A3B',
  'qwen/qwen3-235b-a22b:free': 'Qwen3 235B A22B',
  'microsoft/mai-ds-r1:free': 'Microsoft MAI DS R1',
  'tngtech/deepseek-r1t-chimera:free': 'TNG DeepSeek R1T Chimera',
  'qwen/qwen3-0.6b-04-28:free': 'Qwen3 0.6B',
  'microsoft/phi-4-reasoning:free': 'Phi 4 Reasoning',
  'microsoft/phi-4-reasoning-plus:free': 'Phi 4 Reasoning Plus',
  // Anthropic
  'claude-3-7': 'Claude 3.7 Sonnet',
  'claude-3-5': 'Claude 3.5 Sonnet',
  'summary': 'Summarizer',  
  // NVIDIA Models
  'nvidia/llama-3.1-nemotron-nano-8b-v1:free': 'Nemotron Nano 8B',
  'nvidia/llama-3.3-nemotron-super-49b-v1:free': 'Nemotron Super 49B',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1:free': 'Nemotron Ultra 253B',
  // DeepSeek Models
  'deepseek/deepseek-r1:free': 'DeepSeek R1',
  'deepseek/deepseek-r1-zero:free': 'DeepSeek R1 Zero',
  // Meta Models
  'meta-llama/llama-3.2-11b-vision-instruct:free': 'Llama 3.2 Vision',
  'meta-llama/llama-3.1-8b-instruct:free': 'Llama 3.1 8B',
};

const modelCategories = {
  Google: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', description: 'Latest Gemini 2.5 Pro with enhanced capabilities', context: 0, color: 'from-emerald-400 to-emerald-600', icon: '🧠', badge: 'Free' },
    { id: 'gemini-flash-2.5', name: 'Gemini 2.5 Flash', provider: 'Google', description: 'Latest Flash model with improved speed and capabilities', context: 0, color: 'from-yellow-400 to-yellow-600', icon: '⚡', badge: 'Free' },
    { id: 'gemini-flash', name: 'Gemini 2.0 Flash', provider: 'Google', description: 'Fastest performance optimized model', context: 0, color: 'from-blue-400 to-blue-600', icon: '🚀', badge: 'Free' },
    { id: 'gemini-lite', name: 'Gemini Lite', provider: 'Google', description: 'Full-featured model with enhanced capabilities', context: 0, color: 'from-indigo-400 to-indigo-600', icon: '🌟', badge: 'Free' },
    { id: 'gemini-thinking', name: 'Gemini 2.0 Flash Thinking', provider: 'Google', description: 'Advanced reasoning for more thoughtful responses', context: 0, color: 'from-purple-400 to-purple-600', icon: '🤔', badge: 'Free' }
  ],
  OpenRouter: [
    { id: 'deepseek-v3-0324', name: 'DeepSeek V3 Latest', description: 'DeepSeek V3, a 685B-parameter, mixture-of-experts model', provider: 'OpenRouter', color: 'from-purple-400 to-purple-600', badge: 'Free', context: '32K', icon: '🧠', highlighted: true },
    { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', provider: 'OpenRouter', description: 'Advanced reasoning and analysis model', context: '32K', badge: 'Free', color: 'from-violet-400 to-violet-600', icon: '🤔' },
    { id: 'deepseek/deepseek-prover-v2:free', name: 'DeepSeek Prover V2', provider: 'OpenRouter', description: 'Advanced mathematical and logical proof verification model', context: '32K', badge: 'Free', color: 'from-blue-400 to-blue-600', icon: '🔍' },
    { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free', name: 'Nemotron Ultra 253B', provider: 'OpenRouter', description: 'Ultra-large 253B parameter model for complex tasks', context: '32K', badge: 'Free', color: 'from-purple-400 to-purple-600', icon: '🌠' },
    { id: 'mistral-small-3', name: 'Mistral Small 3', provider: 'OpenRouter', description: 'Compact yet powerful 24B parameter instruction model', context: '32K', badge: 'Free', color: 'from-blue-400 to-blue-600', icon: '🌪️' },
    { id: 'mistral-nemo', name: 'Mistral Nemo', provider: 'OpenRouter', description: 'Advanced Mistral model with enhanced capabilities', context: '32K', badge: 'Free', color: 'from-indigo-400 to-indigo-700', icon: '🌊' },
    { id: 'mistral-small-31', name: 'Mistral Small 3.1 24B', description: 'Latest Mistral small model with improved reasoning', provider: 'OpenRouter', color: 'from-purple-400 to-purple-600', badge: 'Free', icon: '🏆' },
    { id: 'qwen-32b', name: 'Qwen Coder 32B', provider: 'OpenRouter', description: 'Code-Specific Qwen large language models', context: '32K', badge: 'Free', color: 'from-red-400 to-red-600', icon: '🌏' },
    { id: 'llama2-70b', name: 'Llama-2 70B', provider: 'OpenRouter', description: 'Meta\'s largest open model', context: '128K', badge: 'Free', color: 'from-blue-500 to-blue-700', icon: '🦙' },
    { id: 'mistral-7b', name: 'Mistral 7B Instruct', provider: 'OpenRouter', description: 'A high-performing model with optimizations for speed and context length.', badge: 'Free', color: 'from-purple-400 to-purple-600', icon: '🌪️' },
    { id: 'phi3', name: 'Phi-3', provider: 'OpenRouter', description: 'Compact but capable model', context: '8K', badge: 'Free', color: 'from-cyan-400 to-cyan-600', icon: 'φ' },
    { id: 'openchat', name: 'OpenChat 3.5', provider: 'OpenRouter', description: 'Open-source chat model', context: '8K', badge: 'Free', color: 'from-green-400 to-green-600', icon: '💬' },
    { id: 'nvidia/llama-3.1-nemotron-nano-8b-v1:free', name: 'Nemotron Nano 8B', provider: 'OpenRouter', description: 'Efficient 8B parameter model for general tasks', context: '32K', badge: 'Free', color: 'from-green-400 to-green-600', icon: '⚡' },
    { id: 'nvidia/llama-3.3-nemotron-super-49b-v1:free', name: 'Nemotron Super 49B', provider: 'OpenRouter', description: 'Powerful 49B parameter model with enhanced capabilities', context: '32K', badge: 'Free', color: 'from-blue-400 to-blue-600', icon: '🚀' },
    { id: 'meta-llama/llama-3.2-11b-vision-instruct:free', name: 'Llama 3.2 Vision', provider: 'OpenRouter', description: 'Vision-language model for multimodal tasks', context: '32K', badge: 'Free', color: 'from-indigo-400 to-indigo-600', icon: '👁️' },
    { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B', provider: 'OpenRouter', description: 'Efficient instruction-following model', context: '32K', badge: 'Free', color: 'from-cyan-400 to-cyan-600', icon: '🦙' },
    { id: 'deepseek-v3-openrouter', name: 'DeepSeek V3 (Free)', provider: 'OpenRouter', description: 'Latest DeepSeek chat model optimized for performance', context: '32K', badge: 'Free', color: 'from-purple-400 to-purple-600', icon: '🌌' },
    { id: 'deepseek/deepseek-r1-zero:free', name: 'DeepSeek R1 Zero', provider: 'OpenRouter', description: 'Optimized version of R1 for faster responses', context: '32K', badge: 'Free', color: 'from-rose-400 to-rose-600', icon: '⚡' },
    { id: 'deepseek-distill', name: 'DeepSeek R1 Distill 70B', provider: 'OpenRouter', description: 'Advanced reasoning model', context: '164K', badge: 'Free', color: 'from-violet-400 to-violet-600', icon: '🔮' },
    { id: 'qwen/qwen3-30b-a3b:free', name: 'Qwen3 30B A3B', provider: 'OpenRouter', description: 'Advanced 30B parameter model with enhanced capabilities', context: '32K', badge: 'Free', color: 'from-green-400 to-green-600', icon: '🌟' },
    { id: 'qwen/qwen3-235b-a22b:free', name: 'Qwen3 235B A22B', provider: 'OpenRouter', description: 'Ultra-large 235B parameter model for complex tasks', context: '32K', badge: 'Free', color: 'from-purple-400 to-purple-600', icon: '🚀' },
    { id: 'microsoft/mai-ds-r1:free', name: 'Microsoft MAI DS R1', provider: 'OpenRouter', description: 'Specialized data science and analysis model', context: '32K', badge: 'Free', color: 'from-blue-500 to-blue-700', icon: '📊' },
    { id: 'tngtech/deepseek-r1t-chimera:free', name: 'TNG DeepSeek R1T Chimera', provider: 'OpenRouter', description: 'Hybrid model combining multiple specialized capabilities', context: '32K', badge: 'Free', color: 'from-indigo-400 to-indigo-600', icon: '🐉' },
    { id: 'qwen/qwen3-0.6b-04-28:free', name: 'Qwen3 0.6B', provider: 'OpenRouter', description: 'Efficient compact model optimized for quick responses', context: '32K', badge: 'Free', color: 'from-cyan-400 to-cyan-600', icon: '⚡' },
    { id: 'microsoft/phi-4-reasoning:free', name: 'Phi 4 Reasoning', provider: 'OpenRouter', description: 'Advanced reasoning and problem-solving model', context: '32K', badge: 'Free', color: 'from-violet-400 to-violet-600', icon: '🧠' },
    { id: 'microsoft/phi-4-reasoning-plus:free', name: 'Phi 4 Reasoning Plus', provider: 'OpenRouter', description: 'Enhanced version of Phi 4 with improved reasoning capabilities', context: '32K', badge: 'Free', color: 'from-rose-400 to-rose-600', icon: '🎯' }
  ],
  OpenAI: [
    { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview', provider: 'OpenAI', description: 'Latest GPT-4.5 preview model with enhanced capabilities', context: 0, color: 'from-violet-400 to-fuchsia-600', icon: '🔮', badge: 'Paid' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', description: 'Advanced GPT-4 Omega model', context: 0, color: 'from-blue-400 to-indigo-600', icon: 'Ω', badge: 'Paid' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', description: 'Compact version of GPT-4 Omega', context: 0, color: 'from-cyan-400 to-blue-600', icon: 'ω', badge: 'Paid' },
    { id: 'o1', name: 'O1', provider: 'OpenAI', description: 'Next generation O1 model', context: 0, color: 'from-rose-400 to-pink-600', icon: '🌟', badge: 'Paid' },
    { id: 'o3-mini', name: 'O3 Mini', provider: 'OpenAI', description: 'Compact O3 model with efficient performance', context: 0, color: 'from-purple-400 to-violet-600', icon: '💫', badge: 'Paid' },
    { id: 'o1-mini', name: 'O1 Mini', provider: 'OpenAI', description: 'Efficient and compact O1 model', context: 0, color: 'from-fuchsia-400 to-purple-600', icon: '✨', badge: 'Paid' }
  ],
  Anthropic: [
    { id: 'claude-3-7', name: 'Claude 3.7 Sonnet', provider: 'Anthropic', description: 'Latest Claude model with superior reasoning and analysis', context: 0, color: 'from-orange-400 to-orange-600', icon: '🧠', badge: 'Paid' },
    { id: 'claude-3-5', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', description: 'Advanced Claude model optimized for complex tasks', context: 0, color: 'from-orange-500 to-orange-700', icon: '🤖', badge: 'Paid' }
  ],
  DeepSeek: [
    { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek', description: 'Latest DeepSeek chat model optimized for performance', context: '32K', color: 'from-purple-400 to-purple-600', icon: '🌌', badge: 'Paid' },
    { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'DeepSeek', description: 'Specialized model for coding tasks and technical discussions', context: '32K', color: 'from-indigo-400 to-indigo-600', icon: '👨‍💻', badge: 'Paid' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'DeepSeek', description: 'Advanced model with chain-of-thought reasoning', context: '32K', color: 'from-blue-400 to-blue-600', icon: '🤔', badge: 'Paid' }
  ]
};


module.exports = {
  providerMap,
  openAIModels,
  claudeModels,
  deepseekModels,
  openRouterModels,
  geminiModels,
  modelDisplayNames,
  modelCategories
}; 