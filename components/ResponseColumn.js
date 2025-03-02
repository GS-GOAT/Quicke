export default function ResponseColumn({ model, response, loading }) {
  const copyToClipboard = () => {
    if (response?.text) {
      navigator.clipboard.writeText(response.text);
      alert(`Copied ${model}'s response to clipboard!`);
    }
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h3 className="text-lg leading-6 font-medium text-gray-900">{model}</h3>
        {response?.text && (
          <button
            onClick={copyToClipboard}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            Copy
          </button>
        )}
      </div>
      <div className="border-t border-gray-200">
        <div className="px-4 py-5 sm:p-6 min-h-[200px] max-h-[500px] overflow-auto">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : response?.error ? (
            <div className="text-red-500">Error: {response.error}</div>
          ) : response?.text ? (
            <div className="whitespace-pre-wrap">{response.text}</div>
          ) : (
            <div className="text-gray-400 italic">No response yet</div>
          )}
        </div>
      </div>
    </div>
  );
} 