import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { ChunkRenderer } from '../utils/chunkRenderer';

export default function ResponseColumn({ model, response, streaming }) {
  const contentRef = useRef(null);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chunkRendererRef = useRef(null);
  const lastTextRef = useRef('');

  // Initialize chunk renderer
  useEffect(() => {
    chunkRendererRef.current = new ChunkRenderer({
      chunkSize: 150,
      typingSpeed: 25,
      maxTypingSpeed: 5,
      longResponseThreshold: 1000,
      onChunk: (text) => {
        setDisplayedText(text);
        setIsTyping(true);
      },
      onComplete: () => {
        setIsTyping(false);
      }
    });

    return () => {
      if (chunkRendererRef.current) {
        chunkRendererRef.current.reset();
      }
    };
  }, []);

  // Enhanced response handling
  useEffect(() => {
    if (!response) {
      setDisplayedText('');
      if (chunkRendererRef.current) {
        chunkRendererRef.current.reset();
      }
      return;
    }

    const newText = response.text || '';
    const isNewResponse = !response.loading && !streaming;
    
    if (chunkRendererRef.current) {
      chunkRendererRef.current.addText(newText, isNewResponse);
    }
  }, [response?.text, streaming, response?.loading]);

  // Immediate rendering fallback for non-streaming responses
  useEffect(() => {
    if (response?.text && !streaming && !response.loading) {
      setDisplayedText(response.text);
      setIsTyping(false);
    }
  }, [response?.text, streaming, response?.loading]);

  // Auto-scroll to follow new content
  useEffect(() => {
    if (contentRef.current && (streaming || isTyping)) {
      const element = contentRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [displayedText, streaming, isTyping]);

  const copyToClipboard = () => {
    if (response?.text) {
      navigator.clipboard.writeText(response.text);
      alert(`Copied ${model}'s response to clipboard!`);
    }
  };

  return (
    <div className="bg-white dark:bg-darksurface border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col h-full shadow-soft dark:shadow-soft-dark">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h3 className="text-lg leading-6 font-medium text-gray-900">{model}</h3>
        {response?.text && (
          <button
            onClick={copyToClipboard}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            Copy
          </button>
        )}
      </div>
      <div 
        ref={contentRef}
        className="p-4 overflow-auto flex-grow scrollbar-thin"
        style={{ minHeight: "200px", maxHeight: "600px" }}
      >
        {response?.loading && !displayedText ? (
          <div className="flex justify-center items-center h-full">
            <div className="dot-typing"></div>
          </div>
        ) : response?.error ? (
          <div className="text-red-500 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="font-medium">Error:</p>
            <p className="mt-1">{response.error}</p>
          </div>
        ) : displayedText ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                code: CodeBlock,
                a: ({node, ...props}) => (
                  <a target="_blank" rel="noopener noreferrer" {...props} />
                ),
              }}
            >
              {displayedText}
            </ReactMarkdown>
            {(streaming || isTyping) && (
              <span className="typing-cursor">▋</span>
            )}
          </div>
        ) : (
          <div className="text-gray-400 dark:text-gray-500 italic flex items-center justify-center h-full">
            Waiting for response...
          </div>
        )}
      </div>
    </div>
  );
}

// ...rest of existing code for CodeBlock etc...