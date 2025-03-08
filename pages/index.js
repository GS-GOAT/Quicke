import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import ModelSelector from '../components/ModelSelector';
import PromptInput from '../components/PromptInput';
import ResponseColumn from '../components/ResponseColumn';
import ThemeToggle from '../components/ThemeToggle';
import ApiKeyManager from '../components/ApiKeyManager';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedModels, setSelectedModels] = useState(['gpt-4', 'claude', 'gemini']);
  const [error, setError] = useState(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showApiKeyManager, setShowApiKeyManager] = useState(false);
  const messagesEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const modelButtonRef = useRef(null);
  const modelSelectorRef = useRef(null);

  // Auto-scroll when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Function to handle clicks outside the ModelSelector when it's open
  useEffect(() => {
    function handleClickOutside(event) {
      if (showModelSelector && modelButtonRef.current && modelSelectorRef.current &&
          !modelButtonRef.current.contains(event.target) &&
          !modelSelectorRef.current.contains(event.target)) {
        setShowModelSelector(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showModelSelector]);

  const handleModelButtonMouseEnter = () => {
    setShowModelSelector(true);
  };

  const handleModelSelectorMouseLeave = () => {
    setShowModelSelector(false);
  };

  // Load API keys from localStorage on component mount
  useEffect(() => {
    // This will be handled in the ApiKeyManager component
  }, []);

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return;
    
    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    setLoading(true);
    
    // Initialize responses for all selected models
    const initialResponses = {};
    selectedModels.forEach(model => {
      initialResponses[model] = { loading: true, text: '', error: null };
    });
    
    // Add to history - append to end instead of prepending
    const id = Date.now().toString();
    setHistory(prev => [...prev, { id, prompt, responses: initialResponses }]);
    
    // Clear the prompt input
    setPrompt('');
    
    // Get API keys from localStorage if available
    let apiKeysParam = '';
    try {
      if (typeof window !== 'undefined') {
        const storedKeys = localStorage.getItem('quicke_api_keys');
        if (storedKeys) {
          const { decrypt } = await import('../utils/encryption');
          const decryptedKeys = JSON.parse(decrypt(storedKeys));
          
          // Extract just the keys (not usage data)
          const keyObjects = {
            openai: decryptedKeys.openai?.key || '',
            anthropic: decryptedKeys.anthropic?.key || '',
            google: decryptedKeys.google?.key || '',
            openrouter: decryptedKeys.openrouter?.key || ''
          };
          
          apiKeysParam = `&apiKeys=${encodeURIComponent(JSON.stringify(keyObjects))}`;
        }
      }
    } catch (error) {
      console.error('Error retrieving API keys:', error);
    }
    
    // Create the URL with the selected models and API keys
    const modelsParam = selectedModels.join(',');
    const apiUrl = `/api/stream?prompt=${encodeURIComponent(prompt)}&models=${encodeURIComponent(modelsParam)}${apiKeysParam}`;
    
    // Create a new EventSource for streaming
    const newEventSource = new EventSource(apiUrl);
    eventSourceRef.current = newEventSource;
    
    // Track which models have started receiving data
    const modelStarted = {};
    
    newEventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Handle the final done event
      if (data.done && !data.model) {
        newEventSource.close();
        eventSourceRef.current = null;
        setLoading(false);
        return;
      }
      
      // Handle individual model updates
      if (data.model) {
        setHistory(prev => {
          const updated = [...prev];
          if (updated.length === 0) return updated;
          
          const latestEntry = updated[updated.length - 1]; // Last entry is now the latest (since we append)
          if (!latestEntry.responses) latestEntry.responses = {};
          
          // Mark this model as having started receiving data
          modelStarted[data.model] = true;
          
          // Create or update the model's response
          latestEntry.responses[data.model] = {
            ...(latestEntry.responses[data.model] || {}),
            text: data.text || latestEntry.responses[data.model]?.text || '',
            error: data.error || null,
            loading: data.done ? false : true,
          };
          
          return updated;
        });
      }
    };
    
    newEventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      
      // Handle the case where a model might not have started streaming
      setHistory(prev => {
        const updated = [...prev];
        if (updated.length === 0) return updated;
        
        const latestEntry = updated[updated.length - 1]; // Last entry is now the latest (since we append)
        if (!latestEntry.responses) latestEntry.responses = {};
        
        // For any model that hasn't received data, mark as error
        selectedModels.forEach(model => {
          if (!modelStarted[model] && latestEntry.responses[model]?.loading) {
            latestEntry.responses[model] = {
              ...latestEntry.responses[model],
              loading: false,
              error: 'Failed to receive response from model'
            };
          }
        });
        
        return updated;
      });
      
      newEventSource.close();
      eventSourceRef.current = null;
      setLoading(false);
    };
  };

  const handleClear = () => {
    setPrompt('');
    setHistory([]);
    setError(null);
    
    // Close any active EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
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
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-darkbg transition-colors duration-200">
      <Head>
        <title>Quicke - LLM Response Comparison</title>
        <meta name="description" content="Get responses from multiple LLMs side by side" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="bg-white dark:bg-darksurface shadow-sm dark:shadow-none border-b border-gray-200 dark:border-gray-800 transition-colors duration-200">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                <path d="M21.721 12.752a9.711 9.711 0 00-.945-5.003 12.754 12.754 0 01-4.339 2.708 18.991 18.991 0 01-.214 4.772 17.165 17.165 0 005.498-2.477zM14.634 15.55a17.324 17.324 0 00.332-4.647c-.952.227-1.945.347-2.966.347-1.021 0-2.014-.12-2.966-.347a17.515 17.515 0 00.332 4.647 17.385 17.385 0 005.268 0zM9.772 17.119a18.963 18.963 0 004.456 0A17.182 17.182 0 0112 21.724a17.18 17.18 0 01-2.228-4.605zM7.777 15.23a18.87 18.87 0 01-.214-4.774 12.753 12.753 0 01-4.34-2.708 9.711 9.711 0 00-.944 5.004 17.165 17.165 0 005.498 2.477zM21.356 14.752a9.765 9.765 0 01-7.478 6.817 18.64 18.64 0 001.988-4.718 18.627 18.627 0 005.49-2.098zM2.644 14.752c1.682.971 3.53 1.688 5.49 2.099a18.64 18.64 0 001.988 4.718 9.765 9.765 0 01-7.478-6.816zM13.878 2.43a9.755 9.755 0 016.116 3.986 11.267 11.267 0 01-3.746 2.504 18.63 18.63 0 00-2.37-6.49zM12 2.276a17.152 17.152 0 012.805 7.121c-.897.23-1.837.353-2.805.353-.968 0-1.908-.122-2.805-.353A17.151 17.151 0 0112 2.276zM10.122 2.43a18.629 18.629 0 00-2.37 6.49 11.266 11.266 0 01-3.746-2.504a9.754 9.754 0 016.116-3.985z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Quicke</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Settings Button */}
            <button
              onClick={() => setShowApiKeyManager(true)}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="API Keys & Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M11.828 2.25c-.916 0-1.699.663-1.85 1.567l-.091.549a.798.798 0 01-.517.608 7.45 7.45 0 00-.478.198.798.798 0 01-.796-.064l-.453-.324a1.875 1.875 0 00-2.416.2l-.243.243a1.875 1.875 0 00-.2 2.416l.324.453a.798.798 0 01.064.796 7.448 7.448 0 00-.198.478.798.798 0 01-.608.517l-.55.092a1.875 1.875 0 00-1.566 1.849v.344c0 .916.663 1.699 1.567 1.85l.549.091c.281.047.508.25.608.517.06.162.127.321.198.478a.798.798 0 01-.064.796l-.324.453a1.875 1.875 0 00.2 2.416l.243.243c.648.648 1.67.733 2.416.2l.453-.324a.798.798 0 01.796-.064c.157.071.316.137.478.198.267.1.47.327.517.608l.092.55c.15.903.932 1.566 1.849 1.566h.344c.916 0 1.699-.663 1.85-1.567l.091-.549a.798.798 0 01.517-.608 7.52 7.52 0 00.478-.198.798.798 0 01.796.064l.453.324a1.875 1.875 0 002.416-.2l.243-.243c.648-.648.733-1.67.2-2.416l-.324-.453a.798.798 0 01-.064-.796c.071-.157.137-.316.198-.478.1-.267.327-.47.608-.517l.55-.091a1.875 1.875 0 001.566-1.85v-.344c0-.916-.663-1.699-1.567-1.85l-.549-.091a.798.798 0 01-.608-.517 7.507 7.507 0 00-.198-.478.798.798 0 01.064-.796l.324-.453a1.875 1.875 0 00-.2-2.416l-.243-.243a1.875 1.875 0 00-2.416-.2l-.453.324a.798.798 0 01-.796.064 7.462 7.462 0 00-.478-.198.798.798 0 01-.517-.608l-.091-.55a1.875 1.875 0 00-1.85-1.566h-.344zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
              </svg>
            </button>
            
            <ThemeToggle />
            
            <div className="relative">
              <button 
                ref={modelButtonRef}
                onMouseEnter={handleModelButtonMouseEnter}
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="px-4 py-2 rounded-lg bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium transition-all duration-200 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center space-x-2">
                  <span>{selectedModels.length} Model{selectedModels.length !== 1 ? 's' : ''} Selected</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>

              {showModelSelector && (
                <div
                  ref={modelSelectorRef}
                  onMouseLeave={handleModelSelectorMouseLeave}
                  className="fixed top-16 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-3xl rounded-xl bg-white dark:bg-darksurface shadow-xl ring-1 ring-black ring-opacity-5 z-50 backdrop-blur-sm backdrop-filter"
                  style={{
                    maxHeight: 'calc(100vh - 200px)',
                    overflowY: 'auto'
                  }}
                >
                  <div className="relative w-full">
                    {/* Arrow indicator */}
                    <div className="absolute right-12 -top-2 w-4 h-4 bg-white dark:bg-darksurface rotate-45 border-t border-l border-gray-200 dark:border-gray-700"></div>
                    
                    <ModelSelector 
                      selectedModels={selectedModels} 
                      setSelectedModels={setSelectedModels} 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* API Key Manager Modal */}
      <ApiKeyManager 
        isOpen={showApiKeyManager} 
        onClose={() => setShowApiKeyManager(false)} 
      />
      
      {error && (
        <div className="mx-auto w-full max-w-4xl p-4 my-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800/30">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
            Error: {error}
          </div>
        </div>
      )}
      
      <main className="flex-grow overflow-auto px-4 py-2">
        <div className="max-w-5xl mx-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Welcome to Quicke</h2>
              <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-md">
                Enter a prompt below to see responses from multiple AI models side by side
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button 
                  onClick={() => setPrompt("Explain quantum computing in simple terms")}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  "Explain quantum computing"
                </button>
                <button 
                  onClick={() => setPrompt("Write a short poem about the ocean")}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  "Write a poem"
                </button>
                <button 
                  onClick={() => setPrompt("Compare React, Vue and Angular for a new web project")}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  "Compare frameworks"
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-10 pb-24 pt-4">
              {history.map((entry) => (
                <div key={entry.id} className="space-y-6">
                  <div className="flex justify-end">
                    <div className="bg-primary-100 dark:bg-primary-900/30 p-4 rounded-2xl rounded-tr-none shadow-sm max-w-[80%] border border-primary-200 dark:border-primary-800/30">
                      <p className="text-gray-800 dark:text-gray-200">{entry.prompt}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedModels.map(model => (
                      <ResponseColumn 
                        key={`${entry.id}-${model}`}
                        model={model}
                        response={entry.responses?.[model] || { loading: false, text: '', error: null }}
                        streaming={entry.responses?.[model]?.streaming}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>
      
      <footer className="px-4 py-4 sm:px-6 lg:px-8 bg-transparent">
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