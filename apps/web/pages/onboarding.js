import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

export default function Onboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // API key state - reduced to core providers
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    anthropic: '',
    google: '',
    openrouter: ''
  });
  
  // API key provider links
  const providerLinks = {
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/keys',
    google: 'https://aistudio.google.com/app/apikey',
    openrouter: 'https://openrouter.ai/keys'
  };
  
  // Animation refs
  const containerRef = useRef(null);
  const cardRef = useRef(null);
  
  // Effect to animate elements on mount
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.classList.add('animate-fade-in');
    }
  }, []);
  
  // Handle API key changes
  const handleKeyChange = (provider, value) => {
    setApiKeys({
      ...apiKeys,
      [provider]: value
    });
  };
  
  // Check if at least one API key is provided
  const hasAtLeastOneKey = Object.values(apiKeys).some(key => key.trim() !== '');
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!hasAtLeastOneKey) {
      setError('Please enter at least one API key to continue');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Filter out empty API keys
      const nonEmptyKeys = Object.fromEntries(
        Object.entries(apiKeys).filter(([_, value]) => value.trim() !== '')
      );
      
      // Send keys to API endpoint
      const responses = await Promise.all(
        Object.entries(nonEmptyKeys).map(([provider, key]) =>
          fetch('/api/user/api-keys', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ provider, key })
          })
        )
      );

      // Check if any response failed
      const failedResponses = responses.filter(response => !response.ok);
      if (failedResponses.length > 0) {
        const error = await failedResponses[0].json();
        throw new Error(error.message || 'Failed to save API keys');
      }

      // Show success animation
      setSuccess(true);
      
      // Redirect after success animation completes
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err) {
      console.error('Error saving API keys:', err);
      setError(err.message || 'Failed to save API keys. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Render key input fields based on the provider
  const renderKeyInput = (provider, label, placeholder, hint = null) => (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label htmlFor={`${provider}-key`} className="block text-sm font-medium text-gray-300">
          {label}
        </label>
        <a 
          href={providerLinks[provider]} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-xs text-primary-400 hover:text-primary-300 flex items-center"
        >
          Get API Key
          <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
      <div className="mt-1 relative rounded-md shadow-sm">
        <input
          type="password"
          name={`${provider}-key`}
          id={`${provider}-key`}
          className="block w-full pr-10 sm:text-sm rounded-md bg-[#2C2C2E] border border-[#3A3A3C] focus:outline-none focus:border-primary-500 text-white py-2.5 px-4 transition-colors placeholder-gray-500"
          placeholder={placeholder}
          value={apiKeys[provider]}
          onChange={(e) => handleKeyChange(provider, e.target.value)}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
      {hint && (
        <p className="text-xs text-gray-400 mt-1">{hint}</p>
      )}
    </div>
  );

  return (
    <>
      <Head>
        <title>Onboarding - Quicke</title>
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#101010] p-4 selection:bg-primary-500 selection:text-white">
        {/* Logo and Quicke text in top left */}
        <div className="absolute top-6 left-6 flex items-center z-20">
          <img src="/logo.jpeg" alt="Quicke Logo" className="h-8 w-auto mr-2" />
          <span className="text-xl font-bold text-white">Quicke</span>
        </div>
        <div className="w-full max-w-xs sm:max-w-sm relative z-10">
          <div className="bg-[#1D1D1E] rounded-xl shadow-2xl p-8 space-y-7">
            <div className="text-center mb-2">
              <h2 className="text-3xl font-semibold text-white">
                Welcome to Quicke
              </h2>
              <p className="mt-2.5 text-sm text-gray-400">
                Add your API keys to get started. You'll need at least one key to continue.
              </p>
            </div>
            {error && (
              <div className="p-3.5 rounded-md bg-red-500/10 text-red-400 text-sm border border-red-500/20">
                <p>{error}</p>
              </div>
            )}
            {success && (
              <div className="p-3.5 rounded-md bg-green-500/10 text-green-400 text-sm border border-green-500/20">
                <p>API keys saved successfully. Redirecting to Quicke...</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                {renderKeyInput('openai', 'OpenAI API Key', 'sk-...')}
                {renderKeyInput('anthropic', 'Anthropic Claude API Key', 'sk-ant-...')}
                {renderKeyInput('google', 'Google Gemini API Key', 'AIza...', 'Google offers free API credits for Gemini models.')}
                {renderKeyInput('openrouter', 'OpenRouter API Key', 'sk-or-...', 'OpenRouter offers free credits to start with.')}
              </div>
              <div className="text-xs text-gray-400 bg-blue-900/20 p-3 rounded-md border-l-4 border-blue-600">
                <svg className="inline-block w-4 h-4 mr-1 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                You need at least one API key to use Quicke.
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  className="py-2 px-4 rounded-md text-sm font-medium text-gray-300 bg-[#2C2C2E] hover:bg-[#363638] border border-[#3A3A3C] transition-colors"
                  onClick={() => router.push('/')}
                >
                  Skip for now
                </button>
                <button
                  type="submit"
                  disabled={loading || success}
                  className={`py-2 px-4 rounded-md text-sm font-semibold text-black bg-white hover:bg-gray-200 shadow-sm transition-colors duration-150 relative ${
                    (loading || success) ? 'cursor-not-allowed opacity-60' : ''
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : success ? (
                    <span className="flex items-center justify-center">
                      <svg className="mr-2 h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 001.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Success!
                    </span>
                  ) : (
                    'Continue to Quicke'
                  )}
                </button>
              </div>
            </form>
            <div className="mt-5 text-center text-xs text-gray-400">
              Need help getting API keys? Check our
              <a href="#" className="ml-1 text-primary-400 hover:text-primary-300 transition-colors duration-200">documentation</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}