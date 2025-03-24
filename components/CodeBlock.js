import { useState, useRef } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/cjs/styles/hljs';

const CodeBlock = ({ language, children }) => {
  const [copyText, setCopyText] = useState('Copy');
  const timeoutRef = useRef(null);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopyText('Copied!');
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set a new timeout to revert the button text after 2 seconds
    timeoutRef.current = setTimeout(() => {
      setCopyText('Copy');
    }, 2000);
  };
  
  return (
    <div className="relative">
      <div className="absolute right-2 top-2">
        <button
          onClick={handleCopy}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          style={{ width: '50px', textAlign: 'center' }}
        >
          {copyText}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'javascript'}
        style={atomOneDark}
        className="rounded-md"
        customStyle={{
          padding: '1rem',
          paddingTop: '2rem',
          backgroundColor: '#1e1e1e',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;