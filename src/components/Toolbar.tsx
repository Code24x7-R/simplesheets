// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Undo2,
  Redo2,
  Copy,
  Scissors,
  ClipboardPaste,
  BarChart3,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  PaintBucket,
  ChevronDown,
} from 'lucide-react';
import { BorderAll } from './icons/BorderIcons';
import { BORDER_COLORS } from '../hooks/useCellStyle';

/** Border preset definition with icon pattern. */
interface BorderPreset {
  id: string;
  label: string;
  /** Which edges to show on the icon preview: top, bottom, left, right. */
  edges: ('top' | 'bottom' | 'left' | 'right')[];
  /** Whether this is an "outside" border (range-level, not cell-level). */
  isOutside?: boolean;
}

/** Common border presets matching Excel's border dropdown. */
const BORDER_PRESETS: BorderPreset[] = [
  { id: 'none', label: 'No Border', edges: [] },
  { id: 'all', label: 'All Borders', edges: ['top', 'bottom', 'left', 'right'] },
  { id: 'outside', label: 'Outside Borders', edges: ['top', 'bottom', 'left', 'right'], isOutside: true },
  { id: 'top', label: 'Top Border', edges: ['top'] },
  { id: 'bottom', label: 'Bottom Border', edges: ['bottom'] },
  { id: 'left', label: 'Left Border', edges: ['left'] },
  { id: 'right', label: 'Right Border', edges: ['right'] },
  { id: 'thick-outside', label: 'Thick Outside', edges: ['top', 'bottom', 'left', 'right'], isOutside: true },
  { id: 'double-bottom', label: 'Double Bottom', edges: ['bottom'] },
  { id: 'top-bottom', label: 'Top and Bottom', edges: ['top', 'bottom'] },
  { id: 'inside', label: 'Inside Borders', edges: ['top', 'bottom', 'left', 'right'] },
];

interface ToolbarProps {
  // ── Formatting callbacks ─────────────────────────────────────────
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleUnderline: () => void;
  onToggleStrikethrough: () => void;
  onSetTextColor: (color: string) => void;
  onSetBackgroundColor: (color: string) => void;
  onSetAlignLeft: () => void;
  onSetAlignCenter: () => void;
  onSetAlignRight: () => void;
  onSetNumberFormat: (format: string) => void;
  // ── Border callbacks ─────────────────────────────────────────────
  onSetBorderTop: () => void;
  onSetBorderBottom: () => void;
  onSetBorderLeft: () => void;
  onSetBorderRight: () => void;
  onSetBorderAll: () => void;
  onSetBorderOutside: () => void;
  onClearBorders: () => void;
  onSetBorderColor: (color: string) => void;
  // ── Clipboard callbacks ──────────────────────────────────────────
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  // ── Chart callback ─────────────────────────────────────────────
  onChart: () => void;
  // ── State ────────────────────────────────────────────────────────
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  canUndo: boolean;
  canRedo: boolean;
  borderColor: string;
  // ── Conditional Formatting ───────────────────────────────────────
  onOpenConditionalFormat?: () => void;
  // ── Data Validation ──────────────────────────────────────────────
  onOpenDataValidation?: () => void;
}

/**
 * A beautiful, functional toolbar with border presets, formatting buttons,
 * and quick-access clipboard actions.
 */
