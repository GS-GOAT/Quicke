import { useState, useRef, useEffect } from 'react';

export default function PromptInput({ prompt, setPrompt, onSubmit, onClear, disabled, isProcessing }) {  // Add isProcessing prop
  const textareaRef = useRef(null);
  
  // Auto-resize the textarea as the user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);
  
  // Handle Enter key to submit
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative transition-all duration-200 rounded-xl shadow-soft dark:shadow-soft-dark border border-gray-200 dark:border-gray-700 bg-white dark:bg-darksurface prompt-input-hover">
      <textarea
        ref={textareaRef}
        className={`w-full py-4 px-4 pr-16 text-gray-900 dark:text-gray-100 rounded-xl resize-none bg-transparent focus:outline-none ${
          isProcessing ? 'opacity-70' : ''
        }`}
        rows="1"
        placeholder={isProcessing ? "Wait for current response to complete..." : "Ask the models anything..."}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}  // Remove isProcessing from here
        style={{ maxHeight: '200px', minHeight: '56px' }}
      />
      
      <div className="absolute right-3 bottom-3 flex space-x-2">
        {prompt && (
          <button
            onClick={() => setPrompt('')}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Clear input"
            disabled={isProcessing}  // Add this
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        <button
          onClick={onSubmit}
          disabled={disabled || !prompt.trim() || isProcessing}  // Add isProcessing here
          className={`p-2 rounded-full transition-all duration-200 ${
            disabled || !prompt.trim() || isProcessing
              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed bg-gray-100 dark:bg-gray-800' 
              : 'text-white bg-primary-600 hover:bg-primary-700 shadow-md'
          } focus:outline-none`}
          title={isProcessing ? "Wait for current response to complete" : "Send message"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}