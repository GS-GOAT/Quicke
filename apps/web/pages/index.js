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
import { useSplitPanel } from '../components/SplitPanelContext';
import SplitPanelLayout from '../components/SplitPanelLayout';
import { toast } from 'react-hot-toast';

// Guest mode configuration
const GUEST_ALLOWED_MODELS = ['gemini-flash', 'gemini-flash-2.5'];
const GUEST_CONVERSATION_LIMIT = 300;

// Model display names for UI elements
const modelDisplayNames = {
  'gemini-flash': 'Gemini 2.0 Flash',
  'gemini-flash-2.5': 'Gemini 2.5 Flash',
  'summary': 'Summarizer'
};

export default function Home() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);


  const defaultInitialModels = ['gemini-flash-2.5', 'gemini-flash'];
  const [selectedModels, setSelectedModels] = useState(defaultInitialModels);

  // Guest mode state
  const [isGuest, setIsGuest] = useState(true);
  const [guestConversationCount, setGuestConversationCount] = useLocalStorage('quicke_guest_convo_count', 0);

  // Load saved model selection only for logged-in users
  useEffect(() => {
    if (!isGuest) {
      const savedModels = localStorage.getItem('selectedModels');
      if (savedModels) {
        try {
          const parsedModels = JSON.parse(savedModels);
          if (Array.isArray(parsedModels) && parsedModels.length > 0) {
            setSelectedModels(parsedModels);
          }
        } catch (e) {
          console.error('Error parsing saved models:', e);
        }
      }
    }
  }, [isGuest]);

  const [error, setError] = useState(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showApiKeyManager, setShowApiKeyManager] = useState(false);
  const messagesEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const modelButtonRef = useRef(null);
  const modelSelectorRef = useRef(null);
  const [responseModels, setResponseModels] = useState({});
  const [isProcessing, setIsProcessing] = useState(false); 
  const [currentPromptId, setCurrentPromptId] = useState(null);
  const [showContinueButton, setShowContinueButton] = useState(true); 
  const [visibleSuggestions, setVisibleSuggestions] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [responseLayout, setResponseLayout] = useLocalStorage('responseLayout', 'stack');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const universeRef = useRef(null);
  const starfieldRef = useRef(null);
  const [contextEnabled, setContextEnabled] = useState(true);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [activeThreadTitle, setActiveThreadTitle] = useState("New Chat");
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [isClient, setIsClient] = useState(false); // New state to track client mount

  // Track which conversations have been saved to avoid duplicate saves
  const savedConversationsRef = useRef(new Set());

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

  // new state for summary
  const [showSummary, setShowSummary] = useState({});
  const [summaryLoading, setSummaryLoading] = useState({});

  // Get split panel context
  const { isSidePanelOpen, sidePanelContent, openSidePanel, closeSidePanel } = useSplitPanel();

  // handler for opening response in side panel
  const handleOpenInSidePanel = (columnProps) => {
    openSidePanel(columnProps);
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

  // to useEffect section
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

  // backdrop blur when model selector is open
  useEffect(() => {
    if (showModelSelector) {
      document.body.classList.add('backdrop-blur-active');
    } else {
      document.body.classList.remove('backdrop-blur-active');
    }
    return () => document.body.classList.remove('backdrop-blur-active');
  }, [showModelSelector]);

  // event listener for API key manager toggle
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

      // isHistorical flag to loaded conversations
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
    const currentPromptText = contextData.prompt || contextData.text || prompt;

    if (loading || isCreatingThread || !currentPromptText || !currentPromptText.trim()) {
      setLoading(false);
      return;
    }

    const modelsToSubmit = isGuest
      ? selectedModels.filter(m => GUEST_ALLOWED_MODELS.includes(m))
      : selectedModels;

    if (modelsToSubmit.length === 0) {
      triggerLoginPrompt(isGuest ? `Please select ${GUEST_ALLOWED_MODELS.map(m => modelDisplayNames[m] || m).join(' or ')} to chat.` : "Please select at least one model.");
      setLoading(false);
      return;
    }

    if (isGuest) {
      if (guestConversationCount >= GUEST_CONVERSATION_LIMIT) {
        triggerLoginPrompt("You've reached your free conversation limit. Please sign up or log in to continue.");
        setLoading(false);
        return;
      }
    } else if (!session) {
      triggerLoginPrompt("Please sign in to continue.");
      setLoading(false);
      return;
    }

    setIsProcessing(true);
    setHasInteracted(true);
    if (starfieldRef.current) starfieldRef.current.stopAnimation();

    const conversationId = `conv-${isGuest ? 'guest' : (session?.user?.id?.slice(-5) || 'user')}-${Date.now()}`;
    setCurrentPromptId(conversationId);

    let currentThreadIdForAPI = activeThreadId;

    if (!isGuest && !currentThreadIdForAPI) {
      setIsCreatingThread(true);
      try {
        const tentativeTitle = currentPromptText.substring(0, 50) + (currentPromptText.length > 50 ? '...' : '');
        const threadRes = await fetch('/api/threads/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: tentativeTitle })
        });

        if (!threadRes.ok) {
          const errorData = await threadRes.json();
          throw new Error(errorData.error || 'Failed to create new thread');
        }

        const newThread = await threadRes.json();
        currentThreadIdForAPI = newThread.id;
        setActiveThreadId(newThread.id);
        setActiveThreadTitle(newThread.title);
        router.push(`/?threadId=${newThread.id}`, undefined, { shallow: true });
        fetchThreads();
      } catch (err) {
        console.error('Error creating thread:', err);
        setError(`Failed to start new chat: ${err.message}`);
        setIsProcessing(false);
        setIsCreatingThread(false);
        return;
      } finally {
        setIsCreatingThread(false);
      }
    }

    const firstFileId = !isGuest && (contextData.fileId || (contextData.fileIds && contextData.fileIds[0])) || null;
    const fileIds = !isGuest && (contextData.fileIds || (contextData.fileId ? [contextData.fileId] : [])) || [];

    const initialResponses = {};
    modelsToSubmit.forEach(model => {
      initialResponses[model] = { text: '', loading: true, error: null, streaming: true, done: false };
    });

    setHistory(prev => [...prev, {
      id: conversationId,
      prompt: currentPromptText,
      responses: initialResponses,
      activeModels: [...modelsToSubmit],
      timestamp: new Date(),
      isHistorical: false,
      fileId: firstFileId,
      fileIds: fileIds,
      fileName: !isGuest ? (contextData?.fileName || null) : null,
      fileNames: !isGuest ? (contextData?.fileNames || []) : [],
      threadId: isGuest ? null : currentThreadIdForAPI,
    }]);

    setPrompt('');

    const queryParams = new URLSearchParams({
      prompt: currentPromptText,
      models: modelsToSubmit.join(','),
      conversationId,
    });

    if (isGuest) {
      queryParams.append('isGuest', "true");
    } else {
      if (currentThreadIdForAPI) queryParams.append('threadId', currentThreadIdForAPI);
      if (contextEnabled) queryParams.append('useContext', "true");
      if (firstFileId) queryParams.append('fileId', firstFileId);
      if (fileIds.length > 0) queryParams.append('fileIds', fileIds.join(','));
    }

    const newEventSource = new EventSource(`/api/stream?${queryParams.toString()}`);
    eventSourceRef.current = newEventSource;

    if (isGuest) setGuestConversationCount(prev => prev + 1);

    const finalModelTextsToSave = {};

    newEventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.model && modelsToSubmit.includes(data.model)) {
        const update = {
          text: data.text !== undefined ? data.text : '',
          error: data.error || null,
          loading: data.loading !== undefined ? data.loading : false,
          streaming: data.streaming !== undefined ? data.streaming : false,
          done: data.done === true,
          duration: data.duration || null
        };

        if (update.done && !update.error && !isGuest) {
          finalModelTextsToSave[data.model] = { text: update.text, timestamp: Date.now() };
        }

        setHistory(prevHist => {
          const updatedHist = [...prevHist];
          const idx = updatedHist.findIndex(e => e.id === conversationId);
          if (idx !== -1) {
            if (!updatedHist[idx].responses[data.model]) updatedHist[idx].responses[data.model] = {};
            updatedHist[idx].responses[data.model] = { ...updatedHist[idx].responses[data.model], ...update };
          }
          return updatedHist;
        });

        // After updating history, check if all models are done and save the conversation (for logged-in users only)
        if (!isGuest) {
          setTimeout(() => {
            setHistory(prevHist => {
              const updatedHist = [...prevHist];
              const idx = updatedHist.findIndex(e => e.id === conversationId);
              if (idx !== -1) {
                const allDone = Object.values(updatedHist[idx].responses).every(r => r.done || r.error);
                if (allDone && !savedConversationsRef.current.has(conversationId)) {
                  savedConversationsRef.current.add(conversationId);
                  // Save the conversation
                  fetch('/api/conversations/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: conversationId,
                      prompt: updatedHist[idx].prompt,
                      responses: updatedHist[idx].responses,
                      threadId: updatedHist[idx].threadId,
                      summary: updatedHist[idx].summary || undefined
                    })
                  }).catch(err => {
                    console.error('Failed to save conversation:', err);
                  });
                }
              }
              return updatedHist;
            });
          }, 0);
        }
      }
    };

    newEventSource.onerror = (err) => {
      console.error('EventSource error:', err);
      newEventSource.close();
      eventSourceRef.current = null;
      setIsProcessing(false);
      setCurrentPromptId(null);
      // setError('Connection error. Please try again.');
    };

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    setIsProcessing(false);
    setCurrentPromptId(null);
    setShowContinueButton(true);
    
    // Reset the animation state
    setHasInteracted(false);
    
    // Restart the starfield animation
    if (starfieldRef.current) {
      starfieldRef.current.startAnimation();
    }
  };

  // summary generation function
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

  // separator component between conversations
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
              // Don't immediately submit, just set the prompt text
              // handleSubmit({ text: suggestion });
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

  // Load more button handler
  const handleLoadMore = () => {
    if (hasMore) {
      if (activeThreadId) {
        // If in thread view, load more conversations from this thread
        handleLoadMoreThreadConversations();
      } else {
        // Otherwise, load more from general history
        const nextPage = Math.ceil(history.filter(entry => entry.isHistorical).length / 5) + 1;
        fetchConversations(nextPage);
      }
    }
  };
  
  // Function to load more conversations from the current thread
  const handleLoadMoreThreadConversations = async () => {
    try {
      // Get current scroll position before loading more
      const mainContent = document.querySelector('main');
      const oldScrollHeight = mainContent?.scrollHeight || 0;
      const oldScrollTop = mainContent?.scrollTop || 0;
      
      // Use the number of existing conversations to calculate the offset
      const existingConversations = history.length;
      const response = await fetch(`/api/threads/retrieve?id=${activeThreadId}&skip=${existingConversations}`);
      
      if (!response.ok) throw new Error('Failed to load more thread conversations');
      
      const data = await response.json();
      
      // Set hasMore based on whether we received any additional conversations
      setHasMore(data.conversations.length > 0);
      
      // the new conversations to existing history
      if (data.conversations.length > 0) {
        setHistory(prev => [...prev, ...data.conversations]);
        
        // After state update, adjust scroll position to maintain view
        setTimeout(() => {
          if (mainContent) {
            const newScrollHeight = mainContent.scrollHeight;
            const heightDifference = newScrollHeight - oldScrollHeight;
            mainContent.scrollTop = oldScrollTop + heightDifference;
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error loading more thread conversations:', error);
    }
  };

  const getResponseLayoutClass = () => {
    if (isSidePanelOpen) {
      return 'flex flex-col space-y-6'; // Single column when side panel is open
    }
    return responseLayout === 'grid' 
      ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
      : 'flex flex-col space-y-6';
  };

  // Update renderConversationHistory to use history state directly
  const renderConversationHistory = () => {
    return (
      <div className="space-y-6">
        {history.map((entry, index) => (
          <div key={entry.id || `entry-${index}`} className="space-y-6">
            {/* File attachment display */}
            {entry.fileId && (
              <div className="flex justify-end mb-2">
                <div className="bg-gray-50 dark:bg-gray-800 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm max-w-[280px]">
                  <div className="flex items-center">
                    {/* File type icons */}
                    {entry.fileName?.toLowerCase().endsWith('.pdf') && (
                      <div className="mr-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {/* ... other file type icons ... */}
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate w-full" title={entry.fileName || "Attached Document"}>
                        {entry.fileName || "Attached Document"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
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
                  conversationId={entry.id}
                  response={entry.responses?.[model]}
                  streaming={currentPromptId === entry.id && entry.responses?.[model]?.streaming}
                  className="light-response-column"
                  onRetry={handleModelRetry}
                  onOpenInSidePanel={handleOpenInSidePanel}
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
            
            {/* summarize button */}
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
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 transition-transform duration-300 group-hover:scale-110">
                        <path d="M21 6.375c0 2.692-4.03 4.875-9 4.875S3 9.067 3 6.375 7.03 1.5 12 1.5s9 2.183 9 4.875z" />
                        <path d="M12 12.75c2.685 0 5.19-.586 7.078-1.609a8.283 8.283 0 001.897-1.384c.016.121.025.244.025.368C21 12.817 16.97 15 12 15s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.285 8.285 0 001.897 1.384C6.809 12.164 9.315 12.75 12 12.75z" />
                        <path d="M12 16.5c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 001.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 001.897 1.384C6.809 15.914 9.315 16.5 12 16.5z" />
                      </svg>
                      <span>Summarize Responses</span>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Show separator between historical and new conversations */}
            {index < history.length - 1 && entry.isHistorical !== history[index + 1].isHistorical && (
              <div className="flex items-center my-8">
                <div className="flex-grow h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
                <div className="mx-4 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                  {entry.isHistorical ? "New Conversations" : "Previous Conversations"}
                </div>
                <div className="flex-grow h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
              </div>
            )}
          </div>
        ))}
      </div>
    );
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
      
      // Create a new EventSource
      const newEventSource = new EventSource(
        `/api/stream?prompt=${encodeURIComponent(conversation.prompt)}&models=${encodeURIComponent(modelId)}`
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

  // Ensure the layout toggle works correctly on initial load
  useEffect(() => {
    // Force a re-render of the toggle buttons when the component mounts
    const layoutButtons = document.querySelectorAll('.layout-toggle-button');
    layoutButtons.forEach(button => {
      button.classList.remove('bg-primary-900/40', 'text-gray-400');
      if ((button.dataset.layout === 'grid' && responseLayout === 'grid') || 
          (button.dataset.layout === 'stack' && responseLayout === 'stack')) {
        button.classList.add('bg-primary-900/40', 'text-primary-400');
      } else {
        button.classList.add('text-gray-400');
      }
    });
  }, [responseLayout]);

  // Update handleStopStreaming to work with history state
  const handleStopStreaming = () => {
    console.log('Stopping stream');
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setHistory(prev => {
      return prev.map(entry => {
        if (entry.id === currentPromptId) {
          const updatedResponses = { ...entry.responses };
          
          Object.keys(updatedResponses).forEach(model => {
            if (updatedResponses[model]?.streaming || updatedResponses[model]?.loading) {
              updatedResponses[model] = {
                ...updatedResponses[model],
                streaming: false,
                loading: false,
                text: updatedResponses[model].text ? updatedResponses[model].text + " [stopped]" : "[stopped]",
                done: true
              };
            }
          });
          
          return { ...entry, responses: updatedResponses };
        }
        return entry;
      });
    });
    
    setIsProcessing(false);
    setLoading(false);
    setCurrentPromptId(null);
  };

  // Function to fetch threads
  const fetchThreads = async () => {
    if (!session) return;
    try {
      const response = await fetch(`/api/threads/list`);
      if (response.ok) {
        const data = await response.json();
        // Display up to 10 threads
        setThreads(data.threads);
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
    }
  };

  // Function to delete the oldest thread and its conversations
  const deleteOldestThread = async () => {
    if (!session) return { success: false };
    try {
      const response = await fetch(`/api/threads/delete-oldest`, {
        method: 'DELETE'
      });
      if (response.ok) {
        // Refetch threads after deletion
        fetchThreads();
        return { success: true };
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error('Error deleting oldest thread:', error);
      return { success: false };
    }
  };

  // Function to handle thread selection
  const handleThreadSelect = (threadId) => {
    if (isGuest || !session) return;
    
    if (threadId === activeThreadId && history.length > 0) {
      setSidebarOpen(false);
      return;
    }
    
    router.push(`/?threadId=${threadId}`, undefined, { shallow: false }); // Changed shallow: true to false
    setSidebarOpen(false);
  };

  // Fetch threads on component mount
  useEffect(() => {
    if (session?.user) {
      fetchThreads();
    }
  }, [session]);

  // Function to handle new thread creation
  const handleNewThread = async () => {
    if (isGuest) {
      triggerLoginPrompt("Please sign up or log in to create and save chat threads.");
      return;
    }
    
    if (!session) return;

    setHistory([]);
    setActiveThreadId(null);
    setActiveThreadTitle("New Chat");
    router.push('/', undefined, { shallow: false }); // Changed shallow: true to false
    setSidebarOpen(false);
    setHasInteracted(false);
    
    if (starfieldRef.current) {
      starfieldRef.current.startAnimation();
    }
    
    setCurrentPromptId(null);
    setPrompt('');
    window.dispatchEvent(new Event('clearFileReferences'));
  };

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
          
          <div className="flex flex-col h-[calc(100%-60px)]">
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
            </div>
            
            {/* Thread List with purple accent border - now scrollable */}
            <div className="px-4 pb-4 overflow-y-auto flex-1">
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
        </div>
        
        {/*  style tag to ensure the glass effect works */}
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

  // --- Session, Guest, and Thread Loading Logic ---
  useEffect(() => {
    setIsClient(true); // Set isClient to true after first render on client

    if (sessionStatus === 'loading') {
      setLoading(true);
      return;
    }
    setLoading(false);

    const currentIsGuest = !session;
    setIsGuest(currentIsGuest);
    const queryThreadId = router.query.threadId;

    if (currentIsGuest) {
      // Guest mode handling
      setHistory([]);
      setActiveThreadId(null);
      setActiveThreadTitle("New Chat");
      setThreads([]);
      setContextEnabled(false);
      
      // If guest was on a thread URL, redirect them to the base URL
      if (queryThreadId) {
        router.replace('/', undefined, { shallow: true });
      }
    } else {
      // Logged-in user handling
      fetchThreads(); // Fetch available threads for the sidebar
      
      if (queryThreadId) {
        // A specific thread is in the URL
        if (queryThreadId !== activeThreadId || history.length === 0) {
          loadThreadConversations(queryThreadId, 0, true);
        }
      } else {
        // No threadId in URL, means it's a "new chat" or base page
        if (activeThreadId || history.length > 0) {
          setHistory([]);
          setActiveThreadId(null);
          setActiveThreadTitle("New Chat");
        }
      }
    }
  }, [session, sessionStatus, router.query.threadId]);

  const loadThreadConversations = async (threadIdToLoad, skipCount = 0, initialLoad = false) => {
    if (isGuest || !session || !threadIdToLoad) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/threads/retrieve?id=${threadIdToLoad}&skip=${skipCount}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError("Thread not found or you don't have access.");
          router.replace('/', undefined, { shallow: true });
          setActiveThreadId(null);
          setActiveThreadTitle("New Chat");
          setHistory([]);
          return;
        }
        throw new Error('Failed to load thread');
      }

      const data = await response.json();
      const newConversations = data.conversations || [];

      if (initialLoad) {
        setHistory(newConversations.reverse());
      } else {
        setHistory(prev => [...newConversations.reverse(), ...prev]);
      }

      setActiveThreadId(threadIdToLoad);
      setActiveThreadTitle(data.thread?.title || "Chat");
      setHasMoreConversations(data.hasMore || false);
      setSidebarOpen(false);
      window.dispatchEvent(new Event('clearFileReferences'));

      // Scroll handling
      setTimeout(() => {
        const mainContent = document.querySelector('main div div.h-full.overflow-y-auto');
        if (mainContent) {
          if (initialLoad) {
            mainContent.scrollTop = mainContent.scrollHeight;
          } else {
            const oldScrollHeight = mainContent.dataset.oldScrollHeight || 0;
            mainContent.scrollTop = mainContent.scrollHeight - oldScrollHeight;
            mainContent.dataset.oldScrollHeight = mainContent.scrollHeight;
          }
        }
      }, 100);

    } catch (error) {
      console.error('Error loading thread:', error);
      setError(error.message || 'Failed to retrieve thread conversations.');
    } finally {
      setLoading(false);
    }
  };

  // --- Welcome Screen Logic ---
  const renderWelcomeOrSuggestions = () => {
    // Only render guest-specific message on client after hydration
    if (isGuest && !isClient) {
      return null; // Or a placeholder if needed
    }

    if (activeThreadId && history.length > 0) return null;
    if (history.length > 0 && !isGuest) return null;
    if (isProcessing) return null;

    if (isGuest && isClient && guestConversationCount >= GUEST_CONVERSATION_LIMIT) { // Add isClient check
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <h2 className="text-2xl font-bold mb-4">Free Trial Limit Reached</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You've used all {GUEST_CONVERSATION_LIMIT} free conversations. Sign up to continue chatting!
          </p>
          <button
            onClick={() => signIn()}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Sign Up Now
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        {renderSuggestions()}
        {isGuest && isClient ? ( // Conditionally render guest message only on client
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl">
            Try out our AI models with {GUEST_CONVERSATION_LIMIT - guestConversationCount} free conversations.
          </p>
        ) : !isGuest ? ( // Render for logged-in users always
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl">
            Start a new conversation or select a thread from your library.
          </p>
        ) : null} {/* Don't render anything for guest on server */}
      </div>
    );
  };

  // Login prompt function
  const triggerLoginPrompt = (message) => {
    toast.error(
      (t) => (
        <div className="flex flex-col items-center text-center p-2">
          <span className="text-sm mb-3">{message}</span>
          <div className="flex gap-3">
            <button
              onClick={() => { router.push('/auth/signin'); toast.dismiss(t.id); }}
              className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-md"
            >
              Sign In
            </button>
            <button
              onClick={() => { router.push('/auth/signup'); toast.dismiss(t.id); }}
              className="px-4 py-2 text-xs font-semibold text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-md shadow-md"
            >
              Sign Up
            </button>
            <button onClick={() => toast.dismiss(t.id)} className="p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 hover:text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ),
      { duration: 10000, position: 'top-center', style: { background: '#1F2937', color: '#F3F4F6', border: '1px solid #374151', maxWidth: '450px', borderRadius: '8px' } }
    );
  };

  // Add this helper function inside Home component
  const renderMainContentArea = () => {
    if (history.length === 0 && !isProcessing && !(activeThreadId && loading && !error)) {
      return (
        <div className="flex-1 flex items-center justify-center h-full">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="max-w-3xl w-full space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white">
                  What can I help with?
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-400">
                  Get instant responses from multiple AI models side by side
                </p>
              </div>
              {renderWelcomeOrSuggestions()}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="h-full overflow-y-auto scrollbar-thin">
        <div className="px-2 sm:px-4 py-2 pb-32">
          <div className="max-w-7xl mx-auto">
            {renderConversationHistory()}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative z-[2] flex flex-col min-h-screen">
      <StarfieldBackground ref={starfieldRef} />
      
      {/* Dark overlay */}
      <div 
        className="fixed inset-0 bg-black transition-opacity duration-1000 pointer-events-none z-[1]"
        style={{ 
          opacity: hasInteracted ? 0 : 0.3 
        }}
      />

      {/* Main content wrapper */}
      <div className="relative z-[2] flex flex-col h-screen">
        <Head>
          <title>Quicke - The AI ChatHub</title>
          <meta name="description" content="Get responses from multiple LLMs side by side" />
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <header className="relative z-10 bg-white/80 dark:bg-darksurface/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-800 safe-area-top">
          <div className="max-w-7xl mx-auto px-2 sm:px-6">
            <div className="flex items-center justify-between h-[52px] sm:h-16">
              {/* Logo & Brand */}
              <div className="flex items-center space-x-2 sm:space-x-3">
                <button 
                  className="p-1.5 sm:p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 group relative"
                  aria-label="Thread menu"
                  onMouseEnter={() => setSidebarOpen(true)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
                
                <h1 className="text-xl sm:text-2xl font-bold quicke-text">
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
              <div className="flex-1 flex justify-center px-1 sm:px-4">
                <button 
                  ref={modelButtonRef}
                  onClick={handleModelButtonClick}
                  className="group px-2 sm:px-4 py-1 sm:py-2 rounded-lg bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs sm:text-sm font-medium transition-all duration-200 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <span>{selectedModels.length} Model{selectedModels.length !== 1 ? 's' : ''}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-primary-500 transition-colors">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* Right Actions */}
              <div className="flex items-center space-x-4">
                {/* layout toggle buttons outside of dropdown menu */}
                <div className="hidden md:flex items-center space-x-2 mr-2 px-2 py-1 rounded-lg bg-gray-800/30">
                  <button
                    onClick={() => setResponseLayout('grid')}
                    data-layout="grid"
                    className={`layout-toggle-button flex items-center p-1.5 rounded-lg text-sm transition-colors ${
                      responseLayout === 'grid'
                        ? 'bg-primary-900/40 text-primary-400'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'
                    }`}
                    title="Grid Layout"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path d="M2 4.25A2.25 2.25 0 014.25 2h2.5A2.25 2.25 0 019 4.25v2.5A2.25 2.25 0 016.75 9h-2.5A2.25 2.25 0 012 6.75v-2.5zM2 13.25A2.25 2.25 0 014.25 11h2.5A2.25 2.25 0 019 13.25v2.5A2.25 2.25 0 016.75 18h-2.5A2.25 2.25 0 012 15.75v-2.5zM11 4.25A2.25 2.25 0 0113.25 2h2.5A2.25 2.25 0 0118 4.25v2.5A2.25 2.25 0 0115.75 9h-2.5A2.25 2.25 0 0111 6.75v-2.5zM11 13.25A2.25 2.25 0 0113.25 11h2.5A2.25 2.25 0 0118 13.25v2.5A2.25 2.25 0 0115.75 18h-2.5A2.25 2.25 0 0111 15.75v-2.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setResponseLayout('stack')}
                    data-layout="stack"
                    className={`layout-toggle-button flex items-center p-1.5 rounded-lg text-sm transition-colors ${
                      responseLayout === 'stack'
                        ? 'bg-primary-900/40 text-primary-400'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'
                    }`}
                    title="Stack Layout"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v2.5A2.25 2.25 0 0115.75 9h-11.5A2.25 2.25 0 012 6.75v-2.5zM2 13.25A2.25 2.25 0 014.25 11h11.5A2.25 2.25 0 0118 13.25v2.5A2.25 2.25 0 0115.75 18h-11.5A2.25 2.25 0 012 15.75v-2.5z" />
                    </svg>
                  </button>
                </div>

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

        {/* Model Selector */}
        <ModelSelector
          isOpen={showModelSelector}
          setIsOpen={setShowModelSelector}
          selectedModels={selectedModels}
          setSelectedModels={setSelectedModels}
          isGuest={isGuest}
        />

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
        
        {/* Main content area */}
        <main className="flex-1 overflow-hidden relative">
          {isSidePanelOpen && sidePanelContent ? (
            <SplitPanelLayout
              leftContent={renderMainContentArea()}
              rightContent={
                sidePanelContent && (
                  <ResponseColumn
                    {...sidePanelContent}
                    isInSidePanel={true}
                    onCloseSidePanel={closeSidePanel}
                    onOpenInSidePanel={handleOpenInSidePanel}
                    onRetry={handleModelRetry}
                  />
                )
              }
            />
          ) : (
            renderMainContentArea()
          )}
        </main>

        {/* Footer with prompt bar */}
        <footer className="px-2 sm:px-4 py-2 sm:py-4 bg-transparent relative sm:relative z-[40] safe-area-bottom">
          <div className="relative max-w-4xl mx-auto">
            {/* This div is the main "glass" container for the prompt bar */}
            <div className="relative rounded-2xl backdrop-blur-md bg-white/10 dark:bg-gray-900/20 border border-gray-200/20 dark:border-gray-700/20 shadow-lg overflow-hidden">
              <div className="flex items-center gap-3 p-2">
                {history.length > 0 && (
                  <button
                    onClick={handleClear}
                    className="p-2.5 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50/20 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 group"
                    title="Clear screen"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 transform group-hover:scale-110 transition-transform duration-200">
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
                    disabled={
                      (isGuest && guestConversationCount >= GUEST_CONVERSATION_LIMIT) || // Guest quota
                      isProcessing || // Stream active
                      loading || // General loading (e.g., thread creation)
                      (!isGuest && selectedModels.length === 0) // Logged in but no models selected
                    }
                    isProcessing={isProcessing}
                    preserveOnFocus={true}
                    onStopStreaming={handleStopStreaming}
                    threadId={activeThreadId}
                    selectedModels={selectedModels}
                    isGuest={isGuest} // Pass isGuest
                    onTriggerLoginPrompt={triggerLoginPrompt} // Pass handler
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