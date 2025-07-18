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

module.exports = {
  providerMap,
  openAIModels,
  claudeModels,
  deepseekModels,
  openRouterModels,
  geminiModels,
  modelDisplayNames,
}; 