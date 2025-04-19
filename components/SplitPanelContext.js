import React, { createContext, useState, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const SplitPanelContext = createContext();

export const useSplitPanel = () => useContext(SplitPanelContext);

export const SplitPanelProvider = ({ children }) => {
  const [sidePanelContent, setSidePanelContent] = useState(null);
  const [splitPosition, setSplitPosition] = useLocalStorage('splitPosition', 70); // Default 70% main panel

  const openSidePanel = useCallback((content) => {
    // Check if the same panel content is already open, if so, close it
    if (sidePanelContent && 
        sidePanelContent.model === content.model && 
        sidePanelContent.conversationId === content.conversationId) {
      setSidePanelContent(null);
    } else {
      setSidePanelContent(content);
    }
  }, [sidePanelContent]);

  const closeSidePanel = useCallback(() => {
    setSidePanelContent(null);
  }, []);

  const isSidePanelOpen = sidePanelContent !== null;

  const value = {
    isSidePanelOpen,
    sidePanelContent,
    openSidePanel,
    closeSidePanel,
    splitPosition,
    setSplitPosition,
  };

  return (
    <SplitPanelContext.Provider value={value}>
      {children}
    </SplitPanelContext.Provider>
  );
};