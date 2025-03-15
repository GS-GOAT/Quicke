import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import ModelSelector from '../components/ModelSelector';
import PromptInput from '../components/PromptInput';
import ResponseColumn from '../components/ResponseColumn';
import ThemeToggle from '../components/ThemeToggle';
import ApiKeyManager from '../components/ApiKeyManager';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedModels, setSelectedModels] = useState(['gemini', 'deepseek-r1']);
  const [error, setError] = useState(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showApiKeyManager, setShowApiKeyManager] = useState(false);
  const messagesEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const modelButtonRef = useRef(null);
  const modelSelectorRef = useRef(null);
  const [responses, setResponses] = useState({});
  const [responseModels, setResponseModels] = useState({});
  const [isProcessing, setIsProcessing] = useState(false); // Add this state
  const [currentPromptId, setCurrentPromptId] = useState(null);
  const [showContinueButton, setShowContinueButton] = useState(true); // Add this line
  const [visibleSuggestions, setVisibleSuggestions] = useState([]);

  const promptSuggestions = {
    writing: [
      "Write a short story about time travel",
      "Create a poem about the ocean",
      "Write a dialogue between two AI systems",
      "Craft a creative product description",
    ],
    analysis: [
      "Compare different programming languages",
      "Analyze the impact of AI on society",
      "Explain quantum computing simply",
      "Break down complex economic concepts",
    ],
    creativity: [
      "Design a unique superhero concept",
      "Create a recipe fusion dish",
      "Invent a new sport",
      "Generate creative marketing ideas",
    ],
    business: [
      "Write a professional email template",
      "Create a business pitch",
      "Develop a marketing strategy",
      "Draft a project proposal",
    ],
    technical: [
      "Debug this code snippet",
      "Explain microservices architecture",
      "Compare cloud providers",
      "Optimize database queries",
    ]
  };

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

  // Replace multiple useEffect hooks with a single one for session-based fetching
  useEffect(() => {
    if (session?.user && history.length === 0) {  // Only fetch if no history exists
      fetchConversations();
    }
  }, [session]);  // Remove history.length from dependencies

  // Add to useEffect section
  useEffect(() => {
    if (history.length === 0) {
      const categories = Object.keys(promptSuggestions);
      let currentIndex = 0;

      const rotateSuggestions = () => {
        const category = categories[currentIndex % categories.length];
        const suggestions = promptSuggestions[category];
        const randomSuggestions = suggestions
          .sort(() => Math.random() - 0.5)
          .slice(0, 4);

        setVisibleSuggestions(randomSuggestions);
        currentIndex++;
      };

      rotateSuggestions();
      const interval = setInterval(rotateSuggestions, 8000);
      return () => clearInterval(interval);
    }
  }, [history.length]);

  // Add backdrop blur when model selector is open
  useEffect(() => {
    if (showModelSelector) {
      document.body.classList.add('backdrop-blur-active');
    } else {
      document.body.classList.remove('backdrop-blur-active');
    }
    return () => document.body.classList.remove('backdrop-blur-active');
  }, [showModelSelector]);

  // Add event listener for API key manager toggle
  useEffect(() => {
    const handleApiKeyManagerToggle = (event) => {
      setShowApiKeyManager(true);
    };

    window.addEventListener('toggleApiKeyManager', handleApiKeyManagerToggle);
    return () => {
      window.removeEventListener('toggleApiKeyManager', handleApiKeyManagerToggle);
    };
  }, []);

  // Modified function to fetch conversations
  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations/retrieve');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      
      const data = await response.json();
      const transformedHistory = data.map(conv => {
        // Find the user message (should be the first one)
        const userMessage = conv.messages.find(msg => msg.role === 'user');
        
        // Get all assistant messages and parse their content
        const assistantMessages = conv.messages
          .filter(msg => msg.role === 'assistant')
          .map(msg => {
            try {
              return JSON.parse(msg.content);
            } catch (e) {
              console.error('Error parsing message:', msg.content);
              return null;
            }
          })
          .filter(Boolean);

        // Create responses object
        const responses = {};
        assistantMessages.forEach(parsed => {
          const { model, timestamp, ...responseData } = parsed;
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
          timestamp: new Date(conv.createdAt),
          isHistorical: true // Flag to identify retrieved conversations
        };
      });

      // Add isHistorical flag to loaded conversations
      const historicalConversations = transformedHistory.map(conv => ({
        ...conv,
        isHistorical: true
      }));

      setHistory(historicalConversations);
      
      // Smooth scroll to bottom after loading historical conversations
      setTimeout(() => {
        const mainContent = document.querySelector('main');
        if (mainContent) {
          mainContent.scrollTo({
            top: mainContent.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const handleSubmit = async () => {
    // Add authentication check
    if (!session) {
      const encodedPrompt = encodeURIComponent(prompt);
      router.push(`/auth/signin?redirect=/?prompt=${encodedPrompt}`);
      return;
    }

    if (!prompt.trim() || loading || isProcessing) return;
    
    setLoading(true);
    setIsProcessing(true);
    
    const currentPrompt = prompt;
    const id = Date.now().toString();
    setCurrentPromptId(id);
    
    // Clear previous responses before starting new request
    setResponses({});
    
    let completedResponses = {};

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
    
    setHistory(prev => [...prev, { 
      id,
      prompt: currentPrompt,
      responses: initialResponses,
      activeModels: [...selectedModels],
      isHistorical: false
    }]);
    
    setPrompt('');
    setResponses(initialResponses);

    const newEventSource = new EventSource(
      `/api/stream?prompt=${encodeURIComponent(currentPrompt)}&models=${encodeURIComponent(selectedModels.join(','))}`
    );
    eventSourceRef.current = newEventSource;

    newEventSource.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.model) {
        const update = {
          text: data.text || '',
          error: data.error || null,
          loading: data.loading !== false,
          streaming: data.streaming !== false
        };
        
        completedResponses[data.model] = update;

        setResponses(prev => ({
          ...prev,
          [data.model]: update
        }));
        
        // Only update the current conversation's responses
        setHistory(prev => {
          const updated = [...prev];
          const currentEntry = updated.find(entry => entry.id === id);
          if (currentEntry) {
            currentEntry.responses[data.model] = update;
          }
          return updated;
        });
      }
      
      // Handle final completion after all models are done
      if (data.allComplete) {
        try {
          // Filter out responses with errors
          const validResponses = Object.entries(completedResponses).reduce((acc, [model, response]) => {
            if (!response.error) {
              acc[model] = response;
            }
            return acc;
          }, {});

          // Only save if there are valid responses
          if (Object.keys(validResponses).length > 0) {
            await fetch('/api/conversations/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: currentPrompt,
                responses: validResponses,
                conversationId: id
              }),
            });
          }
        } catch (error) {
          console.error('Error saving conversation:', error);
        }

        newEventSource.close();
        eventSourceRef.current = null;
        setLoading(false);
        setIsProcessing(false);
        setCurrentPromptId(null);
      }
    };

    // Handle errors
    newEventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setLoading(false);
      setIsProcessing(false); // Clear processing flag even on error
      newEventSource.close();
      eventSourceRef.current = null;
    };

    // Add this after setting the new history item
    setTimeout(() => {
      const mainContent = document.querySelector('main');
      if (mainContent) {
        mainContent.scrollTo({
          top: mainContent.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  const handleClear = () => {
    if (history.length === 0) return;
    
    // If there's an active stream, close it
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Reset all relevant state
    setPrompt('');
    setHistory([]);
    setError(null);
    setResponses({});
    setIsProcessing(false);
    setCurrentPromptId(null);
    setShowContinueButton(true); // Now this will work
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

  // Add separator component between conversations
  const ConversationSeparator = () => (
    <div className="flex items-center my-8">
      <div className="flex-grow h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
      <div className="mx-4 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
        Previous Conversation
      </div>
      <div className="flex-grow h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
    </div>
  );

  // Replace the old suggestion rendering with continuous scroll
  const renderSuggestions = () => (
    <div className="relative h-24 overflow-hidden">
      <div className="suggestion-carousel">
        {/* Duplicate suggestions array for seamless loop */}
        {[...Object.values(promptSuggestions).flat(), ...Object.values(promptSuggestions).flat()].map((suggestion, index) => (
          <button
            key={`${suggestion}-${index}`}
            onClick={() => setPrompt(suggestion)}
            className="suggestion-item px-4 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-md hover:shadow-lg border border-gray-200 dark:border-gray-700"
          >
            "{suggestion}"
          </button>
        ))}
      </div>
    </div>
  );

  const renderConversationHistory = () => (
    <div className="space-y-10 pb-24 pt-4">
      {/* Historical conversations first */}
      {history.filter(entry => entry.isHistorical).map((entry) => (
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
                className="light-response-column"
              />
            ))}
          </div>
        </div>
      ))}

      {/* Separator - only show if there are both historical and new conversations */}
      {history.some(entry => entry.isHistorical) && history.some(entry => !entry.isHistorical) && (
        <div className="flex items-center my-8">
          <div className="flex-grow h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
          <div className="mx-4 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            New Conversations
          </div>
          <div className="flex-grow h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
        </div>
      )}

      {/* New conversations last */}
      {history.filter(entry => !entry.isHistorical).map((entry) => (
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
                className="light-response-column"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#111111] transition-colors duration-200">
      <Head>
        <title>Quicke - LLM Response Comparison</title>
        <meta name="description" content="Get responses from multiple LLMs side by side" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="relative z-10 bg-white/80 dark:bg-darksurface/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary-600 to-primary-400 rounded-xl transform group-hover:scale-105 transition-transform duration-200"></div>
                <div className="relative h-full w-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">Q</span>
                </div>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                Quicke
              </h1>
            </div>

            {/* Center - Model Selector */}
            <div className="flex-1 flex justify-center">
              <button 
                ref={modelButtonRef}
                onMouseEnter={handleModelButtonMouseEnter}
                className="group px-4 py-2 rounded-lg bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium transition-all duration-200 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center space-x-2">
                  <span>{selectedModels.length} Model{selectedModels.length !== 1 ? 's' : ''}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>
            </div>

            {/* Right Actions */}
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              {session?.user ? (
                <div className="relative group">
                  <button className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium">
                      {session.user.email.charAt(0).toUpperCase()}
                    </div>
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
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm hover:shadow-lg hover:shadow-primary-500/25 transition-all duration-200"
                  >
                    Start Free
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Model Selector Dropdown */}
      {showModelSelector && (
        <div
          ref={modelSelectorRef}
          onMouseLeave={handleModelSelectorMouseLeave}
          className="fixed top-16 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-3xl rounded-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-2xl ring-1 ring-black/5 dark:ring-white/5 z-50 transition-all duration-200 ease-out transform"
          style={{
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto'
          }}
        >
          <ModelSelector 
            selectedModels={selectedModels} 
            setSelectedModels={setSelectedModels} 
          />
        </div>
      )}

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
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className="max-w-3xl w-full space-y-8">
                <div className="space-y-4">
                  <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
                    Prompt AI Models At Once
                  </h1>
                  <p className="text-xl text-gray-600 dark:text-gray-400">
                    Get instant responses from multiple AI models side by side
                  </p>
                </div>

                {renderSuggestions()}

                {/* Quick start section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
                  {/* <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Multiple Models</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Compare responses from leading AI models</p>
                  </div> */}
                  {/* Add more quick start cards */}
                </div>
              </div>
            </div>
          ) : renderConversationHistory()}
        </div>
      </main>
      
      <footer className="px-4 py-4 sm:px-6 lg:px-8 bg-transparent">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            {/* Add dustbin button */}
            {history.length > 0 && (
              <button
                onClick={handleClear}
                className="p-2.5 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 group"
                title="Clear all conversations"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" 
                  className="w-5 h-5 transform group-hover:scale-110 transition-transform duration-200">
                  <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            <div className="flex-grow">
              <PromptInput 
                prompt={prompt} 
                setPrompt={setPrompt} 
                onSubmit={handleSubmit}
                onClear={handleClear}
                disabled={loading || selectedModels.length === 0 || isProcessing}
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}