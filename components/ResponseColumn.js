import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import CodeBlock from './CodeBlock'; // Add this import
import remarkGfm from 'remark-gfm';  // Add this import at the top with other imports
import remarkParse from 'remark-parse';

// Model display names mapping
const modelDisplayNames = {
  // OpenAI
  'gpt-4.5-preview': 'GPT-4.5 Preview',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'o1': 'O1',
  'o3-mini': 'O3 Mini',
  'o1-mini': 'O1 Mini',
  // Google
  'gemini-flash': 'Gemini 2.0 Flash',
  'gemini-pro': 'Gemini 2.0 Pro',
  'gemini-thinking': 'Gemini 2.0 Flash Thinking',
  'gemini-2.5-pro': 'Gemini 2.5 Pro', // Add new model
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
  'mistral-small-31': 'Mistral Small 3.1 24B', // Add new model display name
  'mistral-nemo': 'Mistral Nemo',
  'deepseek-v3-0324': 'DeepSeek V3 0324', // Add new model display name
  // 'olympiccoder': 'OlympicCoder 7B',
  // Anthropic
  'claude-3-7': 'Claude 3.7 Sonnet',
  'claude-3-5': 'Claude 3.5 Sonnet',
};

// Add provider map
const providerMap = {
  'gpt-4.5-preview': 'OpenAI',
  'gpt-4o': 'OpenAI',
  'gpt-4o-mini': 'OpenAI',
  'o1': 'OpenAI',
  'o3-mini': 'OpenAI',
  'o1-mini': 'OpenAI',
  'gemini-flash': 'Google',
  'gemini-pro': 'Google', 
  'gemini-thinking': 'Google',
  'gemini-2.5-pro': 'Google', // Add new model
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
  'claude-3-5': 'Anthropic'
};

