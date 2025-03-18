import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Model display names mapping
const modelDisplayNames = {
  'gpt-4': 'GPT-4',
  'claude': 'Claude 3 Sonnet',
  'gemini': 'Gemini 2.0 Flash',
  'mistral-7b': 'Mistral Medium',
  'llama2-70b': 'Llama-2 70B',
  'phi3': 'Phi-3',
  'qwen-32b': 'Qwen Coder 32B',
  'openchat': 'OpenChat 3.5',
  'deepseek-r1': 'DeepSeek R1',
  'deepseek-v3': 'DeepSeek V3',
  'nemotron-70b': 'Nemotron 70B',
  'mistral-small-3': 'Mistral Small 3',
  'mistral-nemo': 'Mistral Nemo',
  'olympiccoder': 'OlympicCoder 7B'
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

  // Enhanced math processing function with more comprehensive patterns
  const processMathInText = (text) => {
    if (!text) return text;

    // First protect code blocks
    const codeBlocks = [];
    let protectedText = text.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `\uE000${codeBlocks.length - 1}\uE000`;
    });

    // First, protect displayed equations
    protectedText = protectedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
      return `\n\n$$${content}$$\n\n`;
    });

    // Add proper spacing around inline math
    protectedText = protectedText.replace(/\$([^$\n]+?)\$/g, (match, content) => {
      // Don't add space if already has space or punctuation
      const spaceBefore = /[-\s({[]$/.test(match[0]) ? '' : ' ';
      const spaceAfter = /[-\s)}\],.]$/.test(match[match.length - 1]) ? '' : ' ';
      return `${spaceBefore}$${content}$${spaceAfter}`;
    });

    // Process other math expressions
    const replacements = [
      // Basic math delimiters
      { pattern: /\$\$([^$]+?)\$\$/g, replace: (_, m) => wrapInMath(m, 'block') },
      { pattern: /\$([^$\n]+?)\$/g, replace: (_, m) => wrapInMath(m, 'inline') },
      { pattern: /\\\[(.*?)\\\]/g, replace: (_, m) => wrapInMath(m, 'block') },
      { pattern: /\\\((.*?)\\\)/g, replace: (_, m) => wrapInMath(m, 'inline') },
      
      // Common LaTeX commands and environments
      { pattern: /\\begin\{(equation|align|gather|multline)\*?\}([\s\S]*?)\\end\{\1\*?\}/g, 
        replace: (_, env, content) => wrapInMath(content, 'block') },
      { pattern: /\\boxed\{([^}]*)\}/g, replace: (_, m) => wrapInMath(`\\boxed{${m}}`, 'inline') },
      
      // Mathematical operators and symbols
      { pattern: /\\(sin|cos|tan|csc|sec|cot|arcsin|arccos|arctan|sinh|cosh|tanh)\b/g, 
        replace: m => wrapInMath(m) },
      { pattern: /\\(log|ln|exp|lim|sup|inf|max|min|arg|det|dim|ker|deg|gcd|lcm)\b/g,
        replace: m => wrapInMath(m) },
      { pattern: /\\(sum|prod|coprod|int|oint|bigcap|bigcup|bigoplus|bigotimes)\b/g,
        replace: m => wrapInMath(m) },
      { pattern: /\\(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)\b/g,
        replace: m => wrapInMath(m) },
      { pattern: /\\(mod|bmod|pmod|pod)\b/g, replace: m => wrapInMath(m) },
      
      // Common mathematical constructs
      { pattern: /\\(frac|dfrac|tfrac)\{[^}]*\}\{[^}]*\}/g, replace: m => wrapInMath(m) },
      { pattern: /\\(sqrt|\root)\[?[^]]*\]?\{[^}]*\}/g, replace: m => wrapInMath(m) },
      { pattern: /\\(vec|bar|hat|tilde|dot|ddot)\{[^}]*\}/g, replace: m => wrapInMath(m) },
      { pattern: /\\(overline|underline|widehat|widetilde|overrightarrow|overleftarrow)\{[^}]*\}/g,
        replace: m => wrapInMath(m) },
      
      // Matrices and arrays
      { pattern: /\\begin\{(matrix|pmatrix|bmatrix|vmatrix|Vmatrix|smallmatrix)\}[\s\S]*?\\end\{\1\}/g,
        replace: m => wrapInMath(m, 'block') },
      { pattern: /\\begin\{(array|cases)\}[\s\S]*?\\end\{\1\}/g,
        replace: m => wrapInMath(m, 'block') },
      
      // Mathematical spacing and alignment
      { pattern: /\\(quad|qquad|hspace|vspace)\*?\{[^}]*\}/g, replace: m => wrapInMath(m) },
      { pattern: /\\(left|right|middle|big|Big|bigg|Bigg)[\[\](){}|./]/g, replace: m => wrapInMath(m) },
      
      // Special symbols and operators
      { pattern: /[×÷±∑∏∫⋅⊗⊕≤≥≠∈∉⊆⊇∪∩→←↔⇒⇐⇔∀∃∄¬∨∧⊥∥∞ℵℝℤℕℚℂ]/g, replace: m => wrapInMath(m) },
      { pattern: /\\(infty|emptyset|partial|nabla|therefore|because|forall|exists|nexists|neg|vee|wedge|perp|parallel)/g,
        replace: m => wrapInMath(m) },
      // Add support for more mathematical expressions
      { 
        pattern: /\\begin\{(equation|align|gather|multline)\*?\}([\s\S]*?)\\end\{\1\*?\}/g,
        replace: (_, env, content) => `\n\n$${content}$\n\n`
      },
      { 
        pattern: /(?<![\\])\b(?:sin|cos|tan|log|ln)\b(?!\{)/g,
        replace: m => `\\${m}`
      },
      {
        pattern: /(?<=\$.*?)([0-9]+)(?=[⁄/][0-9]+.*?\$)/g,
        replace: m => `\\frac{${m}}`
      },
      // Better fraction handling
      {
        pattern: /\\frac\{([^{}]+)\}\{([^{}]+)\}/g,
        replace: (_, num, den) => `\\frac{${num}}{${den}}`
      },
      // Handle equation spacing
      {
        pattern: /(\$[^$\n]+\$)([,.])?(?!\n)/g,
        replace: (_, math, punct) => punct ? `${math}${punct} ` : `${math} `
      }
    ];

    let processedText = protectedText;
    replacements.forEach(({ pattern, replace }) => {
      processedText = processedText.replace(pattern, replace);
    });

    // Restore code blocks
    processedText = processedText.replace(/\uE000(\d+)\uE000/g, (match, index) => {
      return codeBlocks[index];
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
        "\\norm": "\\|#1\\|",
        "\\set": "\\{#1\\}",
        "\\abs": "|#1|",
        "\\probability": "\\mathbb{P}\\left(#1\\right)",
        "\\expectation": "\\mathbb{E}\\left[#1\\right]",
        "\\variance": "\\text{Var}\\left(#1\\right)",
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
        "\\paren": "\\left(#1\\right)",
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
      return <code className="text-red-500">{value}</code>;
    }
  };

  // Updated CodeBlock component with fixed JSX structure
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
            {elapsedTime && renderTimer(elapsedTime)}
            {isLoading && renderThinkingState()}
          </div>
        </div>
        <div className="flex items-center space-x-2">
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
          <div className="prose prose-sm prose-invert max-w-none prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-gray-800">
            <ReactMarkdown
              components={{
                code: CodeBlock,
                text: ({ children }) => processMathInText(children),
                a: ({ node, ...props }) => (
                  <a target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline" {...props} />
                ),
              }}
              remarkPlugins={[remarkMath]}
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
    </div>
  );
}