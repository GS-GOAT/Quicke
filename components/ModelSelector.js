import { useState, useEffect } from 'react';

export default function ModelSelector({ selectedModels, setSelectedModels }) {
  const availableModels = [
    { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', description: 'Most capable model for complex tasks.', color: 'from-green-400 to-green-600' },
    { id: 'claude', name: 'Claude 3 Sonnet', provider: 'Anthropic', description: 'Balances speed and intelligence, excellent for general use.', color: 'from-orange-400 to-orange-600' },
    { id: 'gemini', name: 'Gemini Pro', provider: 'Google', description: 'Versatile model for a wide range of applications.', color: 'from-blue-400 to-blue-600' },
  ];

  const [customModels, setCustomModels] = useState(() => {
    // Load custom models from local storage or default to empty array
    const storedModels = localStorage.getItem('customLLMs');
    return storedModels ? JSON.parse(storedModels) : [];
  });
  const [newCustomModel, setNewCustomModel] = useState({
    name: '',
    apiEndpoint: '',
    apiKeyName: 'Authorization', // Default API key header name
    apiKeyValue: '',
    modelType: 'custom' // Type identifier for custom models
  });
  const [isAddingCustomModel, setIsAddingCustomModel] = useState(false);

  useEffect(() => {
    // Save custom models to local storage whenever they change
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
    setSelectedModels([...selectedModels, modelId]); // Automatically select the new custom model
    setNewCustomModel({
      name: '',
      apiEndpoint: '',
      apiKeyName: 'Authorization',
      apiKeyValue: '',
      modelType: 'custom'
    });
    setIsAddingCustomModel(false); // Close the form after adding
  };

  const removeCustomModel = (modelId) => {
    setCustomModels(customModels.filter(model => model.id !== modelId));
    setSelectedModels(selectedModels.filter(id => id !== modelId)); // Deselect if selected
  };

  return (
    <div className="bg-white dark:bg-darksurface rounded-xl shadow-soft dark:shadow-soft-dark border border-gray-200 dark:border-gray-700 transition-all duration-200">
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
              className={`relative overflow-hidden rounded-xl cursor-pointer transition-all duration-200 ${
                selectedModels.includes(model.id)
                  ? 'ring-2 ring-primary-500 dark:ring-primary-400'
                  : 'ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-gray-300 dark:hover:ring-gray-600'
              }`}
            >
              {/* Colored gradient background for the header */}
              <div className={`absolute top-0 left-0 right-0 h-12 bg-gradient-to-r ${model.color} opacity-${selectedModels.includes(model.id) ? '100' : '60'}`}></div>
              
              <div className="relative pt-8 pb-4 px-4">
                {selectedModels.includes(model.id) && (
                  <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 rounded-full p-0.5 shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary-600 dark:text-primary-400">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                
                <div className="mt-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">{model.name}</h4>
                  <span className="inline-block mt-1 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {model.provider}
                  </span>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{model.description}</p>
                </div>
              </div>
            </div>
          ))}
          {customModels.map(model => (
            <div
              key={model.id}
              className={`relative overflow-hidden rounded-xl cursor-pointer transition-all duration-200 ${
                selectedModels.includes(model.id)
                  ? 'ring-2 ring-primary-500 dark:ring-primary-400'
                  : 'ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-gray-300 dark:hover:ring-gray-600'
              }`}
            >
              {/* Distinct background for custom models */}
              <div className={`absolute top-0 left-0 right-0 h-12 bg-gradient-to-r from-purple-400 to-purple-600 opacity-${selectedModels.includes(model.id) ? '100' : '60'}`}></div>

              <div className="relative pt-8 pb-4 px-4">
                {selectedModels.includes(model.id) && (
                  <div className="absolute top-2 right-2 bg-white dark:bg-gray-800 rounded-full p-0.5 shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary-600 dark:text-primary-400">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeCustomModel(model.id); }}
                  className="absolute top-2 right-8 bg-white dark:bg-gray-800 rounded-full p-0.5 shadow-md text-red-500 hover:text-red-700"
                  title="Remove custom model"
                  aria-label="Remove custom model"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="mt-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">{model.name} (Custom)</h4>
                  <span className="inline-block mt-1 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    Custom Model
                  </span>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">User-added model</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 px-5">
        {!isAddingCustomModel ? (
          <button
            onClick={() => setIsAddingCustomModel(true)}
            className="w-full px-4 py-2 rounded-md text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 dark:bg-primary-400 dark:hover:bg-primary-500 transition-colors duration-200"
          >
            Add Custom Model
          </button>
        ) : (
          <div>
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-2">Add New Custom Model</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="model-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Model Name</label>
                <input type="text" name="name" id="model-name" className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-800 dark:text-white" value={newCustomModel.name} onChange={handleInputChange} placeholder="e.g., Grok" />
              </div>
              <div>
                <label htmlFor="api-endpoint" className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Endpoint URL</label>
                <input type="url" name="apiEndpoint" id="api-endpoint" className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-800 dark:text-white" value={newCustomModel.apiEndpoint} onChange={handleInputChange} placeholder="e.g., https://api.groklabs.ai/v1/chat/completions" />
              </div>
              <div>
                <label htmlFor="api-key-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key Header Name</label>
                <input type="text" name="apiKeyName" id="api-key-name" className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-800 dark:text-white" value={newCustomModel.apiKeyName} onChange={handleInputChange} placeholder="Authorization" />
              </div>
              <div>
                <label htmlFor="api-key-value" className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key Value</label>
                <input type="text" name="apiKeyValue" id="api-key-value" className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-800 dark:text-white" value={newCustomModel.apiKeyValue} onChange={handleInputChange} placeholder="Your Grok API Key" />
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={addCustomModel}
                className="px-4 py-2 rounded-md text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 dark:bg-primary-400 dark:hover:bg-primary-500 transition-colors duration-200"
              >
                Add Model
              </button>
              <button
                onClick={() => setIsAddingCustomModel(false)}
                className="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-4 px-5 text-sm text-gray-500 dark:text-gray-400">
        Custom models are stored locally in your browser's storage. <strong>API keys are stored in your browser's local storage and are not sent to any server. Handle your API keys with caution.</strong>
      </p>
    </div>
  );
} 