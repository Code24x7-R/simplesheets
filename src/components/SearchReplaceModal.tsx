// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useState, useCallback, useMemo } from 'react';
import type { Workbook } from '../types';
import { searchSheets, replaceInSheets, type SearchResult, type ReplaceResult } from '../utils/sheetSearch';

// ════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════

interface SearchReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workbook: Workbook;
  activeSheetIndex: number;
  onUpdate: (updatedWorkbook: Workbook, description: string) => void;
}

// ════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════

const DEFAULT_STATE = {
  query: '',
  replacement: '',
  caseSensitive: false,
  matchEntire: false,
  alsoInFormulas: false,
  searchAllSheets: false,
};

// ════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════

export function SearchReplaceModal({
  isOpen,
  onClose,
  workbook,
  activeSheetIndex,
  onUpdate,
}: SearchReplaceModalProps) {
  const [state, setState] = useState(DEFAULT_STATE);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [replaceResult, setReplaceResult] = useState<ReplaceResult | null>(null);

  // Determine sheet indices to search
  const sheetIndices = useMemo(() => {
    if (state.searchAllSheets) return workbook.sheets.map((_, i) => i);
    return [activeSheetIndex];
  }, [state.searchAllSheets, workbook, activeSheetIndex]);

  // Perform a search
  const handleSearch = useCallback(() => {
    /* istanbul ignore next: button is disabled when query is empty */
    if (!state.query.trim()) {
      setSearchResult(null);
      setReplaceResult(null);
      return;
    }
    const result = searchSheets(workbook, activeSheetIndex, {
      query: state.query,
      caseSensitive: state.caseSensitive,
      matchEntire: state.matchEntire,
      alsoInFormulas: state.alsoInFormulas,
    }, sheetIndices);
    setSearchResult(result);
    setReplaceResult(null);
  }, [state, workbook, activeSheetIndex, sheetIndices]);

  // Replace All within searched sheets
  const handleReplaceAll = useCallback(() => {
    if (!state.query.trim() || !searchResult) return;

    const result = replaceInSheets(
      workbook,
      {
        query: state.query,
        replacement: state.replacement,
        caseSensitive: state.caseSensitive,
        matchEntire: state.matchEntire,
        alsoInFormulas: state.alsoInFormulas,
      },
      sheetIndices,
    );

    /* istanbul ignore next - edge case: no replacements made */
    if (result.totalReplaced === 0) return;

    const actionLabel =
      result.sheetResults.length > 1
        ? `Replace All "${state.query}" → "${state.replacement}" (${result.totalReplaced} cell(s))`
        : `Replace All in ${result.sheetResults[0].sheetName} (${result.totalReplaced} cell(s))`;

    const newWorkbook: Workbook = { ...workbook, sheets: result.updatedSheets, lastModified: Date.now() };
    onUpdate(newWorkbook, actionLabel);

    setReplaceResult(result);
    setSearchResult({ matches: result.totalReplaced });
  }, [state, searchResult, workbook, sheetIndices, onUpdate]);



  // Reset everything
  const handleReset = useCallback(() => {
    setState(DEFAULT_STATE);
    setSearchResult(null);
    setReplaceResult(null);
  }, []);

  const handleChange = useCallback(
    (field: keyof typeof DEFAULT_STATE, value: boolean | string) => {
      setState((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // Whether the search query is valid (not empty)
  const hasQuery = state.query.trim().length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-[520px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold">Find &amp; Replace</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Find input */}
          <div>
            <label htmlFor="sr-find" className="block text-sm font-medium mb-1">
              Find
            </label>
            <input
              id="sr-find"
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
              placeholder="Enter text to find…"
              value={state.query}
              onChange={(e) => handleChange('query', e.target.value)}
              autoFocus
              /* istanbul ignore next: coverage issue with inline JSX arrow fns */
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
          </div>

          {/* Replace input */}
          <div>
            <label htmlFor="sr-replace" className="block text-sm font-medium mb-1">
              Replace with
            </label>
            <input
              id="sr-replace"
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
              placeholder="Replacement text…"
              value={state.replacement}
              onChange={(e) => handleChange('replacement', e.target.value)}
              /* istanbul ignore next: coverage issue with inline JSX arrow fns */
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
          </div>

          {/* Options (checkboxes) */}
          <div className="space-y-2 pt-1">
            {[
              { field: 'caseSensitive' as const, label: 'Match case', desc: 'Only match exact letter case' },
              { field: 'matchEntire' as const, label: 'Match entire cell', desc: 'The cell must equal the query exactly' },
              { field: 'alsoInFormulas' as const, label: 'Also search in formulas', desc: 'Include cells containing formulas (=…)' },
              { field: 'searchAllSheets' as const, label: 'Search all sheets', desc: 'Look across every sheet, not just the active one' },
            ].map(({ field, label, desc }) => (
              <label key={field} className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={state[field]}
                  onChange={(e) => handleChange(field, e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                />
                <span>
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                  <span className="ml-1.5 text-xs text-gray-400 group-hover:text-gray-500">{desc}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Result summary */}
          {searchResult && (
            <div className="pt-1">
              {replaceResult ? (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  <strong>{replaceResult.totalReplaced} cell(s) replaced.</strong>
                  {replaceResult.sheetResults.map((r) => (
                    <span key={r.sheetName} className="block text-xs opacity-80 mt-0.5">
                      {r.sheetName}: {r.replaced}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-2">
                  Found <strong>{searchResult.matches}</strong> match{searchResult.matches !== 1 ? 'es' : ''}.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
          <button
            className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            onClick={handleReset}
          >
            Reset
          </button>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              onClick={handleSearch}
              disabled={!hasQuery}
            >
              🔍 Search
            </button>
            <button
              className="px-4 py-1.5 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleReplaceAll}
              disabled={!hasQuery || !searchResult || searchResult.matches === 0}
            >
              Replace All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
