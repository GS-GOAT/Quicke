import { useState, useRef } from 'react';

export default function FileUpload({ onUploadComplete, threadId, conversationId }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Update file type check to include images
    const acceptedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];

    // Validate all files and calculate total size
    let totalSize = 0;
    const validFiles = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!acceptedTypes.includes(file.type)) {
        setError('Only PDF and image files (JPEG, PNG, WebP) are allowed');
        return;
      }
      
      totalSize += file.size;
      validFiles.push(file);
    }

    if (totalSize > 25 * 1024 * 1024) {
      setError('Total file size exceeds 25MB limit');
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      const formData = new FormData();
      
      // Append all files with indexed keys
      validFiles.forEach((file, index) => {
        formData.append(`file-${index}`, file);
      });
      
      if (threadId) formData.append('threadId', threadId);
      if (conversationId) formData.append('conversationId', conversationId);

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            setIsUploading(false);
            setUploadProgress(100);
            onUploadComplete?.(response.files);
            if (fileInputRef.current) fileInputRef.current.value = '';
          } else {
            setError(response.error || 'Upload failed');
            setIsUploading(false);
          }
        } else {
          setError('Upload failed with status ' + xhr.status);
          setIsUploading(false);
        }
      });

      xhr.addEventListener('error', () => {
        setError('Network error occurred during upload');
        setIsUploading(false);
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Upload failed: ' + (err.message || 'Unknown error'));
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileChange}
        multiple
      />
      
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900"
      >
        {isUploading ? (
          <span>Uploading ({uploadProgress}%)</span>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Files
          </>
        )}
      </button>

      {isUploading && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-2">
          <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
