import { useEffect, useRef } from 'react';

export default function ResponseColumn({ model, response, streaming }) {
  const contentRef = useRef(null);

  // Auto-scroll to the bottom of content when it updates
  useEffect(() => {
    if (contentRef.current && streaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [response?.text, streaming]);

  const copyToClipboard = () => {
    if (response?.text) {
      navigator.clipboard.writeText(response.text);
      // Use a more subtle notification
      const notificationEl = document.createElement('div');
      notificationEl.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg transition-opacity duration-300 z-50';
      notificationEl.textContent = `Copied ${model}'s response`;
      document.body.appendChild(notificationEl);
      
      setTimeout(() => {
        notificationEl.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(notificationEl);
        }, 300);
      }, 2000);
    }
  };

  return (
    <div className="bg-white dark:bg-darksurface border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col h-full shadow-soft dark:shadow-soft-dark transition-all duration-200">
      <div className="px-4 py-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-primary-500"></div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{model}</h3>
        </div>
        {response?.text && (
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
        {response?.loading && !response?.text ? (
          <div className="flex justify-center items-center h-full">
            <div className="dot-typing"></div>
          </div>
        ) : response?.error ? (
          <div className="text-red-500 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/30">
            <p className="font-medium">Error encountered:</p>
            <p className="mt-1">{response.error}</p>
          </div>
        ) : response?.text ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {response.text}
              {streaming && (
                <span className="typing-cursor">|</span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-gray-400 dark:text-gray-500 italic flex items-center justify-center h-full">
            Waiting for prompt...
          </div>
        )}
      </div>
    </div>
  );
} 