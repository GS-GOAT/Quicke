import { useState, useEffect } from 'react';

export default function ModelSelector({ selectedModels, setSelectedModels }) {
  const availableModels = [
    { 
      id: 'gpt-4', 
      name: 'GPT-4',
      provider: 'OpenAI',
      description: 'Most capable model for complex tasks.',
      color: 'from-emerald-400 to-emerald-600',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M16.5 7.5h-9v9h9v-9z" />
          <path fillRule="evenodd" d="M8.25 2.25A.75.75 0 019 3v.75h2.25V3a.75.75 0 011.5 0v.75H15V3a.75.75 0 011.5 0v.75h.75a3 3 0 013 3v.75H21A.75.75 0 0121 9h-.75v2.25H21a.75.75 0 010 1.5h-.75v2.25H21a.75.75 0 010 1.5h-.75v.75a3 3 0 01-3 3h-.75V21a.75.75 0 01-1.5 0v-.75h-2.25V21a.75.75 0 01-1.5 0v-.75H9V21a.75.75 0 01-1.5 0v-.75h-.75a3 3 0 01-3-3v-.75H3A.75.75 0 013 15h.75v-2.25H3a.75.75 0 010-1.5h.75V9H3a.75.75 0 010-1.5h.75v-.75a3 3 0 013-3h.75V3a.75.75 0 01.75-.75zM6 6.75A.75.75 0 016.75 6h10.5a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V6.75z" clipRule="evenodd" />
        </svg>
      )
    },
    { 
      id: 'claude', 
      name: 'Claude 3 Sonnet',
      provider: 'Anthropic',
      description: 'Balances speed and intelligence, excellent for general use.',
      color: 'from-orange-400 to-orange-600',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M12 .75a8.25 8.25 0 00-4.135 15.39c.686.398 1.115 1.008 1.134 1.623a.75.75 0 00.577.706c.352.083.71.148 1.074.195.323.041.6-.218.6-.544v-4.661a6.75 6.75 0 111.5 0v4.66c0 .327.277.586.6.545.364-.047.722-.112 1.074-.195a.75.75 0 00.577-.706c.02-.615.448-1.225 1.134-1.623A8.25 8.25 0 0012 .75z" />
          <path fillRule="evenodd" d="M9.013 19.9a.75.75 0 01.877-.597 11.319 11.319 0 004.22 0 .75.75 0 11.28 1.473 12.819 12.819 0 01-4.78 0 .75.75 0 01-.597-.876zM9.754 22.344a.75.75 0 01.824-.668 13.682 13.682 0 002.844 0 .75.75 0 11.156 1.492 15.156 15.156 0 01-3.156 0 .75.75 0 01-.668-.824z" clipRule="evenodd" />
        </svg>
      )
    },
    { 
      id: 'gemini', 
      name: 'Gemini Pro',
      provider: 'Google',
      description: 'Versatile model for a wide range of applications.',
      color: 'from-blue-400 to-blue-600',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
        </svg>
      )
    }
  ];

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
    const modelId = `custom-${newCustomModel.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
    setCustomModels([...customModels, { ...newCustomModel, id: modelId }]);
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

  return (
    <div className="overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Models</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Choose which AI models to compare side by side
        </p>
      </div>
      
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <p>API keys are stored securely in your browser's local storage.</p>
      </div>
    </div>
  );
} 