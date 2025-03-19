import React from 'react';

export default function ThreadButton({ onClick, title, isActive }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-3 py-2 rounded-lg transition-colors duration-200 ${
        isActive 
          ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5 mr-2"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span className="max-w-[150px] truncate">
        {title || 'Threads'}
      </span>
    </button>
  );
} 