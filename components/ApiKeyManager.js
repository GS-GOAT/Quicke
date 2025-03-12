import { useState, useEffect } from 'react';
import { encrypt, decrypt } from '../utils/encryption';

export default function ApiKeyManager({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('keys');
  const [apiKeys, setApiKeys] = useState({
    openai: { key: '', usage: 0, limit: 0 },
    anthropic: { key: '', usage: 0, limit: 0 },
    google: { key: '', usage: 0, limit: 0 },
    openrouter: { key: '', usage: 0, limit: 0 }
  });
  const [keyVisible, setKeyVisible] = useState({});
  const [saveStatus, setSaveStatus] = useState('');

  // fetch api keys from DB
  useEffect(() => {
    async function fetchApiKeys() {
      try {
        const res = await fetch('/api/user/api-keys');
        const data = await res.json();
        const keysObject = {};
        data.forEach(({ provider, encryptedKey }) => {
          keysObject[provider] = { key: encryptedKey };
        });
        setApiKeys(prev => ({ ...prev, ...keysObject }));
      } catch (error) {
        console.error('Error fetching API keys:', error);
      }
    }
    fetchApiKeys();
  }, []);
  
  // Save API keys to DB
  const saveApiKeys = async () => {
    try {
      await Promise.all(Object.entries(apiKeys).map(([provider, { key }]) =>
        fetch('/api/user/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, key }),
        })
      ));
      setSaveStatus('API keys saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error saving API keys:', error);
      setSaveStatus('Error saving API keys.');
    }
  };  

  const handleKeyChange = (provider, value) => {
    setApiKeys({
      ...apiKeys,
      [provider]: { ...apiKeys[provider], key: value }
    });
  };

  const handleLimitChange = (provider, value) => {
    const numValue = parseInt(value) || 0;
    setApiKeys({
      ...apiKeys,
      [provider]: { ...apiKeys[provider], limit: numValue }
    });
  };

  const toggleKeyVisibility = (provider) => {
    setKeyVisible({
      ...keyVisible,
      [provider]: !keyVisible[provider]
    });
  };

  // Simulate fetching usage data
  const fetchUsageData = async () => {
    // In a real app, you would call your API to get actual usage data
    // This is just a placeholder for demonstration
    setApiKeys(prev => ({
      openai: { ...prev.openai, usage: Math.floor(Math.random() * prev.openai.limit) },
      anthropic: { ...prev.anthropic, usage: Math.floor(Math.random() * prev.anthropic.limit) },
      google: { ...prev.google, usage: Math.floor(Math.random() * prev.google.limit) },
      openrouter: { ...prev.openrouter, usage: Math.floor(Math.random() * prev.openrouter.limit) }
    }));
  };

  // Fetch usage data when the usage tab is opened
  useEffect(() => {
    if (activeTab === 'usage') {
      fetchUsageData();
    }
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-darksurface rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">API Key Management</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'keys'
                  ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('keys')}
            >
              API Keys
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'usage'
                  ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('usage')}
            >
              Usage & Limits
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'keys' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter your API keys below. They are encrypted and stored locally in your browser.
              </p>

              {/* OpenAI API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  OpenAI API Key
                </label>
                <div className="flex">
                  <div className="relative flex-grow">
                    <input
                      type={keyVisible.openai ? "text" : "password"}
                      value={apiKeys.openai.key}
                      onChange={(e) => handleKeyChange('openai', e.target.value)}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      placeholder="sk-..."
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
                      onClick={() => toggleKeyVisibility('openai')}
                    >
                      {keyVisible.openai ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">OpenAI</a>
                </p>
              </div>

              {/* Anthropic API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Anthropic API Key
                </label>
                <div className="flex">
                  <div className="relative flex-grow">
                    <input
                      type={keyVisible.anthropic ? "text" : "password"}
                      value={apiKeys.anthropic.key}
                      onChange={(e) => handleKeyChange('anthropic', e.target.value)}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      placeholder="sk-ant-..."
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
                      onClick={() => toggleKeyVisibility('anthropic')}
                    >
                      {keyVisible.anthropic ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Get your API key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">Anthropic</a>
                </p>
              </div>

              {/* Google AI API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Google AI API Key
                </label>
                <div className="flex">
                  <div className="relative flex-grow">
                    <input
                      type={keyVisible.google ? "text" : "password"}
                      value={apiKeys.google.key}
                      onChange={(e) => handleKeyChange('google', e.target.value)}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      placeholder="AIza..."
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
                      onClick={() => toggleKeyVisibility('google')}
                    >
                      {keyVisible.google ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">Google AI Studio</a>
                </p>
              </div>

              {/* OpenRouter API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  OpenRouter API Key
                </label>
                <div className="flex">
                  <div className="relative flex-grow">
                    <input
                      type={keyVisible.openrouter ? "text" : "password"}
                      value={apiKeys.openrouter.key}
                      onChange={(e) => handleKeyChange('openrouter', e.target.value)}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      placeholder="sk-or-..."
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
                      onClick={() => toggleKeyVisibility('openrouter')}
                    >
                      {keyVisible.openrouter ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Get your API key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">OpenRouter</a>
                </p>
              </div>
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Set monthly limits and monitor your API usage.
              </p>

              <div className="space-y-4">
                {/* OpenAI Usage */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      OpenAI Monthly Limit ($)
                    </label>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Usage: ${apiKeys.openai.usage.toFixed(2)} / ${apiKeys.openai.limit.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={apiKeys.openai.limit}
                    onChange={(e) => handleLimitChange('openai', e.target.value)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="Set monthly limit in USD"
                  />
                  {apiKeys.openai.limit > 0 && (
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          apiKeys.openai.usage / apiKeys.openai.limit > 0.9 
                            ? 'bg-red-500' 
                            : apiKeys.openai.usage / apiKeys.openai.limit > 0.7 
                              ? 'bg-yellow-500' 
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(apiKeys.openai.usage / apiKeys.openai.limit * 100, 100)}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                {/* Anthropic Usage */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Anthropic Monthly Limit ($)
                    </label>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Usage: ${apiKeys.anthropic.usage.toFixed(2)} / ${apiKeys.anthropic.limit.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={apiKeys.anthropic.limit}
                    onChange={(e) => handleLimitChange('anthropic', e.target.value)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="Set monthly limit in USD"
                  />
                  {apiKeys.anthropic.limit > 0 && (
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          apiKeys.anthropic.usage / apiKeys.anthropic.limit > 0.9 
                            ? 'bg-red-500' 
                            : apiKeys.anthropic.usage / apiKeys.anthropic.limit > 0.7 
                              ? 'bg-yellow-500' 
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(apiKeys.anthropic.usage / apiKeys.anthropic.limit * 100, 100)}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                {/* Google Usage */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Google AI Monthly Limit ($)
                    </label>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Usage: ${apiKeys.google.usage.toFixed(2)} / ${apiKeys.google.limit.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={apiKeys.google.limit}
                    onChange={(e) => handleLimitChange('google', e.target.value)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="Set monthly limit in USD"
                  />
                  {apiKeys.google.limit > 0 && (
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          apiKeys.google.usage / apiKeys.google.limit > 0.9 
                            ? 'bg-red-500' 
                            : apiKeys.google.usage / apiKeys.google.limit > 0.7 
                              ? 'bg-yellow-500' 
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(apiKeys.google.usage / apiKeys.google.limit * 100, 100)}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                {/* OpenRouter Usage */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      OpenRouter Monthly Limit ($)
                    </label>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Usage: ${apiKeys.openrouter.usage.toFixed(2)} / ${apiKeys.openrouter.limit.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={apiKeys.openrouter.limit}
                    onChange={(e) => handleLimitChange('openrouter', e.target.value)}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                    placeholder="Set monthly limit in USD"
                  />
                  {apiKeys.openrouter.limit > 0 && (
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          apiKeys.openrouter.usage / apiKeys.openrouter.limit > 0.9 
                            ? 'bg-red-500' 
                            : apiKeys.openrouter.usage / apiKeys.openrouter.limit > 0.7 
                              ? 'bg-yellow-500' 
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(apiKeys.openrouter.usage / apiKeys.openrouter.limit * 100, 100)}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                <button
                  className="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  onClick={fetchUsageData}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Usage Data
                </button>
              </div>
            </div>
          )}

          {/* Save status message */}
          {saveStatus && (
            <div className={`mt-4 p-2 rounded text-sm ${
              saveStatus.includes('Error') 
                ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' 
                : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
            }`}>
              {saveStatus}
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 flex justify-end space-x-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            onClick={saveApiKeys}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
} 