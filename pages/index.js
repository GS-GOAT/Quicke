import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import ModelSelector from '../components/ModelSelector';
import PromptInput from '../components/PromptInput';
import ResponseColumn from '../components/ResponseColumn';
import ThemeToggle from '../components/ThemeToggle';
import ApiKeyManager from '../components/ApiKeyManager';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function Home() {
  const { data: session } = useSession();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedModels, setSelectedModels] = useState(['gpt-4', 'claude', 'gemini', 'deepseek-r1']);
  const [error, setError] = useState(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showApiKeyManager, setShowApiKeyManager] = useState(false);
  const messagesEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const modelButtonRef = useRef(null);
  const modelSelectorRef = useRef(null);
  const [responses, setResponses] = useState({});
  const [responseModels, setResponseModels] = useState({});

  // Modify auto-scroll to only trigger on new prompt addition
  useEffect(() => {
    if (messagesEndRef.current && history.length > 0) {
      const lastEntry = history[history.length - 1];
      // Only scroll if this is a new prompt (all responses are in initial state)
      const isNewPrompt = Object.values(lastEntry.responses).every(r => 
        r.loading === true && r.text === ''
      );
      
      if (isNewPrompt) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [history.length]); // Only trigger on history length change

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

  // Add useEffect to load conversations on login
  useEffect(() => {
    if (session?.user) {
      fetchConversations();
    }
  }, [session]);

  // Modified function to fetch conversations
  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations/retrieve');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      
      const data = await response.json();
      
      // Transform conversations into the required format
      // Note: data is already ordered by createdAt desc from the API
      const transformedHistory = data.map(conv => {
        const userMessage = conv.messages.find(msg => msg.role === 'user');
        const assistantMessages = conv.messages
          .filter(msg => msg.role === 'assistant')
          .map(msg => {
            try {
              return JSON.parse(msg.content);
            } catch (e) {
              console.error('Error parsing message content:', e);
              return null;
            }
          })
          .filter(Boolean);
        
        const responses = {};
        assistantMessages.forEach(parsed => {
          const { model, ...responseData } = parsed;
          responses[model] = {
            ...responseData,
            loading: false,
            streaming: false
          };
        });

        return {
          id: conv.id,
          prompt: userMessage.content,
          responses,
          activeModels: Object.keys(responses),
          timestamp: new Date(conv.createdAt)
        };
      });

      // Sort conversations by timestamp in ascending order (oldest first)
      transformedHistory.sort((a, b) => a.timestamp - b.timestamp);

      setHistory(transformedHistory);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return;
    
    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    setLoading(true);
    
    // Initialize response objects for each selected model
    const initialResponses = {};
    selectedModels.forEach(model => {
      initialResponses[model] = {
        text: '',
        loading: true,
        error: null,
        streaming: true
      };
    });
    
    setResponses(initialResponses);
    
    // Add to history immediately with initial state
    const id = Date.now().toString();
    setResponseModels(prev => ({
      ...prev,
      [id]: [...selectedModels]
    }));
    
    setHistory(prev => [...prev, { 
      id, 
      prompt, 
      responses: initialResponses,
      activeModels: [...selectedModels] // Store models active for this response
    }]);
    setPrompt('');

    // Create event source for streaming - remove API keys from URL
    const newEventSource = new EventSource(
      `/api/stream?prompt=${encodeURIComponent(prompt)}&models=${encodeURIComponent(selectedModels.join(','))}`
    );
    eventSourceRef.current = newEventSource;

    // Handle incoming stream data
    newEventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.model) {
        // Update both responses and history immediately
        const update = {
          text: data.text || '',
          error: data.error || null,
          loading: data.loading !== false,
          streaming: data.streaming !== false
        };
        
        setResponses(prev => ({
          ...prev,
          [data.model]: update
        }));
        
        setHistory(prev => {
          const updated = [...prev];
          const latestEntry = updated[updated.length - 1];
          if (latestEntry) {
            latestEntry.responses[data.model] = update;
          }
          return updated;
        });
      }
      
      // Handle completion
      if (data.done && !data.model) {
        try {
          await fetch('/api/conversations/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              responses
            }),
          });
        } catch (error) {
          console.error('Error saving conversation:', error);
        }

        newEventSource.close();
        eventSourceRef.current = null;
        setLoading(false);
        
        // Check if all models have completed
        const allComplete = selectedModels.every(model => 
          !responses[model]?.loading && !responses[model]?.streaming
        );
        
        if (allComplete) {
          // Update final state in history
          setHistory(prev => {
            const updated = [...prev];
            const latestEntry = updated[updated.length - 1];
            if (latestEntry) {
              latestEntry.responses = {...responses};
            }
            return updated;
          });
        }
      }
    };

    // Handle errors
    newEventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setLoading(false);
      newEventSource.close();
      eventSourceRef.current = null;
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
      'gemini': 'Gemini 2.0 Flash',
      'deepseek-r1': 'DeepSeek R1'
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
          {/* Left side with logo */}
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                <path d="M21.721 12.752a9.711 9.711 0 00-.945-5.003 12.754 12.754 0 01-4.339 2.708 18.991 18.991 0 01-.214 4.772 17.165 17.165 0 005.498-2.477zM14.634 15.55a17.324 17.324 0 00.332-4.647c-.952.227-1.945.347-2.966.347-1.021 0-2.014-.12-2.966-.347a17.515 17.515 0 00.332 4.647 17.385 17.385 0 005.268 0zM9.772 17.119a18.963 18.963 0 004.456 0A17.182 17.182 0 0112 21.724a17.18 17.18 0 01-2.228-4.605zM7.777 15.23a18.87 18.87 0 01-.214-4.774 12.753 12.753 0 01-4.34-2.708 9.711 9.711 0 00-.944 5.004 17.165 17.165 0 005.498 2.477zM21.356 14.752a9.765 9.765 0 01-7.478 6.817 18.64 18.64 0 001.988-4.718 18.627 18.627 0 005.49-2.098zM2.644 14.752c1.682.971 3.53 1.688 5.49 2.099a18.64 18.64 0 001.988 4.718 9.765 9.765 0 01-7.478-6.816zM13.878 2.43a9.755 9.755 0 016.116 3.986 11.267 11.267 0 01-3.746 2.504 18.63 18.63 0 00-2.37-6.49zM12 2.276a17.152 17.152 0 012.805 7.121c-.897.23-1.837.353-2.805.353-.968 0-1.908-.122-2.805-.353A17.151 17.151 0 0112 2.276zM10.122 2.43a18.629 18.629 0 00-2.37 6.49 11.266 11.266 0 01-3.746-2.504a9.754 9.754 0 016.116-3.985z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Quicke</h1>
          </div>
          
          {/* Center/Right side with actions */}
          <div className="flex items-center space-x-4">

            <ThemeToggle />

            {/* Model selector */}
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

            {/* User menu - moved to rightmost position */}
            {session?.user ? (
              <div className="relative group">
                <button className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium">
                    {session.user.email.charAt(0).toUpperCase()}
                  </div>
                  {/* <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{session.user.email}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Manage account</span>
                  </div> */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                
                <div className="absolute right-0 mt-2 w-56 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Signed in as</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{session.user.email}</p>
                  </div>
                  
                  {/* Added API Keys option */}
                  <button 
                    onClick={() => setShowApiKeyManager(true)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
                      <path fillRule="evenodd" d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0 019 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 01.293-.707L8.196 8.39A5.002 5.002 0 018 7zm5-3a.75.75 0 000 1.5A1.5 1.5 0 0114.5 7 .75.75 0 0016 7a3 3 0 00-3-3z" clipRule="evenodd" />
                    </svg>
                    API Keys
                  </button>
                  
                  <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                    <button 
                      onClick={() => signOut()}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
                        <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                        <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link href="/auth/signin" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400">
                  Sign in
                </Link>
                <Link 
                  href="/auth/signup"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors duration-200"
                >
                  Sign up
                </Link>
              </div>
            )}
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
                    {(entry.activeModels || []).map(model => (
                      <ResponseColumn 
                        key={`${entry.id}-${model}`}
                        model={model}
                        response={responses[model] || entry.responses?.[model] || { loading: false, text: '', error: null }}
                        streaming={responses[model]?.streaming || entry.responses?.[model]?.streaming}
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