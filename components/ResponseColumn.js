import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// Model display names mapping
const modelDisplayNames = {
  'gpt-4': 'GPT-4',
  'claude': 'Claude 3 Sonnet',
  'gemini': 'Gemini 2.0 Flash',
  'mistral-7b': 'Mistral Medium',
  'llama2-70b': 'Llama-2 70B',
  'phi3': 'Phi-3',
  'qwen-32b': 'Qwen QwQ 32B',
  'openchat': 'OpenChat 3.5' ,
  'deepseek-r1': 'DeepSeek R1'
};

export default function ResponseColumn({ model, response, streaming, className, conversationId }) {  // Add conversationId prop
  const contentRef = useRef(null);
  const [displayedText, setDisplayedText] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);  // Add this state for code copy functionality
  const lastResponseRef = useRef('');
  const processingTimeoutRef = useRef(null);
  const [isActive, setIsActive] = useState(false);  // Add this to track if this column is currently receiving updates
  const previousResponseRef = useRef('');  // Add this to track previous response
  const currentConversationRef = useRef(conversationId);  // Add ref to track conversation

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
      setIsActive(false);
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

  // Remove or modify the auto-scroll during streaming
  useEffect(() => {
    if (contentRef.current && streaming) {
      // Only auto-scroll the response container if user has scrolled to bottom
      const container = contentRef.current;
      const isAtBottom = container.scrollHeight - container.scrollTop === container.clientHeight;
      
      if (isAtBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [displayedText, streaming]);

  const copyToClipboard = () => {
    const textToCopy = response?.text || displayedText;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      const notificationEl = document.createElement('div');
      notificationEl.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg transition-opacity duration-300 z-50';
      notificationEl.textContent = `Copied ${modelDisplayName}'s response`;
      document.body.appendChild(notificationEl);
      
      setTimeout(() => {
        notificationEl.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(notificationEl);
        }, 300);
      }, 2000);
    }
  };

  // Copy code function
  const copyCode = (code, language) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(language);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Determine the current state
  const isLoading = response?.loading === true;
  const hasError = response?.error != null;
  const hasText = (displayedText && displayedText.length > 0) || 
                  (response?.text && response.text.length > 0);
  const waitingForPrompt = !isLoading && !hasError && !hasText;

  // Enhanced math processing function with more comprehensive patterns
  const processMathInText = (text) => {
    if (!text) return text;
    
    // Helper to wrap text in math delimiters
    const wrapInMath = (content, type = 'inline') => 
      `$$math$$${type}${content}$$`;

    const replacements = [
      // Basic math delimiters
      { pattern: /\$\$([^$]+?)\$\$/g, replace: (_, m) => wrapInMath(m, 'block') },
      { pattern: /\$([^$\n]+?)\$/g, replace: (_, m) => wrapInMath(m, 'inline') },
      { pattern: /\\\[(.*?)\\\]/g, replace: (_, m) => wrapInMath(m, 'block') },
      { pattern: /\\\((.*?)\\\)/g, replace: (_, m) => wrapInMath(m, 'inline') },
      
      // Common LaTeX patterns that should be wrapped in math mode
      { pattern: /\\[a-zA-Z]+\{[^}]*\}/g, replace: m => wrapInMath(m) },
      { pattern: /\\[a-zA-Z]+/g, replace: m => wrapInMath(m) },
      { pattern: /\b\\(?:left|right|quad|qquad|text)\b/g, replace: m => wrapInMath(m) },
      
      // Equations and arrays
      { pattern: /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, replace: m => wrapInMath(m, 'block') },
      
      // Special symbols and operators
      { pattern: /[×÷±∑∏∫⋅⊗⊕≤≥≠∈∉⊆⊇∪∩]/g, replace: m => wrapInMath(m) },
      
      // Fractions, square roots, and other common constructs
      { pattern: /\\frac\{[^}]*\}\{[^}]*\}/g, replace: m => wrapInMath(m) },
      { pattern: /\\sqrt(?:\[[^]]*\])?\{[^}]*\}/g, replace: m => wrapInMath(m) },
      { pattern: /\\boxed\{[^}]*\}/g, replace: m => wrapInMath(m) },
      
      // Matrices and arrays
      { pattern: /\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix)\}[\s\S]*?\\end\{(?:matrix|pmatrix|bmatrix|vmatrix)\}/g, 
        replace: m => wrapInMath(m, 'block') },
    ];

    let processedText = text;
    replacements.forEach(({ pattern, replace }) => {
      processedText = processedText.replace(pattern, replace);
    });

    return processedText;
  };

  // Enhanced Math component with better error handling and options
  const Math = ({ value, inline }) => {
    const options = {
      throwOnError: false,
      errorColor: '#ff3860',
      strict: false,
      trust: true,
      macros: {
        "\\R": "\\mathbb{R}",
        "\\N": "\\mathbb{N}",
        "\\Z": "\\mathbb{Z}",
        "\\Q": "\\mathbb{Q}",
        "\\C": "\\mathbb{C}",
        "\\implies": "\\Rightarrow",
        "\\iff": "\\Leftrightarrow",
        "\\norm": "\\|#1\\|"
      },
    };

    try {
      return inline ? (
        <InlineMath math={value} settings={options} />
      ) : (
        <BlockMath math={value} settings={options} />
      );
    } catch (error) {
      console.error('KaTeX error:', error);
      return <code className="text-red-500">{value}</code>;
    }
  };

  // Updated CodeBlock component
  const CodeBlock = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    // Handle math blocks
    if (language === 'math') {
      const content = String(children).replace(/\n$/, '');
      const isInline = content.startsWith('inline');
      const mathContent = isInline ? content.slice(6) : content.slice(5);
      return <Math value={mathContent} inline={isInline} />;
    }

    if (!inline && language) {
      return (
        <div className="relative group">
          <SyntaxHighlighter
            style={atomDark}
            language={language}
            className="rounded-md !bg-gray-800 dark:!bg-gray-900 !mt-4 !mb-4"
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
          <button
            onClick={() => copyCode(String(children), language)}
            className="absolute top-2 right-2 p-1 rounded text-xs text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            aria-label="Copy code"
          >
            {copiedCode === language ? (
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
                Copied!
              </span>
            ) : (
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1">
                  <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                  <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                </svg>
                Copy
              </span>
            )}
          </button>
        </div>
      );
    }

    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  };

  const handleApiKeyWarning = () => {
    const event = new CustomEvent('toggleApiKeyManager', {
      detail: { show: true }
    });
    window.dispatchEvent(event);
  };

  const renderError = () => {
    const isApiKeyError = response.error?.toLowerCase().includes('api key');
    
    return (
      <div 
        onClick={(e) => {
          if (isApiKeyError) {
            e.preventDefault();
            e.stopPropagation();
            handleApiKeyWarning();
          }
        }}
        className={`p-4 rounded-lg border ${
          isApiKeyError 
            ? 'border-yellow-600/30 bg-yellow-900/20 cursor-pointer hover:bg-yellow-900/30' 
            : 'border-red-800/30 bg-red-900/20'
        } transition-colors duration-200`}
      >
        <div className="flex items-start space-x-3">
          {isApiKeyError ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-500 mt-0.5">
              <path fillRule="evenodd" d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0 019 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 01.293-.707L8.196 8.39A5.002 5.002 0 018 7z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-red-500 mt-0.5">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l-1.72-1.72z" clipRule="evenodd" />
            </svg>
          )}
          <div>
            <p className={`font-medium ${isApiKeyError ? 'text-yellow-400' : 'text-red-400'}`}>
              {isApiKeyError ? 'API Key Required' : 'Error encountered'}
            </p>
            <p className="mt-1 text-sm text-gray-300">{response.error}</p>
            {isApiKeyError && (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleApiKeyWarning();
                }}
                className="mt-2 text-xs text-yellow-500 hover:text-yellow-400 font-medium flex items-center"
              >
                Add API key →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`rounded-xl overflow-hidden flex flex-col h-full shadow-lg transition-all duration-200 ${className}`}>
      <div className="px-4 py-3 flex justify-between items-center border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-primary-500"></div>
          <h3 className="text-lg font-medium text-gray-200">{modelDisplayName}</h3>
          {isLoading && (
            <span className="ml-2 text-xs text-gray-400">
              Thinking...
            </span>
          )}
        </div>
        {hasText && (
          <button
            onClick={copyToClipboard}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Copy response"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
          </button>
        )}
      </div>
      <div 
        ref={contentRef}
        className="p-4 overflow-auto flex-grow scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        style={{ minHeight: "200px", maxHeight: "600px" }}
      >
        {isLoading && !hasText ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-full max-w-md h-4 rounded-full loading-gradient"></div>
            <div className="w-3/4 max-w-sm h-4 rounded-full loading-gradient"></div>
            <div className="pulse-dots mt-4">
              <div className="pulse-dot"></div>
              <div className="pulse-dot"></div>
              <div className="pulse-dot"></div>
            </div>
          </div>
        ) : hasError ? (
          renderError()
        ) : hasText ? (
          <div className="prose prose-sm prose-invert max-w-none prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-gray-800">
            <ReactMarkdown
              components={{
                code: CodeBlock,
                // Process text nodes to identify math expressions
                text: ({ children }) => processMathInText(children),
                // Override for links to open in new tab
                a: ({ node, ...props }) => (
                  <a target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline" {...props} />
                ),
              }}
            >
              {displayedText || response.text}
            </ReactMarkdown>
            {/* Only show cursor when this column is actively receiving updates */}
            {isActive && (
              <span className="typing-cursor">|</span>
            )}
          </div>
        ) : waitingForPrompt ? (
          <div className="text-gray-500 italic flex items-center justify-center h-full">
            Waiting for prompt...
          </div>
        ) : null}
      </div>
    </div>
  );
}