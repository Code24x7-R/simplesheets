import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { FunctionInfo } from '../utils/formulaAutocomplete';
import { searchFunctions } from '../utils/formulaAutocomplete';
import { getFunctionSchema } from '../utils/formulaWizardSchema';

interface FunctionPickerProps {
  /** Whether the picker is open */
  isOpen: boolean;
  /** Callback when a function is selected */
  onSelect: (functionName: string) => void;
  /** Callback when the picker is dismissed without selection */
  onClose: () => void;
}

/**
 * Function Picker Modal
 *
 * Shown when the user opens the FormulaWizard on a cell without a formula.
 * Lets the user search for and select a function to build.
 *
 * Features:
 * - Search input with real-time filtering
 * - Keyboard navigation (Arrow keys + Enter)
 * - Grouped by category
 * - Shows function signature and description
 */
export function FunctionPicker({ isOpen, onSelect, onClose }: FunctionPickerProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get filtered functions based on search
  const filteredFunctions = useMemo(() => {
    return searchFunctions(search, 50); // Show more results in picker
  }, [search]);

  // Group functions by category
  const groupedFunctions = useMemo(() => {
    const groups: Record<string, FunctionInfo[]> = {};
    for (const fn of filteredFunctions) {
      if (!groups[fn.category]) {
        groups[fn.category] = [];
      }
      groups[fn.category].push(fn);
    }
    return groups;
  }, [filteredFunctions]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    return Object.values(groupedFunctions).flat();
  }, [groupedFunctions]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      // Focus input after render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      // Guard for environments where scrollIntoView is not available (e.g., JSDOM)
      if (selectedElement && typeof selectedElement.scrollIntoView === 'function') {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setSelectedIndex(0);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatList[selectedIndex]) {
            onSelect(flatList[selectedIndex].name);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatList, selectedIndex, onSelect, onClose]
  );

  const handleSelect = useCallback(
    (functionName: string) => {
      onSelect(functionName);
    },
    [onSelect]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
        role="dialog"
        aria-label="Choose a function"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h2 className="text-sm font-semibold text-gray-700">Choose a Function</h2>
          <button
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Search Input */}
        <div className="px-4 py-3 border-b border-gray-100">
          <input
            ref={inputRef}
            type="text"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
            placeholder="Search functions (e.g., SUM, IF, VLOOKUP)..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Function List */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-2">
          {flatList.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-8">
              No functions match &quot;{search}&quot;
            </div>
          ) : (
            Object.entries(groupedFunctions).map(([category, functions]) => (
              <div key={category} className="mb-3">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {category}
                </div>
                {functions.map((fn) => {
                  const globalIndex = flatList.indexOf(fn);
                  const isSelected = globalIndex === selectedIndex;
                  const schema = getFunctionSchema(fn.name);

                  return (
                    <button
                      key={fn.name}
                      data-index={globalIndex}
                      className={`w-full text-left px-3 py-2 rounded flex items-start gap-3 transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-l-2 border-l-blue-500'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleSelect(fn.name)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <span className="font-mono text-sm font-semibold text-blue-700 min-w-[90px]">
                        {fn.name}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-500 truncate">
                          {fn.signature}
                        </div>
                        <div className="text-xs text-gray-400">{fn.description}</div>
                      </div>
                      {schema && (
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                          {schema.parameters.length} params
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>↑↓ Navigate • Enter Select • Esc Close</span>
            <span>{flatList.length} functions</span>
          </div>
        </div>
      </div>
    </div>
  );
}
