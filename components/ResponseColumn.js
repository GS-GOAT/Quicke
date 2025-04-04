import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
// import CodeBlock from './CodeBlock'; // Add this import

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
  'deepseek-v3-0324': 'DeepSeek V3 Latest', // Add new model display name
  // 'olympiccoder': 'OlympicCoder 7B',
  // Anthropic
  'claude-3-7': 'Claude 3.7 Sonnet',
  'claude-3-5': 'Claude 3.5 Sonnet',
  'summary': 'Summarizer',  // Add summary model display name
};

// Add provider map
const providerMap = {
  'gpt-4.5-preview': 'OpenAI',
  'gpt-4o': 'OpenAI',
  'gpt-4o-mini': 'OpenAI',
  'gpt-4o-mini-or': 'OpenRouter', 
  'o1': 'OpenAI',
  'o3-mini': 'OpenAI',
  'o1-mini': 'OpenAI',
  'gemini-flash': 'Google',
  'gemini-pro': 'Google', 
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
  'summary': 'System',  // Add summary provider
};

// Update display provider function
const getDisplayProvider = (provider) => {
  if (provider === 'OpenRouter') return 'OR';
  return provider;
};

// // Add this function to render multimodal content
// const renderContent = (content) => {
//   // Check if content is an array (multimodal response)
//   if (Array.isArray(content)) {
//     return content.map((item, index) => {
//       if (item.type === 'text') {
//         return (
//           <ReactMarkdown key={index} components={MarkdownComponents}>
//             {item.text}
//           </ReactMarkdown>
//         );
//       } else if (item.type === 'image_url') {
//         return (
//           <div key={index} className="my-4">
//             <img 
//               src={item.image_url.url} 
//               alt="Generated image" 
//               className="max-w-full rounded-lg"
//             />
//           </div>
//         );
//       }
//       return null;
//     });
//   }
  
//   // Regular text response
//   return (
//     <ReactMarkdown components={MarkdownComponents}>
//       {content}
//     </ReactMarkdown>
//   );
// };

