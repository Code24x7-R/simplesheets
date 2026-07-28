import { useState, useRef, useEffect, useCallback } from 'react';
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
  // ── State ────────────────────────────────────────────────────────
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  canUndo: boolean;
  canRedo: boolean;
  borderColor: string;
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={!props.canUndo ? 'opacity-30' : ''}>
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button
          className="toolbar-btn"
          onClick={props.onRedo}
          title="Redo (Ctrl+Y)"
          disabled={!props.canRedo}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={!props.canRedo ? 'opacity-30' : ''}>
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
          </svg>
        </button>
        <button className="toolbar-btn" onClick={props.onCopy} title="Copy (Ctrl+C)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <button className="toolbar-btn" onClick={props.onCut} title="Cut (Ctrl+X)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
          </svg>
        </button>
        <button className="toolbar-btn" onClick={props.onPaste} title="Paste (Ctrl+V)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* ── Font Formatting Section ─────────────────────────────────── */}
      <div className="toolbar-section flex items-center gap-0.5">
        <button
          className={`toolbar-btn font-bold ${props.isBold ? 'bg-blue-100 text-blue-700' : ''}`}
          onClick={props.onToggleBold}
          title="Bold (Ctrl+B)"
        >
          B
        </button>
        <button
          className={`toolbar-btn italic ${props.isItalic ? 'bg-blue-100 text-blue-700' : ''}`}
          onClick={props.onToggleItalic}
          title="Italic (Ctrl+I)"
        >
          I
        </button>
        <button
          className={`toolbar-btn underline ${props.isUnderline ? 'bg-blue-100 text-blue-700' : ''}`}
          onClick={props.onToggleUnderline}
          title="Underline (Ctrl+U)"
        >
          U
        </button>
        <button
          className="toolbar-btn line-through"
          onClick={props.onToggleStrikethrough}
          title="Strikethrough"
        >
          S
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
            <span className="font-bold text-sm leading-none">A</span>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" fill="#FFFF00" stroke="none" />
              <path d="M3 3h18v18H3z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="4" width="16" height="16" rx="1" />
            </svg>
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="15" y2="12" />
            <line x1="3" y1="18" x2="18" y2="18" />
          </svg>
        </button>
        <button className="toolbar-btn" onClick={props.onSetAlignCenter} title="Align Center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="6" y1="12" x2="18" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <button className="toolbar-btn" onClick={props.onSetAlignRight} title="Align Right">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="9" y1="12" x2="21" y2="12" />
            <line x1="6" y1="18" x2="21" y2="18" />
          </svg>
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="4" width="16" height="16" rx="1" />
            <line x1="12" y1="4" x2="12" y2="20" />
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-60">
            <polyline points="6 9 12 15 18 9" />
          </svg>
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
          onClick={() => props.onSetNumberFormat('0.00%')}
          title="Percent format"
        >
          %
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
