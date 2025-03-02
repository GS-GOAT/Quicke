export default function PromptInput({ prompt, setPrompt, onSubmit, onClear, disabled }) {
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg p-4">
      <div className="mb-4">
        <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
          Enter your prompt
        </label>
        <textarea
          id="prompt"
          name="prompt"
          rows="4"
          className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Enter a prompt to send to all selected LLMs..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        ></textarea>
      </div>
      <div className="flex space-x-3">
        <button
          type="button"
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={onSubmit}
          disabled={disabled}
        >
          Generate Responses
        </button>
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
    </div>
  );
} 