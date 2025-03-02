function ModelSelector({ selectedModels, setSelectedModels }) {
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
    <div className="bg-white shadow sm:rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-3">Select Models to Compare</h3>
      <div className="flex flex-wrap gap-3">
        {availableModels.map(model => (
          <button
            key={model.id}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              selectedModels.includes(model.id)
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => toggleModel(model.id)}
          >
            {model.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ModelSelector; 