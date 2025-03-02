export default function ModelSelector({ selectedModels, setSelectedModels }) {
  const availableModels = [
    { id: 'gpt-4', name: 'GPT-4' },
    { id: 'claude', name: 'Claude 3 Sonnet' },
    { id: 'gemini', name: 'Gemini Pro' },
  ];

  const toggleModel = (modelId) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(selectedModels.filter(id => id !== modelId));
    } else {
      setSelectedModels([...selectedModels, modelId]);
    }
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
        </div>
      </div>
    </div>
  );
} 