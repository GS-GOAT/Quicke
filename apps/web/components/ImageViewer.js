export default function ImageViewer({ fileId, fileName = 'Image' }) {
  return (
    <div className="image-viewer border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
        <span className="font-medium text-gray-900 dark:text-gray-100">{fileName}</span>
      </div>
    </div>
  );
}
