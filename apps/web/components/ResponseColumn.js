import { useEffect, useRef, useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import React from 'react';
import { useSplitPanel } from './SplitPanelContext';
import { TableWrapper, TableRow, TableCell, MarkdownComponents } from './MarkdownComponents';
import SkeletonLoader from './SkeletonLoader';

// Model display names mapping
const modelDisplayNames = {
  // OpenAI
  'gpt-4.5-preview': 'GPT-4.5 Preview',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4o-mini-or': 'GPT-4o Mini',
  'o1': 'O1',
  'o3-mini': 'O3 Mini',
  'o1-mini': 'O1 Mini',
  // Google
  'gemini-flash': 'Gemini 2.0 Flash',
  'gemini-flash-2.5':'Gemini 2.5 Flash',
  'gemini-lite': 'Gemini Lite',
  'gemini-thinking': 'Gemini 2.0 Flash Thinking',
  'gemini-2.5-pro': 'Gemini 2.5 Pro', 
  // DeepSeek official models
  'deepseek-chat': 'DeepSeek V3',
  'deepseek-coder': 'DeepSeek Coder',
  'deepseek-reasoner': 'DeepSeek R1',
  // OpenRouter models
  'deepseek-distill': 'DeepSeek R1 70B',
  'deepseek-v3-openrouter': 'DeepSeek V3 (Free)',
  'mistral-7b': 'Mistral Medium',
  'llama2-70b': 'Llama-2 70B',
  'phi3': 'Phi-3',
  'qwen-32b': 'Qwen Coder 32B',
  'openchat': 'OpenChat 3.5',
  'nemotron-70b': 'Nemotron 70B',
  'mistral-small-3': 'Mistral Small 3',
  'mistral-small-31': 'Mistral Small 3.1 24B', 
  'mistral-nemo': 'Mistral Nemo',
  'deepseek-v3-0324': 'DeepSeek V3 Latest', 
  'deepseek/deepseek-prover-v2:free': 'DeepSeek Prover V2',
  'qwen/qwen3-30b-a3b:free': 'Qwen3 30B A3B',
  'qwen/qwen3-235b-a22b:free': 'Qwen3 235B A22B',
  'microsoft/mai-ds-r1:free': 'Microsoft MAI DS R1',
  'tngtech/deepseek-r1t-chimera:free': 'TNG DeepSeek R1T Chimera',
  'qwen/qwen3-0.6b-04-28:free': 'Qwen3 0.6B',
  'microsoft/phi-4-reasoning:free': 'Phi 4 Reasoning',
  'microsoft/phi-4-reasoning-plus:free': 'Phi 4 Reasoning Plus',
  // Anthropic
  'claude-3-7': 'Claude 3.7 Sonnet',
  'claude-3-5': 'Claude 3.5 Sonnet',
  'summary': 'Summarizer',  
  // NVIDIA Models
  'nvidia/llama-3.1-nemotron-nano-8b-v1:free': 'Nemotron Nano 8B',
  'nvidia/llama-3.3-nemotron-super-49b-v1:free': 'Nemotron Super 49B',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1:free': 'Nemotron Ultra 253B',
  // DeepSeek Models
  'deepseek/deepseek-r1:free': 'DeepSeek R1',
  'deepseek/deepseek-r1-zero:free': 'DeepSeek R1 Zero',
  // Meta Models
  'meta-llama/llama-3.2-11b-vision-instruct:free': 'Llama 3.2 Vision',
  'meta-llama/llama-3.1-8b-instruct:free': 'Llama 3.1 8B',
};

// provider map
const providerMap = {
  'gpt-4.5-preview': 'OpenAI',
  'gpt-4o': 'OpenAI',
  'gpt-4o-mini': 'OpenAI',
  'gpt-4o-mini-or': 'OpenRouter', 
  'o1': 'OpenAI',
  'o3-mini': 'OpenAI',
  'o1-mini': 'OpenAI',
  'gemini-flash': 'Google',
  'gemini-lite': 'Google', 
  'gemini-flash-2.5': 'google',
  'gemini-thinking': 'Google',
  'gemini-2.5-pro': 'Google', 
  'deepseek-chat': 'DeepSeek',
  'deepseek-coder': 'DeepSeek',
  'deepseek-reasoner': 'DeepSeek',
  'deepseek-distill': 'OpenRouter',
  'deepseek-v3-openrouter': 'OpenRouter',
  'deepseek-v3-0324': 'OpenRouter',
  'mistral-7b': 'OpenRouter',
  'llama2-70b': 'OpenRouter',
  'phi3': 'OpenRouter',
  'qwen-32b': 'OpenRouter',
  'openchat': 'OpenRouter',
  'nemotron-70b': 'OpenRouter',
  'mistral-small-3': 'OpenRouter',
  'mistral-small-31': 'OpenRouter',
  'mistral-nemo': 'OpenRouter',
  'claude-3-7': 'Anthropic',
  'claude-3-5': 'Anthropic',
  'summary': 'System',  
  'deepseek/deepseek-prover-v2:free': 'OpenRouter',
  'qwen/qwen3-30b-a3b:free': 'OpenRouter',
  'qwen/qwen3-235b-a22b:free': 'OpenRouter',
  'microsoft/mai-ds-r1:free': 'OpenRouter',
  'tngtech/deepseek-r1t-chimera:free': 'OpenRouter',
  'qwen/qwen3-0.6b-04-28:free': 'OpenRouter',
  'microsoft/phi-4-reasoning:free': 'OpenRouter',
  'microsoft/phi-4-reasoning-plus:free': 'OpenRouter',
  // NVIDIA Models
  'nvidia/llama-3.1-nemotron-nano-8b-v1:free': 'OpenRouter',
  'nvidia/llama-3.3-nemotron-super-49b-v1:free': 'OpenRouter',
  'nvidia/llama-3.1-nemotron-ultra-253b-v1:free': 'OpenRouter',
  // DeepSeek Models
  'deepseek/deepseek-r1:free': 'OpenRouter',
  'deepseek/deepseek-r1-zero:free': 'OpenRouter', 
  // Meta Models
  'meta-llama/llama-3.2-11b-vision-instruct:free': 'OpenRouter',
  'meta-llama/llama-3.1-8b-instruct:free': 'OpenRouter',
};

// Update display provider function
const getDisplayProvider = (provider) => {
  if (provider === 'OpenRouter') return 'OR';
  return provider;
};

// Math component with enhanced KaTeX options
const Math = ({ value, inline }) => {
  if (!value) return null;
  
  try {
    const cleanValue = value
      .replace(/^(\$|\$\$)/, '')
      .replace(/(\$|\$\$)$/, '')
      .trim();

    const options = {
      throwOnError: false,
      errorColor: '#f06',
      strict: false,
      trust: true,
      displayMode: !inline
    };

    return inline ? (
      <InlineMath math={cleanValue} settings={options} />
    ) : (
      <BlockMath math={cleanValue} settings={options} />
    );
  } catch (error) {
    console.error('KaTeX rendering error:', error);
    return (
      <span className="text-red-300 bg-red-900/20 px-2 py-1 rounded font-mono text-sm">
        {value}
      </span>
    );
  }
};

const markdownConfig = {
  remarkPlugins: [
    [remarkGfm, {
      singleTilde: false,
      tableCellPadding: true,
      tablePipeAlign: true,
      stringLength: str => str.length
    }],
    [remarkMath, {
      singleDollarTextMath: true,
      inlineMathLimiter: '$',
      blockMathLimiter: '$$'
    }]
  ],
  rehypePlugins: [
    [rehypeKatex, {
      strict: false,
      throwOnError: false,
      trust: true,
      maxSize: 800,
      maxExpand: 1000,
      macros: {
        "\\R": "\\mathbb{R}",
        "\\N": "\\mathbb{N}",
        "\\Z": "\\mathbb{Z}",
        "\\Q": "\\mathbb{Q}",
        "\\C": "\\mathbb{C}",
        "\\d": "\\mathrm{d}",
        "\\diff": "\\mathrm{d}",
        "\\e": "\\mathrm{e}",
        "\\i": "\\mathrm{i}",
        "\\vec": "\\boldsymbol",
        "\\matrix": "\\begin{matrix}#1\\end{matrix}",
        "\\bmatrix": "\\begin{bmatrix}#1\\end{bmatrix}",
        "\\pmatrix": "\\begin{pmatrix}#1\\end{pmatrix}",
        "\\cases": "\\begin{cases}#1\\end{cases}"
      }
    }]
  ],
  components: {
    ...MarkdownComponents,
    code: ({ node, inline, className, children, ...props }) => {
      if (inline) {
        return (
          <code className="px-1.5 py-0.5 rounded font-mono text-base bg-gray-800/40">
            {children}
          </code>
        );
      }
    
      const [isCopied, setIsCopied] = useState(false);
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeContent = String(children).replace(/\n$/, '');
    
      const handleCopy = () => {
        navigator.clipboard.writeText(codeContent);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      };
    
      return (
        <div className="code-block-container">
          <div className="code-block-header">
            <span className="code-block-language">
              {language || 'text'}
            </span>
            <button
              onClick={handleCopy}
              className="code-block-copy-btn"
            >
              {isCopied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                    <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="code-block-content">
            <SyntaxHighlighter
              language={language || 'text'}
              style={oneDark}
              customStyle={{
                margin: 0,
                padding: 0,
                background: 'transparent',
              }}
              codeTagProps={{
                style: {
                  fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                }
              }}
            >
              {codeContent}
            </SyntaxHighlighter>
          </div>
        </div>
      );
    },
    math: ({ value }) => <Math value={value} inline={false} />,
    inlineMath: ({ value }) => <Math value={value} inline={true} />,
    table: ({ children }) => (
      <TableWrapper>{children}</TableWrapper>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-800/70">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-gray-700/50 bg-gray-900/20">{children}</tbody>
    ),
    tr: TableRow,
    th: ({ children }) => (
      <TableCell isHeader={true}>{children}</TableCell>
    ),
    td: ({ children }) => (
      <TableCell isHeader={false}>{children}</TableCell>
    ),
  }
};

function ResponseColumn({
  model,
  response,
  streaming,
  className = '',
  onRetry,
  conversationId,
  isSummary = false,
  onOpenInSidePanel
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const contentRef = useRef(null);
  const [displayedText, setDisplayedText] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  
  // Get split panel context
  const { isSidePanelOpen, sidePanelContent, openSidePanel, closeSidePanel } = useSplitPanel();

  // Check if this column is in side panel
  const isInSidePanel = isSidePanelOpen && 
    sidePanelContent?.model === model && 
    sidePanelContent?.conversationId === conversationId;

  const lastResponseRef = useRef('');
  const processingTimeoutRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const previousResponseRef = useRef('');
  const currentConversationRef = useRef(conversationId);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Timer state and refs
  const responseKey = `${model}-${conversationId}`;
  const [elapsedTime, setElapsedTime] = useState('0.0');
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  
  // Global static registry to persist timer info across component instances
  // This allows us to maintain timer state even when switching between main view and side panel
  if (!window.timerRegistry) {
    window.timerRegistry = new Map();
  }

  // --- Auto-scroll state ---
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const scrollDebounceTimeoutRef = useRef(null);
  // --- End auto-scroll state ---

  // Reset state when conversation changes
  useEffect(() => {
    if (currentConversationRef.current !== conversationId) {
      setDisplayedText('');
      lastResponseRef.current = '';
      previousResponseRef.current = '';
      setIsActive(false);
      currentConversationRef.current = conversationId;
    }
  }, [conversationId]);

  // Reset state when response changes completely
  useEffect(() => {
    if (!response) {
      setDisplayedText('');
      lastResponseRef.current = '';
      previousResponseRef.current = '';
      setIsActive(false);
      return;
    }

    // Only update if this is a new response for the current conversation
    if (currentConversationRef.current === conversationId) {
      if (previousResponseRef.current !== response.text) {
        setDisplayedText(response.text || '');
        lastResponseRef.current = response.text || '';
        previousResponseRef.current = response.text || '';
        setIsActive(response.loading || streaming);
      }
    }
  }, [response?.text, conversationId]);

  // Handle streaming updates only for active responses in current conversation
  useEffect(() => {
    if (!response || !streaming || currentConversationRef.current !== conversationId) {
      return;
    }

    if (response.text && response.text !== lastResponseRef.current) {
      // Only update if this is new content
      const newText = response.text.slice(lastResponseRef.current.length);
      if (newText) {
        setDisplayedText(prev => prev + newText);
        lastResponseRef.current = response.text;
        setIsActive(true);
      }
    }

    // Clear active state when streaming ends
    if (!response.loading && !streaming) {
      setIsActive(false);
    }
  }, [response?.text, streaming, response?.loading, conversationId]);

  // Reset userHasScrolled when conversationId changes or when a new stream starts for THIS column
  useEffect(() => {
    if (currentConversationRef.current !== conversationId) {
      // New conversation for this column instance
      setUserHasScrolled(false);
      setDisplayedText(''); // Clear previous content
      lastResponseRef.current = '';
      previousResponseRef.current = '';
      if (contentRef.current) contentRef.current.scrollTop = 0; // Scroll to top for new convo
      currentConversationRef.current = conversationId;
    } else if (response?.loading && !streaming) {
      // Existing conversation, but a new stream is about to begin (e.g., retry)
      setUserHasScrolled(false);
      if (contentRef.current && response?.loading) contentRef.current.scrollTop = 0; // Scroll to top for new stream
    }
  }, [conversationId, response?.loading, streaming]);

  // --- Attach scroll event to content area ---
  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const handleScroll = () => {
      if (scrollDebounceTimeoutRef.current) {
        clearTimeout(scrollDebounceTimeoutRef.current);
      }
      scrollDebounceTimeoutRef.current = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = element;
        // Check if scrolled to the bottom (with a small tolerance)
        if (scrollHeight - scrollTop - clientHeight <= 50) {
          setUserHasScrolled(false); // Re-enable auto-scroll if user scrolls to bottom
        } else {
          setUserHasScrolled(true); // User has scrolled away from bottom
        }
      }, 100); // Debounce for 100ms
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (scrollDebounceTimeoutRef.current) {
        clearTimeout(scrollDebounceTimeoutRef.current);
      }
    };
  }, [contentRef.current]);

  // --- Auto-scroll to bottom if streaming and user hasn't manually scrolled up ---
  useEffect(() => {
    const element = contentRef.current;
    if (element && streaming && !userHasScrolled) {
      element.scrollTop = element.scrollHeight;
    }
    // Also consider scrolling if streaming has just ended and user hadn't scrolled.
    // This is implicitly handled if the last chunk of `displayedText` triggers this effect.
  }, [displayedText, streaming, userHasScrolled]);

  // Initialize timer data from registry or create new entry
  useEffect(() => {
    const registryKey = `timer-${model}-${conversationId}`;
    const existingData = window.timerRegistry.get(registryKey);
    
    if (existingData) {
      // Restore from registry
      if (existingData.finalDuration) {
        // Timer already completed, just show the final time
        setElapsedTime(existingData.finalDuration);
      } else if (existingData.startTime) {
        // Timer is running, continue from stored start time
        startTimeRef.current = existingData.startTime;
        
        // Start the timer interval
        if (!timerRef.current && (response?.loading || streaming)) {
          timerRef.current = setInterval(() => {
            const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
            setElapsedTime(elapsed);
          }, 100);
        }
      }
    } else if (response?.loading || streaming) {
      // No existing timer data but we need to start a timer
      startTimeRef.current = Date.now();
      
      // Register this timer
      window.timerRegistry.set(registryKey, {
        startTime: startTimeRef.current,
        finalDuration: null,
        modelId: model,
        conversationId
      });
      
      // Start the timer interval
      timerRef.current = setInterval(() => {
        const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
        setElapsedTime(elapsed);
      }, 100);
    }
    
    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [model, conversationId, response?.loading, streaming]);
  
  // Handle timer completion when response is done
  useEffect(() => {
    const registryKey = `timer-${model}-${conversationId}`;
    
    // If response is no longer loading or streaming, and we have an active timer
    if ((!response?.loading && !streaming) && startTimeRef.current) {
      // Calculate final duration
      const finalDuration = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
      
      // Update registry with final duration
      const existingData = window.timerRegistry.get(registryKey) || {};
      window.timerRegistry.set(registryKey, {
        ...existingData,
        finalDuration
      });
      
      // Update UI
      setElapsedTime(finalDuration);
      
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [response?.loading, streaming, model, conversationId]);
  
  // Handle side panel opening - ensure timer state is preserved
  const handleColumnDoubleClick = (e) => {
    if (e.target.closest('button')) return;
    if (!isInSidePanel) {
      const responseClone = response ? { ...response } : null;
      if (typeof onOpenInSidePanel === 'function') {
        onOpenInSidePanel({
          model,
          conversationId,
          response: responseClone,
          streaming
        });
      } else {
        openSidePanel({
          model,
          conversationId,
          response: responseClone,
          streaming
        });
      }
    }
  };

  // escape key handler for closing side panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isInSidePanel) {
        closeSidePanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInSidePanel, closeSidePanel]);

  // Get the display name for the model
  const modelDisplayName = modelDisplayNames[model] || model;

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  // Timer display component
  const renderTimer = (time) => (
    <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-700/50 ml-2 border border-gray-600">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" 
        className="w-3.5 h-3.5 text-gray-400 mr-1">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .27.144.518.378.651l3.5 2a.75.75 0 00.744-1.302L11 9.677V5z" clipRule="evenodd" />
      </svg>
      <span className="text-xs font-medium text-gray-300 tabular-nums">
        {time}s
      </span>
    </div>
  );

  // Copy response to clipboard
  const copyToClipboard = () => {
    const textToCopy = response?.text || displayedText;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  // Handle side panel toggle
  const handleSidePanelToggle = () => {
    if (isInSidePanel) {
      closeSidePanel();
    } else {
      if (typeof onOpenInSidePanel === 'function') {
        onOpenInSidePanel({
          model,
          conversationId,
          response,
          streaming
        });
      } else {
        openSidePanel({
          model,
          conversationId,
          response,
          streaming
        });
      }
    }
  };

  // Handle header double click
  const handleHeaderDoubleClick = () => {
    if (!isSummary && !isInSidePanel) {
      openSidePanel({
        model,
        conversationId,
        response,
        streaming
      });
    }
  };

  // Toggle response collapse
  const toggleCollapse = (e) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
    if (isExpanded) setIsExpanded(false);
  };

  // Handle retry click
  const handleRetry = () => {
    if (typeof onRetry === 'function') {
      onRetry(model, conversationId);
    }
  };

  // Simplified math processing - let the libraries do the work
  const processMathInText = (text) => {
    try {
      if (!text) return text;
      
      // First, protect code blocks from being processed
      const codeBlocks = [];
      let codeBlocksIndex = 0;
      text = text.replace(/```(?:[a-z]+)?\n([\s\S]*?)\n```/g, (match) => {
        codeBlocks.push(match);
        return `____CODE_BLOCK_${codeBlocksIndex++}____`;
      });
      
      // Also protect inline code from being processed
      const inlineCodes = [];
      let inlineCodesIndex = 0;
      text = text.replace(/`([^`]+)`/g, (match) => {
        inlineCodes.push(match);
        return `____INLINE_CODE_${inlineCodesIndex++}____`;
      });
      
      // Fix some specific edge cases for math expressions
      // Ensure proper formatting of dollar signs to help the parser
      
      // Convert \[ \] to $$ $$ for block math
      text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, content) => `$$${content}$$`);
      
      // Convert \( \) to $ $ for inline math
      text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, content) => `$${content}$`);
      
      // Restore code blocks
      for (let i = 0; i < codeBlocks.length; i++) {
        text = text.replace(`____CODE_BLOCK_${i}____`, codeBlocks[i]);
      }
      
      // Restore inline code
      for (let i = 0; i < inlineCodes.length; i++) {
        text = text.replace(`____INLINE_CODE_${i}____`, inlineCodes[i]);
      }
      
      return text;
    } catch (error) {
      console.error('Error processing math in text:', error);
      return text; // Return original text if processing fails
    }
  };

  // Show thinking state during loading
  const renderThinkingState = () => (
    <span className="ml-2 text-xs text-gray-400 thinking-pulse">
      Thinking
      <span className="thinking-dots">
        <span className="thinking-dot"></span>
        <span className="thinking-dot"></span>
        <span className="thinking-dot"></span>
      </span>
    </span>
  );

  const isValidResponse = (response) => {
    if (!response || !response.text) return false;
    const text = response.text.trim();
    return text !== '' && !text.includes('Waiting for prompt');
  };

  // Determine the current state
  const isLoading = response?.loading === true;
  const hasText = (displayedText && displayedText.length > 0) || 
                 (response?.text && response.text.length > 0);
  const hasError = response?.error ? true : false;

  // special styling for summary
  const columnClassName = `${className} ${isSummary ? 
    'col-span-full bg-gradient-to-b from-gray-900/60 to-gray-800/40 border-t border-purple-500/20 mt-6 backdrop-blur-sm shadow-2xl rounded-2xl overflow-hidden' 
    : ''}`;

  // Custom error container component
  const ErrorContainer = ({ errorMessage, modelId, isGuest }) => {
    const handleOpenApiKeyManager = () => {
      window.dispatchEvent(new CustomEvent('openApiKeyManager'));
    };
    // Heuristic for API key error
    const isApiKeyError = typeof errorMessage === 'string' && (
      errorMessage.slice(-15) === 'API_KEY_MISSING' );
    return (
      <div className="rounded-lg overflow-hidden backdrop-blur-sm mt-2 mb-4">
        <div className="p-4 rounded-lg border bg-yellow-800/20 border-yellow-700/30" >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                  className="w-5 h-5 mt-0.5 text-yellow-500">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className={`text-sm font-medium text-yellow-300`}>
                {isApiKeyError ? `API Key Missing for Provider ${providerMap[modelId] || modelId}` : 'Error'}.
              </h3>
              <div className="mt-1 text-sm text-yellow-200">
                {isApiKeyError ? 'Add key to use' : errorMessage}
              </div>
              {isApiKeyError && !isGuest && (
                <button
                  onClick={handleOpenApiKeyManager}
                  className="mt-3 text-xs font-medium px-3 py-1.5 rounded-md bg-yellow-600 hover:bg-yellow-500 text-white"
                >
                  Open API Key Manager
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`rounded-xl overflow-hidden flex flex-col transition-all duration-300 ${
        isExpanded 
          ? 'fixed inset-6 z-50 bg-gray-900/90 backdrop-blur-md shadow-2xl' 
          : isCollapsed
            ? 'h-[56px]' 
            : 'h-full'
      } ${columnClassName}`}
      onDoubleClick={handleColumnDoubleClick}
    >
      {/* Header with model info and controls */}
      <div 
        className={`px-4 py-3 flex justify-between items-center border-b ${
          isSummary 
            ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-gray-800/40 to-purple-900/20' 
            : 'border-gray-800'
        }`}
        onDoubleClick={handleHeaderDoubleClick}
      >
        <div className="flex items-center space-x-2">
          {isSummary ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-purple-400 animate-ping opacity-75"></div>
              </div>
              <h3 className="text-xl font-medium text-gray-200 flex items-center gap-2">
                Summary
                <span className="text-sm px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium border border-purple-500/20">
                  Synthesizer
                </span>
              </h3>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${hasError ? 'bg-yellow-500' : 'bg-primary-500'}`}></div>
              <div className="flex items-center">
                <h3 className="text-xl font-medium text-gray-200 flex items-center gap-1.5">
                  {modelDisplayName}
                  <span 
                    className="text-xs px-1.5 py-0.5 rounded-md bg-gray-800/50 text-gray-400 font-medium leading-none tracking-wide uppercase"
                    title={`Provider: ${providerMap[model]}`}
                  >
                    {getDisplayProvider(providerMap[model])}
                  </span>
                </h3>
                {/* Always show timer when we have a value */}
                {(elapsedTime && elapsedTime !== '0.0') && renderTimer(elapsedTime)}
                {isLoading && renderThinkingState()}
              </div>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {/* Retry button */}
          {!isSummary && !isLoading && (displayedText || response?.text) && (
            <button
              onClick={handleRetry}
              className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-800 rounded-lg transition-all duration-200"
              title="Retry with this model"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          )}
          
          {/* Show/hide button */}
          {hasText && (
            <>
              <button
                onClick={toggleCollapse}
                className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-800 rounded-lg transition-all duration-200"
                title={isCollapsed ? "Show response" : "Hide response"}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 20 20" 
                  fill="currentColor" 
                  className={`w-5 h-5 transform transition-transform duration-300 ${
                    isCollapsed ? 'rotate-180' : ''
                  }`}
                >
                  <path 
                    fillRule="evenodd" 
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" 
                    clipRule="evenodd" 
                  />
                </svg>
              </button>
              
              {/* Side Panel Toggle Button - now available for both regular and summary responses */}
              {(displayedText || response?.text) && (
                <button
                  onClick={handleSidePanelToggle}
                  className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-800 rounded-lg transition-all duration-200"
                  title={isInSidePanel ? "Close side panel" : "Open in side panel"}
                >
                  {isInSidePanel ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 3.5A1.5 1.5 0 013.5 2h13A1.5 1.5 0 0118 3.5v13a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 16.5v-13zM11.5 4v12H16a.5.5 0 00.5-.5v-11A.5.5 0 0016 4h-4.5z" />
                    </svg>
                  )}
                </button>
              )}

              {/* Copy response button */}
              <button
                onClick={copyToClipboard}
                className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-800 rounded-lg transition-colors"
                title="Copy response"
              >
                {copiedText ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-500">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 101.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Main content area */}
      <div 
        ref={contentRef}
        className={`overflow-auto flex-grow scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent transition-all duration-300 ease-in-out ${
          isCollapsed ? 'h-0 opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        style={{ 
          padding: isCollapsed ? '0' : '1.5rem',
          // Adjust minHeight based on whether skeleton is shown
          minHeight: isCollapsed ? "0" : (
            (response?.loading === true && !displayedText && !response?.error) ? "140px" : "auto" // Or "200px" if that's preferred when text is present
          ), 
          maxHeight: (isExpanded || isInSidePanel) ? undefined : "300px",
          pointerEvents: isCollapsed ? 'none' : 'auto',
          transform: `scale(${isCollapsed ? '0.95' : '1'})`,
          transformOrigin: 'top'
        }}
      >
        {/* Conditional Skeleton Loader */}
        {(response?.loading === true && !displayedText && !response?.error) ? (
          <SkeletonLoader />
        ) : response?.error ? (
          <ErrorContainer errorMessage={response.error} modelId={model} isGuest={response.isGuest} />
        ) : (displayedText) ? ( // Only render markdown if there's text
          <div className="prose prose-lg prose-invert max-w-none">
            <ReactMarkdown {...markdownConfig}>
              {processMathInText(displayedText)}
            </ReactMarkdown>
            {/* Ensure isActive is defined and used correctly from your original logic */}
            {(response?.loading || (streaming && !response?.done)) && !response?.error && (
              <span className="typing-cursor text-lg">|</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Wrap with React.memo for performance optimization
export default memo(ResponseColumn);