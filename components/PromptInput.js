import { useState, useRef, useEffect } from 'react';

export default function PromptInput({ 
  prompt, 
  setPrompt, 
  onSubmit, 
  disabled, 
  isProcessing,
  preserveOnFocus = true,
  threadId,
  onStopStreaming = () => {}
}) {
  const textareaRef = useRef(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [pdfContext, setPdfContext] = useState('');
  const [isPdfProcessing, setIsPdfProcessing] = useState(false);
  const [persistentFile, setPersistentFile] = useState(null);
  const fileInputRef = useRef(null);
  
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
  };

  const handleSubmit = () => {
    if (disabled || !prompt.trim()) return;
    
    // If currently streaming, we need to stop it first
    if (isProcessing) {
      onStopStreaming();
      return;
    }
    
    if (uploadedFile?.fileType === 'application/pdf' && isPdfProcessing) {
      alert('Please wait for PDF processing to complete');
      return;
    }
    
    // Prepare the context data with the file information
    const contextData = {
      prompt,
      fileId: persistentFile?.id || null,
      fileName: persistentFile?.name || null,
      pdfContext
    };
    
    // Submit the message with the context data
    onSubmit(contextData);
    
    // Clear both the displayed file and the persistent reference after submission
    // This follows industry practice where files are only attached to the message they're sent with
    setUploadedFile(null);
    setPersistentFile(null);
    setPdfContext('');
  };

  const handleFileInputClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/jpeg,image/jpg,image/png,image/webp,text/plain,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
    input.onchange = (e) => handleFileChange(e);
    input.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const acceptedTypes = [
      'application/pdf', 
      'image/jpeg', 
      'image/jpg',
      'image/png', 
      'image/webp',
      'text/plain',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
  
    if (!acceptedTypes.includes(file.type)) {
      alert('Only PDF, text, PowerPoint, and image files are allowed');
      return;
    }
  
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit');
      return;
    }
  
    setIsPdfProcessing(true);
  
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (threadId) formData.append('threadId', threadId);
  
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      if (data.success) {
        handleUploadComplete(data.file);
        
        // Set appropriate prompt message based on file type
        let promptMessage = '';
        if (data.file.isPdf) {
          promptMessage = "I've uploaded a PDF document. Please analyze its content and provide a summary.";
        } else if (data.file.isText) {
          promptMessage = "I've uploaded a text file. Please analyze its content and help me understand the main points.";
        } else if (data.file.isPpt) {
          promptMessage = "I've uploaded a PowerPoint presentation. Please help me understand its structure and key messages.";
        } else if (data.file.type?.startsWith('image/')) {
          promptMessage = "I've uploaded an image. Please analyze what's shown in this image.";
        }
        
        setPrompt(promptMessage);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload file: ' + (err.message || 'Unknown error'));
      setUploadedFile(null);
      setPersistentFile(null);
    } finally {
      setIsPdfProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Add effect for global keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ignore if target is already an input/textarea or modal/dialog
      if (e.target.tagName === 'INPUT' || 
          e.target.tagName === 'TEXTAREA' || 
          e.target.isContentEditable ||
          e.target.closest('[role="dialog"]')) {
        return;
      }

      // Focus textarea on any printable character
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        textareaRef.current?.focus();
        
        // Always include the pressed key in the prompt
        setPrompt(prev => prev + e.key);
      }
    };

    document.addEventListener('keypress', handleKeyPress);
    return () => document.removeEventListener('keypress', handleKeyPress);
  }, [setPrompt]);

  // Add effect for clearing file references on thread change
  useEffect(() => {
    const handleClearFileReferences = () => {
      console.log('Clearing file references');
      setUploadedFile(null);
      setPersistentFile(null);
      setPdfContext('');
    };

    window.addEventListener('clearFileReferences', handleClearFileReferences);
    return () => {
      window.removeEventListener('clearFileReferences', handleClearFileReferences);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* File attachment display area (shown above the prompt area) */}
      {uploadedFile && (
        <div className="relative mb-2 bg-gray-50/80 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-3">
          {/* File attachment clip */}
          <div className="relative inline-block mr-2 mb-2 bg-white dark:bg-gray-700/80 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm max-w-[280px]">
            {/* Close button at the top right */}
            <button 
              onClick={() => {
                setUploadedFile(null);
                setPersistentFile(null);
                setPdfContext('');
              }}
              className="absolute -top-2 -right-2 p-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full transition-colors"
              aria-label="Remove file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414-1.414 0l-4.293-4.293-4.293 4.293a1 1 01-1.414-1.414L8.586 10 4.293 5.707a1 1 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            <div className="flex items-center space-x-2">
              {/* File type icon */}
              {uploadedFile.type?.startsWith('image/') && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              )}
              {uploadedFile.type === 'application/pdf' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              )}
              {uploadedFile.type === 'text/plain' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm8 8v2h1v1H4v-1h1v-2H4v-1h16v1h-1z" clipRule="evenodd" />
                </svg>
              )}
              {(uploadedFile.type === 'application/vnd.ms-powerpoint' || 
                uploadedFile.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              )}
              <span 
                className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px] inline-block"
                title={uploadedFile.name} // Show full filename on hover
              >
                {uploadedFile.name}
              </span>
              {isPdfProcessing && (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin h-3 w-3 border-2 border-primary-500 border-t-transparent rounded-full" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Processing...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`relative rounded-xl shadow-sm transition-all duration-200
        ${disabled 
          ? 'opacity-50' 
          : 'hover:shadow-md dark:hover:shadow-inner'}`}
      >
        <div className={`relative border rounded-xl bg-white dark:bg-darksurface
          transition-colors duration-200
          ${disabled
            ? 'border-gray-200 dark:border-gray-700'
            : 'border-gray-200 dark:border-gray-700 hover:border-primary-500/50 dark:hover:border-primary-500/50'
          }`}
        >
          {/* Input area */}
          <div className="relative flex items-start">
            <textarea
              ref={textareaRef}
              className={`w-full py-4 px-4 pr-24 text-gray-900 dark:text-gray-100 
                rounded-xl resize-none bg-transparent focus:outline-none min-h-[56px]
                transition-opacity duration-200
                ${disabled ? 'opacity-70' : ''}`}
              placeholder={isProcessing ? "Type to compose a new message..." : "Send a message..."}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              style={{ maxHeight: '200px' }}
              onFocus={() => {
                if (!preserveOnFocus) {
                  setPrompt('');
                }
              }}
            />
            
            {/* Action buttons */}
            <div className="absolute right-3 bottom-3 flex items-center space-x-2">
              <button
                onClick={handleFileInputClick}
                className="p-1.5 rounded-full transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Upload PDF and Images"
                disabled={disabled || isPdfProcessing}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
              
              {prompt && (
                <button
                  onClick={() => setPrompt('')}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="Clear input"
                  disabled={disabled}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              
              <button
                onClick={handleSubmit}
                disabled={disabled || (!prompt.trim() && !isProcessing) || isPdfProcessing}
                className={`p-2 rounded-full transition-all duration-200 ${
                  disabled || (!prompt.trim() && !isProcessing) || isPdfProcessing
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed bg-gray-100 dark:bg-gray-800' 
                    : isProcessing 
                      ? 'text-white bg-red-600 hover:bg-red-700 shadow-md hover:shadow-lg'
                      : 'text-white bg-primary-600 hover:bg-primary-700 shadow-md hover:shadow-lg'
                }`}
                title={
                  isPdfProcessing 
                    ? "Processing PDF..." 
                    : isProcessing 
                      ? "Stop generating" 
                      : "Send message"
                }
              >
                {isPdfProcessing ? (
                  <div className="animate-spin h-5 w-5 border-2 border-gray-500 border-t-transparent rounded-full" />
                ) : isProcessing ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        className="hidden"
        accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp,text/plain,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        onChange={handleFileChange}
        ref={fileInputRef}
      />
    </div>
  );
}