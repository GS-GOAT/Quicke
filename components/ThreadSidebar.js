import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';

export default function ThreadSidebar({ 
  isOpen, 
  onClose, 
  onSelect, 
  onNewThread, 
  activeThreadId 
}) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const sidebarRef = useRef(null);
  const overlayRef = useRef(null);

  // Handle click outside to close sidebar
  useEffect(() => {
    function handleClickOutside(event) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target) && 
          event.target === overlayRef.current) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Fetch threads when opened
  useEffect(() => {
    if (isOpen) {
      fetchThreads();
    }
  }, [isOpen]);

  const fetchThreads = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/threads/list');
      
      if (!response.ok) {
        throw new Error('Failed to fetch threads');
      }
      
      const data = await response.json();
      setThreads(data.threads);
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteThread = async (e, threadId) => {
    e.stopPropagation(); // Prevent thread selection
    
    if (!confirm('Are you sure you want to delete this thread?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/threads/delete?id=${threadId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete thread');
      }
      
      // Remove thread from state
      setThreads(threads.filter(thread => thread.id !== threadId));
      
      // If deleted thread was active, select a new one or create new
      if (activeThreadId === threadId) {
        const newActiveThread = threads.find(thread => thread.id !== threadId);
        if (newActiveThread) {
          onSelect(newActiveThread.id);
        } else {
          onNewThread();
        }
      }
    } catch (error) {
      console.error('Error deleting thread:', error);
    }
  };

  return (
    <>
      {/* Glass Overlay */}
      {isOpen && (
        <div 
          ref={overlayRef}
          className="fixed inset-0 bg-black/30 dark:bg-black/40 backdrop-blur-sm z-30 transition-opacity duration-300 ease-in-out"
          onClick={onClose}
        />
      )}
      
      {/* Glass Sidebar */}
      <div 
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-all duration-300 ease-out ${
          isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
        } bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-xl h-full flex flex-col overflow-hidden border-r border-white/20 dark:border-gray-800/50`}
      >
        <div className="p-4 flex justify-between items-center border-b border-gray-200/30 dark:border-gray-700/30">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Your Threads</h3>
          <button 
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto scrollbar-thin">
          {/* New Thread Button */}
          <div className="p-4">
            <button
              onClick={onNewThread}
              className="w-full p-3 flex justify-center items-center space-x-2 rounded-lg bg-gradient-to-r from-primary-600/90 to-primary-500/90 hover:from-primary-600 hover:to-primary-500 text-white transition-all duration-200 shadow-lg shadow-primary-500/20 backdrop-blur-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="font-medium">New Thread</span>
            </button>
          </div>
          
          {/* Thread List */}
          <div className="px-3 pb-4">
            <h4 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-2 px-2">Recent Threads</h4>
            
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-400 mb-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">No threads yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Ask a question to start a new thread</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {threads.map(thread => (
                  <li 
                    key={thread.id}
                    className={`relative group rounded-lg overflow-hidden hover:bg-gray-50/70 dark:hover:bg-gray-800/50 cursor-pointer transition-all duration-200 backdrop-blur-sm ${
                      activeThreadId === thread.id ? 'bg-blue-50/80 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-400' : ''
                    }`}
                    onClick={() => onSelect(thread.id)}
                  >
                    <div className="p-3">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate pr-6">{thread.title}</h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {format(new Date(thread.updatedAt), 'MMM d')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{thread.preview}</p>
                      
                      {/* Thread actions */}
                      <div className="absolute right-2 top-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDeleteThread(e, thread.id)}
                          className="p-1 rounded-md text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 backdrop-blur-sm"
                          aria-label="Delete thread"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        {/* Glass Footer */}
        <div className="p-4 border-t border-gray-200/30 dark:border-gray-700/30 bg-white/20 dark:bg-gray-800/20 backdrop-blur-sm">
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span>Only the last 5 threads are saved</span>
          </div>
        </div>
      </div>
    </>
  );
} 