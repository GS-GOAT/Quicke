import { useState, useEffect } from 'react';
import Head from 'next/head';
import ModelSelector from '../components/ModelSelector';
import PromptInput from '../components/PromptInput';
import ResponseColumn from '../components/ResponseColumn';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedModels, setSelectedModels] = useState(['gpt-4', 'claude', 'gemini']);
  const [error, setError] = useState(null);
  const [showModelSelector, setShowModelSelector] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return;
    
    setLoading(true);
    setError(null);
    
    // Add prompt to history
    const newEntry = {
      id: Date.now(),
      prompt,
      responses: {}
    };
    
    setHistory(prev => [...prev, newEntry]);
    
    // Initialize streaming state for each model
    const streamingState = {};
    selectedModels.forEach(model => {
      streamingState[model] = { 
        text: '', 
        loading: true, 
        model: getLabelForModel(model),
        streaming: true
      };
    });
    
    // Update the latest history entry with initial streaming state
    setHistory(prev => {
      const updated = [...prev];
      updated[updated.length - 1].responses = streamingState;
      return updated;
    });
    
    try {
      const eventSource = new EventSource(`/api/stream?prompt=${encodeURIComponent(prompt)}&models=${selectedModels.join(',')}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.done) {
          eventSource.close();
          setLoading(false);
          return;
        }
        
        // Update the streaming response for the specific model
        setHistory(prev => {
          const updated = [...prev];
          const latestEntry = updated[updated.length - 1];
          
          if (data.model && data.text) {
            latestEntry.responses[data.model] = {
              ...latestEntry.responses[data.model],
              text: data.text,
              streaming: true
            };
          } else if (data.model && data.error) {
            latestEntry.responses[data.model] = {
              ...latestEntry.responses[data.model],
              error: data.error,
              streaming: false,
              loading: false
            };
          }
          
          return updated;
        });
      };
      
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        setError('Connection error. Please try again.');
        setLoading(false);
      };
      
    } catch (err) {
      setError(err.message);
      console.error('Error fetching responses:', err);
      setLoading(false);
    }
    
    // Clear prompt after sending
    setPrompt('');
  };

  const handleClear = () => {
    setPrompt('');
    setHistory([]);
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
    <div className="flex flex-col h-screen bg-gray-50">
      <Head>
        <title>Quicke - LLM Response Comparison</title>
        <meta name="description" content="Compare responses from multiple LLMs side by side" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-white shadow py-4 px-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Quicke</h1>
        <button 
          onClick={() => setShowModelSelector(!showModelSelector)} 
          className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium"
        >
          {showModelSelector ? 'Hide Models' : 'Select Models'}
        </button>
      </header>
      
      {showModelSelector && (
        <div className="p-4 bg-white shadow-md m-2 rounded-lg">
          <ModelSelector 
            selectedModels={selectedModels} 
            setSelectedModels={setSelectedModels} 
          />
        </div>
      )}
      
      {error && (
        <div className="mx-auto w-full max-w-4xl p-4 my-2 bg-red-100 text-red-700 rounded-md">
          Error: {error}
        </div>
      )}
      
      <main className="flex-grow overflow-auto px-4 py-2">
        <div className="max-w-4xl mx-auto">
          {history.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-700">Welcome to Quicke</h2>
                <p className="mt-2 text-gray-500">
                  Enter a prompt below to see responses from multiple LLMs side by side
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8 pb-20">
              {history.map((entry) => (
                <div key={entry.id} className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
                    <p className="font-medium text-gray-700">You:</p>
                    <p className="mt-1 text-gray-800">{entry.prompt}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedModels.map(model => (
                      <ResponseColumn 
                        key={model}
                        model={getLabelForModel(model)}
                        response={entry.responses[model]}
                        streaming={entry.responses[model]?.streaming}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <PromptInput 
            prompt={prompt} 
            setPrompt={setPrompt} 
            onSubmit={handleSubmit}
            onClear={handleClear}
            disabled={loading || selectedModels.length === 0}
          />
        </div>
      </footer>
    </div>
  );
} 