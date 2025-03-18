import { useState, useEffect } from 'react';

export default function ModelSelector({ selectedModels, setSelectedModels }) {
  const [activeCategory, setActiveCategory] = useState('all');

  const modelCategories = {
    OpenAI: [
      { 
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'OpenAI',
        description: 'Most capable GPT-4 model for complex tasks',
        context:0,
        color: 'from-emerald-400 to-emerald-600',
        icon: '🤖'
      },
    ],
    Anthropic: [
      { 
        id: 'claude',
        name: 'Claude 3 Sonnet',
        provider: 'Anthropic',
        description: 'Latest Claude model with strong reasoning capabilities',
        context:0,
        color: 'from-orange-400 to-orange-600',
        icon: '🧠'
      }
    ],
    Google: [
      { 
        id: 'gemini',
        name: 'Gemini 2.0 Flash',
        provider: 'Google',
        description: 'Google\'s most capable model',
        context:0,
        color: 'from-blue-400 to-blue-600',
        icon: '🌟'
      }
    ],
    openrouter: [
      { 
        id: 'deepseek-r1',
        name: 'DeepSeek R1',
        provider: 'DeepSeek',
        description: 'Advanced reasoning and knowledge model',
        context:'164K',
        color: 'from-violet-400 to-violet-600',
        icon: '🔮'
      },
      {
        id: 'deepseek-v3',
        name: 'DeepSeek V3',
        provider: 'DeepSeek',
        description: 'Latest DeepSeek chat model optimized for performance',
        context: '32K',
        color: 'from-purple-400 to-purple-600',
        icon: '🌌'
      },
      {
        id: 'nemotron-70b',
        name: 'Nemotron 70B',
        provider: 'NVIDIA',
        description: 'NVIDIA\'s advanced Llama 3.1 based instruction model',
        context: '32K',
        color: 'from-green-500 to-green-700',
        icon: '🎮'
      },
      {
        id: 'mistral-small-3',
        name: 'Mistral Small 3',
        provider: 'Mistral AI',
        description: 'Compact yet powerful 24B parameter instruction model',
        context: '32K',
        color: 'from-blue-400 to-blue-600',
        icon: '🌪️'
      },
      {
        id: 'mistral-nemo',
        name: 'Mistral Nemo',
        provider: 'Mistral AI',
        description: 'Advanced Mistral model with enhanced capabilities',
        context: '32K',
        color: 'from-indigo-400 to-indigo-600',
        icon: '🌊'
      },
      {
        id: 'olympiccoder',
        name: 'OlympicCoder 7B',
        provider: 'OpenRouter',
        description: 'Specialized coding model optimized for programming tasks',
        context: '16K',
        color: 'from-yellow-400 to-yellow-600',
        icon: '🏆'
      },
      {
        id: 'qwen-32b',
        name: 'Qwen Coder 32B',
        provider: 'Alibaba',
        description: 'Code-Specific Qwen large language models',
        context:'32K',
        color: 'from-red-400 to-red-600',
        icon: '🌏'
      },
      {
        id: 'llama2-70b',
        name: 'Llama-2 70B',
        provider: 'Meta',
        description: 'Meta\'s largest open model',
        context:'128K',
        color: 'from-blue-500 to-blue-700',
        icon: '🦙'
      },
      {
        id: 'mistral-7b',
        name: 'Mistral 7B Instruct',
        provider: 'Mistral AI',
        description: 'A high-performing model with optimizations for speed and context length.',
        color: 'from-purple-400 to-purple-600',
        icon: '🌪️'
      },
      {
        id: 'phi3',
        name: 'Phi-3',
        provider: 'Microsoft',
        description: 'Compact but capable model',
        context:'8K',
        color: 'from-cyan-400 to-cyan-600',
        icon: 'φ'
      },
      {
        id: 'openchat',
        name: 'OpenChat 3.5',
        provider: 'OpenChat',
        description: 'Open-source chat model',
        context:'8K',
        color: 'from-green-400 to-green-600',
        icon: '💬'
      }
    ]
  };

  const [customModels, setCustomModels] = useState(() => {
    const storedModels = localStorage.getItem('customLLMs');
    return storedModels ? JSON.parse(storedModels) : [];
  });
  
  const [isAddingCustomModel, setIsAddingCustomModel] = useState(false);
  const [newCustomModel, setNewCustomModel] = useState({
    name: '',
    apiEndpoint: '',
    apiKeyName: 'Authorization',
    apiKeyValue: '',
    modelType: 'custom'
  });

  useEffect(() => {
    localStorage.setItem('customLLMs', JSON.stringify(customModels));
  }, [customModels]);

  const toggleModel = (modelId) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(selectedModels.filter(id => id !== modelId));
    } else {
      setSelectedModels([...selectedModels, modelId]);
    }
  };

  const handleInputChange = (e) => {
    setNewCustomModel({ ...newCustomModel, [e.target.name]: e.target.value });
  };

  const addCustomModel = () => {
    if (!newCustomModel.name || !newCustomModel.apiEndpoint || !newCustomModel.apiKeyValue) {
      alert('Please fill in all custom model fields.');
      return;
    }

    // Validate endpoint URL
    try {
      new URL(newCustomModel.apiEndpoint);
    } catch (e) {
      alert('Please enter a valid API endpoint URL');
      return;
    }

    const modelId = `custom-${newCustomModel.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
    const customModel = {
      ...newCustomModel,
      id: modelId,
      type: 'custom',
      color: 'from-gray-400 to-gray-600',
      icon: '🔌'
    };

    // Store custom model config
    const updatedCustomModels = [...customModels, customModel];
    setCustomModels(updatedCustomModels);
    localStorage.setItem('customLLMs', JSON.stringify(updatedCustomModels));

    setSelectedModels([...selectedModels, modelId]);
    setNewCustomModel({
      name: '',
      apiEndpoint: '',
      apiKeyName: 'Authorization',
      apiKeyValue: '',
      modelType: 'custom'
    });
    setIsAddingCustomModel(false);
  };

  const removeCustomModel = (modelId) => {
    setCustomModels(customModels.filter(model => model.id !== modelId));
    setSelectedModels(selectedModels.filter(id => id !== modelId));
  };

  const allModels = Object.values(modelCategories).flat();

  const filteredModels = activeCategory === 'all' 
    ? allModels 
    : modelCategories[activeCategory] || [];

  return (
    <div className="overflow-hidden model-selector-scrollbar">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700/50 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Models</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Select models to be prompted
        </p>
      </div>
      
      <div className="p-5">
        <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === 'all'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            All Models
          </button>
          {Object.keys(modelCategories).map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize whitespace-nowrap transition-colors ${
                activeCategory === category
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map(model => (
            <div 
              key={model.id}
              onClick={() => toggleModel(model.id)}
              className={`group relative overflow-hidden rounded-xl cursor-pointer transition-all duration-200 transform hover:scale-[1.02] ${
                selectedModels.includes(model.id)
                  ? 'ring-2 ring-primary-500 dark:ring-primary-400 bg-primary-50 dark:bg-primary-900/10'
                  : 'ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-gray-300 dark:hover:ring-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${model.color} opacity-10 group-hover:opacity-20 transition-opacity duration-200`} />
              
              <div className="relative p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${model.color} text-white shadow-sm`}>
                    {model.icon}
                  </div>
                  
                  {selectedModels.includes(model.id) && (
                    <div className="flex items-center">
                      <span className="text-xs font-medium text-primary-600 dark:text-primary-400 mr-2">Selected</span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-primary-600 dark:text-primary-400">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">{model.name}</h4>
                  <span className="inline-block text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mb-2">
                    {model.provider}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{model.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          {!isAddingCustomModel ? (
            <button
              onClick={() => setIsAddingCustomModel(true)}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              <span>Add Custom Model</span>
            </button>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Add New Custom Model</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="model-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Model Name</label>
                  <input type="text" name="name" id="model-name" 
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" 
                    value={newCustomModel.name} onChange={handleInputChange} 
                    placeholder="e.g., Grok" 
                  />
                </div>
                <div>
                  <label htmlFor="api-endpoint" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">API Endpoint</label>
                  <input type="url" name="apiEndpoint" id="api-endpoint" 
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" 
                    value={newCustomModel.apiEndpoint} onChange={handleInputChange} 
                    placeholder="https://api.example.com/v1/chat" 
                  />
                </div>
                <div>
                  <label htmlFor="api-key-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">API Key Header</label>
                  <input type="text" name="apiKeyName" id="api-key-name" 
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" 
                    value={newCustomModel.apiKeyName} onChange={handleInputChange} 
                    placeholder="Authorization" 
                  />
                </div>
                <div>
                  <label htmlFor="api-key-value" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                  <input type="password" name="apiKeyValue" id="api-key-value" 
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" 
                    value={newCustomModel.apiKeyValue} onChange={handleInputChange} 
                    placeholder="Your API Key" 
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => setIsAddingCustomModel(false)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={addCustomModel}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors duration-200"
                >
                  Add Model
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400">
      </div>
    </div>
  );
}