export default function ResponseColumn({ model, response, streaming, className, conversationId, onRetry }) {  // Add conversationId prop
  const contentRef = useRef(null);
  const [displayedText, setDisplayedText] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);  // state for code copy functionality
  const lastResponseRef = useRef('');
  const processingTimeoutRef = useRef(null);
  const [isActive, setIsActive] = useState(false);  // to track if this column is currently receiving updates
  const previousResponseRef = useRef('');  // to track previous response
  const currentConversationRef = useRef(conversationId);  // Add ref to track conversation
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Simplify timer-related state to just what's needed
  const [elapsedTime, setElapsedTime] = useState(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

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

  // Single timer effect to handle all cases
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // For historical responses, use stored duration
    if (response?.duration) {
      setElapsedTime(response.duration);
      return;
    }

    // Start timer for new responses
    if (response?.loading) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
        setElapsedTime(elapsed);
      }, 100);
    }

    // Stop timer and save duration when response is complete
    if (response?.done) {
      const duration = ((Date.now() - (startTimeRef.current || Date.now())) / 1000).toFixed(1);
      setElapsedTime(duration);
      if (response && typeof response === 'object') {
        response.duration = duration;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [response?.loading, response?.done, response?.duration]);

  // Clean up timer when component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Enhanced timer display component
  const renderTimer = (time) => (
    <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700/50 ml-2 border border-gray-200 dark:border-gray-600">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" 
        className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 mr-1">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .27.144.518.378.651l3.5 2a.75.75 0 00.744-1.302L11 9.677V5z" clipRule="evenodd" />
      </svg>
      <span className="text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
        {time || '—'}s
      </span>
    </div>
  );

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

  // Replace the current processMathInText function with this robust version
  const processMathInText = (text) => {
    if (!text) return text;
    
    // First protect code blocks and inline code
    const codeBlocks = [];
    let processedText = text.replace(/```[\s\S]*?```/g, match => {
      codeBlocks.push(match);
      return `CODE_BLOCK_${codeBlocks.length - 1}`;
    });
    
    const inlineCodes = [];
    processedText = processedText.replace(/`[^`]+`/g, match => {
      inlineCodes.push(match);
      return `INLINE_CODE_${inlineCodes.length - 1}`;
    });

    // Fix the specific math patterns from the examples
    
    // 1. Fix \x2 and \x3 patterns (LaTeX-style exponents)
    processedText = processedText.replace(/\\x\s*2/g, 'x^2');
    processedText = processedText.replace(/\\x\s*3/g, 'x^3');
    
    // 2. Handle integration expressions with commas and boxed results
    processedText = processedText.replace(
      /\[\s*\\int\s+([^\],]+),?\s*dx\s*=\s*\\boxed\{\\dfrac\{([^{}]+)\}\{([^{}]+)\}\s*\+\s*C\s*\}\s*\]/g,
      '$$\\int $1\\,dx = \\boxed{\\dfrac{$2}{$3} + C}$$'
    );
    
    // 3. Handle simpler integration expressions
    processedText = processedText.replace(
      /\[\s*\\int\s+([^\],]+),?\s*dx\s*=\s*\\frac\{([^{}]+)\}\{([^{}]+)\}\s*\+\s*C\s*\]/g,
      '$$\\int $1\\,dx = \\frac{$2}{$3} + C$$'
    );
    
    // 4. Handle integration with Unicode symbol
    processedText = processedText.replace(
      /∫\s+([^\n,]+),?\s*dx\s*=\s*\(([^)]+)\)\/([^+]+)\s*\+\s*C/g,
      '$$\\int $1\\,dx = \\frac{$2}{$3} + C$$'
    );
    
    // 5. Handle standalone fraction expressions
    processedText = processedText.replace(
      /\\frac\{([^{}]+)\}\{([^{}]+)\}/g,
      '$$\\frac{$1}{$2}$$'
    );
    
    // 6. Handle standalone boxed expressions
    processedText = processedText.replace(
      /\\boxed\{([^{}]+)\}/g,
      '$$\\boxed{$1}$$'
    );
    
    // 7. Handle special square bracket notations for integrals
    processedText = processedText.replace(
      /\[\s*(\\int|∫)\s+([^,=]+),?\s*d([a-z])\s*=\s*([^\\[\]]+)\s*\]/g,
      '$$\\int $2\\,d$3 = $4$$'
    );
    
    // Restore code blocks and inline code
    processedText = processedText.replace(/CODE_BLOCK_(\d+)/g, (_, i) => codeBlocks[parseInt(i)]);
    processedText = processedText.replace(/INLINE_CODE_(\d+)/g, (_, i) => inlineCodes[parseInt(i)]);
    
    return processedText;
  };

  // Enhanced Math component with better error handling and options
  const Math = ({ value, inline }) => {
    const options = {
      throwOnError: false,
      errorColor: '#aaa', // Less noticeable neutral color for error fallback
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
        "\\norm": "\\|#1\\|",
        "\\set": "\\{#1\\}",
        "\\abs": "|#1|",
        "\\probability": "\\mathbb{P}\\left(#1\\right)",
        "\\expectation": "\\mathbb{E}\\left[#1\\right]",
        "\\variance": "\\text{Var}\\left[#1\\right]",
        "\\diff": "\\mathrm{d}",
        "\\pd": "\\partial",
        "\\transpose": "^{\\mathsf{T}}",
        "\\inverse": "^{-1}",
        "\\argmin": "\\underset{#1}{\\text{arg min}}",
        "\\argmax": "\\underset{#1}{\\text{arg max}}",
        "\\mod": "\\text{ mod }",
        "\\equiv": "\\text{ equiv }",
        "\\ceil": "\\lceil#1\\rceil",
        "\\floor": "\\lfloor#1\\rfloor",
        "\\norm": "\\left\\|#1\\right\\|",
        "\\paren": "\\left(#1\\right\\right)",
        "\\ang": "\\langle#1\\rangle",
        "\\abs": "\\left|#1\\right|",
        "\\set": "\\{#1\\}",
        "\\card": "\\left|#1\\right|",
        "\\vectornorm": "\\left\\|#1\\right\\|",
        "\\interior": "\\mathop{\\mathrm{int}}"
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
      // Return a neutral fallback without red color
      return <code className="text-gray-400 bg-gray-800/60 px-1.5 py-0.5 rounded font-mono text-sm">{value}</code>;
    }
  };

  // Updated CodeBlock component with fixed JSX structure
  const CodeBlockWrapper = ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    const code = String(children).replace(/\n$/, '');
    
    return (
      <div>
        <CodeBlock 
          language={language} 
          value={code} 
          inline={inline} 
        />
      </div>
    );
  };

  // Add these new components for table handling
  const TableWrapper = ({ children }) => (
    <div className="w-full overflow-x-auto my-6 rounded-lg border border-gray-700">
      <table className="w-full border-collapse table-auto">
        {children}
      </table>
    </div>
  );

  const TableRow = ({ children, isHeader }) => (
    <tr className={`
      ${isHeader ? 'bg-gray-800/50' : 'odd:bg-transparent even:bg-gray-800/20'} 
      border-b border-gray-700 last:border-0
    `}>
      {children}
    </tr>
  );

  const TableCell = ({ children, isHeader }) => {
    const Component = isHeader ? 'th' : 'td';
    return (
      <Component className={`
        px-4 py-2 text-sm border-r border-gray-700 last:border-r-0
        ${isHeader 
          ? 'font-semibold text-gray-200 whitespace-nowrap' 
          : 'text-gray-300 break-words'
        }
      `}>
        {children}
      </Component>
    );
  };

  const handleApiKeyWarning = () => {
    const event = new CustomEvent('toggleApiKeyManager', {
      detail: { show: true }
    });
    window.dispatchEvent(event);
  };

  const renderError = () => {
    const errorType = response.errorType || 'UNKNOWN_ERROR';
    
    const getErrorStyles = () => {
      switch (errorType) {
        case 'API_KEY_MISSING':
          return 'border-yellow-600/30 bg-yellow-900/20 cursor-pointer hover:bg-yellow-900/30';
        case 'MODEL_UNAVAILABLE':
          return 'border-orange-600/30 bg-orange-900/20';
        case 'TIMEOUT':
          return 'border-orange-600/30 bg-orange-900/20';
        case 'RATE_LIMIT':
          return 'border-purple-600/30 bg-purple-900/20';
        case 'MAX_RETRIES_EXCEEDED':
          return 'border-red-600/30 bg-red-900/20';
        case 'EMPTY_RESPONSE':
          return 'border-blue-600/30 bg-blue-900/20';
        default:
          return 'border-red-800/30 bg-red-900/20';
      }
    };

    const getErrorTitle = () => {
      switch (errorType) {
        case 'API_KEY_MISSING':
          return 'API Key Required';
        case 'MODEL_UNAVAILABLE':
          return 'Model Unavailable';
        case 'TIMEOUT':
          return 'Response Timeout';
        case 'RATE_LIMIT':
          return 'Rate Limit Exceeded';
        case 'MAX_RETRIES_EXCEEDED':
          return 'Max Retries Exceeded';
        case 'EMPTY_RESPONSE':
          return 'Empty Response';
        case 'NETWORK_ERROR':
          return 'Network Error';
        default:
          return 'Error Encountered';
      }
    };

    const getErrorMessage = () => {
      if (response.retryCount > 0) {
        return `${response.error} (Retry ${response.retryCount}/${response.maxRetries || 2})`;
      }
      return response.error;
    };

    const getErrorIcon = () => {
      switch (errorType) {
        case 'API_KEY_MISSING':
          return (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0 019 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 01.293-.707L8.196 8.39A5.002 5.002 0 018 7zm5-3a.75.75 0 000 1.5A1.5 1.5 0 0114.5 7 .75.75 0 0016 7a3 3 0 00-3-3z" clipRule="evenodd" />
            </svg>
          );
        case 'TIMEOUT':
        case 'MODEL_UNAVAILABLE':
          return (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
            </svg>
          );
        case 'EMPTY_RESPONSE':
          return (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75zM3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
            </svg>
          );
        default:
          return (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          );
      }
    };

    const errorTextClass = () => {
      switch (errorType) {
        case 'API_KEY_MISSING':
          return 'text-yellow-400';
        case 'MODEL_UNAVAILABLE':
        case 'TIMEOUT':
          return 'text-orange-400';
        case 'RATE_LIMIT':
          return 'text-purple-400';
        case 'MAX_RETRIES_EXCEEDED':
          return 'text-red-400';
        case 'EMPTY_RESPONSE':
          return 'text-blue-400';
        default:
          return 'text-red-400';
      }
    };

    return (
      <div className={`p-4 rounded-lg border ${getErrorStyles()} transition-colors duration-200`}>
        <div className="flex items-start space-x-3">
          <div className={`p-1.5 rounded-full ${errorTextClass()} bg-opacity-20`}>
            {getErrorIcon()}
          </div>
          <div>
            <p className={`font-medium ${errorTextClass()}`}>
              {getErrorTitle()}
            </p>
            <p className="mt-1 text-sm text-gray-300">{getErrorMessage()}</p>
            {errorType === 'API_KEY_MISSING' && (
              <button 
                onClick={handleApiKeyWarning}
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

  const renderLoading = (isSlowModel) => (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="w-full max-w-md h-4 rounded-full loading-gradient"></div>
      <div className="w-3/4 max-w-sm h-4 rounded-full loading-gradient"></div>
      <div className="dot-typing-container">
        <div className="dot-typing"></div>
      </div>
    </div>
  );

  // Update the thinking animation in header
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

  const toggleCollapse = (e) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
    if (isExpanded) setIsExpanded(false);
  };

  const toggleExpand = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
    if (isCollapsed) setIsCollapsed(false);
  };

  // Handle retry click
  const handleRetry = () => {
    console.log('Retry clicked for model:', model, 'conversation:', conversationId);
    if (typeof onRetry === 'function') {
      onRetry(model, conversationId);
    }
  };

  // Define table components outside the main render
  const MarkdownComponents = {
    table: ({ children }) => (
      <div className="w-full overflow-x-auto my-6 rounded-lg border border-gray-700/50 shadow-xl bg-gray-900/30">
        <table className="min-w-full divide-y divide-gray-700/50">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-800/70">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-gray-700/50 bg-gray-900/20">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="transition-all duration-150 hover:bg-gray-800/40">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap bg-gray-800/50">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-6 py-4 text-sm text-gray-300 font-normal align-middle">
        {children}
      </td>
    ),
    code: ({ node, inline, className, children, ...props }) => {
      const [isCopied, setIsCopied] = useState(false);
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (!inline) {
        const handleCopy = () => {
          navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        };

        return (
          <div className="relative group">
            {/* Language indicator */}
            {language && (
              <div className="absolute top-0 left-0 bg-gray-800/90 text-gray-400 text-xs px-2 py-1 rounded-bl font-mono">
                {language}
              </div>
            )}
            
            {/* Copy button with success state */}
            <button
              onClick={handleCopy}
              className={`absolute top-2 right-2 p-1.5 rounded text-xs font-medium transition-all duration-200 ${
                isCopied 
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                  : 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-300'
              }`}
            >
              {isCopied ? (
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-400">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  <span className="text-green-400">Copied!</span>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                    <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                  </svg>
                  <span>Copy</span>
                </span>
              )}
            </button>
            
            <SyntaxHighlighter
              language={language || 'text'}
              style={oneDark}
              customStyle={{
                margin: 0,
                borderRadius: '0.5rem',
                padding: '2.5rem 1rem 1rem 1rem',
                backgroundColor: 'rgb(0, 0, 20)',
                fontSize: '0.875rem',
                lineHeight: '1.5'
              }}
              codeTagProps={{
                style: {
                  fontFamily: 'JetBrains Mono, Fira Code, Menlo, Monaco, Consolas, monospace'
                }
              }}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          </div>
        );
      }
      
      return (
        <code className="px-1.5 py-0.5 rounded font-mono text-sm bg-gray-800/40">
          {children}
        </code>
      );
    },
  };

  return (
    <div className={`rounded-xl overflow-hidden flex flex-col transition-all duration-300 ${
      isExpanded 
        ? 'fixed inset-6 z-50 bg-gray-900/90 backdrop-blur-md shadow-2xl' 
        : isCollapsed
          ? 'h-[56px]' 
          : 'h-full'
    } ${className}`}>
      <div className="px-4 py-3 flex justify-between items-center border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-primary-500"></div>
          <div className="flex items-center">
            <h3 className="text-lg font-medium text-gray-200">{modelDisplayName}</h3>
            {/* <span className="ml-2 text-xs text-gray-400">
              {providerMap[model]?.charAt(0).toUpperCase() + providerMap[model]?.slice(1) || 'Unknown'}
            </span> */}
            {elapsedTime && renderTimer(elapsedTime)}
            {isLoading && renderThinkingState()}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Add Retry Button in header */}
          {!isLoading && !streaming && (displayedText || response?.text || response?.error) && (
            <button
              onClick={handleRetry}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
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
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
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
              <button
                onClick={toggleExpand}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
                title={isExpanded ? "Exit fullscreen" : "Enter fullscreen"}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 20 20" 
                  fill="currentColor" 
                  className="w-5 h-5"
                >
                  {isExpanded ? (
                    <path d="M3 3h4v4H3V3zM13 3h4v4h-4V3zM3 13h4v4H3v-4zM13 13h4v4h-4v-4z"/>
                  ) : (
                    <path fillRule="evenodd" d="M3.25 3.25a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v.5h-4v4h-.5a.5.5 0 0 1-.5-.5v-4Zm9 0a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-.5v-4h-4v-.5Zm-9 9a.5.5 0 0 1 .5-.5h.5v4h4v.5a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5v-4Zm9-.5a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5h-4Z" />
                  )}
                </svg>
              </button>
              <button
                onClick={copyToClipboard}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Copy response"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
      <div 
        ref={contentRef}
        className={`overflow-auto flex-grow scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent transition-all duration-300 ease-in-out ${
          isCollapsed ? 'h-0 opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        style={{ 
          padding: isCollapsed ? '0' : '1rem',
          minHeight: isCollapsed ? "0" : "200px", 
          maxHeight: isExpanded ? "calc(100vh - 140px)" : "600px",
          pointerEvents: isCollapsed ? 'none' : 'auto',
          transform: `scale(${isCollapsed ? '0.95' : '1'})`,
          transformOrigin: 'top'
        }}
      >
        {(isLoading && !hasText) || (response?.isSlowModel && !hasText) ? (
          renderLoading(response?.isSlowModel)
        ) : hasError ? (
          renderError()
        ) : hasText ? (
          <div >
            <ReactMarkdown
              components={MarkdownComponents}
              remarkPlugins={[[remarkGfm, { tablePipeAlign: true }], remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {displayedText || response.text}
            </ReactMarkdown>
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
      
      {/* Add the KaTeX styling inside the component */}
      <style jsx global>{`
        /* Make math expressions bold and larger */
        .katex {
          font-size: 1.15em !important;
          font-weight: 500 !important;
        }
        
        .katex-display > .katex {
          font-size: 1.25em !important;
          font-weight: 600 !important;
        }
        
        /* Improve spacing for math display blocks */
        .katex-display {
          margin: 1.5em 0 !important;
          padding: 0.5em 0 !important;
          overflow-x: auto;
          overflow-y: hidden;
        }
        
        /* Make fractions more readable */
        .katex .mfrac .frac-line {
          border-bottom-width: 0.08em !important;
        }
        
        /* Make boxed expressions stand out more */
        .katex .boxed {
          border: 0.08em solid !important;
          border-radius: 0.1em !important;
          padding: 0.1em 0.2em !important;
          border-color: #6c6 !important;
        }

        /* Table-specific styles */
        .markdown-table-wrapper {
          margin: 1rem 0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* Improve table scrollbar appearance */
        .markdown-table-wrapper::-webkit-scrollbar {
          height: 6px;
        }

        .markdown-table-wrapper::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
        }

        .markdown-table-wrapper::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }

        .markdown-table-wrapper::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        /* Table styles */
        .markdown-body table {
          border-spacing: 0;
          border-collapse: collapse;
          margin: 1em 0;
          width: 100%;
        }

        .markdown-body table tr {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .markdown-body table tr:nth-child(2n) {
          background-color: rgba(255, 255, 255, 0.02);
        }

        .markdown-body table td,
        .markdown-body table th {
          padding: 12px 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          line-height: 1.4;
        }

        .markdown-body table th {
          font-weight: 600;
          background-color: rgba(255, 255, 255, 0.05);
        }

        /* Table wrapper scrollbar styles */
        .overflow-x-auto::-webkit-scrollbar {
          height: 8px;
        }

        .overflow-x-auto::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }

        .overflow-x-auto::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .overflow-x-auto::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        /* Reset default table styles */
        table {
          border-spacing: 0;
          border-collapse: separate;
          width: 100%;
        }

        /* Ensure tables don't overflow their containers */
        .overflow-x-auto {
          max-width: 100%;
          margin: 1rem 0;
          border-radius: 0.5rem;
        }

        /* Basic table structure */
        table td,
        table th {
          min-width: 100px; /* Prevent cells from becoming too narrow */
        }

        /* Preserve whitespace in code blocks within tables */
        table code {
          white-space: pre-wrap;
        }

        /* Enhanced table styles */
        .markdown-body table {
          border-spacing: 0;
          border-collapse: separate;
          border-radius: 0.5rem;
          margin: 1.5em 0;
          width: 100%;
          overflow: hidden;
          background: rgba(17, 24, 39, 0.3);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .markdown-body thead {
          position: relative;
        }

        .markdown-body thead:after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          background: linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 100%);
        }

        .markdown-body th {
          font-weight: 600;
          letter-spacing: 0.05em;
          background: rgba(31, 41, 55, 0.5);
        }

        .markdown-body td {
          background: transparent;
          line-height: 1.6;
          vertical-align: middle;
        }

        .markdown-body tr:last-child td:first-child {
          border-bottom-left-radius: 0.5rem;
        }

        .markdown-body tr:last-child td:last-child {
          border-bottom-right-radius: 0.5rem;
        }

        .markdown-body th:first-child {
          border-top-left-radius: 0.5rem;
        }

        .markdown-body th:last-child {
          border-top-right-radius: 0.5rem;
        }

        /* Improve table hover effects */
        .markdown-body tr:hover td {
          background: rgba(55, 65, 81, 0.3);
        }

        /* Add subtle transitions */
        .markdown-body td, .markdown-body th {
          transition: all 150ms ease-in-out;
        }

        /* Improve text readability in tables */
        .markdown-body td, .markdown-body th {
          text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }

        /* Code block enhancements */
        .syntax-highlighter {
          font-feature-settings: "liga" 0;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Syntax highlighting tweaks */
        .token.comment,
        .token.prolog,
        .token.doctype,
        .token.cdata {
          font-style: italic;
        }

        .token.function,
        .token.class-name {
          color: #61afef;
        }

        .token.keyword {
          color: #c678dd;
        }

        .token.string {
          color: #98c379;
        }

        .token.number {
          color: #d19a66;
        }

        /* Line number styling */
        .syntax-highlighter .linenumber {
          min-width: 2.5em;
          padding-right: 1em;
          text-align: right;
          color: rgba(255, 255, 255, 0.2);
          -webkit-user-select: none;
          user-select: none;
        }
      `}</style>
    </div>
  );
}