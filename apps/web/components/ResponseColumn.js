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
import { providerMap, modelDisplayNames } from '../../api-worker/config/models';

const getDisplayProvider = (provider) => {
  if (provider === 'OpenRouter') return 'OR';
  return provider;
};

// Math component with enhanced KaTeX options
const Math = ({ value, inline }) => {
  if (!value) return null;
  try {
    const cleanValue = value.replace(/^(\$|\$\$)/, '').replace(/(\$|\$\$)$/, '').trim();
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
  
  const responseKey = `${model}-${conversationId}`;
  const [elapsedTime, setElapsedTime] = useState('0.0');
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  
  // Global static registry to persist timer info across component instances
  // allows us to maintain timer state even when switching between main view and side panel // - Can BE Improved
  if (!window.timerRegistry) {
    window.timerRegistry = new Map();
  }

  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const scrollDebounceTimeoutRef = useRef(null);

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
      // only for new content
      const newText = response.text.slice(lastResponseRef.current.length);
      if (newText) {
        setDisplayedText(prev => prev + newText);
        lastResponseRef.current = response.text;
        setIsActive(true);
      }
    }

    // Stream ends
    if (!response.loading && !streaming) {
      setIsActive(false);
    }
  }, [response?.text, streaming, response?.loading, conversationId]);

  // Resets scroll and state when conversation changes
  useEffect(() => {
    if (currentConversationRef.current !== conversationId) {
      setUserHasScrolled(false);
      setDisplayedText('');
      lastResponseRef.current = '';
      previousResponseRef.current = '';
      if (contentRef.current) contentRef.current.scrollTop = 0;
      currentConversationRef.current = conversationId;
    } else if (response?.loading && !streaming) {
      setUserHasScrolled(false);
      if (contentRef.current && response?.loading) contentRef.current.scrollTop = 0;
    }
  }, [conversationId, response?.loading, streaming]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const handleScroll = () => {
      if (scrollDebounceTimeoutRef.current) {
        clearTimeout(scrollDebounceTimeoutRef.current);
      }
      scrollDebounceTimeoutRef.current = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = element;
        if (scrollHeight - scrollTop - clientHeight <= 50) {
          setUserHasScrolled(false);
        } else {
          setUserHasScrolled(true);
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

  // Auto scroll
  useEffect(() => {
    const element = contentRef.current;
    if (element && streaming && !userHasScrolled) {
      element.scrollTop = element.scrollHeight;
    }
  }, [displayedText, streaming, userHasScrolled]);

  // Initialization of timer
  useEffect(() => {
    const registryKey = `timer-${model}-${conversationId}`;
    const existingData = window.timerRegistry.get(registryKey);
    
    if (existingData) {
      if (existingData.finalDuration) {
        setElapsedTime(existingData.finalDuration);
      } else if (existingData.startTime) {
        startTimeRef.current = existingData.startTime;
        
        if (!timerRef.current && (response?.loading || streaming)) {
          timerRef.current = setInterval(() => {
            const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
            setElapsedTime(elapsed);
          }, 100);
        }
      }
    } else if (response?.loading || streaming) {
      startTimeRef.current = Date.now();
      
      window.timerRegistry.set(registryKey, {
        startTime: startTimeRef.current,
        finalDuration: null,
        modelId: model,
        conversationId
      });
      
      timerRef.current = setInterval(() => {
        const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
        setElapsedTime(elapsed);
      }, 100);
    }
    
    // Unmount Cleanup
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [model, conversationId, response?.loading, streaming]);
  
  useEffect(() => {
    const registryKey = `timer-${model}-${conversationId}`;
    
    // Calculates final duration after stream ends
    if ((!response?.loading && !streaming) && startTimeRef.current) {
      const finalDuration = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
      
      const existingData = window.timerRegistry.get(registryKey) || {};
      window.timerRegistry.set(registryKey, {
        ...existingData,
        finalDuration
      });
      
      setElapsedTime(finalDuration);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [response?.loading, streaming, model, conversationId]);
  
  // side panel opening
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isInSidePanel) {
        closeSidePanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInSidePanel, closeSidePanel]);

  const modelDisplayName = modelDisplayNames[model] || model;

  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

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

  const copyToClipboard = () => {
    const textToCopy = response?.text || displayedText;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  // Side Panel Toggle Control
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

  const toggleCollapse = (e) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
    if (isExpanded) setIsExpanded(false);
  };

  // Model Manual Retry
  const handleRetry = () => {
    if (typeof onRetry === 'function') {
      onRetry(model, conversationId);
    }
  };

  // Simplified Math Processing
  const processMathInText = (text) => {
    try {
      if (!text) return text;
      
      // Prevents Math Processing in code blocks and inline code
      const codeBlocks = [];
      let codeBlocksIndex = 0;
      text = text.replace(/```(?:[a-z]+)?\n([\s\S]*?)\n```/g, (match) => {
        codeBlocks.push(match);
        return `____CODE_BLOCK_${codeBlocksIndex++}____`;
      });
      
      const inlineCodes = [];
      let inlineCodesIndex = 0;
      text = text.replace(/`([^`]+)`/g, (match) => {
        inlineCodes.push(match);
        return `____INLINE_CODE_${inlineCodesIndex++}____`;
      });
      
      // Edge Cases - Different Models -> Different Formats. Best For now
      // Tried and not Worked - System Prompting, Few Shot Prompting.
      text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, content) => `$$${content}$$`);
      
      text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, content) => `$${content}$`);
      
      for (let i = 0; i < codeBlocks.length; i++) {
        text = text.replace(`____CODE_BLOCK_${i}____`, codeBlocks[i]);
      }
      
      for (let i = 0; i < inlineCodes.length; i++) {
        text = text.replace(`____INLINE_CODE_${i}____`, inlineCodes[i]);
      }
      
      return text;
    } catch (error) {
      console.error('Error processing math in text:', error);
      return text;
    }
  };

  // Thinking State
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

  const columnClassName = `${className} ${isSummary ? 
    'col-span-full bg-gradient-to-b from-gray-900/60 to-gray-800/40 border-t border-purple-500/20 mt-6 backdrop-blur-sm shadow-2xl rounded-2xl overflow-hidden' 
    : ''}`;

  const ErrorContainer = ({ errorMessage, modelId, isGuest }) => {
    const handleOpenApiKeyManager = () => {
      window.dispatchEvent(new CustomEvent('openApiKeyManager'));
    };
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
                {(elapsedTime && elapsedTime !== '0.0') && renderTimer(elapsedTime)}
                {isLoading && renderThinkingState()}
              </div>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center space-x-2">
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
          minHeight: isCollapsed ? "0" : (
            (response?.loading === true && !displayedText && !response?.error) ? "140px" : "auto"
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
        ) : (displayedText) ? (
          <div className="prose prose-lg prose-invert max-w-none">
            <ReactMarkdown {...markdownConfig}>
              {processMathInText(displayedText)}
            </ReactMarkdown>
            {(response?.loading || (streaming && !response?.done)) && !response?.error && (
              <span className="typing-cursor text-lg">|</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default memo(ResponseColumn);