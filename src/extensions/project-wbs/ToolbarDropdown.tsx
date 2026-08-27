// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * ToolbarDropdown — A reusable dropdown menu for toolbar actions.
 *
 * Groups related actions under a single trigger button to reduce
 * toolbar clutter. Closes on outside click or item selection.
 */

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

interface ToolbarDropdownProps {
  label: string;
  children: ReactNode;
  iconOnly?: boolean;
}

export function ToolbarDropdown({ label, children, iconOnly = false }: ToolbarDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleItemClick = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        className={
          iconOnly
            ? 'px-2 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50'
            : 'px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1'
        }
        onClick={handleToggle}
        title={label}
      >
        {!iconOnly && (
          <>
            {label}
            <span className="text-[10px]">▼</span>
          </>
        )}
        {iconOnly && label}
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 z-50 min-w-[160px] bg-white border border-gray-200 rounded-lg shadow-lg py-1 overflow-hidden"
          onClick={handleItemClick}
        >
          {children}
        </div>
      )}
    </div>
  );
}
