import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import StarfieldBackground from '../components/StarfieldBackground';

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
    <div className="space-y-1 transition-all duration-300 transform hover:scale-[1.01]">
      <div className="flex justify-between items-center">
        <label htmlFor={`${provider}-key`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <a 
          href={providerLinks[provider]} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-500 flex items-center"
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
          className="block w-full pr-10 sm:text-sm rounded-md 
                   bg-white/10 backdrop-blur-sm border border-gray-300 dark:border-gray-700
                   focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 dark:focus:border-primary-400
                   text-gray-900 dark:text-white py-2.5 px-4 transition-all duration-200"
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
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>
      )}
    </div>
  );

  return (
    // Changed to allow scrolling when needed
    <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-auto scrollbar-thin">
      <Head>
        <title>Welcome to Quicke | API Setup</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      {/* Starfield background */}
      <StarfieldBackground />
      
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/30 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/20 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/4 left-1/4 w-60 h-60 bg-pink-500/10 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      {/* Content container - changed to allow proper scrolling */}
      <div 
        ref={containerRef} 
        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-10"
      >
        <div className="fixed top-6 left-6 z-10">
          <h1 className="text-2xl font-bold text-white flex items-center">
            <span className="text-primary-500 mr-2">Quicke</span>
            <span className="text-sm text-gray-300 ml-1">AI ChatHub</span>
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300">
              Beta
            </span>
          </h1>
        </div>
        
        {/* Main card */}
        <div 
          ref={cardRef}
          className={`w-full max-w-md mx-auto bg-white/10 dark:bg-gray-800/20 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl transform transition-all duration-500 my-12 ${
            success ? 'scale-105 ring-2 ring-green-500' : ''
          }`}
          style={{
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          {/* Card header */}
          <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-primary-400/30 to-primary-600/30 rounded-full filter blur-2xl transform translate-x-10 -translate-y-10"></div>
            
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-xl mr-3">Q</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Welcome to Quicke</h2>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Add your API keys to get started. You'll need at least one key to continue.
            </p>
          </div>
          
          {/* Card body */}
          <form onSubmit={handleSubmit} className="px-6 py-4">
            <div className="space-y-4">
              {/* Error message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 dark:border-red-500 p-3 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400 dark:text-red-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Success message */}
              {success && (
                <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-400 dark:border-green-500 p-3 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400 dark:text-green-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-700 dark:text-green-300">API keys saved successfully. Redirecting to Quicke...</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* API Key inputs - with reduced height and added hints about free tier */}
              <div className="space-y-4">
                <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                  {renderKeyInput('openai', 'OpenAI API Key', 'sk-...')}
                </div>
                
                <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                  {renderKeyInput('anthropic', 'Anthropic Claude API Key', 'sk-ant-...')}
                </div>
                
                <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
                  {renderKeyInput('google', 'Google Gemini API Key', 'AIza...', 'Google offers free API credits for Gemini models.')}
                </div>
                
                <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
                  {renderKeyInput('openrouter', 'OpenRouter API Key', 'sk-or-...', 'OpenRouter offers free credits to start with.')}
                </div>
              </div>
              
              {/* Hint */}
              <div className="text-xs text-gray-500 dark:text-gray-400 animate-fade-in bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border-l-4 border-blue-400 dark:border-blue-600" style={{ animationDelay: '0.6s' }}>
                <p>
                  <svg className="inline-block w-4 h-4 mr-1 text-blue-500 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  You need at least one API key to use Quicke.
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
                onClick={() => router.push('/')}
              >
                Skip for now
              </button>
              
              <button
                type="submit"
                disabled={loading || success}
                className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 ${
                  loading ? 'animate-pulse' : ''
                } ${success ? 'bg-green-600 hover:bg-green-700' : ''}`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : success ? (
                  <span className="flex items-center">
                    <svg className="-ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
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
          
          {/* Futuristic animation elements */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-400 via-primary-600 to-primary-400 bg-gradient-animate"></div>
        </div>
        
        {/* Footer */}
        <div className="mt-5 text-center text-xs text-gray-500 dark:text-gray-400 animate-fade-in mb-8" style={{ animationDelay: '0.7s' }}>
          <p>
            Need help getting API keys? Check our
            <a href="#" className="ml-1 text-primary-600 dark:text-primary-400 hover:text-primary-500 transition-colors duration-200">
              documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}