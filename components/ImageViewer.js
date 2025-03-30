import { useState } from 'react';

export default function ImageViewer({ fileId, imageUrl, fileName = 'Image' }) {
  const [isLoading, setIsLoading] = useState(!imageUrl);
  const [error, setError] = useState('');

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setError('Failed to load image');
  };

  return (
    <div className="image-viewer border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
          <span className="font-medium text-gray-900 dark:text-gray-100">{fileName}</span>
        </div>
      </div>
      
      <div className="relative overflow-auto bg-gray-50 dark:bg-gray-900 flex justify-center p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 w-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 flex items-center justify-center h-64 w-full">{error}</div>
        ) : (
          <img 
            src={imageUrl || `/api/files/${fileId}`} 
            alt="Uploaded image"
            className="max-w-full max-h-[400px] object-contain"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
      </div>
    </div>
  );
}
