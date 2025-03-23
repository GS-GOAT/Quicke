import { useState, useRef, useEffect } from 'react';
import FileUpload from './FileUpload';

export default function PromptInput({ prompt, setPrompt, onSubmit, onClear, disabled, isProcessing, threadId }) {
  const textareaRef = useRef(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [pdfContext, setPdfContext] = useState('');
  const [isPdfProcessing, setIsPdfProcessing] = useState(false);
  const [persistentFile, setPersistentFile] = useState(null);
  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleUploadComplete = async (file) => {
    setUploadedFile(file);
    setPersistentFile(file); // Keep persistent reference
    setIsPdfProcessing(true);
    
    try {
      const response = await fetch(`/api/extract-pdf?fileId=${file.id}`);
      if (!response.ok) throw new Error('Failed to extract PDF content');
      
      const data = await response.json();
      setPdfContext(data.text || '');
      
      if (!prompt.trim()) {
        setPrompt("I've uploaded a PDF document. Please analyze its contents.");
      }
    } catch (err) {
      console.error('Error extracting PDF:', err);
      alert('Error processing PDF. Please try again.');
      setUploadedFile(null);
      setPersistentFile(null);
    } finally {
      setIsPdfProcessing(false);
    }
  };

  const handleTextExtracted = (text) => {
    setPdfContext(text);
    if (!prompt.trim()) {
      setPrompt("I've uploaded a PDF document. Please analyze its contents.");
    }
  };

  const handleSubmit = () => {
    if (disabled || !prompt.trim() || isProcessing) return;
    if (uploadedFile?.fileType === 'application/pdf' && isPdfProcessing) {
      alert('Please wait for PDF processing to complete');
      return;
    }
    
    const contextData = {
      prompt,
      fileId: persistentFile?.id || null,
      fileName: persistentFile?.name || null,
      pdfContext
    };
    
    onSubmit(contextData);
  };

  return (
    <div className="space-y-4">
      {showFileUpload && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <FileUpload 
            onUploadComplete={handleUploadComplete} 
            threadId={threadId}
          />
        </div>
      )}
      
      <div className="relative rounded-xl shadow-soft dark:shadow-soft-dark border border-gray-200 dark:border-gray-700 bg-white dark:bg-darksurface prompt-input-hover">
        {/* Show file chip for both processing and processed states */}
        {(uploadedFile || persistentFile) && (
          <div className="absolute top-2 left-2 flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 text-sm px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            
            <span className="truncate max-w-[150px]">{(uploadedFile || persistentFile).name}</span>
            
            {isPdfProcessing && (
              <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" />
            )}
            
            <button 
              onClick={() => {
                setUploadedFile(null);
                setPersistentFile(null);
                setPdfContext('');
              }}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 111.414 1.414L11.414 10l4.293 4.293a1 1 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 01-1.414-1.414L8.586 10 4.293 5.707a1 1 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className={`w-full py-4 px-4 pr-16 text-gray-900 dark:text-gray-100 rounded-xl resize-none bg-transparent focus:outline-none ${
            isProcessing ? 'opacity-70' : ''
          }`}
          rows="1"
          placeholder={isProcessing ? "Wait for current response to complete..." : "Ask about your PDF or any question..."}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isProcessing}
          style={{ maxHeight: '200px', minHeight: '56px' }}
        />
        
        <div className="absolute right-3 bottom-3 flex space-x-2">
          <button
            onClick={() => setShowFileUpload(!showFileUpload)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Upload PDF"
            disabled={isProcessing}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </button>

          {prompt && (
            <button
              onClick={() => setPrompt('')}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Clear input"
              disabled={isProcessing}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          
          <button
            onClick={handleSubmit}
            disabled={disabled || !prompt.trim() || isProcessing || isPdfProcessing}
            className={`p-2 rounded-full transition-all duration-200 ${
              disabled || !prompt.trim() || isProcessing || isPdfProcessing
                ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed bg-gray-100 dark:bg-gray-800' 
                : 'text-white bg-primary-600 hover:bg-primary-700 shadow-md'
            } focus:outline-none`}
            title={isPdfProcessing ? "Processing PDF..." : isProcessing ? "Wait for current response to complete" : "Send message"}
          >
            {isPdfProcessing ? (
              <div className="animate-spin h-5 w-5 border-2 border-gray-500 border-t-transparent rounded-full" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}