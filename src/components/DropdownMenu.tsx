// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useState, useRef, useEffect, useCallback } from 'react';

/** A single menu item. */
export interface MenuItem {
  /** Unique identifier for the menu item. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional keyboard shortcut display (e.g., "Ctrl+Z"). */
  shortcut?: string;
  /** Optional emoji/icon prefix. */
  icon?: string;
  /** Whether the item is disabled. */
  disabled?: boolean;
  /** Whether this item is a separator line. */
  separator?: boolean;
  /** Submenu items (if present, clicking opens submenu instead of triggering action). */
  submenu?: MenuItem[];
}

interface DropdownMenuProps {
  /** The label shown on the trigger button. */
  label: string;
  /** Items to display in the dropdown. */
  items: MenuItem[];
  /** Callback when an item is selected. */
  onSelect: (id: string) => void;
}

/**
 * Generic accessible dropdown menu component.
 *
 * Features:
 * - Opens below the trigger button
 * - Closes on click outside or Escape key
 * - Supports nested submenus
 * - Disabled items shown but not clickable
 * - Separators for visual grouping
 */
export function DropdownMenu({ label, items, onSelect }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveSubmenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close menu on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setActiveSubmenu(null);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    setActiveSubmenu(null);
  }, []);

  const handleItemClick = useCallback(
    (item: MenuItem) => {
      if (item.disabled || item.separator) return;
      if (item.submenu) {
        setActiveSubmenu((prev) => (prev === item.id ? null : item.id));
        return;
      }
      onSelect(item.id);
      setIsOpen(false);
      setActiveSubmenu(null);
    },
    [onSelect]
  );

  const handleMouseEnter = useCallback((item: MenuItem) => {
    if (item.submenu) {
      setActiveSubmenu(item.id);
    }
  }, []);

  const renderItem = (item: MenuItem) => {
    if (item.separator) {
      return <div key={item.id} className="menu-separator" />;
    }

    return (
      <div
        key={item.id}
        className={`menu-item ${item.disabled ? 'menu-item-disabled' : ''} ${item.submenu ? 'menu-item-submenu' : ''}`}
        onClick={() => handleItemClick(item)}
        onMouseEnter={() => handleMouseEnter(item)}
        role="menuitem"
        aria-disabled={item.disabled}
      >
        <span className="menu-item-icon">{item.icon ?? ''}</span>
        <span className="menu-item-label">{item.label}</span>
        {item.shortcut && <span className="menu-item-shortcut">{item.shortcut}</span>}
        {item.submenu && <span className="menu-item-arrow">▸</span>}
        {item.submenu && activeSubmenu === item.id && (
          <div className="menu-submenu">
            {item.submenu.map(renderItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="dropdown-menu" ref={menuRef}>
      <button
        ref={triggerRef}
        className={`menu-trigger ${isOpen ? 'menu-trigger-active' : ''}`}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {label}
      </button>
      {isOpen && (
        <div className="menu-dropdown" role="menu">
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );
}
