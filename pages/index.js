import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import ModelSelector from '../components/ModelSelector';
import PromptInput from '../components/PromptInput';
import ResponseColumn from '../components/ResponseColumn';
import ApiKeyManager from '../components/ApiKeyManager';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useLocalStorage } from '../hooks/useLocalStorage'; 
import StarfieldBackground from '../components/StarfieldBackground';

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedModels, setSelectedModels] = useState(['gemini-2.5-pro','gemini-flash', 'gemini-thinking', 'deepseek-v3-0324', 'mistral-small-31']);
  const [error, setError] = useState(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showApiKeyManager, setShowApiKeyManager] = useState(false);
  const messagesEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const modelButtonRef = useRef(null);
  const modelSelectorRef = useRef(null);
  const [responses, setResponses] = useState({});
  const [responseModels, setResponseModels] = useState({});
  const [isProcessing, setIsProcessing] = useState(false); 
  const [currentPromptId, setCurrentPromptId] = useState(null);
  const [showContinueButton, setShowContinueButton] = useState(true); 
  const [visibleSuggestions, setVisibleSuggestions] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [responseLayout, setResponseLayout] = useLocalStorage('responseLayout', 'grid'); // Add layout state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const universeRef = useRef(null);
  const starfieldRef = useRef(null);
  const [contextEnabled, setContextEnabled] = useState(true);

  const [predefinedSuggestions] = useState([
    "Explain quantum computing in simple terms",
    "Write a short story about a robot learning to feel emotions",
    "How do I improve my coding skills?",
    "What are some strategies for effective time management?",
    "Explain the concept of blockchain technology",
    "Help me create a workout routine for beginners",
    "What are the best practices for web accessibility?",
    "How does machine learning work?",
  ]);
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

  // Add new state for summary
  const [showSummary, setShowSummary] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});

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

  const handleModelButtonClick = () => {
    setShowModelSelector(!showModelSelector);
  };

  // Load API keys from localStorage on component mount
  useEffect(() => {
    // This will be handled in the ApiKeyManager component
  }, []);

  // Replace multiple useEffect hooks with a single one for session-based fetching
  useEffect(() => {
    // Only initialize selectedModels and other state on mount
    // Don't fetch conversations automatically
    
    // Check URL for thread ID
    const { threadId } = router.query;
    
    if (threadId) {
      // If URL has threadId, load that thread
      setActiveThreadId(threadId);
      loadThreadConversations(threadId);
    }
  }, [router.query]);

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
  const fetchConversations = async (pageNum = 1) => {
    try {
      // Get current scroll position before loading more
      const mainContent = document.querySelector('main');
      const oldScrollHeight = mainContent?.scrollHeight || 0;
      const oldScrollTop = mainContent?.scrollTop || 0;

      const response = await fetch(`/api/conversations/retrieve?page=${pageNum}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      
      const data = await response.json();
      
      // Check if there are more conversations to load
      setHasMore(data.hasMore);

      const transformedHistory = data.conversations.map(conv => {
        // Find the user message (should be the first one)
        const userMessage = conv.messages.find(msg => msg.role === 'user');
        
        // Get all assistant messages and summary, maintaining order
        const assistantMessages = conv.messages
          .filter(msg => msg.role === 'assistant' || msg.role === 'summary')
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          .map(msg => {
            try {
              return {
                ...JSON.parse(msg.content),
                role: msg.role
              };
            } catch (error) {
              console.error('Failed to parse message content:', error);
              return null;
            }
          })
          .filter(Boolean);

        // Create responses object including summary if it exists
        const responses = {};
        let summaryText = null;

        assistantMessages.forEach(parsed => {
          const { model, timestamp, role, ...responseData } = parsed;
          
          if (role === 'summary') {
            summaryText = responseData.text;
          } else {
            responses[model] = {
              ...responseData,
              loading: false,
              streaming: false
            };
          }
        });

        return {
          id: conv.id,
          prompt: userMessage.content,
          responses,
          activeModels: Object.keys(responses).filter(model => model !== 'summary'),
          timestamp: new Date(conv.createdAt),
          isHistorical: true,
          summary: summaryText
        };
      });

      // Add isHistorical flag to loaded conversations
      const historicalConversations = transformedHistory.map(conv => ({
        ...conv,
        isHistorical: true
      }));

      // Prepend new conversations if loading more, otherwise replace
      setHistory(prev => 
        pageNum > 1 
          ? [...historicalConversations, ...prev]
          : historicalConversations
      );
      
      // Update showSummary state for loaded summaries
      setShowSummary(prev => {
        const updatedState = { ...prev };
        historicalConversations.forEach(conv => {
          if (conv.summary) {
            updatedState[conv.id] = true;
          }
        });
        return updatedState;
      });
      
      // Only scroll on initial load (page 1) or maintain scroll position for load more
      if (pageNum === 1) {
        setTimeout(() => {
          if (mainContent) {
            mainContent.scrollTo({
              top: mainContent.scrollHeight,
              behavior: 'smooth'
            });
          }
        }, 100);
      } else {
        // After state update, adjust scroll position to maintain view
        setTimeout(() => {
          if (mainContent) {
            const newScrollHeight = mainContent.scrollHeight;
            const heightDifference = newScrollHeight - oldScrollHeight;
            mainContent.scrollTop = oldScrollTop + heightDifference;
          }
        }, 0);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const handleSubmit = async (contextData) => {
    // Add authentication check
    if (!session) {
      const encodedPrompt = encodeURIComponent(prompt);
      router.push(`/auth/signin?redirect=/?prompt=${encodedPrompt}`);
      return;
    }
    
    const promptText = contextData?.prompt || prompt;
    const fileId = contextData?.fileId || null;
    if (!promptText.trim() || loading || isProcessing) return;
    
    setLoading(true);
    setIsProcessing(true);

    // Generate a unique conversation ID
    const conversationId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setCurrentPromptId(conversationId);
    
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
      id: conversationId,
      prompt: promptText,
      responses: initialResponses,
      activeModels: [...selectedModels],
      timestamp: new Date(),
      isHistorical: false
    }]);
    
    setPrompt('');
    setResponses(initialResponses);

    // Construct query parameters with conversation ID
    const queryParams = new URLSearchParams({
      prompt: promptText,
      models: selectedModels.join(','),
      fileId: fileId || '',
      conversationId,
      threadId: activeThreadId || '',
      useContext: contextEnabled.toString()
    });

    const newEventSource = new EventSource(`/api/stream?${queryParams.toString()}`);
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
          const currentEntry = updated.find(entry => entry.id === conversationId);
          if (currentEntry) {
            currentEntry.responses[data.model] = update;
          }
          return updated;
        });
      }
      
      // Handle final completion after all models are done
      if (data.allComplete) {
        console.log('Processing completion, checking for summary');
        
        const validResponses = Object.entries(completedResponses)
          .filter(([_, response]) => !response.error);
          
        console.log(`Found ${validResponses.length} valid responses for summarization`);
        
        try {
          const validResponsesData = validResponses.reduce((acc, [model, response]) => {
            acc[model] = { 
              text: response.text,
              timestamp: Date.now()
            };
            return acc;
          }, {});

          if (Object.keys(validResponsesData).length > 0) {
            const saveResponse = await fetch('/api/conversations/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: conversationId,
                prompt: promptText,
                responses: validResponsesData,
                threadId: activeThreadId,
                fileId: fileId
              }),
            });

            if (!saveResponse.ok) {
              throw new Error(`Failed to save conversation: ${saveResponse.statusText}`);
            }
            
            const saveData = await saveResponse.json();
            
            if (!activeThreadId && saveData.threadId) {
              setActiveThreadId(saveData.threadId);
              fetchThreads();
            }
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

    // after setting the new history item
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

  // Add summary generation function
  const generateSummary = async (conversationId) => {
    try {
      // Find the conversation
      const conversation = history.find(h => h.id === conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // If the conversation already has a summary, just display it
      if (conversation.summary) {
        setShowSummary(prev => ({ ...prev, [conversationId]: true }));
        return;
      }
      
      // Otherwise, generate a new summary
      setSummaryLoading(prev => ({ ...prev, [conversationId]: true }));
      
      // Format responses for the API
      const validResponses = Object.entries(conversation.responses)
        .filter(([_, response]) => !response.error && response.text)
        .reduce((acc, [model, response]) => {
          acc[model] = { text: response.text };
          return acc;
        }, {});
      
      // Check if we have responses to summarize
      if (Object.keys(validResponses).length === 0) {
        throw new Error('No valid responses to summarize');
      }
      
      // Call summary API
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: validResponses })
      });
      
      if (!res.ok) {
        throw new Error('Failed to generate summary');
      }
      
      const summary = await res.json();
      
      // Update local state
      setHistory(prev => prev.map(h => {
        if (h.id === conversationId) {
          return {
            ...h,
            summary: summary.text
          };
        }
        return h;
      }));
      
      setShowSummary(prev => ({ ...prev, [conversationId]: true }));

      // Save the summary to the database
      const saveResponse = await fetch('/api/conversations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: conversationId,
          prompt: conversation.prompt,
          responses: conversation.responses,
          threadId: activeThreadId,
          summary: summary.text
        })
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save summary');
      }

    } catch (error) {
      console.error('Summary generation failed:', error);
    } finally {
      setSummaryLoading(prev => ({ ...prev, [conversationId]: false }));
    }
  };

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
    <div className="my-4 mx-auto max-w-3xl overflow-hidden suggestion-carousel-container">
      <div className="suggestion-carousel whitespace-nowrap">
        {predefinedSuggestions.concat(predefinedSuggestions).map((suggestion, i) => (
          <span 
            key={i} 
            onClick={() => {
              setPrompt(suggestion);
              handleSubmit({ text: suggestion });
            }}
            className="suggestion-item inline-block px-3 py-1.5 mr-2 bg-gray-100/70 dark:bg-gray-800/70 text-gray-800 dark:text-gray-200 rounded-full text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          >
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  );

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchConversations(nextPage);
  };

  const getResponseLayoutClass = () => {
    return responseLayout === 'grid'
      ? 'grid grid-cols-1 md:grid-cols-2 gap-6' // Increased gap and reduced columns
      : 'flex flex-col space-y-6'; // Keep stack layout the same
  };

  const renderConversationHistory = () => (
    <div className="space-y-10 pb-24 pt-4">
      {/* Load More button with updated styling */}
      {history.some(entry => entry.isHistorical) && hasMore && (
        <button
          onClick={handleLoadMore}
          className="flex items-center justify-center space-x-1 mx-auto px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-white dark:bg-gray-800 rounded-full shadow-sm hover:shadow transition-all duration-200 border border-gray-200 dark:border-gray-700 group"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 20 20" 
            fill="currentColor" 
            className="w-3.5 h-3.5 rotate-180"
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
          <span>Load more</span>
        </button>
      )}

      {/* Historical conversations first */}
      {history.filter(entry => entry.isHistorical).map((entry) => (
        <div key={entry.id} className="space-y-6">
          <div className="flex justify-end">
            <div className="bg-primary-100 dark:bg-primary-900/30 p-4 rounded-2xl rounded-tr-none shadow-sm max-w-[80%] border border-primary-200 dark:border-primary-800/30">
              <p className="text-gray-800 dark:text-gray-200">{entry.prompt}</p>
            </div>
          </div>
          
          <div className={getResponseLayoutClass()}>
            {(entry.activeModels || []).map(model => (
              <ResponseColumn 
                key={`${entry.id}-${model}`}
                model={model}
                conversationId={entry.id}  // Add conversation ID
                response={
                  // Only pass current responses if this is the active conversation
                  currentPromptId === entry.id 
                    ? responses[model] 
                    : entry.responses?.[model]
                }
                streaming={
                  currentPromptId === entry.id && 
                  (responses[model]?.streaming || entry.responses?.[model]?.streaming)
                }
                className="light-response-column"
                onRetry={handleModelRetry}
              />
            ))}
          </div>
          
          {/* Display summary if available */}
          {entry.summary && (
            <ResponseColumn
              model="summary"
              response={{ text: entry.summary }}
              streaming={false}
              isCollapsed={false}
              className="w-full"
              isSummary={true}
            />
          )}
          
          {/* Add summarize button if summary not showing */}
          {!entry.summary && !currentPromptId && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => generateSummary(entry.id)}
                disabled={summaryLoading[entry.id]}
                className={`
                  group relative flex items-center gap-3 px-6 py-2.5 
                  text-sm font-medium transition-all duration-300
                  ${summaryLoading[entry.id]
                    ? 'text-purple-300 bg-purple-900/20'
                    : 'text-gray-300 hover:text-white bg-gradient-to-r from-purple-900/30 via-gray-800/30 to-purple-900/30 hover:from-purple-800/40 hover:via-gray-700/40 hover:to-purple-800/40'
                  }
                  rounded-xl border border-purple-500/20 hover:border-purple-500/30
                  shadow-lg hover:shadow-purple-500/10
                  backdrop-blur-sm
                `}
              >
                {summaryLoading[entry.id] ? (
                  <>
                    <div className="relative">
                      <div className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></div>
                    </div>
                    <span>Analyzing Responses...</span>
                  </>
                ) : (
                  <>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="currentColor" 
                      className="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
                    >
                      <path d="M21 6.375c0 2.692-4.03 4.875-9 4.875S3 9.067 3 6.375 7.03 1.5 12 1.5s9 2.183 9 4.875z" />
                      <path d="M12 12.75c2.685 0 5.19-.586 7.078-1.609a8.283 8.283 0 001.897-1.384c.016.121.025.244.025.368C21 12.817 16.97 15 12 15s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.285 8.285 0 001.897 1.384C6.809 12.164 9.315 12.75 12 12.75z" />
                      <path d="M12 16.5c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 001.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 001.897 1.384C6.809 15.914 9.315 16.5 12 16.5z" />
                    </svg>
                    <span>Summarize Responses</span>
                    
                    {/* Add subtle glow effect */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </>
                )}
              </button>
            </div>
          )}
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
          
          <div className={getResponseLayoutClass()}>
            {/* Render normal responses */}
            {(entry.activeModels || []).map(model => (
              <ResponseColumn 
                key={`${entry.id}-${model}`}
                model={model}
                conversationId={entry.id}
                response={currentPromptId === entry.id ? responses[model] : entry.responses?.[model]}
                streaming={currentPromptId === entry.id && responses[model]?.streaming}
                className="light-response-column"
                onRetry={handleModelRetry}
              />
            ))}
            
            {/* Display summary if available */}
            {entry.summary && (
              <ResponseColumn
                model="summary"
                response={{ text: entry.summary }}
                streaming={false}
                isCollapsed={false}
                className="w-full"
                isSummary={true}
              />
            )}
          </div>

          {/* Add summarize button */}
          {!entry.summary && !currentPromptId && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => generateSummary(entry.id)}
                disabled={summaryLoading[entry.id]}
                className={`
                  group relative flex items-center gap-3 px-6 py-2.5 
                  text-sm font-medium transition-all duration-300
                  ${summaryLoading[entry.id]
                    ? 'text-purple-300 bg-purple-900/20'
                    : 'text-gray-300 hover:text-white bg-gradient-to-r from-purple-900/30 via-gray-800/30 to-purple-900/30 hover:from-purple-800/40 hover:via-gray-700/40 hover:to-purple-800/40'
                  }
                  rounded-xl border border-purple-500/20 hover:border-purple-500/30
                  shadow-lg hover:shadow-purple-500/10
                  backdrop-blur-sm
                `}
              >
                {summaryLoading[entry.id] ? (
                  <>
                    <div className="relative">
                      <div className="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></div>
                    </div>
                    <span>Analyzing Responses...</span>
                  </>
                ) : (
                  <>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="currentColor" 
                      className="w-5 h-5 transition-transform duration-300 group-hover:scale-110"
                    >
                      <path d="M21 6.375c0 2.692-4.03 4.875-9 4.875S3 9.067 3 6.375 7.03 1.5 12 1.5s9 2.183 9 4.875z" />
                      <path d="M12 12.75c2.685 0 5.19-.586 7.078-1.609a8.283 8.283 0 001.897-1.384c.016.121.025.244.025.368C21 12.817 16.97 15 12 15s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.285 8.285 0 001.897 1.384C6.809 12.164 9.315 12.75 12 12.75z" />
                      <path d="M12 16.5c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 001.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 001.897 1.384C6.809 15.914 9.315 16.5 12 16.5z" />
                    </svg>
                    <span>Summarize Responses</span>
                    
                    {/* Add subtle glow effect */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // component definition before your main return statement

  const ThreadSidebar = ({ isOpen, onClose, threads, onNewThread, onThreadSelect, activeThreadId }) => {
    return (
      <>
        {/* Glass overlay backdrop */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30"
            onClick={onClose}
          />
        )}
        
        {/* Glass sidebar */}
        <div 
          className={`fixed top-0 left-0 w-64 h-full z-40 border-r border-gray-700/30 shadow-xl transform transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{
            backgroundColor: 'rgba(28, 28, 32, 0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div className="p-4 border-b border-gray-700/30" style={{ backgroundColor: 'rgba(24, 24, 28, 0.6)' }}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-200">Library</h2>
              <button 
                onClick={onClose}
                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800/50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="p-4">
            {/* New Thread Button with enhanced hover */}
            <button
              onClick={onNewThread}
              className="flex items-center justify-center w-full px-3 py-2 mb-6 text-sm font-medium text-white rounded-lg shadow-lg transition-all duration-200 hover:bg-gray-700/90 hover:transform hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: 'rgba(45, 45, 50, 0.7)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>New Thread</span>
            </button>
            
            {/* Thread List with purple accent border */}
            <div className="space-y-2">
              {threads.length === 0 ? (
                <div className="text-center py-8 text-gray-400" style={{ backgroundColor: 'rgba(40, 40, 45, 0.3)', borderRadius: '0.5rem' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm font-medium">No threads yet</p>
                  <p className="text-xs mt-1">Start a new conversation</p>
                </div>
              ) : (
                threads.map(thread => (
                  <div 
                    key={thread.id}
                    onClick={() => onThreadSelect(thread.id)}
                    className="transition-all duration-200 mb-2"
                  >
                    <div
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-150 border-l-2 ${
                        activeThreadId === thread.id 
                          ? 'bg-gray-700/70 border-purple-400' 
                          : 'bg-gray-800/40 border-transparent hover:bg-gray-700/50 hover:border-gray-500'
                      }`}
                      style={{
                        transition: "all 0.15s ease",
                        transform: `scale(${activeThreadId === thread.id ? '1.02' : '1'})`,
                        borderLeftColor: activeThreadId === thread.id 
                          ? 'rgba(167, 139, 250, 0.8)'  // Purplish color for the left border
                          : 'transparent',
                      }}
                    >
                      <h3 className="text-sm font-medium text-gray-200 truncate">{thread.title}</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(thread.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Add this style tag to ensure the glass effect works */}
        <style jsx>{`
          @supports (backdrop-filter: blur(20px)) or (-webkit-backdrop-filter: blur(20px)) {
            div[style*="backdrop-filter"] {
              backdrop-filter: blur(20px) !important;
              -webkit-backdrop-filter: blur(20px) !important;
            }
          }
        `}</style>
      </>
    );
  };

  // Fetch threads on component mount
  useEffect(() => {
    if (session?.user) {
      fetchThreads();
    }
  }, [session]);

  // Function to fetch threads
  const fetchThreads = async () => {
    try {
      const response = await fetch('/api/threads/list');
      if (!response.ok) throw new Error('Failed to fetch threads');
      
      const data = await response.json();
      // Only keep the last 5 threads
      setThreads(data.threads.slice(0, 5));
    } catch (error) {
      console.error('Error fetching threads:', error);
    }
  };

  // Function to handle new thread creation
  const handleNewThread = () => {
    // Clear the current conversation
    setHistory([]);
    setActiveThreadId(null);
    setSidebarOpen(false);
  };

  // Function to handle thread selection
  const handleThreadSelect = async (threadId) => {
    if (threadId === activeThreadId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/threads/retrieve?id=${threadId}`);
      
      if (!response.ok) throw new Error('Failed to load thread');
      
      const data = await response.json();
      setHistory(data.conversations);
      setActiveThreadId(threadId);
      setSidebarOpen(false);
      
      // Add smooth scrolling to bottom
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
      console.error('Error loading thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModelRetry = async (modelId, conversationId) => {
    console.log(`Retrying model ${modelId} for conversation ${conversationId}`);
    
    // Find the conversation to retry
    const conversation = history.find(entry => entry.id === conversationId);
    if (!conversation) {
      console.error("Conversation not found:", conversationId);
      return;
    }
    
    // Update UI to show loading
    setHistory(prev => {
      const updated = [...prev];
      const entryIndex = updated.findIndex(entry => entry.id === conversationId);
      if (entryIndex !== -1) {
        updated[entryIndex].responses = {
          ...updated[entryIndex].responses,
          [modelId]: {
            text: '',
            loading: true,
            error: null,
            streaming: true
          }
        };
      }
      return updated;
    });
    
    try {
      // This would normally call an API endpoint to retry the model
      // For now, we'll simulate it by re-submitting the prompt for this model only
      
      // Get custom models configuration
      const customModels = JSON.parse(localStorage.getItem('customLLMs') || '[]');
      
      // Create a new EventSource
      const newEventSource = new EventSource(
        `/api/stream?prompt=${encodeURIComponent(conversation.prompt)}&models=${encodeURIComponent(modelId)}&customModels=${encodeURIComponent(JSON.stringify(customModels))}`
      );
      
      newEventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.model === modelId) {
          const update = {
            text: data.text || '',
            error: data.error || null,
            loading: data.loading !== false,
            streaming: data.streaming !== false
          };
          
          setHistory(prev => {
            const updated = [...prev];
            const entryIndex = updated.findIndex(entry => entry.id === conversationId);
            if (entryIndex !== -1) {
              updated[entryIndex].responses[modelId] = update;
            }
            return updated;
          });
        }
        
        // Handle final completion
        if (data.allComplete) {
          newEventSource.close();
        }
      };
      
      // Handle errors
      newEventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        
        setHistory(prev => {
          const updated = [...prev];
          const entryIndex = updated.findIndex(entry => entry.id === conversationId);
          if (entryIndex !== -1) {
            updated[entryIndex].responses[modelId] = {
              text: '',
              loading: false,
              error: 'Failed to retry model',
              streaming: false
            };
          }
          return updated;
        });
        
        newEventSource.close();
      };
    } catch (error) {
      console.error("Error retrying model:", error);
      
      setHistory(prev => {
        const updated = [...prev];
        const entryIndex = updated.findIndex(entry => entry.id === conversationId);
        if (entryIndex !== -1) {
          updated[entryIndex].responses[modelId] = {
            text: '',
            loading: false,
            error: `Failed to retry: ${error.message}`,
            streaming: false
          };
        }
        return updated;
      });
    }
  };

  const handleFirstPrompt = () => {
    setHasInteracted(true);
    if (starfieldRef.current) {
      starfieldRef.current.stopAnimation();
    }
  };

  useEffect(() => {
    // When the first message is sent, stop the animation
    if (history.length > 0 && !hasInteracted) {
      handleFirstPrompt();
    }
  }, [history.length, hasInteracted]);

  const renderContextToggle = () => (
    <div className="flex items-center space-x-2">
      <switch
        checked={contextEnabled}
        onChange={setContextEnabled}
        className="relative inline-flex h-6 w-11 items-center rounded-full"
      >
        <span className="sr-only">Enable conversation context</span>
        {/* Switch UI */}
      </switch>
      <span className="text-sm text-gray-600 dark:text-gray-300">
        Conversation Memory
      </span>
    </div>
  );

  return (
    <div className="flex flex-col h-screen relative">
      <StarfieldBackground ref={starfieldRef} />
      
      {/* Add a dark overlay that fades out when hasInteracted is true */}
      <div 
        className="fixed inset-0 bg-black transition-opacity duration-1000 pointer-events-none z-[1]"
        style={{ 
          opacity: hasInteracted ? 0 : 0.3 
        }}
      />

      {/* Wrap all content in a relative container with z-index */}
      <div className="relative z-[2] flex flex-col h-screen">
        <Head>
          <title>Quicke - The AI ChatHub</title>
          <meta name="description" content="Get responses from multiple LLMs side by side" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <header className="relative z-10 bg-white/80 dark:bg-darksurface/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-800 safe-area-top">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-16">
              {/* Logo & Brand */}
              <div className="flex items-center space-x-3">
                {/* Add Hamburger Menu */}
                <button 
                  className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 group relative"
                  aria-label="Thread menu"
                  onMouseEnter={() => setSidebarOpen(true)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
                
                {/* Updated Quicke text with improved animation */}
                <h1 className="text-2xl font-bold quicke-text">
                  Quicke
                </h1>
                
                {/* Updated animation styles */}
                <style jsx global>{`
                  .quicke-text {
                    position: relative;
                    background: linear-gradient(90deg, 
                      rgba(255, 255, 255, 0.95) 0%, 
                      rgba(240, 240, 255, 0.9) 40%, 
                      rgba(225, 225, 245, 0.85) 60%, 
                      rgba(210, 210, 235, 0.8) 100%
                    );
                    background-size: 200% 100%;
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    -webkit-text-fill-color: transparent;
                    letter-spacing: 1px;
                  }
                  
                  /* Modify the wave effect to move in one direction only and slower */
                  .quicke-text::before {
                    content: 'Quicke';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, 
                      transparent 0%,
                      transparent 30%,
                      rgba(255, 240, 220, 0.7) 50%, 
                      transparent 70%,
                      transparent 100%
                    );
                    background-size: 300% 100%;
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    -webkit-text-fill-color: transparent;
                    animation: wave-through 12s linear infinite;
                  }
                  
                  /* Animation that moves in one direction only: right to left - REVERSED */
                  @keyframes wave-through {
                    0% { background-position: 400% 0; }
                    100% { background-position: -100% 0; }
                  }
                  
                  /* Keep the subtle underline */
                  .quicke-text::after {
                    content: '';
                    position: absolute;
                    width: 100%;
                    height: 1px;
                    bottom: -2px;
                    left: 0;
                    background: linear-gradient(90deg, transparent, rgba(255, 220, 160, 0.5), transparent);
                  }
                `}</style>
              </div>

              {/* Center - Model Selector */}
              <div className="flex-1 flex justify-center">
                <button 
                  ref={modelButtonRef}
                  onClick={handleModelButtonClick} // Replace onMouseEnter
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
                {session?.user ? (
                  <div className="relative group">
                    <button className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 transition-all duration-200">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e6dfd3] via-[#f5efe7] to-[#d4cbbe] flex items-center justify-center text-gray-800 font-medium shadow-sm"
                        style={{
                          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.05)'
                        }}>
                        {session.user.email.charAt(0).toUpperCase()}
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    <div className="absolute right-0 mt-2 w-56 py-2 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200"
                      style={{
                        backgroundColor: 'rgba(28, 28, 32, 0.75)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderRight: '1px solid rgba(75, 75, 80, 0.2)',
                        boxShadow: '0 0 20px rgba(0, 0, 0, 0.4)'
                      }}>
                      <div className="px-4 py-2 border-b border-gray-700/30">
                        <p className="text-sm text-gray-400">Signed in as</p>
                        <p className="text-sm font-medium text-gray-200 truncate">{session.user.email}</p>
                      </div>
                      
                      <button 
                        onClick={() => setShowApiKeyManager(true)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50 flex items-center transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
                          <path fillRule="evenodd" d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0 019 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 01.293-.707L8.196 8.39A5.002 5.002 0 018 7zm5-3a.75.75 0 000 1.5A1.5 1.5 0 0114.5 7 .75.75 0 0016 7a3 3 0 00-3-3z" clipRule="evenodd" />
                        </svg>
                        API Keys
                      </button>
                      
                      <div className="border-t border-gray-700/30 mt-2 pt-2">
                        <div className="px-4 py-2">
                          <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block">
                            Response Layout
                          </label>
                          <div className="flex items-center space-x-4">
                            <button
                              onClick={() => setResponseLayout('grid')}
                              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm ${
                                responseLayout === 'grid'
                                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path d="M2 4.25A2.25 2.25 0 014.25 2h2.5A2.25 2.25 0 019 4.25v2.5A2.25 2.25 0 016.75 9h-2.5A2.25 2.25 0 012 6.75v-2.5zM2 13.25A2.25 2.25 0 014.25 11h2.5A2.25 2.25 0 019 13.25v2.5A2.25 2.25 0 016.75 18h-2.5A2.25 2.25 0 012 15.75v-2.5zM11 4.25A2.25 2.25 0 0113.25 2h2.5A2.25 2.25 0 0118 4.25v2.5A2.25 2.25 0 0115.75 9h-2.5A2.25 2.25 0 0111 6.75v-2.5zM11 13.25A2.25 2.25 0 0113.25 11h2.5A2.25 2.25 0 0118 13.25v2.5A2.25 2.25 0 0115.75 18h-2.5A2.25 2.25 0 0111 15.75v-2.5z" />
                              </svg>
                              <span>Grid</span>
                            </button>
                            <button
                              onClick={() => setResponseLayout('stack')}
                              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm ${
                                responseLayout === 'stack'
                                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                              }`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v2.5A2.25 2.25 0 0115.75 9h-11.5A2.25 2.25 0 012 6.75v-2.5zM2 13.25A2.25 2.25 0 014.25 11h11.5A2.25 2.25 0 0118 13.25v2.5A2.25 2.25 0 0115.75 18h-11.5A2.25 2.25 0 012 15.75v-2.5z" />
                              </svg>
                              <span>Stack</span>
                            </button>
                          </div>
                        </div>
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
                      className="relative px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-300 overflow-hidden group"
                      style={{
                        background: 'linear-gradient(165deg, rgba(79, 70, 229, 0.4) 0%, rgba(55, 48, 163, 0.4) 100%)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: `
                          0 2px 4px rgba(79, 70, 229, 0.1),
                          0 4px 8px rgba(79, 70, 229, 0.1),
                          inset 0 1px 1px rgba(255, 255, 255, 0.4),
                          inset 0 -1px 1px rgba(0, 0, 0, 0.1)
                        `
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = `
                          0 4px 8px rgba(79, 70, 229, 0.2),
                          0 8px 16px rgba(79, 70, 229, 0.2),
                          inset 0 1px 1px rgba(255, 255, 255, 0.4),
                          inset 0 -1px 1px rgba(0, 0, 0, 0.1)
                        `;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = `
                          0 2px 4px rgba(79, 70, 229, 0.1),
                          0 4px 8px rgba(79, 70, 229, 0.1),
                          inset 0 1px 1px rgba(255, 255, 255, 0.4),
                          inset 0 -1px 1px rgba(0, 0, 0, 0.1)
                        `;
                      }}
                    >
                      {/* Glass highlight effect */}
                      <div 
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{
                          background: 'linear-gradient(165deg, rgba(255, 255, 255, 0.2) 0%, transparent 100%)',
                          borderRadius: '7px'
                        }}
                      />
                      <span className="relative z-10">Start Free</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Model Selector Dropdown */}
        {showModelSelector && (
          <>
            {/* Add backdrop div with blur effect */}
            <div 
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={() => setShowModelSelector(false)}
            />
            
            {/* Update model selector container */}
            <div
              ref={modelSelectorRef}
              className="fixed top-16 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-3xl rounded-xl bg-white/95 dark:bg-gray-900/95 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 z-50 transition-all duration-200 ease-out transform"
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
          </>
        )}

        <ApiKeyManager 
          isOpen={showApiKeyManager} 
          onClose={() => setShowApiKeyManager(false)} 
        />
        
        {error && (
          <div className="mx-auto w-full max-w-4xl p-4 my-2 bg-yellow-900/20 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-lg border border-yellow-200/30 dark:border-yellow-800/30">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
              Error: {error}
            </div>
          </div>
        )}
        
        <main className="flex-grow overflow-auto px-2 sm:px-4 py-2 mobile-scrollbar">
          <div className="max-w-5xl mx-auto">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="max-w-3xl w-full space-y-8">
                  <div className="space-y-4">
                    <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
                      Welcome to your AI ChatHub
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
        
        <footer className="px-2 sm:px-4 py-2 sm:py-4 bg-transparent relative z-[2] safe-area-bottom">
          <div className="relative max-w-4xl mx-auto">
            {/* Add glass effect container for prompt */}
            <div className="relative rounded-2xl backdrop-blur-md bg-white/10 dark:bg-gray-900/20 border border-gray-200/20 dark:border-gray-700/20 shadow-lg overflow-hidden">
              <div className="flex items-center gap-3 p-2">
                {history.length > 0 && (
                  <button
                    onClick={handleClear}
                    className="p-2.5 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50/20 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 group"
                    title="Clear screen"
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
                    onSubmit={(e) => {
                      if (!hasInteracted) {
                        handleFirstPrompt();
                      }
                      handleSubmit(e);
                    }}
                    onClear={handleClear}
                    disabled={loading || selectedModels.length === 0}  
                    isProcessing={isProcessing}
                    preserveOnFocus={true} // Add this prop
                  />
                </div>
              </div>
            </div>
          </div>
        </footer>

        <ThreadSidebar 
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          threads={threads}
          onNewThread={handleNewThread}
          onThreadSelect={handleThreadSelect}
          activeThreadId={activeThreadId}
        />
      </div>
    </div>
  );
}