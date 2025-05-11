import { useState, useEffect } from 'react';

export default function PDFViewer({ fileId, onTextExtracted }) {
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!fileId) return;

    async function fetchFileInfo() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/extract-pdf?fileId=${fileId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch file information');
        }
        
        const data = await response.json();
        setFileName(data.info?.metadata?.Title || 'PDF Document');
        onTextExtracted?.(data.text);
      } catch (err) {
        console.error('Error fetching file information:', err);
        setError('Failed to fetch file information');
      } finally {
        setIsLoading(false);
      }
    }

    fetchFileInfo();
  }, [fileId, onTextExtracted]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-16">
      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-600"></div>
    </div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="pdf-viewer border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
        <span className="font-medium text-gray-900 dark:text-gray-100">{fileName}</span>
      </div>
    </div>
  );
}
