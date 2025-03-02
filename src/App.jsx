import { useState } from 'react';
import './App.css';
import ResponseColumn from './components/ResponseColumn';
import PromptInput from './components/PromptInput';
import ModelSelector from './components/ModelSelector';

function App() {
  const [prompt, setPrompt] = useState('');
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedModels, setSelectedModels] = useState(['gpt-4', 'claude', 'gemini']);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Initialize loading state for each model
      const loadingState = {};
      selectedModels.forEach(model => {
        loadingState[model] = { loading: true, model: getLabelForModel(model) };
      });
      setResponses(loadingState);
      
      const response = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, models: selectedModels }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch responses');
      }
      
      const data = await response.json();
      setResponses(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching responses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPrompt('');
    setResponses({});
    setError(null);
  };

  function getLabelForModel(modelId) {
    const labels = {
      'gpt-4': 'GPT-4',
      'claude': 'Claude 3 Sonnet',
      'gemini': 'Gemini Pro'
    };
    return labels[modelId] || modelId;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">LLM Comparison Tool</h1>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <ModelSelector 
              selectedModels={selectedModels} 
              setSelectedModels={setSelectedModels} 
            />
          </div>
          
          <PromptInput 
            prompt={prompt} 
            setPrompt={setPrompt} 
            onSubmit={handleSubmit}
            onClear={handleClear}
            disabled={loading || selectedModels.length === 0}
          />
          
          {error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md">
              Error: {error}
            </div>
          )}
          
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedModels.map(model => (
              <ResponseColumn 
                key={model}
                model={getLabelForModel(model)}
                response={responses[model]}
                loading={loading || (responses[model]?.loading)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App; 