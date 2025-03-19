import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

export default function CodeBlock({ language = '', value = '', inline = false }) {
  const [copied, setCopied] = useState(false);
  
  const copyCode = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  if (inline) {
    return (
      <code className="bg-gray-800/50 px-1.5 py-0.5 rounded text-primary-300 font-mono text-sm">
        {value}
      </code>
    );
  }
  
  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-gray-700/50 shadow-lg">
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2">
        <span className="text-xs font-mono text-gray-400 uppercase">{language}</span>
        <button
          onClick={copyCode}
          className="text-xs text-gray-400 hover:text-primary-400 flex items-center"
        >
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '1rem',
          backgroundColor: '#1e1e1e',
          borderRadius: 0,
          fontSize: '0.9rem',
        }}
        showLineNumbers={false}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
} 