import { useEffect, useRef, useState } from 'react';

// Model display names mapping
const modelDisplayNames = {
  'gpt-4': 'GPT-4',
  'claude': 'Claude 3 Sonnet',
  'gemini': 'Gemini Pro',
  'mistral-medium': 'Mistral Medium',
  'mixtral': 'Mixtral 8x7B',
  'llama2-70b': 'Llama-2 70B',
  'solar': 'Solar 70B',
  'phi2': 'Phi-2',
  'qwen': 'Qwen 72B',
  'openchat': 'OpenChat 3.5'
};

export default function ResponseColumn({ model, response, streaming }) {
  const contentRef = useRef(null);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const lastResponseRef = useRef('');
  const processingTimeoutRef = useRef(null);

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

  // Reset displayed text when response changes completely
  useEffect(() => {
    // If response is undefined or null, initialize with defaults
    if (!response) {
      setDisplayedText('');
      lastResponseRef.current = '';
      return;
    }

    // If it's a completely new response, reset the display
    if (response.text !== undefined && !response.text.startsWith(lastResponseRef.current)) {
      setDisplayedText('');
      lastResponseRef.current = '';
    }

    // Process text only if it exists and has changed
    if (response.text !== undefined && response.text !== lastResponseRef.current) {
      const newText = response.text.slice(lastResponseRef.current.length);
      typeText(newText);
      lastResponseRef.current = response.text;
    }
  }, [response?.text]);

  const typeText = async (text) => {
    if (!text) return;
    
    setIsTyping(true);
    const words = text.split(/(\s+)/).filter(word => word.length > 0);
    
    for (let i = 0; i < words.length; i++) {
      if (!isTyping) break;
      
      await new Promise(resolve => {
        processingTimeoutRef.current = setTimeout(resolve, 30);
      });
      setDisplayedText(prev => prev + words[i]);
    }
    
    setIsTyping(false);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (contentRef.current && (streaming || isTyping)) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [displayedText, streaming, isTyping]);

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

  // Determine the current state
  const isLoading = response?.loading === true;
  const hasError = response?.error != null;
  const hasText = (displayedText && displayedText.length > 0) || 
                  (response?.text && response.text.length > 0);
  const waitingForPrompt = !isLoading && !hasError && !hasText;

  return (
    <div className="bg-white dark:bg-darksurface border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col h-full shadow-soft dark:shadow-soft-dark transition-all duration-200">
      <div className="px-4 py-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-primary-500"></div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{modelDisplayName}</h3>
          {isLoading && (
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              Loading...
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
        className="p-4 overflow-auto flex-grow scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent"
        style={{ minHeight: "200px", maxHeight: "600px" }}
      >
        {isLoading && !hasText ? (
          <div className="flex justify-center items-center h-full">
            <div className="dot-typing"></div>
          </div>
        ) : hasError ? (
          <div className="text-red-500 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/30">
            <p className="font-medium">Error encountered:</p>
            <p className="mt-1">{response.error}</p>
          </div>
        ) : hasText ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {displayedText || response.text}
              {(streaming || isTyping) && (
                <span className="typing-cursor">|</span>
              )}
            </div>
          </div>
        ) : waitingForPrompt ? (
          <div className="text-gray-400 dark:text-gray-500 italic flex items-center justify-center h-full">
            Waiting for prompt...
          </div>
        ) : null}
      </div>
    </div>
  );
} 