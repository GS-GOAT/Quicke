import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';

// Inline styles to override any conflicting CSS
const sidebarStyles = {
  container: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    width: '18rem',
    zIndex: 40,
    backgroundColor: 'rgba(35, 35, 38, 0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRight: '1px solid rgba(75, 75, 80, 0.2)',
    boxShadow: '0 0 20px rgba(0, 0, 0, 0.4)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
  },
  header: {
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 40, 43, 0.5)',
    borderBottom: '1px solid rgba(75, 75, 80, 0.2)',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 500,
    color: 'rgba(220, 220, 225, 0.9)',
  },
  closeButton: {
    padding: '0.5rem',
    borderRadius: '0.375rem',
    color: 'rgba(180, 180, 190, 0.8)',
    transition: 'color 0.2s',
  },
  content: {
    flexGrow: 1,
    overflow: 'auto',
    padding: '0.75rem',
  },
  newThreadButton: {
    width: '100%',
    padding: '0.75rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
    borderRadius: '0.5rem',
    backgroundColor: 'rgba(45, 45, 48, 0.8)',
    color: 'white',
    fontWeight: 500,
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  threadItem: {
    padding: '0.75rem',
    borderRadius: '0.5rem',
    marginBottom: '0.5rem',
    backgroundColor: 'rgba(45, 45, 48, 0.4)',
    borderLeft: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  threadItemActive: {
    backgroundColor: 'rgba(50, 50, 55, 0.7)',
    borderLeft: '2px solid rgba(125, 125, 255, 0.7)',
  },
  threadTitle: {
    color: 'rgba(220, 220, 225, 0.9)',
    fontWeight: 500,
    fontSize: '0.875rem',
  },
  threadDate: {
    color: 'rgba(180, 180, 190, 0.6)',
    fontSize: '0.75rem',
    marginTop: '0.25rem',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 30,
    transition: 'opacity 0.3s ease-in-out',
  }
};

// Add this style tag at the top of your component to force the styles
const ForceStyles = () => (
  <style jsx global>{`
    /* Override any global styles that might interfere with translucency */
    #thread-sidebar {
      background-color: rgba(28, 28, 32, 0.75) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
      border-right: 1px solid rgba(64, 64, 70, 0.2) !important;
      box-shadow: 0 0 25px rgba(0, 0, 0, 0.3) !important;
    }
    
    #thread-header {
      background-color: rgba(24, 24, 28, 0.6) !important;
      border-bottom: 1px solid rgba(64, 64, 70, 0.2) !important;
    }
    
    #thread-new-button {
      background-color: rgba(45, 45, 50, 0.7) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
    }
    
    .thread-item {
      background-color: rgba(40, 40, 45, 0.4) !important;
    }
    
    .thread-item.active {
      background-color: rgba(50, 50, 60, 0.7) !important;
      border-left: 2px solid rgba(125, 125, 200, 0.7) !important;
    }
    
    /* Ensure content has properly transparent background */
    #thread-content {
      background-color: transparent !important;
    }
  `}</style>
);

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

  // Handle click outside
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
    e.stopPropagation();
    
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
      
      setThreads(threads.filter(thread => thread.id !== threadId));
      
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
      <ForceStyles />
      {/* Overlay */}
      {isOpen && (
        <div 
          ref={overlayRef}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 30,
            transition: 'opacity 0.3s ease-in-out',
            opacity: isOpen ? 1 : 0,
          }}
          onClick={onClose}
        />
      )}
      
      {/* Glass Sidebar with ID for targeted styling */}
      <div 
        id="thread-sidebar"
        ref={sidebarRef}
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          width: '18rem',
          zIndex: 40,
          backgroundColor: 'rgba(28, 28, 32, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(64, 64, 70, 0.2)',
          boxShadow: '0 0 25px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          opacity: isOpen ? 1 : 0,
        }}
      >
        {/* Header with ID for targeted styling */}
        <div 
          id="thread-header"
          style={{
            padding: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(24, 24, 28, 0.6)',
            borderBottom: '1px solid rgba(64, 64, 70, 0.2)',
          }}
        >
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 500,
            color: 'rgba(220, 220, 225, 0.9)',
          }}>Library</h3>
          <button 
            onClick={onClose}
            style={{
              padding: '0.5rem',
              borderRadius: '0.375rem',
              color: 'rgba(180, 180, 190, 0.8)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {/* Content with ID for targeted styling */}
        <div 
          id="thread-content"
          style={{
            flexGrow: 1,
            overflow: 'auto',
            padding: '0.75rem',
            backgroundColor: 'transparent',
          }}
        >
          {/* New Thread Button with ID for targeted styling */}
          <button
            id="thread-new-button"
            onClick={onNewThread}
            style={{
              width: '100%',
              padding: '0.75rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(45, 45, 50, 0.7)',
              color: 'white',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>New Thread</span>
          </button>
          
          {/* Thread list with class for targeted styling */}
          {loading ? (
            <div style={{textAlign: 'center', padding: '2rem', color: 'rgba(180, 180, 190, 0.8)'}}>
              <div style={{
                width: '1.5rem',
                height: '1.5rem',
                border: '2px solid rgba(125, 125, 255, 0.3)',
                borderTopColor: 'rgba(125, 125, 255, 0.8)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 0.5rem auto',
              }}></div>
              <style jsx>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
              Loading...
            </div>
          ) : threads.length === 0 ? (
            <div style={{
              textAlign: 'center', 
              padding: '2rem', 
              color: 'rgba(180, 180, 190, 0.8)',
              backgroundColor: 'rgba(40, 40, 45, 0.3)',
              borderRadius: '0.5rem',
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                margin: '0 auto 0.75rem auto',
                opacity: 0.6,
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div style={{fontWeight: 500, marginBottom: '0.25rem'}}>No threads yet</div>
              <div style={{fontSize: '0.75rem'}}>Start a new conversation</div>
            </div>
          ) : (
            threads.map(thread => (
              <div 
                key={thread.id}
                onClick={() => onSelect(thread.id)}
                className={`thread-item ${activeThreadId === thread.id ? 'active' : ''}`}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  marginBottom: '0.5rem',
                  backgroundColor: 'rgba(40, 40, 45, 0.4)',
                  borderLeft: '2px solid',
                  borderLeftColor: activeThreadId === thread.id ? 'rgba(125, 125, 200, 0.7)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  color: 'rgba(220, 220, 225, 0.9)',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}>
                  {thread.title}
                </div>
                <div style={{
                  color: 'rgba(180, 180, 190, 0.6)',
                  fontSize: '0.75rem',
                  marginTop: '0.25rem',
                }}>
                  {new Date(thread.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
} 