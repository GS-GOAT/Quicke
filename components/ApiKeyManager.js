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
  const [keyStatuses, setKeyStatuses] = useState({
    openai: { exists: false, isValid: false },
    anthropic: { exists: false, isValid: false },
    google: { exists: false, isValid: false },
    openrouter: { exists: false, isValid: false }
  });

  // fetch api keys from DB
  const fetchApiKeys = async () => {
    try {
      const res = await fetch('/api/user/api-keys');
      const data = await res.json();
      
      const keysObject = {};
      const statusObject = {};

      // Initialize all statuses as false
      Object.keys(apiKeys).forEach(provider => {
        keysObject[provider] = { key: '', usage: 0, limit: 0 };
        statusObject[provider] = { exists: false, isValid: false };
      });

      // Update for existing keys
      data.forEach(({ provider, encryptedKey }) => {
        if (encryptedKey && encryptedKey.trim()) {
          keysObject[provider] = {
            key: encryptedKey,
            usage: apiKeys[provider]?.usage || 0,
            limit: apiKeys[provider]?.limit || 0
          };
          statusObject[provider] = { exists: true, isValid: true };
        }
      });

      setApiKeys(prev => ({ ...prev, ...keysObject }));
      setKeyStatuses(statusObject);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      setSaveStatus('Error loading API keys');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchApiKeys();
    }
  }, [isOpen]);
  
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
    
    // Reset validation status when key is changed
    setKeyStatuses(prev => ({
      ...prev,
      [provider]: { exists: false, isValid: false }
    }));
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

  const handleKeyDelete = async (provider) => {
    try {
      await fetch('/api/user/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      
      // Update state to reflect deletion
      setApiKeys(prev => ({
        ...prev,
        [provider]: { key: '', usage: 0, limit: 0 }
      }));
      setKeyStatuses(prev => ({
        ...prev,
        [provider]: { exists: false, isValid: false }
      }));
      
      setSaveStatus(`${provider} API key removed successfully`);
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error deleting API key:', error);
      setSaveStatus(`Error removing ${provider} API key`);
    }
  };

  // Simplify handleSubmit to use single upsert operation
  const handleSubmit = async (provider) => {
    if (!apiKeys[provider].key.trim()) {
      setSaveStatus('Please enter a valid API key');
      return;
    }

    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider, 
          key: apiKeys[provider].key 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save API key');
      }

      setKeyStatuses(prev => ({
        ...prev,
        [provider]: { exists: true, isValid: true }
      }));

      setSaveStatus(`${provider} API key saved successfully!`);
      setTimeout(() => setSaveStatus(''), 3000);

      // Refresh API keys after successful save
      fetchApiKeys();
    } catch (error) {
      console.error('Error saving API key:', error);
      setSaveStatus(`Error saving ${provider} API key`);
      setKeyStatuses(prev => ({
        ...prev,
        [provider]: { exists: false, isValid: false }
      }));
    }
  };

  const renderKeyInput = (provider, label, placeholder, helpLink) => (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex items-center space-x-2">
        <div className="relative flex-grow group">
          <input
            type={keyVisible[provider] ? "text" : "password"}
            value={apiKeys[provider].key}
            onChange={(e) => handleKeyChange(provider, e.target.value)}
            className={`block w-full px-4 py-3 rounded-lg text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border transition-all duration-200 ${
              keyStatuses[provider].exists && keyStatuses[provider].isValid
                ? 'border-green-500 dark:border-green-600' 
                : apiKeys[provider].key
                  ? 'border-yellow-500 dark:border-yellow-600'
                  : 'border-gray-300 dark:border-gray-600'
            } focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
            placeholder={placeholder}
          />
          
          {keyStatuses[provider].exists && keyStatuses[provider].isValid && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <div className="text-green-500 dark:text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}
          
          {/* Show/Hide button */}
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => toggleKeyVisibility(provider)}
          >
            {keyVisible[provider] ? (
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
        
        {/* Action buttons */}
        <div className="flex space-x-2">
          {keyStatuses[provider].exists ? (
            <button
              onClick={() => handleKeyDelete(provider)}
              className="p-2 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
              title="Remove API key"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
              </svg>
            </button>
          ) : apiKeys[provider].key ? (
            <button
              onClick={() => handleSubmit(provider)}
              className="p-2 text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors duration-200"
              title="Save API key"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Get your API key from <a href={helpLink} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">{provider.charAt(0).toUpperCase() + provider.slice(1)}</a>
      </p>
    </div>
  );

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

              {renderKeyInput('openai', 'OpenAI API Key', 'sk-...', 'https://platform.openai.com/api-keys')}
              {renderKeyInput('anthropic', 'Anthropic API Key', 'sk-ant-...', 'https://console.anthropic.com/')}
              {renderKeyInput('google', 'Google AI API Key', 'AIza...', 'https://makersuite.google.com/app/apikey')}
              {renderKeyInput('openrouter', 'OpenRouter API Key', 'sk-or-...', 'https://openrouter.ai/keys')}
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