function ModelSelector({ selectedModels, setSelectedModels }) {
  const availableModels = [
    { 
      id: 'gpt-4', 
      name: 'GPT-4',
      provider: 'OpenAI',
      description: 'Most capable GPT-4 model for complex tasks',
      color: 'from-emerald-400 to-emerald-600',
      icon: '🤖'
    },
    { 
      id: 'claude', 
      name: 'Claude 3 Sonnet',
      provider: 'Anthropic',
      description: 'Latest Claude model with strong reasoning capabilities',
      color: 'from-orange-400 to-orange-600',
      icon: '🧠'
    },
    { 
      id: 'gemini', 
      name: 'Gemini 2.0 Flash',
      provider: 'Google',
      description: 'Google\'s most capable model',
      color: 'from-blue-400 to-blue-600',
      icon: '🌟'
    },
    { 
      id: 'deepseek-r1', 
      name: 'DeepSeek R1',
      provider: 'DeepSeek',
      description: 'Advanced reasoning model with strong analytical capabilities',
      color: 'from-purple-400 to-purple-600',
      icon: '🔍'
    }
  ];

  const toggleModel = (modelId) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(selectedModels.filter(id => id !== modelId));
    } else {
      setSelectedModels([...selectedModels, modelId]);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Select Models</h3>
      <div className="text-sm text-gray-500 mb-3">
        Available models: {availableModels.map(m => m.name).join(', ')}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {availableModels.map(model => (
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
    </div>
  );
}

export default ModelSelector;