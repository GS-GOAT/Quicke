import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSplitPanel } from './SplitPanelContext';

const MIN_PANEL_WIDTH_PERCENT = 25; // Minimum width for either panel

export default function SplitPanelLayout({ leftContent, rightContent }) {
  const { splitPosition, setSplitPosition } = useSplitPanel();
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    e.preventDefault(); // Prevent text selection during drag
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    // Enforce min/max width constraints
    const clampedPosition = Math.max(
      MIN_PANEL_WIDTH_PERCENT,
      Math.min(newPosition, 100 - MIN_PANEL_WIDTH_PERCENT)
    );

    setSplitPosition(clampedPosition);
  }, [isDragging, setSplitPosition]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  // global mouse listeners when dragging starts
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      {/* Left Panel (Main Content) */}
      <div
        className="overflow-auto h-full scrollbar-thin"
        style={{ width: `${splitPosition}%` }}
      >
        {leftContent}
      </div>

      {/* Separator */}
      <div
        className="w-2 cursor-col-resize bg-gray-300/10 dark:bg-gray-700/30 hover:bg-primary-500/30 transition-colors duration-150 flex-shrink-0"
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      />

      {/* Right Panel (Side Panel Content) */}
      <div
        className="overflow-auto h-full scrollbar-thin border-l border-gray-700/50"
        style={{ 
          width: `${100 - splitPosition}%`,
          backgroundColor: 'rgba(17, 17, 20, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        {rightContent}
      </div>
    </div>
  );
}