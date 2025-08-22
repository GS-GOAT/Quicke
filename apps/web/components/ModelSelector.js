import { useState, forwardRef } from 'react';
import { modelCategories } from '../../api-worker/config/models';

const GUEST_ALLOWED_MODELS = ['gemini-flash', 'gemini-flash-2.5'];

const ModelSelector = forwardRef(function ModelSelector({ isOpen, setIsOpen, selectedModels, setSelectedModels, isGuest = false }, ref) {
  const handleDeselectAll = () => setSelectedModels([]);
  const toggleModel = (modelId) => {
    if (isGuest && !GUEST_ALLOWED_MODELS.includes(modelId)) return;
    setSelectedModels(prev => prev.includes(modelId) ? prev.filter(id => id !== modelId) : [...prev, modelId]);
  };

  // Dropdown menu classes
  const dropdownBaseClasses = "absolute right-0 mt-2 w-[380px] md:w-[420px] origin-top-right rounded-xl bg-gray-950/90 backdrop-blur-md shadow-2xl ring-1 ring-gray-700/50 z-[100] flex flex-col animate-fade-in-down-fast";
  const openClasses = "opacity-100 scale-100 pointer-events-auto";
  const closedClasses = "opacity-0 scale-95 pointer-events-none";

  if (!isOpen) return null;

  return (
    <div ref={ref} className={`${dropdownBaseClasses} ${isOpen ? openClasses : closedClasses}`}>
      {/* Header */}
      <div className="p-3.5 border-b border-gray-700/60 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h3 className="text-md font-semibold text-gray-100">
            Select Models
            <span className="ml-2 px-1.5 py-0.5 bg-primary-700/40 text-primary-300 rounded-md text-xs">
              {selectedModels.length}
            </span>
          </h3>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleDeselectAll}
              className="px-2 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
              title="Deselect All"
            >
              Clear
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {/* Scrollable Content Area */}
      <div className="overflow-y-auto p-3.5 space-y-3 model-selector-scrollbar flex-grow max-h-[60vh]">
        {Object.keys(modelCategories).map(category => (
          <div key={category} className="space-y-1">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 sticky top-0 bg-gray-950/90 backdrop-blur-sm py-1.5 z-10 -mx-3.5 px-3.5 border-b border-gray-700/30">
              {category}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              {modelCategories[category].map(model => {
                const isDisabled = isGuest && !GUEST_ALLOWED_MODELS.includes(model.id);
                const isSelected = selectedModels.includes(model.id);
                return (
                  <div
                    key={model.id}
                    onClick={() => !isDisabled && toggleModel(model.id)}
                    className={`relative group border border-gray-700/40 rounded-lg p-2.5 pr-8 transition-all duration-150 ease-in-out transform hover:border-gray-600/70 ${
                      isDisabled ? 'opacity-60 cursor-not-allowed filter grayscale-[20%]' : 'cursor-pointer hover:bg-gray-800/50'
                    } ${
                      isSelected ? 'bg-primary-700/25 border-primary-600/50' : 'bg-gray-800/30'
                    }`}
                  >
                    {isDisabled && (
                      <div className="absolute left-1/2 -top-3 z-50 -translate-x-1/2 -translate-y-full group-hover:opacity-100 group-hover:pointer-events-auto opacity-0 pointer-events-none transition-all duration-200">
                        <div className="relative flex flex-col items-center">
                          <div className="px-3 py-2 rounded-md bg-white text-gray-800 text-xs shadow-lg border border-gray-300 font-medium whitespace-nowrap">
                            Log in to use this model
                          </div>
                          <div className="w-3 h-3 bg-white border-l border-b border-gray-300 rotate-45 mt-[-7px] z-[-1]"></div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white text-xs bg-gradient-to-br ${model.color || 'from-gray-600 to-gray-700'}`}>
                        {model.icon || '●'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-sm text-gray-100 truncate">{model.name}</h5>
                        <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-gray-700 text-gray-400">
                            {model.provider}
                          </span>
                          {model.badge && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-medium ${
                              (model.badge === 'Free' || (isGuest && GUEST_ALLOWED_MODELS.includes(model.id) && model.badge !== 'Paid'))
                                ? 'bg-green-800/60 text-green-300 border border-green-700/60'
                                : 'bg-purple-800/60 text-purple-300 border border-purple-700/60'
                            }`}>
                              {isGuest && GUEST_ALLOWED_MODELS.includes(model.id) && model.badge !== 'Paid' ? 'Trial' : model.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-1/2 -translate-y-1/2 right-2.5 text-primary-400">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {isDisabled && (
                      <div className="absolute top-1.5 right-1.5 p-0.5 bg-gray-700/80 rounded-full shadow">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-yellow-300">
                          <path fillRule="evenodd" d="M8 1a3.5 3.5 0 00-3.5 3.5V7A1.5 1.5 0 003 8.5v5A1.5 1.5 0 004.5 15h7A1.5 1.5 0 0013 13.5v-5A1.5 1.5 0 0011.5 7V4.5A3.5 3.5 0 008 1zm2 6V4.5a2 2 0 10-4 0V7h4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

ModelSelector.displayName = 'ModelSelector';
export default ModelSelector;