import { useState, useEffect } from 'react';
// import { encrypt, decrypt } from '../utils/encryption'; // Not used directly here

export default function ApiKeyManager({ isOpen, onClose }) {
  const [apiKeys, setApiKeys] = useState({
    openai: { key: '', usage: 0, limit: 0 },
    anthropic: { key: '', usage: 0, limit: 0 },
    google: { key: '', usage: 0, limit: 0 },
    openrouter: { key: '', usage: 0, limit: 0 },
    deepseek: { key: '', usage: 0, limit: 0 }
  });
  const [keyVisible, setKeyVisible] = useState({});
  const [saveStatus, setSaveStatus] = useState('');
  const [keyStatuses, setKeyStatuses] = useState({
    openai: { exists: false, isValid: false },
    anthropic: { exists: false, isValid: false },
    google: { exists: false, isValid: false },
    openrouter: { exists: false, isValid: false },
    deepseek: { exists: false, isValid: false }
  });
  const [hasModifications, setHasModifications] = useState(false);
  const [originalKeys, setOriginalKeys] = useState({});

  const fetchApiKeys = async () => {
    try {
      const res = await fetch('/api/user/api-keys');
      const data = await res.json();
      const keysObject = {};
      const statusObject = {};
      Object.keys(apiKeys).forEach(provider => {
        keysObject[provider] = { key: '', usage: 0, limit: 0 };
        statusObject[provider] = { exists: false, isValid: false };
      });
      data.forEach(({ provider, encryptedKey }) => {
        if (keysObject.hasOwnProperty(provider)) {
          if (encryptedKey && encryptedKey.trim()) {
            keysObject[provider] = {
              ...keysObject[provider],
              key: encryptedKey,
            };
            statusObject[provider] = { exists: true, isValid: true };
          }
        }
      });
      setApiKeys(keysObject);
      setOriginalKeys(JSON.parse(JSON.stringify(keysObject)));
      setKeyStatuses(statusObject);
      setHasModifications(false);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      setSaveStatus('Error loading API keys');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchApiKeys();
      setSaveStatus('');
    }
  }, [isOpen]);

  const saveApiKeys = async () => {
    if (!hasModifications) {
      onClose();
      return;
    }
    setSaveStatus('Saving...');
    try {
      const keysToSave = Object.entries(apiKeys).filter(([provider, { key }]) => {
        return key.trim() !== originalKeys[provider]?.key?.trim();
      });
      if (keysToSave.length === 0 && !Object.values(keyStatuses).some(s => !s.exists && apiKeys[s.provider]?.key)) {
        onClose();
        return;
      }
      await Promise.all(keysToSave.map(([provider, { key }]) =>
        fetch('/api/user/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, key: key.trim() }),
        })
      ));
      setSaveStatus('API keys saved successfully!');
      setOriginalKeys(JSON.parse(JSON.stringify(apiKeys)));
      setHasModifications(false);
      fetchApiKeys();
      setTimeout(() => {
        setSaveStatus('');
      }, 2000);
    } catch (error) {
      console.error('Error saving API keys:', error);
      setSaveStatus('Error saving API keys.');
    }
  };

  const checkModifications = (newKeys) => {
    return Object.keys(newKeys).some(provider =>
      newKeys[provider].key.trim() !== originalKeys[provider]?.key?.trim()
    );
  };

  const handleKeyChange = (provider, value) => {
    const newKeys = {
      ...apiKeys,
      [provider]: { ...apiKeys[provider], key: value }
    };
    setApiKeys(newKeys);
    setHasModifications(checkModifications(newKeys));
    setKeyStatuses(prev => ({
      ...prev,
      [provider]: { ...prev[provider], isValid: false }
    }));
  };

  const handleKeyDelete = async (provider) => {
    setSaveStatus(`Removing ${provider} key...`);
    try {
      await fetch('/api/user/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const newKeys = {
        ...apiKeys,
        [provider]: { ...apiKeys[provider], key: '' }
      };
      setApiKeys(newKeys);
      setKeyStatuses(prev => ({
        ...prev,
        [provider]: { exists: false, isValid: false }
      }));
      setOriginalKeys(prev => ({...prev, [provider]: {...prev[provider], key: ''}}));
      setHasModifications(checkModifications(newKeys));
      setSaveStatus(`${provider} API key removed.`);
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error deleting API key:', error);
      setSaveStatus(`Error removing ${provider} API key.`);
    }
  };

  const renderKeyInput = (provider, label, placeholder, helpLink) => (
    <div className="space-y-2 mb-6 last:mb-0">
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <div className="flex items-center space-x-2">
        <div className="relative flex-grow group">
          <input
            type={keyVisible[provider] ? "text" : "password"}
            value={apiKeys[provider]?.key || ''}
            onChange={(e) => handleKeyChange(provider, e.target.value)}
            className={`block w-full px-3 py-2.5 rounded-md text-sm text-white bg-[#2C2C2E] border placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors ${
              keyStatuses[provider]?.exists && keyStatuses[provider]?.isValid
                ? 'border-green-600/70' 
                : (apiKeys[provider]?.key && apiKeys[provider].key.trim() !== '')
                  ? 'border-yellow-600/60'
                  : 'border-[#3A3A3C]'
            }`}
            placeholder={placeholder}
          />
          {keyStatuses[provider]?.exists && keyStatuses[provider]?.isValid && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2 text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
            </div>
          )}
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1"
            onClick={() => setKeyVisible(prev => ({ ...prev, [provider]: !prev[provider] }))}
          >
            {keyVisible[provider] ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" /></svg>
            )}
          </button>
        </div>
        {keyStatuses[provider]?.exists && (
          <button
            onClick={() => handleKeyDelete(provider)}
            className="p-2 text-red-500 hover:text-red-400 bg-red-900/20 hover:bg-red-800/30 rounded-md transition-colors"
            title="Remove API key"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg>
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Get your API key from <a href={helpLink} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:text-primary-400 hover:underline">{provider.charAt(0).toUpperCase() + provider.slice(1)}</a>
      </p>
    </div>
  );

  const toggleKeyVisibility = (provider) => {
    setKeyVisible(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleClose = () => {
    if (hasModifications) {
      if (confirm("You have unsaved changes. Are you sure you want to close?")) {
        setApiKeys(JSON.parse(JSON.stringify(originalKeys)));
        setHasModifications(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for when side panel is open (optional, can be part of main page layout) */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" // Only show backdrop on smaller screens
          onClick={handleClose} 
        />
      )}

      {/* Side Panel */}
      <div 
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md transform transition-transform duration-300 ease-in-out bg-[#1D1D1E] shadow-2xl border-l border-[#3A3A3C] flex flex-col
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#3A3A3C] flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">API Key Manager</h2>
            <button 
              onClick={handleClose} 
              className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded-md hover:bg-[#2C2C2E]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Manage your API keys for model providers.
          </p>
        </div>

        {/* Content area - Scrollable */}
        <div className="overflow-y-auto flex-grow p-6 space-y-5 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50">
          {renderKeyInput('openai', 'OpenAI API Key', 'sk-...', 'https://platform.openai.com/api-keys')}
          {renderKeyInput('anthropic', 'Anthropic API Key', 'sk-ant-...', 'https://console.anthropic.com/')}
          {renderKeyInput('google', 'Google AI API Key', 'AIza...', 'https://makersuite.google.com/app/apikey')}
          {renderKeyInput('openrouter', 'OpenRouter API Key', 'sk-or-...', 'https://openrouter.ai/keys')}
          {renderKeyInput('deepseek', 'DeepSeek API Key', 'sk-ds-...', 'https://platform.deepseek.com/api_keys')}  
          {/* Status message */}
          {saveStatus && (
            <div className={`mt-4 p-3 rounded-md text-sm ${
              saveStatus.includes('Error') 
                ? 'bg-red-500/10 text-red-400 border border-red-500/30' 
                : 'bg-green-500/10 text-green-400 border border-green-500/30'
            }`}>
              {saveStatus}
            </div>
          )}
        </div>

        {/* Footer for buttons */}
        <div className="px-6 py-4 border-t border-[#3A3A3C] bg-[#1D1D1E] flex-shrink-0">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-[#2C2C2E] border border-[#3A3A3C] rounded-md hover:bg-[#363638] transition-colors"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-semibold border border-transparent rounded-md transition-colors ${
                hasModifications 
                  ? 'bg-white hover:bg-gray-200 text-black' // Save Changes style like primary auth button
                  : 'bg-green-600 hover:bg-green-700 text-white' // Done style
              } ${!hasModifications && !Object.values(apiKeys).some(k => k.key) ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={saveApiKeys}
              disabled={!hasModifications && !Object.values(apiKeys).some(k => k.key && k.key.trim() !== '') && !Object.values(keyStatuses).some(s => s.exists) }
            >
              {hasModifications ? 'Save Changes' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}