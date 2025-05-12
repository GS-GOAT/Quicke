import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

export default function ModelSelector({ isOpen, setIsOpen, models, selectedModels, setSelectedModels }) {
  const [activeCategory, setActiveCategory] = useState('all');

  const modelCategories = {
    Google: [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'Google',
        description: 'Latest Gemini 2.5 Pro with enhanced capabilities',
        context: 0,
        color: 'from-emerald-400 to-emerald-600',
        icon: '🧠',
        badge: 'Free',
      },
      {
        id: 'gemini-flash-2.5',
        name: 'Gemini 2.5 Flash',
        provider: 'Google',
        description: 'Latest Flash model with improved speed and capabilities',
        context: 0,
        color: 'from-yellow-400 to-yellow-600',
        icon: '⚡',
        badge: 'Free',
      },
      { 
        id: 'gemini-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'Google',
        description: 'Fastest performance optimized model',
        context: 0,
        color: 'from-blue-400 to-blue-600',
        icon: '🚀',
        badge: 'Free',
      },
      {
        id: 'gemini-lite',
        name: 'Gemini Lite',
        provider: 'Google',
        description: 'Full-featured model with enhanced capabilities',
        context: 0,
        color: 'from-indigo-400 to-indigo-600',
        icon: '🌟',
        badge: 'Free',
      },
      {
        id: 'gemini-thinking',
        name: 'Gemini 2.0 Flash Thinking',
        provider: 'Google',
        description: 'Advanced reasoning for more thoughtful responses',
        context: 0,
        color: 'from-purple-400 to-purple-600',
        icon: '🤔',
        badge: 'Free',
      }
    ],
    OpenRouter: [
        {
          id: 'deepseek-v3-0324',
          name: 'DeepSeek V3 Latest',
          description: 'DeepSeek V3, a 685B-parameter, mixture-of-experts model',
          provider: 'OpenRouter',
          color: 'from-purple-400 to-purple-600',
          badge: 'Free',
          context: '32K',
          icon: '🧠',
          highlighted: true
        },
        {
          id: 'nemotron-70b',
          name: 'Nemotron 70B',
          provider: 'OpenRouter',
          description: 'NVIDIA\'s advanced Llama 3.1 based instruction model',
          context: '32K',
          badge: 'Free',
          color: 'from-green-500 to-green-700',
          icon: '🎮'
        },
        {
          id: 'deepseek-v3-openrouter',
          name: 'DeepSeek V3 (Free)',
          provider: 'OpenRouter',
          description: 'Latest DeepSeek chat model optimized for performance',
          context: '32K',
          badge: 'Free',
          color: 'from-purple-400 to-purple-600',
          icon: '🌌'
        },
        {
          id: 'deepseek-distill',
          name: 'DeepSeek R1 Distill 70B',
          provider: 'OpenRouter',
          description: 'Advanced reasoning model',
          context: '164K',
          badge: 'Free',
          color: 'from-violet-400 to-violet-600',
          icon: '🔮'
        },
        {
          id: 'mistral-small-3',
          name: 'Mistral Small 3',
          provider: 'OpenRouter',
          description: 'Compact yet powerful 24B parameter instruction model',
          context: '32K',
          badge: 'Free',
          color: 'from-blue-400 to-blue-600',
          icon: '🌪️'
        },
        {
          id: 'mistral-nemo',
          name: 'Mistral Nemo',
          provider: 'OpenRouter',
          description: 'Advanced Mistral model with enhanced capabilities',
          context: '32K',
          badge: 'Free',
          color: 'from-indigo-400 to-indigo-700',
          icon: '🌊'
        },
        {
          id: 'mistral-small-31',
          name: 'Mistral Small 3.1 24B',
          description: 'Latest Mistral small model with improved reasoning',
          provider: 'OpenRouter',
          color: 'from-purple-400 to-purple-600',
          badge: 'Free',
          icon: '🏆',
        },
        {
          id: 'qwen-32b',
          name: 'Qwen Coder 32B',
          provider: 'OpenRouter',
          description: 'Code-Specific Qwen large language models',
          context:'32K',
          badge: 'Free',
          color: 'from-red-400 to-red-600',
          icon: '🌏'
        },
        {
          id: 'llama2-70b',
          name: 'Llama-2 70B',
          provider: 'OpenRouter',
          description: 'Meta\'s largest open model',
          context:'128K',
          badge: 'Free',
          color: 'from-blue-500 to-blue-700',
          icon: '🦙'
        },
        {
          id: 'mistral-7b',
          name: 'Mistral 7B Instruct',
          provider: 'OpenRouter',
          description: 'A high-performing model with optimizations for speed and context length.',
          badge: 'Free',
          color: 'from-purple-400 to-purple-600',
          icon: '🌪️'
        },
        {
          id: 'phi3',
          name: 'Phi-3',
          provider: 'OpenRouter',
          description: 'Compact but capable model',
          context:'8K',
          badge: 'Free',
          color: 'from-cyan-400 to-cyan-600',
          icon: 'φ'
        },
        {
          id: 'openchat',
          name: 'OpenChat 3.5',
          provider: 'OpenRouter',
          description: 'Open-source chat model',
          context:'8K',
          badge: 'Free',
          color: 'from-green-400 to-green-600',
          icon: '💬'
        },
        {
          id: 'nvidia/llama-3.1-nemotron-nano-8b-v1:free',
          name: 'Nemotron Nano 8B',
          provider: 'OpenRouter',
          description: 'Efficient 8B parameter model for general tasks',
          context: '32K',
          badge: 'Free',
          color: 'from-green-400 to-green-600',
          icon: '⚡'
        },
        {
          id: 'nvidia/llama-3.3-nemotron-super-49b-v1:free',
          name: 'Nemotron Super 49B',
          provider: 'OpenRouter',
          description: 'Powerful 49B parameter model with enhanced capabilities',
          context: '32K',
          badge: 'Free',
          color: 'from-blue-400 to-blue-600',
          icon: '🚀'
        },
        {
          id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
          name: 'Nemotron Ultra 253B',
          provider: 'OpenRouter',
          description: 'Ultra-large 253B parameter model for complex tasks',
          context: '32K',
          badge: 'Free',
          color: 'from-purple-400 to-purple-600',
          icon: '🌠'
        },
        {
          id: 'meta-llama/llama-3.2-11b-vision-instruct:free',
          name: 'Llama 3.2 Vision',
          provider: 'OpenRouter',
          description: 'Vision-language model for multimodal tasks',
          context: '32K',
          badge: 'Free',
          color: 'from-indigo-400 to-indigo-600',
          icon: '👁️'
        },
        {
          id: 'meta-llama/llama-3.1-8b-instruct:free',
          name: 'Llama 3.1 8B',
          provider: 'OpenRouter',
          description: 'Efficient instruction-following model',
          context: '32K',
          badge: 'Free',
          color: 'from-cyan-400 to-cyan-600',
          icon: '🦙'
        },
        {
          id: 'deepseek/deepseek-r1:free',
          name: 'DeepSeek R1',
          provider: 'OpenRouter',
          description: 'Advanced reasoning and analysis model',
          context: '32K',
          badge: 'Free',
          color: 'from-violet-400 to-violet-600',
          icon: '🤔'
        },
        {
          id: 'deepseek/deepseek-r1-zero:free',
          name: 'DeepSeek R1 Zero',
          provider: 'OpenRouter',
          description: 'Optimized version of R1 for faster responses',
          context: '32K',
          badge: 'Free',
          color: 'from-rose-400 to-rose-600',
          icon: '⚡'
        },
        {
          id: 'deepseek/deepseek-prover-v2:free',
          name: 'DeepSeek Prover V2',
          provider: 'OpenRouter',
          description: 'Advanced mathematical and logical proof verification model',
          context: '32K',
          badge: 'Free',
          color: 'from-blue-400 to-blue-600',
          icon: '🔍'
        },
        {
          id: 'qwen/qwen3-30b-a3b:free',
          name: 'Qwen3 30B A3B',
          provider: 'OpenRouter',
          description: 'Advanced 30B parameter model with enhanced capabilities',
          context: '32K',
          badge: 'Free',
          color: 'from-green-400 to-green-600',
          icon: '🌟'
        },
        {
          id: 'qwen/qwen3-235b-a22b:free',
          name: 'Qwen3 235B A22B',
          provider: 'OpenRouter',
          description: 'Ultra-large 235B parameter model for complex tasks',
          context: '32K',
          badge: 'Free',
          color: 'from-purple-400 to-purple-600',
          icon: '🚀'
        },
        {
          id: 'microsoft/mai-ds-r1:free',
          name: 'Microsoft MAI DS R1',
          provider: 'OpenRouter',
          description: 'Specialized data science and analysis model',
          context: '32K',
          badge: 'Free',
          color: 'from-blue-500 to-blue-700',
          icon: '📊'
        },
        {
          id: 'tngtech/deepseek-r1t-chimera:free',
          name: 'TNG DeepSeek R1T Chimera',
          provider: 'OpenRouter',
          description: 'Hybrid model combining multiple specialized capabilities',
          context: '32K',
          badge: 'Free',
          color: 'from-indigo-400 to-indigo-600',
          icon: '🐉'
        },
        {
          id: 'qwen/qwen3-0.6b-04-28:free',
          name: 'Qwen3 0.6B',
          provider: 'OpenRouter',
          description: 'Efficient compact model optimized for quick responses',
          context: '32K',
          badge: 'Free',
          color: 'from-cyan-400 to-cyan-600',
          icon: '⚡'
        },
        {
          id: 'microsoft/phi-4-reasoning:free',
          name: 'Phi 4 Reasoning',
          provider: 'OpenRouter',
          description: 'Advanced reasoning and problem-solving model',
          context: '32K',
          badge: 'Free',
          color: 'from-violet-400 to-violet-600',
          icon: '🧠'
        },
        {
          id: 'microsoft/phi-4-reasoning-plus:free',
          name: 'Phi 4 Reasoning Plus',
          provider: 'OpenRouter',
          description: 'Enhanced version of Phi 4 with improved reasoning capabilities',
          context: '32K',
          badge: 'Free',
          color: 'from-rose-400 to-rose-600',
          icon: '🎯'
        }
    ],
    OpenAI: [
      {
        id: 'gpt-4.5-preview',
        name: 'GPT-4.5 Preview',
        provider: 'OpenAI',
        description: 'Latest GPT-4.5 preview model with enhanced capabilities',
        context: 0,
        color: 'from-violet-400 to-fuchsia-600',
        icon: '🔮',
        badge: 'Paid',
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        description: 'Advanced GPT-4 Omega model',
        context: 0,
        color: 'from-blue-400 to-indigo-600',
        icon: 'Ω',
        badge: 'Paid',
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'OpenAI',
        description: 'Compact version of GPT-4 Omega',
        context: 0,
        color: 'from-cyan-400 to-blue-600',
        icon: 'ω',
        badge: 'Paid',
      },
      {
        id: 'o1',
        name: 'O1',
        provider: 'OpenAI',
        description: 'Next generation O1 model',
        context: 0,
        color: 'from-rose-400 to-pink-600',
        icon: '🌟',
        badge: 'Paid',
      },
      {
        id: 'o3-mini',
        name: 'O3 Mini',
        provider: 'OpenAI',
        description: 'Compact O3 model with efficient performance',
        context: 0,
        color: 'from-purple-400 to-violet-600',
        icon: '💫',
        badge: 'Paid',
      },
      {
        id: 'o1-mini',
        name: 'O1 Mini',
        provider: 'OpenAI',
        description: 'Efficient and compact O1 model',
        context: 0,
        color: 'from-fuchsia-400 to-purple-600',
        icon: '✨',
        badge: 'Paid',
      }
    ],
    Anthropic: [
      { 
        id: 'claude-3-7',
        name: 'Claude 3.7 Sonnet',
        provider: 'Anthropic',
        description: 'Latest Claude model with superior reasoning and analysis',
        context: 0,
        color: 'from-orange-400 to-orange-600',
        icon: '🧠',
        badge: 'Paid',
      },
      {
        id: 'claude-3-5',
        name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        description: 'Advanced Claude model optimized for complex tasks',
        context: 0,
        color: 'from-orange-500 to-orange-700',
        icon: '🤖',
        badge: 'Paid',
      }
    ],
    DeepSeek: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek V3',
        provider: 'DeepSeek',
        description: 'Latest DeepSeek chat model optimized for performance',
        context: '32K',
        color: 'from-purple-400 to-purple-600',
        icon: '🌌',
        badge: 'Paid',
      },
      {
        id: 'deepseek-coder',
        name: 'DeepSeek Coder',
        provider: 'DeepSeek',
        description: 'Specialized model for coding tasks and technical discussions',
        context: '32K',
        color: 'from-indigo-400 to-indigo-600',
        icon: '👨‍💻',
        badge: 'Paid',
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek R1',
        provider: 'DeepSeek',
        description: 'Advanced model with chain-of-thought reasoning',
        context: '32K',
        color: 'from-blue-400 to-blue-600',
        icon: '🤔',
        badge: 'Paid',
      }
    ]
  };

  const handleDeselectAll = () => {
    setSelectedModels([]);
  };

  const allModels = Object.values(modelCategories).flat();

  const filteredModels = activeCategory === 'all' 
    ? allModels 
    : modelCategories[activeCategory] || [];

  const toggleModel = (modelId) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(selectedModels.filter(id => id !== modelId));
    } else {
      setSelectedModels([...selectedModels, modelId]);
    }
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={() => setIsOpen(false)} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-md" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl max-h-[85vh] transform overflow-hidden rounded-xl bg-gray-950 p-4 sm:p-6 shadow-xl transition-all">
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title className="text-xl font-semibold text-white">
                    Select Models 
                    <span className="ml-2 px-2 py-1 bg-primary-600/20 text-primary-400 rounded-lg text-sm">
                      {selectedModels.length} selected
                    </span>
                  </Dialog.Title>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleDeselectAll}
                      className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
                    >
                      Deselect All
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6 overflow-y-auto max-h-[calc(85vh-120px)] pr-2">
                  {Object.keys(modelCategories).map(category => (
                    <div key={category} className="space-y-2">
                      <h3 className="text-lg font-medium text-gray-300 px-1">{category}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                        {modelCategories[category].map(model => (
                          <div 
                            key={model.id}
                            onClick={() => toggleModel(model.id)}
                            className={`relative group cursor-pointer border border-gray-700 rounded-lg p-2 sm:p-3 transition-all ${
                              selectedModels.includes(model.id) 
                                ? 'bg-primary-900/40 border-primary-700 shadow-lg shadow-primary-900/20' 
                                : 'bg-gray-800/50 hover:bg-gray-800 hover:shadow-lg'
                            }`}
                          >
                            <div className="flex items-start space-x-2 sm:space-x-3">
                              <div className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center bg-gradient-to-br ${model.color || 'from-gray-500 to-gray-700'}`}>
                                <span className="text-white text-xs sm:text-sm">{model.icon || '🤖'}</span>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <h4 className="font-medium text-xs sm:text-sm text-white mb-1 truncate pr-6">{model.name}</h4>
                                  {selectedModels.includes(model.id) && (
                                    <div className="absolute top-2 right-2 text-primary-400">
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 sm:w-4 sm:h-4">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center flex-wrap gap-1 sm:gap-2 mt-1">
                                  <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-gray-700 text-gray-300">
                                    {model.provider}
                                  </span>
                                  
                                  {model.badge && (
                                    <span className={`inline-flex items-center px-1 py-0.5 rounded text-[10px] sm:text-xs font-medium ${
                                      model.badge === 'Free' 
                                        ? 'bg-green-900/30 text-green-400 border border-green-800/30' 
                                        : 'bg-purple-900/30 text-purple-400 border border-purple-800/30'
                                    }`}>
                                      {model.badge}
                                    </span>
                                  )}
                                </div>
                                
                                {model.description && (
                                  <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-400 line-clamp-2 sm:line-clamp-1 group-hover:text-gray-300 transition-colors">
                                    {model.description}
                                    <div className="absolute invisible group-hover:visible z-10 w-64 p-2 mt-2 text-xs bg-gray-800 border border-gray-700 rounded-md shadow-xl text-gray-300 top-full left-0">
                                      {model.description}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}