export function Toolbar(props: ToolbarProps) {
  const [borderDropdownOpen, setBorderDropdownOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState<'text' | 'fill' | 'border' | null>(null);
  const borderBtnRef = useRef<HTMLButtonElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const borderDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (borderDropdownRef.current && !borderDropdownRef.current.contains(e.target as Node)) {
        setBorderDropdownOpen(false);
      }
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBorderPreset = useCallback(
    (preset: BorderPreset) => {
      switch (preset.id) {
        case 'none':
          props.onClearBorders();
          break;
        case 'all':
          props.onSetBorderAll();
          break;
        case 'outside':
        case 'thick-outside':
          props.onSetBorderOutside();
          break;
        case 'top':
          props.onSetBorderTop();
          break;
        case 'bottom':
        case 'double-bottom':
          props.onSetBorderBottom();
          break;
        case 'left':
          props.onSetBorderLeft();
          break;
        case 'right':
          props.onSetBorderRight();
          break;
        case 'top-bottom':
          props.onSetBorderTop();
          props.onSetBorderBottom();
          break;
        case 'inside':
          props.onSetBorderAll();
          break;
      }
      setBorderDropdownOpen(false);
    },
    [props]
  );

  return (
    <div className="toolbar flex items-center gap-1 px-3 py-1 border-b border-gray-200 bg-white flex-wrap">
      {/* ── Clipboard Section ──────────────────────────────────────── */}
      <div className="toolbar-section flex items-center gap-0.5">
        <button
          className="toolbar-btn"
          onClick={props.onUndo}
          title="Undo (Ctrl+Z)"
          disabled={!props.canUndo}
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          className="toolbar-btn"
          onClick={props.onRedo}
          title="Redo (Ctrl+Y)"
          disabled={!props.canRedo}
        >
          <Redo2 className="w-4 h-4" />
        </button>
        <button className="toolbar-btn" onClick={props.onCopy} title="Copy (Ctrl+C)">
          <Copy className="w-4 h-4" />
        </button>
        <button className="toolbar-btn" onClick={props.onCut} title="Cut (Ctrl+X)">
          <Scissors className="w-4 h-4" />
        </button>
        <button className="toolbar-btn" onClick={props.onPaste} title="Paste (Ctrl+V)">
          <ClipboardPaste className="w-4 h-4" />
        </button>
        <button className="toolbar-btn" onClick={props.onChart} title="Insert Chart">
          <BarChart3 className="w-4 h-4" />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* ── Font Formatting Section ─────────────────────────────────── */}
      <div className="toolbar-section flex items-center gap-0.5">
        <button
          className={`toolbar-btn ${props.isBold ? 'bg-blue-100 text-blue-700' : ''}`}
          onClick={props.onToggleBold}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          className={`toolbar-btn ${props.isItalic ? 'bg-blue-100 text-blue-700' : ''}`}
          onClick={props.onToggleItalic}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          className={`toolbar-btn ${props.isUnderline ? 'bg-blue-100 text-blue-700' : ''}`}
          onClick={props.onToggleUnderline}
          title="Underline (Ctrl+U)"
        >
          <Underline className="w-4 h-4" />
        </button>
        <button
          className="toolbar-btn"
          onClick={props.onToggleStrikethrough}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* ── Color Section ───────────────────────────────────────────── */}
      <div className="toolbar-section flex items-center gap-1 relative" ref={colorPickerRef}>
        {/* Text Color */}
        <div className="relative">
          <button
            className="toolbar-btn flex flex-col items-center"
            onClick={() => setColorPickerOpen(colorPickerOpen === 'text' ? null : 'text')}
            title="Text Color"
          >
            <Palette className="w-4 h-4" />
            <span className="w-4 h-1 rounded-sm mt-0.5" style={{ backgroundColor: '#000000' }} />
          </button>
          {colorPickerOpen === 'text' && (
            <div className="color-picker-popover" onClick={(e) => e.stopPropagation()}>
              <div className="color-grid">
                {BORDER_COLORS.map((color) => (
                  <button
                    key={color}
                    className="color-cell"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      props.onSetTextColor(color);
                      setColorPickerOpen(null);
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fill Color */}
        <div className="relative">
          <button
            className="toolbar-btn flex flex-col items-center"
            onClick={() => setColorPickerOpen(colorPickerOpen === 'fill' ? null : 'fill')}
            title="Fill Color"
          >
            <PaintBucket className="w-4 h-4" />
            <span className="w-4 h-1 rounded-sm mt-0.5 bg-yellow-300" />
          </button>
          {colorPickerOpen === 'fill' && (
            <div className="color-picker-popover" onClick={(e) => e.stopPropagation()}>
              <div className="color-grid">
                {BORDER_COLORS.map((color) => (
                  <button
                    key={color}
                    className="color-cell"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      props.onSetBackgroundColor(color);
                      setColorPickerOpen(null);
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Border Color */}
        <div className="relative">
          <button
            className="toolbar-btn flex flex-col items-center"
            onClick={() => setColorPickerOpen(colorPickerOpen === 'border' ? null : 'border')}
            title="Border Color"
          >
            <BorderAll className="w-4 h-4" />
            <span className="w-4 h-1 rounded-sm mt-0.5" style={{ backgroundColor: props.borderColor }} />
          </button>
          {colorPickerOpen === 'border' && (
            <div className="color-picker-popover" onClick={(e) => e.stopPropagation()}>
              <div className="color-grid">
                {BORDER_COLORS.map((color) => (
                  <button
                    key={color}
                    className="color-cell"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      props.onSetBorderColor(color);
                      setColorPickerOpen(null);
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* ── Alignment Section ───────────────────────────────────────── */}
      <div className="toolbar-section flex items-center gap-0.5">
        <button className="toolbar-btn" onClick={props.onSetAlignLeft} title="Align Left">
          <AlignLeft className="w-4 h-4" />
        </button>
        <button className="toolbar-btn" onClick={props.onSetAlignCenter} title="Align Center">
          <AlignCenter className="w-4 h-4" />
        </button>
        <button className="toolbar-btn" onClick={props.onSetAlignRight} title="Align Right">
          <AlignRight className="w-4 h-4" />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* ── Borders Dropdown ────────────────────────────────────────── */}
      <div className="toolbar-section relative flex items-center" ref={borderDropdownRef}>
        <button
          ref={borderBtnRef}
          className={`toolbar-btn flex items-center gap-1 ${borderDropdownOpen ? 'bg-gray-200' : ''}`}
          onClick={() => setBorderDropdownOpen(!borderDropdownOpen)}
          title="Borders"
        >
          <BorderAll className="w-4 h-4" />
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        {borderDropdownOpen && (
          <div className="border-dropdown">
            <div className="border-presets-grid">
              {BORDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="border-preset-btn"
                  onClick={() => handleBorderPreset(preset)}
                  title={preset.label}
                >
                  <BorderIcon edges={preset.edges} isOutside={preset.isOutside} />
                  <span className="border-preset-label">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="toolbar-divider" />

      {/* ── Number Format ───────────────────────────────────────────── */}
      <div className="toolbar-section flex items-center gap-0.5">
        <button
          className="toolbar-btn text-xs"
          onClick={() => props.onSetNumberFormat('General')}
          title="General format"
        >
          Gen
        </button>
        <button
          className="toolbar-btn text-xs"
          onClick={() => props.onSetNumberFormat('0.00')}
          title="Number format (0.00)"
        >
          123
        </button>
        <button
          className="toolbar-btn text-xs"
          onClick={() => props.onSetNumberFormat('$#,##0.00')}
          title="Currency format"
        >
          $
        </button>
        <button
          className="toolbar-btn text-xs"
          onClick={() => props.onSetNumberFormat('_($*#,##0.00_);_($*(#,##0.00);_($* "-"??_);_(@_)')}
          title="Accounting format (left-aligned $, right-aligned number, dash for zero)"
        >
          Acct
        </button>
        <button
          className="toolbar-btn text-xs"
          onClick={() => props.onSetNumberFormat('0.00%')}
          title="Percent format"
        >
          %
        </button>
        <button
          className="toolbar-btn text-xs"
          onClick={() => props.onSetNumberFormat('mm/dd/yyyy')}
          title="Date format (MM/DD/YYYY)"
        >
          📅
        </button>
        <button
          className="toolbar-btn text-xs"
          onClick={() => props.onSetNumberFormat('@')}
          title="Text format — preserves literal values (leading zeros, IDs)"
        >
          Abc
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* ── Conditional Formatting ───────────────────────────────────── */}
      <div className="toolbar-section flex items-center gap-0.5">
        <button
          className="toolbar-btn text-xs"
          onClick={props.onOpenConditionalFormat}
          title="Conditional Formatting — highlight cells based on conditions"
        >
          🎨
        </button>
        <button
          className="toolbar-btn text-xs"
          onClick={props.onOpenDataValidation}
          title="Data Validation — restrict cell entries"
        >
          ✓
        </button>
      </div>
    </div>
  );
}

/** Small icon preview showing which edges have borders. */
function BorderIcon({ edges, isOutside }: { edges: ('top' | 'bottom' | 'left' | 'right')[]; isOutside?: boolean }) {
  const hasTop = edges.includes('top');
  const hasBottom = edges.includes('bottom');
  const hasLeft = edges.includes('left');
  const hasRight = edges.includes('right');
  const borderStyle = isOutside ? '2px solid #333' : '1.5px solid #555';

  return (
    <div className="border-icon-container">
      <div
        className="border-icon-box"
        style={{
          borderTop: hasTop ? borderStyle : '1px solid #ddd',
          borderBottom: hasBottom ? borderStyle : '1px solid #ddd',
          borderLeft: hasLeft ? borderStyle : '1px solid #ddd',
          borderRight: hasRight ? borderStyle : '1px solid #ddd',
        }}
      >
        {edges.length === 0 && <span className="border-icon-none">∅</span>}
      </div>
    </div>
  );
}