export default function ResponseColumn({ model, response, streaming, className, conversationId, onRetry, isSummary }) {  // Add conversationId prop
  const contentRef = useRef(null);
  const [displayedText, setDisplayedText] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  const lastResponseRef = useRef('');
  const processingTimeoutRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const previousResponseRef = useRef('');
  const currentConversationRef = useRef(conversationId);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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

  // Auto-scroll during streaming
  useEffect(() => {
    if (contentRef.current && streaming) {
      // Only auto-scroll if user has scrolled to bottom
      const container = contentRef.current;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      
      if (isAtBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [displayedText, streaming]);

  // Timer effect
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

  // Timer display component
  const renderTimer = (time) => (
    <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-700/50 ml-2 border border-gray-600">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" 
        className="w-3.5 h-3.5 text-gray-400 mr-1">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .27.144.518.378.651l3.5 2a.75.75 0 00.744-1.302L11 9.677V5z" clipRule="evenodd" />
      </svg>
      <span className="text-xs font-medium text-gray-300 tabular-nums">
        {time || '—'}s
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

  // Process mathematical expressions in text
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

    // Simple detector for square brackets containing LaTeX expressions
    processedText = processedText.replace(/\[(.*?\\frac.*?|.*?\\sqrt.*?|.*?\\boxed.*?)\]/g, (match, p1) => {
      // Skip if it looks like a link
      if (p1.includes('](') || p1.includes('http')) {
        return match;
      }
      return `$$${p1}$$`;
    });

    // Handle common math pattern replacements
    
    // LaTeX-style exponents
    processedText = processedText.replace(/\\x\s*([0-9]+)/g, 'x^$1');
    
    // Integration expressions with boxed results
    processedText = processedText.replace(
      /\[\s*\\int\s+([^\],]+),?\s*dx\s*=\s*\\boxed\{([^{}]+)\}\s*\]/g,
      '$$\\int $1\\,dx = \\boxed{$2}$$'
    );
    
    // Simple integrations
    processedText = processedText.replace(
      /\[\s*\\int\s+([^\],]+),?\s*dx\s*=\s*([^\\[\]]+)\s*\]/g,
      '$$\\int $1\\,dx = $2$$'
    );
    
    // Unicode integration symbol
    processedText = processedText.replace(
      /∫\s+([^\n,]+),?\s*dx\s*=\s*([^]+)/g,
      '$$\\int $1\\,dx = $2$$'
    );
    
    // Standalone LaTeX expressions
    processedText = processedText.replace(
      /\\(frac|boxed|sqrt|vec|overrightarrow|hat|bar)\{([^{}]+)\}\{?([^{}]*)\}?/g,
      '$$\\$1{$2}{$3}$$'
    );

    // Fix problematic math expressions
    processedText = processedText.replace(/KaTeX can only parse string typed expression/g, '');
    
    // Restore code blocks and inline code
    processedText = processedText.replace(/CODE_BLOCK_(\d+)/g, (_, i) => codeBlocks[parseInt(i)]);
    processedText = processedText.replace(/INLINE_CODE_(\d+)/g, (_, i) => inlineCodes[parseInt(i)]);
    
    return processedText;
  };

  // Enhanced Math component with better error handling
  const Math = ({ value, inline }) => {
    // Clean up problematic text
    const cleanValue = value ? value
      .replace(/KaTeX can only parse string typed expression/g, '')
      .replace(/​/g, '') // Remove zero-width spaces
      .replace(/\s+([{}])/g, '$1') // Remove spaces before braces
      .replace(/([{}])\s+/g, '$1') // Remove spaces after braces
      .trim() : '';

    const options = {
      throwOnError: false,
      errorColor: '#aaa',
      strict: false,
      trust: true,
      macros: {
        "\\R": "\\mathbb{R}",
        "\\N": "\\mathbb{N}",
        "\\Z": "\\mathbb{Z}",
        "\\Q": "\\mathbb{Q}",
        "\\C": "\\mathbb{C}",
        "\\implies": "\\Rightarrow",
        "\\iff": "\\Leftrightarrow"
      },
    };

    try {
      return inline ? (
        <InlineMath math={cleanValue} settings={options} />
      ) : (
        <BlockMath math={cleanValue} settings={options} />
      );
    } catch (error) {
      console.error('KaTeX error:', error);
      return <code className="text-gray-400 bg-gray-800/60 px-1.5 py-0.5 rounded font-mono text-sm">{value}</code>;
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

  // Toggle response collapse
  const toggleCollapse = (e) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
    if (isExpanded) setIsExpanded(false);
  };

  // Toggle fullscreen expand
  const toggleExpand = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
    if (isCollapsed) setIsCollapsed(false);
  };

  // Handle retry click
  const handleRetry = () => {
    if (typeof onRetry === 'function') {
      onRetry(model, conversationId);
    }
  };

  // Handle API key warning
  const handleApiKeyWarning = () => {
    const event = new CustomEvent('toggleApiKeyManager', {
      detail: { show: true }
    });
    window.dispatchEvent(event);
  };

  // Render error states
  const renderError = () => {
    const errorType = response.errorType || 'UNKNOWN_ERROR';
    
    const getErrorStyles = () => {
      switch (errorType) {
        case 'API_KEY_MISSING':
          return 'border-yellow-600/30 bg-yellow-900/20 cursor-pointer hover:bg-yellow-900/30';
        case 'MODEL_UNAVAILABLE':
        case 'TIMEOUT':
          return 'border-orange-600/30 bg-orange-900/20';
        case 'RATE_LIMIT':
          return 'border-purple-600/30 bg-purple-900/20';
        default:
          return 'border-red-800/30 bg-red-900/20';
      }
    };

    const getErrorTitle = () => {
      switch (errorType) {
        case 'API_KEY_MISSING': return 'API Key Required';
        case 'MODEL_UNAVAILABLE': return 'Model Unavailable';
        case 'TIMEOUT': return 'Response Timeout';
        case 'RATE_LIMIT': return 'Rate Limit Exceeded';
        case 'MAX_RETRIES_EXCEEDED': return 'Max Retries Exceeded';
        case 'EMPTY_RESPONSE': return 'Empty Response';
        case 'NETWORK_ERROR': return 'Network Error';
        default: return 'Error Encountered';
      }
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
        default:
          return (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          );
      }
    };

    const getErrorMessage = () => {
      let errorMsg = response.error;
      
      // Remove [ADD_KEY] marker from the message but flag that we need a button
      const needsKeyButton = errorMsg && errorMsg.includes('[ADD_KEY]');
      if (needsKeyButton) {
        errorMsg = errorMsg.replace('[ADD_KEY]', '');
      }
      
      if (response.retryCount > 0) {
        return `${errorMsg} (Retry ${response.retryCount}/${response.maxRetries || 2})`;
      }
      return errorMsg;
    };

    const errorTextClass = () => {
      switch (errorType) {
        case 'API_KEY_MISSING': return 'text-yellow-400';
        case 'MODEL_UNAVAILABLE':
        case 'TIMEOUT': return 'text-orange-400';
        case 'RATE_LIMIT': return 'text-purple-400';
        default: return 'text-red-400';
      }
    };

    return (
      <div className={`p-4 rounded-lg border ${getErrorStyles()} transition-colors duration-200`}>
        <div className="flex items-start space-x-3">
          <div className={`p-1.5 rounded-full ${errorTextClass()} bg-opacity-20`}>
            {getErrorIcon()}
          </div>
          <div>
            <p className={`font-medium ${errorTextClass()}`}>{getErrorTitle()}</p>
            <p className="mt-1 text-sm text-gray-300">{getErrorMessage()}</p>
            {(errorType === 'API_KEY_MISSING' || response.error?.includes('[ADD_KEY]')) && (
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

  // Improved loading animation
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className="w-full max-w-md h-4 rounded-full loading-gradient opacity-70"></div>
      <div className="w-3/4 max-w-sm h-4 rounded-full loading-gradient opacity-50"></div>
      <div className="w-1/2 max-w-xs h-4 rounded-full loading-gradient opacity-30"></div>
      <div className="dot-typing-container mt-2">
        <div className="dot-typing"></div>
      </div>
    </div>
  );

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

  // Define markdown rendering components
  const MarkdownComponents = {
    // Headings with proper typography and spacing
    h1: ({ children }) => (
      <h1 className="text-2xl font-semibold mt-6 mb-4 pb-2 border-b border-gray-700/30 text-white">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-semibold mt-5 mb-3 text-white">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-medium mt-4 mb-2 text-white">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-medium mt-3 mb-2 text-gray-100">{children}</h4>
    ),
    
    // Paragraphs with proper line height and spacing
    p: ({ children }) => (
      <p className="my-3 leading-relaxed text-gray-200">{children}</p>
    ),
    
    // Enhanced unordered lists
    ul: ({ children }) => (
      <ul className="my-3 pl-6 space-y-2">{children}</ul>
    ),
    
    // Enhanced ordered lists
    ol: ({ children }) => (
      <ol className="my-3 pl-6 space-y-2 list-decimal">{children}</ol>
    ),
    
    // List items with better spacing and bullets
    li: ({ children }) => (
      <li className="text-gray-200 leading-relaxed">{children}</li>
    ),
    
    // Blockquotes with elegant styling
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-gray-500/50 pl-4 my-4 italic text-gray-300 bg-gray-800/30 py-2 pr-3 rounded-r">
        {children}
      </blockquote>
    ),
    
    // Tables with proper styling
    table: ({ children }) => (
      <div className="w-full overflow-x-auto my-6 rounded-lg border border-gray-700/50 shadow-lg">
        <table className="min-w-full divide-y divide-gray-700/50">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-800/70">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-gray-700/50 bg-gray-900/20">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="transition-all duration-150 hover:bg-gray-800/40">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider whitespace-nowrap">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-6 py-4 text-sm text-gray-300 align-middle">{children}</td>
    ),
    
    // Enhanced code blocks with syntax highlighting, language label, and copy button
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
          <div className="relative my-4 overflow-hidden" style={{ backgroundColor: 'rgb(0, 0, 20)', borderRadius: '0.5rem' }}>
            {/* Language indicator */}
            {language && (
              <div className="absolute top-0 left-0 bg-gray-800/70 text-gray-400 text-xs px-2 py-1 font-mono z-10">
                {language}
              </div>
            )}
            
            {/* Copy button with success state */}
            <button
              onClick={handleCopy}
              className={`absolute top-2 right-2 p-1.5 rounded text-xs font-medium transition-all duration-200 z-10 ${
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
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                  </svg>
                </span>
              )}
            </button>
            
            <SyntaxHighlighter
              language={language || 'text'}
              style={oneDark}
              customStyle={{
                margin: 0,
                padding: '2.5rem 1rem 1rem 1rem',
                backgroundColor: 'rgb(0, 0, 20)',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                border: 'none',
                borderRadius: '0.5rem',
                boxShadow: 'none'
              }}
              codeTagProps={{
                style: {
                  fontFamily: 'JetBrains Mono, Fira Code, Menlo, Monaco, Consolas, monospace',
                  backgroundColor: 'transparent'
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
    
    // Links with proper styling
    a: ({ node, children, href }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline underline-offset-2 decoration-blue-400/30 hover:decoration-blue-300/50 transition-colors"
      >
        {children}
      </a>
    ),
    
    // Horizontal rule with better styling
    hr: () => (
      <hr className="my-6 border-t border-gray-700/50" />
    ),
    
    // Math rendering components
    math: ({ value }) => <Math value={value} inline={false} />,
    inlineMath: ({ value }) => <Math value={value} inline={true} />
  };

  // Determine the current state
  const isLoading = response?.loading === true;
  const hasError = response?.error != null;
  const hasText = (displayedText && displayedText.length > 0) || 
                 (response?.text && response.text.length > 0);
  const waitingForPrompt = !isLoading && !hasError && !hasText;

  // Add special styling for summary
  const columnClassName = `${className} ${isSummary ? 
    'col-span-full bg-gradient-to-b from-gray-900/60 to-gray-800/40 border-t border-purple-500/20 mt-6 backdrop-blur-sm shadow-2xl rounded-2xl overflow-hidden' 
    : ''}`;

  return (
    <div className={`rounded-xl overflow-hidden flex flex-col transition-all duration-300 ${
      isExpanded 
        ? 'fixed inset-6 z-50 bg-gray-900/90 backdrop-blur-md shadow-2xl' 
        : isCollapsed
          ? 'h-[56px]' 
          : 'h-full'
    } ${columnClassName}`}>
      {/* Header with model info and controls */}
      <div className={`px-4 py-3 flex justify-between items-center border-b ${
        isSummary 
          ? 'border-purple-500/20 bg-gradient-to-r from-purple-900/20 via-gray-800/40 to-purple-900/20' 
          : 'border-gray-800'
      }`}>
        <div className="flex items-center space-x-2">
          {isSummary ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-purple-400 animate-ping opacity-75"></div>
              </div>
              <h3 className="text-lg font-medium text-gray-200 flex items-center gap-2">
                Summary
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium border border-purple-500/20">
                  Synthesizer
                </span>
              </h3>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-primary-500"></div>
              <div className="flex items-center">
                <h3 className="text-lg font-medium text-gray-200 flex items-center gap-1.5">
                  {modelDisplayName}
                  <span 
                    className="text-[9px] px-1 py-0.5 rounded-md bg-gray-800/50 text-gray-400 font-medium leading-none tracking-wide uppercase"
                    title={`Provider: ${providerMap[model]}`}
                  >
                    {getDisplayProvider(providerMap[model])}
                  </span>
                </h3>
                {elapsedTime && renderTimer(elapsedTime)}
                {isLoading && renderThinkingState()}
              </div>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {/* Retry button */}
          {!isSummary && !isLoading && !streaming && (displayedText || response?.text || response?.error) && (
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
              
              {/* Expand/collapse button */}
              <button
                onClick={toggleExpand}
                className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-800 rounded-lg transition-all duration-200"
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
                    <path fillRule="evenodd" d="M3.25 3.25a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v.5h-4v4h-.5a.5.5 0 0 1-.5-.5v-4Zm9 0a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-.5v-4h-4v-.5Zm-9 9a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5h-4Z" />
                  )}
                </svg>
              </button>
              
              {/* Copy response button */}
              <button
                onClick={copyToClipboard}
                className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-800 rounded-lg transition-colors"
                title="Copy response"
              >
                {copiedText ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-500">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
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
          padding: isCollapsed ? '0' : '1.25rem',
          minHeight: isCollapsed ? "0" : "200px", 
          maxHeight: isExpanded ? "calc(100vh - 140px)" : "600px",
          pointerEvents: isCollapsed ? 'none' : 'auto',
          transform: `scale(${isCollapsed ? '0.95' : '1'})`,
          transformOrigin: 'top'
        }}
      >
        {/* Loading state */}
        {(isLoading && !hasText) && renderLoading()}
        
        {/* Error state */}
        {hasError && renderError()}
        
        {/* Content state */}
        {hasText && (
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              components={MarkdownComponents}
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {processMathInText(displayedText || response.text)}
            </ReactMarkdown>
            {isActive && (
              <span className="typing-cursor">|</span>
            )}
          </div>
        )}
        
        {/* Waiting state */}
        {waitingForPrompt && (
          <div className="text-gray-500 italic flex items-center justify-center h-full">
            Waiting for prompt...
          </div>
        )}
      </div>
      
      {/* Add the KaTeX styling inside the component */}
      <style jsx global>{`
        /* Enhanced typography */
        .prose {
          color: #e5e7eb;
          max-width: none;
          line-height: 1.6;
        }
        
        .prose p {
          margin-top: 1.25em;
          margin-bottom: 1.25em;
        }
        
        .prose strong {
          color: #fff;
          font-weight: 600;
        }
        
        .prose em {
          color: #d1d5db;
        }
        
        /* List styling */
        .prose ul {
          margin-top: 1.25em;
          margin-bottom: 1.25em;
          list-style-type: disc;
          padding-left: 1.625em;
        }
        
        .prose ol {
          margin-top: 1.25em;
          margin-bottom: 1.25em;
          list-style-type: decimal;
          padding-left: 1.625em;
        }
        
        .prose li {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          padding-left: 0.375em;
        }
        
        .prose li::marker {
          color: #9ca3af;
        }
        
        /* KaTeX math styling */
        .katex {
          font-size: 1.15em !important;
          font-weight: 500 !important;
        }
        
        .katex-display > .katex {
          font-size: 1.25em !important;
          font-weight: 600 !important;
        }
        
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
        
        /* Make boxed expressions stand out */
        .katex .boxed {
          border: 0.08em solid !important;
          border-radius: 0.1em !important;
          padding: 0.1em 0.2em !important;
          border-color: #6c6 !important;
        }

        /* Code block scrollbars */
        pre::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }

        pre::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }

        pre::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        pre::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        /* Syntax highlighting colors */
        .token.comment { color: #8b949e !important; font-style: italic; }
        .token.string { color: #a5d6ff !important; }
        .token.number { color: #f2cc60 !important; }
        .token.builtin { color: #ff7b72 !important; }
        .token.char { color: #9ecbff !important; }
        .token.constant { color: #79c0ff !important; }
        .token.function { color: #d2a8ff !important; }
        .token.keyword { color: #ff7b72 !important; }
        .token.operator { color: #79c0ff !important; }
        .token.property { color: #79c0ff !important; }
        .token.punctuation { color: #c9d1d9 !important; }
        .token.variable { color: #ffa657 !important; }
        
        /* Improve table scrollbar */
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
        
        /* Typing cursor animation */
        .typing-cursor {
          display: inline-block;
          width: 2px;
          height: 1.2em;
          background-color: currentColor;
          margin-left: 2px;
          animation: blink 1s step-end infinite;
          vertical-align: text-bottom;
        }

        @keyframes blink {
          from, to { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}