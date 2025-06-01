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
import { useSplitPanel } from '../components/SplitPanelContext';
import SplitPanelLayout from '../components/SplitPanelLayout';
import { toast } from 'react-hot-toast';
import SkeletonLoaderChatUI from '../components/SkeletalLoaderChatUI';

// Guest mode configuration
const GUEST_ALLOWED_MODELS = ['gemini-flash', 'gemini-flash-2.5'];
const GUEST_CONVERSATION_LIMIT = 5;

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
  const [visibleSuggestions, setVisibleSuggestions] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [responseLayout, setResponseLayout] = useLocalStorage('responseLayout', 'stack');
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [contextEnabled, setContextEnabled] = useState(true);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [activeThreadTitle, setActiveThreadTitle] = useState("New Chat");
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [isClient, setIsClient] = useState(false); // New state to track client mount
  const [sidebarVisible, setSidebarVisible] = useState(true); // State to control sidebar visibility
  const [isThreadLoading, setIsThreadLoading] = useState(false); // <-- Ensure this is present
  // --- FIX: Declare summariesProcessed state ---
  const [summariesProcessed, setSummariesProcessed] = useState(new Set());
  const [autoSummarizeEnabled, setAutoSummarizeEnabled] = useLocalStorage('autoSummarizeEnabled', true);

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

      // Defensive sort by timestamp
      const sortedConversations = historicalConversations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setHistory(prev => 
        pageNum > 1 
          ? [...prev, ...sortedConversations]
          : sortedConversations
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
    if (currentPromptId) {
      handleStopStreaming();
    }

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
                  }).then(() => {
                    // After saving the conversation, refetch threads to update the list
                    fetchThreads();
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
  };

  // summary generation function
  const generateSummary = async (conversationId) => {
    // Prevent multiple calls for the same conversation if one is already in progress or done
    const conversationEntry = history.find(h => h.id === conversationId);
    if (!conversationEntry || conversationEntry.summaryFetching || (conversationEntry.summary && !conversationEntry.summaryError)) {
      if(conversationEntry && conversationEntry.summary && autoSummarizeEnabled && !conversationEntry.summaryOpenedInPanel) {
        // If summary exists and should be auto-opened
         openSidePanel({
            model: 'summary', conversationId: conversationId,
            response: { text: conversationEntry.summary, loading: false, streaming: false, error: null, done: true },
            streaming: false, isSummary: true,
          });
          setHistory(prev => prev.map(c => c.id === conversationId ? { ...c, summaryOpenedInPanel: true } : c));
      }
      return;
    }
  
    setHistory(prev => prev.map(h => h.id === conversationId ? { ...h, summaryFetching: true, summaryFetched: true, summaryError: null } : h));
    setSummaryLoading(prev => ({ ...prev, [conversationId]: true }));
  
    try {
      const validResponses = Object.entries(conversationEntry.responses)
        .filter(([_, response]) => !response.error && response.text)
        .reduce((acc, [model, response]) => {
          acc[model] = { text: response.text };
          return acc;
        }, {});
  
      if (Object.keys(validResponses).length === 0) throw new Error('No valid responses to summarize');
  
      let summarizeUrl = '/api/summarize';
      if (isGuest) summarizeUrl += '?isGuest=true';
  
      const res = await fetch(summarizeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: validResponses })
      });
  
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to generate summary API');
      }
  
      const summaryData = await res.json();
  
      setHistory(prev => prev.map(h => {
        if (h.id === conversationId) {
          return { ...h, summary: summaryData.text, summaryError: null, summaryFetching: false };
        }
        return h;
      }));
  
      // Auto-open in side panel if enabled
      if (autoSummarizeEnabled) {
        openSidePanel({
          model: 'summary', conversationId: conversationId,
          response: { text: summaryData.text, loading: false, streaming: false, error: null, done: true },
          streaming: false, isSummary: true,
        });
        setHistory(prev => prev.map(c => c.id === conversationId ? { ...c, summaryOpenedInPanel: true } : c));
      }
  
      if (!isGuest && session) {
        await fetch('/api/conversations/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: conversationId,
            prompt: conversationEntry.prompt,
            responses: conversationEntry.responses, // Save original responses
            threadId: conversationEntry.threadId, // Ensure threadId is from the conversation entry
            summary: summaryData.text
          })
        });
        // Optionally refetch threads if summary save should update thread list immediately
        // fetchThreads(); 
      }
      return summaryData.text;
    } catch (error) {
      console.error(`Summary generation failed for ${conversationId}:`, error);
      setHistory(prev => prev.map(h =>
        h.id === conversationId ? { ...h, summary: null, summaryError: error.message || 'Failed to generate summary', summaryFetching: false } : h
      ));
      // Do not re-throw here if error is handled by setting history
    } finally {
      setSummaryLoading(prev => ({ ...prev, [conversationId]: false }));
    }
  };

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
    // Only show conversations that have a prompt or at least one non-empty response
    const filteredHistory = history.filter(entry => {
      if (entry.prompt && entry.prompt.trim() !== '') return true;
      // Check if any response has non-empty text
      return Object.values(entry.responses || {}).some(r => r && r.text && r.text.trim() !== '');
    });
    return (
      <div className="space-y-6">
        {filteredHistory.map((entry, index) => (
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
            {index < filteredHistory.length - 1 && entry.isHistorical !== filteredHistory[index + 1].isHistorical && (
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
        // Process threads to group by date
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        const groupedThreads = { today: [], yesterday: [], past30Days: [], older: [] };

        data.threads.forEach(thread => {
          const threadDate = new Date(thread.updatedAt);
          const threadDay = new Date(threadDate.getFullYear(), threadDate.getMonth(), threadDate.getDate());

          if (threadDay >= today) {
            groupedThreads.today.push(thread);
          } else if (threadDay >= yesterday) {
            groupedThreads.yesterday.push(thread);
          } else if (threadDay >= thirtyDaysAgo) {
            groupedThreads.past30Days.push(thread);
          } else {
            groupedThreads.older.push(thread);
          }
        });

        // Sort each group by updatedAt descending
        Object.keys(groupedThreads).forEach(key => {
          groupedThreads[key].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        });

        setThreads(groupedThreads);

      } else {
        console.error('Failed to fetch threads:', response.status);
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
  const handleThreadSelect = (threadIdToSelect) => {
    if (isGuest || !session) return;
    if (threadIdToSelect === activeThreadId && history.length > 0) {
      return;
    }
    setIsThreadLoading(true);
    setHistory([]);
    closeSidePanel();
    setPrompt('');
    setCurrentPromptId(null);
    setError(null);
    setSummariesProcessed(new Set());
    savedConversationsRef.current = new Set();
    window.dispatchEvent(new Event('clearFileReferences'));
    router.push(`/?threadId=${threadIdToSelect}`, undefined, { shallow: false });
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
    setIsThreadLoading(true);
    setHistory([]);
    setActiveThreadId(null);
    closeSidePanel();
    setActiveThreadTitle("New Chat");
    setPrompt('');
    setCurrentPromptId(null);
    setError(null);
    setSummariesProcessed(new Set());
    savedConversationsRef.current = new Set();
    window.dispatchEvent(new Event('clearFileReferences'));
    router.push('/', undefined, { shallow: false }).then(() => {
      setIsThreadLoading(false);
    });
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
      setIsThreadLoading(false);
    } else {
      // Logged-in user handling
      fetchThreads(); // Fetch available threads for the sidebar
      
      if (queryThreadId) {
        // A specific thread is in the URL
        if (queryThreadId !== activeThreadId || history.length === 0) {
          loadThreadConversations(queryThreadId, 0, true);
        } else {
          setIsThreadLoading(false);
        }
      } else {
        // No threadId in URL, means it's a "new chat" or base page
        if (activeThreadId || history.length > 0) {
          setHistory([]);
          setActiveThreadId(null);
          setActiveThreadTitle("New Chat");
          setSummariesProcessed(new Set());
          savedConversationsRef.current = new Set();
          window.dispatchEvent(new Event('clearFileReferences'));
        }
        setIsThreadLoading(false);
      }
    }
  }, [session, sessionStatus, router.query.threadId]);

  const loadThreadConversations = async (threadIdToLoad, skipCount = 0, initialLoad = false) => {
    if (isGuest || !session || !threadIdToLoad) return;
    if (initialLoad) {
      setHistory([]);
      setIsThreadLoading(true);
      setError(null);
      setSummariesProcessed(new Set());
      savedConversationsRef.current = new Set();
    }
    try {
      const response = await fetch(`/api/threads/retrieve?id=${threadIdToLoad}&skip=${skipCount}`);
      if (!response.ok) {
        if (initialLoad) setIsThreadLoading(false);
        return;
      }
      const data = await response.json();
      const newConversations = (data.conversations || []).map(conv => ({
        ...conv,
        summaryFetched: !!conv.summary,
        summaryOpenedInPanel: false,
      }));
      // Defensive sort by timestamp
      const sortedConversations = newConversations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      if (initialLoad) {
        setHistory(sortedConversations);
      } else {
        setHistory(prev => [...prev, ...sortedConversations]);
      }
      setActiveThreadId(threadIdToLoad);
      setActiveThreadTitle(data.thread?.title || "Chat");
      setHasMoreConversations(data.hasMore || false);
      if (initialLoad) window.dispatchEvent(new Event('clearFileReferences'));
      setTimeout(() => {
        const mainContent = document.querySelector('main div div.h-full.overflow-y-auto.relative.scrollbar-thin');
        if (mainContent && initialLoad) {
          mainContent.scrollTop = mainContent.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Error loading thread:', error);
      setError(error.message || 'Failed to retrieve thread conversations.');
    } finally {
      if (initialLoad) setIsThreadLoading(false);
    }
  };

  // --- Welcome Screen Logic ---
  const renderWelcomeOrSuggestions = () => {
    // Only render guest-specific message on client after hydration
    if (isGuest && !isClient) {
      return null; // Or a placeholder if needed
    }

    // If there's history or processing, don't show the welcome screen unless it's a new thread view without history loaded yet
    if (history.length > 0 && !activeThreadId) return null;
    if (isProcessing && !activeThreadId) return null;
    if (activeThreadId && history.length > 0 && !loading) return null; // Hide if in a thread with loaded history and not loading more

    if (isGuest && isClient && guestConversationCount >= GUEST_CONVERSATION_LIMIT) { // Add isClient check
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <h2 className="text-2xl font-bold mb-4">Free Trial Limit Reached</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You've used all {GUEST_CONVERSATION_LIMIT - guestConversationCount} free conversations. Sign up to continue chatting!
          </p>
          <Link href="/auth/signup" className="px-4 py-2 text-sm font-medium transition-colors bg-white text-gray-900 rounded-full hover:bg-gray-200">
            Sign Up Now
          </Link>
        </div>
      );
    }

    // Default welcome screen (for guests before limit, or logged-in users with no history)
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        {renderSuggestions()}
        {(isGuest && isClient) ? ( // Conditionally render guest message only on client
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl">
            Try out our AI models with {GUEST_CONVERSATION_LIMIT - guestConversationCount} free conversations.
          </p>
        ) : session ? ( // Render for logged-in users with no history
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
    // Condition for showing skeleton loader:
    // 1. Session is still loading (initial app load)
    // 2. A specific thread is being loaded (isThreadLoading is true AND activeThreadId is set)
    if (isThreadLoading) {
      return (
        // This div mimics the padding and max-width of the actual chat content area
        <div className="flex-1 h-full overflow-y-auto px-2 sm:px-4 py-6 pb-32">
          <div className="max-w-7xl mx-auto">
            <SkeletonLoaderChatUI />
            {/* You can repeat SkeletonLoader for more vertical fill if desired */}
            {/* <div className="mt-6"><SkeletonLoader /></div> */}
          </div>
        </div>
      );
    }

    // Error display specific to thread loading
    if (error && activeThreadId && !isProcessing) { // Check if error is related to current thread
      return (
        <div className="flex-1 flex items-center justify-center h-full text-red-400 p-4 text-center">
          <p>Could not load chat history.<br/>{error}</p>
        </div>
      );
    }

    // Welcome screen or empty state for "New Chat"
    if (history.length === 0 && !isProcessing && !isThreadLoading) {
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

    // Default: Render conversation history
    return (
      // The parent <main> tag already has bg-zinc-800
      <div className="h-full overflow-y-auto relative scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-[#1E1E1E]">
        <div className="px-2 sm:px-4 py-2 pb-32">
          <div className="max-w-7xl mx-auto">
            {renderConversationHistory()}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem('selectedModels');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedModels(parsed);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('selectedModels', JSON.stringify(selectedModels));
    }
  }, [selectedModels, isClient]);

  // --- Add useEffect to auto-trigger summary when summarize button would appear ---
  useEffect(() => {
    if (!autoSummarizeEnabled) return;
    // Find the latest conversation that is not historical, has all models done, has no summary, and is not loading summary
    const latest = history.slice().reverse().find(entry =>
      !entry.isHistorical &&
      !entry.summary &&
      !entry.summaryFetching &&
      Object.values(entry.responses).every(r => r.done || r.error)
    );
    if (latest) {
      generateSummary(latest.id);
    }
  }, [history, autoSummarizeEnabled]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0D0D0D]">
      {/* Persistent Sidebar */}
      {session && sidebarVisible && (
        <div className="w-[260px] h-full bg-black flex flex-col flex-shrink-0 border-r border-gray-700">
          {/* Sidebar Header: Logo + New Task Button */}
          <div className="p-4 h-[60px] flex-shrink-0 flex items-center justify-between">
            {/* Sidebar Toggle Button (in sidebar header when visible) */}
            <button
              onClick={() => setSidebarVisible(!sidebarVisible)}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors mr-3"
              title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path> {/* Hamburger icon */}
              </svg>
            </button>
            {/* Logo */}
            <div className="flex items-center">
              <img src="/logo.jpeg" alt="Quicke Logo" className="h-8 w-auto mr-2" />
              {/* Optional: Add a text label next to the logo */}
              {/* <span className="text-xl font-semibold text-white">Quicke</span> */}
            </div>
          </div>
          {/* New Task Button */}
          <div className="p-3 flex-shrink-0">
            <button
              onClick={handleNewThread}
              className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white rounded-md bg-gray-700 hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New task
              <span className="ml-auto text-xs text-gray-400 border border-gray-500 px-1.5 py-0.5 rounded-sm">Ctrl K</span>
            </button>
          </div>
          {/* Thread List */}
          <div className="flex-grow overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-[#202124]" >
            {Object.keys(threads).map(groupKey => {
              const groupedList = threads[groupKey];
              if (groupedList.length === 0) return null;

              const groupTitle = groupKey === 'today' ? 'Today' : groupKey === 'yesterday' ? 'Yesterday' : groupKey === 'past30Days' ? 'Past 30 Days' : 'Older';

              return (
                <div key={groupKey} className="space-y-1">
                  <h4 className="text-sm font-bold text-gray-300 uppercase mt-4 mb-1 px-2">{groupTitle}</h4>
                  {groupedList.map(thread => (
                    <div
                      key={thread.id}
                      onClick={() => handleThreadSelect(thread.id)}
                      className={`block w-full text-left p-2.5 rounded-md cursor-pointer group ${ activeThreadId === thread.id ? 'bg-gray-700 shadow-inner' : 'hover:bg-gray-700/60'}`}
                    >
                      <h3 className={`text-sm font-medium truncate ${activeThreadId === thread.id ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>{thread.title}</h3>
                      <p className={`text-xs truncate mt-0.5 ${activeThreadId === thread.id ? 'text-gray-400' : 'text-gray-500 group-hover:text-gray-400'}`}>{thread.preview || "No preview available"}<span className="float-right">{new Date(thread.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span></p>
                    </div>
                  ))}
                </div>
              );
            })}
            {/* Load More Threads Button */}
            {/* {hasMore && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={fetchThreads}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md border border-gray-600 transition-colors"
                >
                  Load More Threads
                </button>
              </div>
            )} */}
          </div>
          {/* Auto Summarize Toggle */}
          <div className="px-3 pb-2">
            <div className="flex items-center justify-between bg-gray-800 rounded-md px-3 py-2 mb-2">
              <span className="text-sm text-gray-200 font-medium">Auto Summarize</span>
              <button
                onClick={() => setAutoSummarizeEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoSummarizeEnabled ? 'bg-primary-600' : 'bg-gray-600'}`}
                title="Toggle auto summarize"
                type="button"
              >
                <span className="sr-only">Toggle auto summarize</span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoSummarizeEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>
          {/* User Menu at the bottom */}
          <div className="p-3">
            {session?.user ? (
              <div className="relative group">
                <button className="flex items-center w-full space-x-3 rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-xs shadow-md">
                    {session.user.email.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-left truncate">{session.user.name || session.user.email}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </button>
                {/* Dropdown for API Keys & Sign Out */}
                <div className="absolute bottom-full left-0 mb-2 w-56 py-1 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150">
                  <button
                    onClick={() => setShowApiKeyManager(true)}
                    className="w-full text-left block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                  >
                    API Keys
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="w-full text-left block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header for main content area */}
        <header className={`h-[60px] flex-shrink-0 bg-zinc-900 flex items-center justify-between px-6`}>
          {/* Left section: Quicke text and (conditionally) Sidebar Toggle */}
          <div className="flex items-center">
            {/* Sidebar Toggle Button, visible only when sidebar is hidden and session exists */}
            {session && !sidebarVisible && (
              <button
                onClick={() => setSidebarVisible(!sidebarVisible)}
                className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors mr-3"
                title="Show sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path> {/* Hamburger icon */}
                </svg>
              </button>
            )}
            <h1 className="text-xl font-semibold text-white">Quicke</h1>
          </div>

          {/* Right section: Thread Title/Model Selector (Logged In) or Auth Buttons (Guest) */}
          <div className="flex items-center space-x-4">
            {session ? (
              // Logged-in user header content
              <>
                <h1 className="text-lg font-medium text-gray-300">{activeThreadTitle}</h1>
                <button
                  ref={modelButtonRef}
                  onClick={handleModelButtonClick}
                  className="group px-3 py-1.5 rounded-md bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white text-xs font-medium transition-colors border border-gray-600/50 shadow-sm"
                >
                  Models ({selectedModels.length}) <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>

                {/* ---- START NEW LAYOUT TOGGLE BUTTONS ---- */}
                <div className="flex items-center ml-2 p-0.5 bg-gray-700/60 rounded-lg border border-gray-600/70">
                  <button
                    onClick={() => setResponseLayout('grid')}
                    title="Grid View"
                    className={`p-1.5 rounded-md transition-colors ${
                      responseLayout === 'grid' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-600/50'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setResponseLayout('stack')}
                    title="Stack View"
                    className={`p-1.5 rounded-md transition-colors ${
                      responseLayout === 'stack' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-600/50'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                    </svg>
                  </button>
                </div>
                {/* ---- END NEW LAYOUT TOGGLE BUTTONS ---- */}
              </>
            ) : (
              // Guest user header content
              <div className="flex items-center space-x-4">
                <button
                  ref={modelButtonRef}
                  onClick={handleModelButtonClick}
                  className="group px-3 py-1.5 rounded-md bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white text-xs font-medium transition-colors border border-gray-600/50 shadow-sm"
                >
                  Models ({selectedModels.length}) <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {/* ---- START NEW LAYOUT TOGGLE BUTTONS (Guest) ---- */}
                <div className="flex items-center ml-2 p-0.5 bg-gray-700/60 rounded-lg border border-gray-600/70">
                  <button
                    onClick={() => setResponseLayout('grid')}
                    title="Grid View"
                    className={`p-1.5 rounded-md transition-colors ${
                      responseLayout === 'grid' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-600/50'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setResponseLayout('stack')}
                    title="Stack View"
                    className={`p-1.5 rounded-md transition-colors ${
                      responseLayout === 'stack' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-600/50'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                    </svg>
                  </button>
                </div>
                {/* ---- END NEW LAYOUT TOGGLE BUTTONS (Guest) ---- */}
                <Link href="/auth/signin" className="px-4 py-2 text-sm font-medium transition-colors bg-white text-gray-900 rounded-full hover:bg-gray-200">
                  Log in
                </Link>
                <Link href="/auth/signup" className="px-4 py-2 text-sm font-medium transition-colors text-white border border-white rounded-full hover:bg-white hover:text-gray-900">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </header>
        {/* Chat History / Welcome Screen */}
        <main className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-[#1E1E1E] bg-zinc-900">
          {isSidePanelOpen && sidePanelContent ? (
            <SplitPanelLayout
              leftContent={renderMainContentArea()}
              rightContent={
                <div className="h-full overflow-y-auto p-4">
                  <ResponseColumn
                    key={`${sidePanelContent.conversationId}-${sidePanelContent.model}-side`}
                    {...sidePanelContent}
                    onRetry={handleModelRetry}
                  />
                </div>
              }
            />
          ) : (
            renderMainContentArea()
          )}
        </main>
        {/* Footer with Prompt Input */}
        {(session || isGuest) && (
          <footer className="p-4 flex-shrink-0 bg-zinc-900">
            <div className="max-w-3xl mx-auto">
              <PromptInput
                prompt={prompt}
                setPrompt={setPrompt}
                onSubmit={handleSubmit}
                disabled={
                  (isGuest && guestConversationCount >= GUEST_CONVERSATION_LIMIT) ||
                  isProcessing ||
                  loading ||
                  (!isGuest && selectedModels.length === 0)
                }
                isProcessing={isProcessing}
                onStopStreaming={handleStopStreaming}
                selectedModels={selectedModels}
                isGuest={isGuest}
                onTriggerLoginPrompt={triggerLoginPrompt}
                threadId={activeThreadId}
              />
            </div>
          </footer>
        )}
      </div>
      {/* Modals (ModelSelector, ApiKeyManager) remain outside the flex layout */}
      <ModelSelector isOpen={showModelSelector} setIsOpen={setShowModelSelector} selectedModels={selectedModels} setSelectedModels={setSelectedModels} isGuest={isGuest} />
      <ApiKeyManager isOpen={showApiKeyManager} onClose={() => setShowApiKeyManager(false)} />
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
    </div>
  );
}