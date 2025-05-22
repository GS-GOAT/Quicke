import { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';

export default function PromptInput({ 
  prompt, 
  setPrompt, 
  onSubmit, 
  disabled, 
  isProcessing,
  preserveOnFocus = true,
  threadId,
  onStopStreaming = () => {},
  selectedModels,
  isGuest = false,
  onTriggerLoginPrompt = () => {}
}) {
  const textareaRef = useRef(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [pdfContext, setPdfContext] = useState('');
  const [isPdfProcessing, setIsPdfProcessing] = useState(false);
  const [persistentFiles, setPersistentFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showUploadTooltip, setShowUploadTooltip] = useState(false);
  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // Only trigger submit if we're not currently processing
      // This prevents Enter from triggering the stop functionality
      if (!isProcessing) {
        handleSubmit();
      }
    }
  };

  const handleUploadComplete = async (files) => {
    // Ensure files is always an array
    const filesArray = Array.isArray(files) ? files : files ? [files] : [];
    
    if (filesArray.length === 0) {
      console.error('No files received in handleUploadComplete');
      return;
    }
    
    // Append new files to existing ones instead of replacing
    setUploadedFiles(prevFiles => [...prevFiles, ...filesArray]);
    setPersistentFiles(prevFiles => [...prevFiles, ...filesArray]);
    
    // Check if any PDF files need processing
    const pdfFiles = filesArray.filter(file => file.isPdf || file.type === 'application/pdf');
    
    if (pdfFiles.length > 0) {
      setIsPdfProcessing(true);
      
      try {
        // Process the first PDF file found
        const pdfFile = pdfFiles[0];
        const response = await fetch(`/api/extract-pdf?fileId=${pdfFile.id}`);
        
        if (!response.ok) {
          throw new Error('Failed to extract PDF content');
        }
        
        const data = await response.json();
        setPdfContext(data.text || '');
      } catch (err) {
        console.error('Error extracting PDF:', err);
        alert('Error processing PDF. Please try again.');
        
        // Only remove the PDF files that failed, not all files
        const failedFileIds = pdfFiles.map(file => file.id);
        setUploadedFiles(prevFiles => prevFiles.filter(file => !failedFileIds.includes(file.id)));
        setPersistentFiles(prevFiles => prevFiles.filter(file => !failedFileIds.includes(file.id)));
      } finally {
        setIsPdfProcessing(false);
      }
    } else {
      // No PDFs to process
      setIsPdfProcessing(false);
    }
  };

  const handleTextExtracted = (text) => {
    setPdfContext(text);
  };

  const handleSubmit = () => {
    // If disabled (except when processing), don't proceed
    if (disabled && !isProcessing) {
      // If it's a guest and they are disabled (likely quota), trigger the prompt
      if (isGuest) {
        onTriggerLoginPrompt("Your free trial limit is reached. Please sign up or log in to continue.");
      }
      return;
    }
    
    // If currently streaming, we need to stop it first
    if (isProcessing) {
      onStopStreaming();
      return;
    }
    
    // Check if prompt is valid before proceeding
    if (!prompt || !prompt.trim()) return;
    
    if (!isGuest && isPdfProcessing) {
      toast.error('Please wait for file processing to complete');
      return;
    }
    
    // Prepare the context data with the file information
    const contextData = {
      prompt,
      // Only include file info for non-guests
      ...(!isGuest && {
        files: persistentFiles.map(file => ({
          id: file.id,
          name: file.name,
          type: file.type,
          documentType: file.documentType
        })),
        fileIds: persistentFiles.map(file => file.id) || [],
        fileNames: persistentFiles.map(file => file.name) || [],
        pdfContext
      })
    };
    
    // Submit the message with the context data
    onSubmit(contextData);
    
    // Clear both the displayed file and the persistent reference after submission
    if (!isGuest) {
      setUploadedFiles([]);
      setPersistentFiles([]);
      setPdfContext('');
    }
  };

  const handleFileInputClick = () => {
    if (isGuest) {
      // For guests, show tooltip instead of opening file dialog
      setShowUploadTooltip(true);
      return;
    }

    // For logged-in users, proceed if not disabled for other reasons
    if ((disabled && !isProcessing) || isProcessing || isPdfProcessing) return;

    // Use the ref to trigger the hidden file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // direct handler for the stop button to ensure it works
  const handleStopClick = (e) => {
    e.preventDefault(); // Prevent any default behavior
    e.stopPropagation(); // Stop event propagation
    onStopStreaming(); // Call the stop streaming function - removed debug log
  };

  // Setup global drag and drop handling
  useEffect(() => {
    // Setup document-wide drag and drop handlers
    const handleDocDragEnter = (e) => {
      if (!isGuest) {
        e.preventDefault();
        setIsDragging(true);
      }
    };

    const handleDocDragOver = (e) => {
      if (!isGuest) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }
    };

    const handleDocDragLeave = (e) => {
      if (!isGuest) {
        e.preventDefault();
        e.stopPropagation();
        if (!e.relatedTarget || e.relatedTarget.nodeName === 'HTML') {
          setIsDragging(false);
        }
      }
    };

    const handleDocDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (isGuest) {
        onTriggerLoginPrompt("Please sign up or log in to upload files.");
        return;
      }

      setIsDragging(false);
      
      if (isPdfProcessing) return;
      
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFiles(Array.from(files));
      }
    };

    // document-level event listeners
    document.addEventListener('dragenter', handleDocDragEnter);
    document.addEventListener('dragover', handleDocDragOver);
    document.addEventListener('dragleave', handleDocDragLeave);
    document.addEventListener('drop', handleDocDrop);

    // Cleanup listeners on unmount
    return () => {
      document.removeEventListener('dragenter', handleDocDragEnter);
      document.removeEventListener('dragover', handleDocDragOver);
      document.removeEventListener('dragleave', handleDocDragLeave);
      document.removeEventListener('drop', handleDocDrop);
    };
  }, [isGuest, isPdfProcessing, onTriggerLoginPrompt]);

  // Process single file compatibility wrapper
  const processFile = (file) => {
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
    
    if (file.size > 25 * 1024 * 1024) {
      alert('File size exceeds 25MB limit');
      return;
    }
    
    setIsPdfProcessing(true);

    const formData = new FormData();
    formData.append('file', file);
    
    if (threadId) formData.append('threadId', threadId);

    fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (!response.ok) throw new Error('Upload failed');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          // Handle response with either file or files property
          const files = data.files || (data.file ? [data.file] : []);
          handleUploadComplete(files);
          
          // Set appropriate prompt message based on file type
          let promptMessage = '';
          const fileData = data.file || (data.files && data.files[0]);
          
          if (fileData) {
            if (fileData.isPdf) {
              promptMessage = "I've uploaded a PDF document. Please analyze its content and provide a summary.";
            } else if (fileData.isText) {
              promptMessage = "I've uploaded a text file. Please analyze its content and help me understand the main points.";
            } else if (fileData.isPpt) {
              promptMessage = "I've uploaded a PowerPoint presentation. Please help me understand its structure and key messages.";
            } else if (fileData.type?.startsWith('image/')) {
              promptMessage = "I've uploaded an image. Please analyze what's shown in this image.";
            }
            
            setPrompt(promptMessage);
          }
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      })
      .catch(err => {
        console.error('Upload error:', err);
        alert('Failed to upload file: ' + (err.message || 'Unknown error'));
      })
      .finally(() => {
        setIsPdfProcessing(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });
  };

  // Function to process multiple files
  const processFiles = (files) => {
    if (!files || files.length === 0) return;

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

    // Filter only valid files
    const validFiles = files.filter(file => acceptedTypes.includes(file.type));
    
    if (validFiles.length === 0) {
      alert('Only PDF, text, PowerPoint, and image files are allowed');
      return;
    }
    
    // Calculate size of new files
    const newFilesSize = validFiles.reduce((sum, file) => sum + file.size, 0);
    
    // Check if any individual file exceeds the limit
    if (validFiles.some(file => file.size > 25 * 1024 * 1024)) {
      alert('One or more files exceed the 25MB size limit');
      return;
    }
    
    // If it's a single file, use the traditional method for better compatibility
    if (validFiles.length === 1) {
      processFile(validFiles[0]);
      return;
    }
    
    setIsPdfProcessing(true);

    const formData = new FormData();
    
    // Append all files with indexed keys
    validFiles.forEach((file, index) => {
      formData.append(`file-${index}`, file);
    });
    
    if (threadId) formData.append('threadId', threadId);

    fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
      .then(response => {
        if (!response.ok) throw new Error('Upload failed');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          // Handle response with either file or files property
          const files = data.files || (data.file ? [data.file] : []);
          handleUploadComplete(files);
          
          // Set appropriate prompt message based on file types
          const fileTypes = {
            pdf: files.some(f => f.isPdf),
            text: files.some(f => f.isText),
            ppt: files.some(f => f.isPpt),
            image: files.some(f => f.isImage || f.type?.startsWith('image/'))
          };
          
          let promptMessage = "I've uploaded ";
          
          if (files.length === 1) {
            // Single file message
            if (fileTypes.pdf) {
              promptMessage += "a PDF document. Please analyze its content and provide a summary.";
            } else if (fileTypes.text) {
              promptMessage += "a text file. Please analyze its content and help me understand the main points.";
            } else if (fileTypes.ppt) {
              promptMessage += "a PowerPoint presentation. Please help me understand its structure and key messages.";
            } else if (fileTypes.image) {
              promptMessage += "an image. Please analyze what's shown in this image.";
            }
          } else {
            // Multiple files message
            promptMessage += `${files.length} files. Please analyze their content.`;
          }
          
          // If there are already other files, modify the message
          if (persistentFiles.length > files.length) {
            promptMessage = `I've added ${files.length} more file(s). Please analyze all attached files.`;
          }
          
          setPrompt(promptMessage);
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      })
      .catch(err => {
        console.error('Upload error:', err);
        alert('Failed to upload files: ' + (err.message || 'Unknown error'));
      })
      .finally(() => {
        setIsPdfProcessing(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });
  };

  // Update the file change handler to use the new processFiles function
  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(Array.from(files));
    }
  };

  // Update the effect for global keyboard shortcuts
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

  // Handle clipboard paste
  const handlePaste = async (e) => {
    if (isGuest) {
      const items = e.clipboardData?.items;
      if (items && Array.from(items).some(item => item.kind === 'file')) {
        e.preventDefault();
        onTriggerLoginPrompt("Please sign up or log in to paste files.");
        return;
      }
      // Allow text paste for guests
      return;
    }

    try {
      const clipboardData = e.clipboardData;
      const hasFiles = clipboardData.files && clipboardData.files.length > 0;
      
      if (hasFiles) {
        e.preventDefault();
        const files = Array.from(clipboardData.files);
        const processedFiles = files.map(file => {
          if (file.type.startsWith('image/')) {
            const fileExtension = file.name.split('.').pop() || 'png';
            const newFileName = `screenshot_${Date.now()}.${fileExtension}`;
            return new File([file], newFileName, { type: file.type });
          }
          return file;
        });
        processFiles(processedFiles);
      }
    } catch (error) {
      console.error("Error handling paste:", error);
      toast.error("Error processing pasted content.");
    }
  };
  
  // effect for clearing file references on thread change
  useEffect(() => {
    const handleClearFileReferences = () => {
      console.log('Clearing file references');
      setUploadedFiles([]);
      setPersistentFiles([]);
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
      {!isGuest && uploadedFiles.length > 0 && (
        <div className="relative mb-2 bg-gray-50/80 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-3">
          {uploadedFiles.length > 1 && (
            <div className="absolute -top-2 -right-2 bg-primary-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {uploadedFiles.length}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="relative inline-block bg-white dark:bg-gray-700/80 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm max-w-[280px]">
                <button 
                  onClick={() => {
                    const newFiles = [...uploadedFiles];
                    newFiles.splice(index, 1);
                    setUploadedFiles(newFiles);
                    setPersistentFiles(newFiles);
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full transition-colors"
                  aria-label="Remove file"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                
                <div className="flex items-center space-x-2">
                  {/* File type icon */}
                  {file.type?.startsWith('image/') && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  )}
                  {file.type === 'application/pdf' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {file.type === 'text/plain' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm8 8v2h1v1H4v-1h1v-2H4v-1h16v1h-1z" clipRule="evenodd" />
                    </svg>
                  )}
                  {(file.type === 'application/vnd.ms-powerpoint' || 
                    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span 
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px] inline-block"
                    title={file.name} // Show full filename on hover
                  >
                    {file.name}
                  </span>
                  {isPdfProcessing && (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-3 w-3 border-2 border-primary-500 border-t-transparent rounded-full" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">Processing...</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global drop zone indicator */}
      {!isGuest && isDragging && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border-2 border-dashed border-primary-500 shadow-xl">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">Drop files here</p>
            </div>
          </div>
        </div>
      )}

      <div 
        className="relative rounded-xl shadow-sm transition-all duration-200
          hover:shadow-md dark:hover:shadow-inner"
      >
        <div className="relative border rounded-xl bg-white dark:bg-darksurface
          transition-colors duration-200 border-gray-200 dark:border-gray-700 hover:border-primary-500/50 dark:hover:border-primary-500/50"
        >
          {/* Input area */}
          <div className="relative flex items-start">
            <textarea
              ref={textareaRef}
              className={`w-full py-4 px-4 pr-24 text-gray-900 dark:text-gray-100 
                rounded-xl resize-none bg-transparent focus:outline-none min-h-[56px]
                transition-opacity duration-200`}
              placeholder={isProcessing ? "Type to compose a new message..." : "Send a message..."}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled || isProcessing}
              style={{ maxHeight: '200px' }}
              onFocus={() => {
                if (!preserveOnFocus && !isProcessing) {
                  setPrompt('');
                }
              }}
              onCut={(e) => e.stopPropagation()}
              onCopy={(e) => e.stopPropagation()}
              onPaste={handlePaste}
            />
            
            {/* Action buttons */}
            <div className="absolute right-3 bottom-3 flex items-center space-x-2">
              {/* Upload Button with tooltip */}
              <div className="relative">
                <button
                  onClick={handleFileInputClick}
                  onMouseEnter={() => isGuest && setShowUploadTooltip(true)}
                  onMouseLeave={() => isGuest && setShowUploadTooltip(false)}
                  className={`p-1.5 rounded-full transition-colors ${
                    isGuest
                      ? 'text-gray-500 dark:text-gray-600 cursor-default'
                      : uploadedFiles.length > 0
                        ? 'text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  } ${!isGuest && (isPdfProcessing || (disabled && !isProcessing) || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isGuest ? "Login to attach files" : (isPdfProcessing ? "Processing file..." : uploadedFiles.length > 0 ? `${uploadedFiles.length} file(s) attached` : "Attach files")}
                  disabled={!isGuest && (isPdfProcessing || (disabled && !isProcessing) || isProcessing)}
                >
                  {uploadedFiles.length > 0 && !isGuest ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  )}
                </button>
                {isGuest && showUploadTooltip && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded-md shadow-lg whitespace-nowrap z-10">
                    Please login to attach files
                  </div>
                )}
              </div>
              
              {/* Clear button */}
              {prompt && !isProcessing && (
                <button
                  onClick={() => setPrompt('')}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="Clear input"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              
              {/* Conditionally render different buttons based on state */}
              {isPdfProcessing ? (
                <button
                  disabled
                  className="p-2 rounded-full text-gray-400 dark:text-gray-600 cursor-not-allowed bg-gray-100 dark:bg-gray-800"
                  title="Processing file..."
                >
                  <div className="animate-spin h-5 w-5 border-2 border-gray-500 border-t-transparent rounded-full" />
                </button>
              ) : isProcessing ? (
                <button
                  onClick={handleStopClick}
                  className="p-2 rounded-full text-white bg-red-600 hover:bg-red-700 shadow-md hover:shadow-lg"
                  title="Stop generating"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={disabled || !prompt.trim() || (!isGuest && selectedModels && selectedModels.length === 0)}
                  className={`p-2 rounded-full transition-all duration-200 ${
                    (disabled || !prompt.trim() || (!isGuest && selectedModels && selectedModels.length === 0))
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
                      : 'text-white bg-primary-600 hover:bg-primary-700 shadow-md hover:shadow-lg'
                  }`}
                  title="Send message"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      {!isGuest && (
        <input
          type="file"
          className="hidden"
          accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp,text/plain,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={handleFileChange}
          ref={fileInputRef}
          multiple
        />
      )}
    </div>
  );
}