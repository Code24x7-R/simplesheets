interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: 'Arrow Keys', description: 'Move cell selection' },
      { keys: 'Shift + Arrow', description: 'Extend selection range' },
      { keys: 'Home', description: 'Jump to start of row' },
      { keys: 'Ctrl + Home', description: 'Jump to cell A1' },
      { keys: 'Tab', description: 'Move right (commit edit)' },
      { keys: 'Shift + Tab', description: 'Move left (commit edit)' },
    ],
  },
  {
    title: 'Editing',
    shortcuts: [
      { keys: 'F2', description: 'Enter edit mode for current cell' },
      { keys: 'Ctrl + F2', description: 'Toggle focus between formula bar and grid' },
      { keys: 'Enter', description: 'Commit value, move down' },
      { keys: 'Shift + Enter', description: 'Commit value, move up' },
      { keys: 'Escape', description: 'Cancel edit, restore value' },
      { keys: 'Backspace / Delete', description: 'Clear cell contents' },
      { keys: 'F4', description: 'Cycle reference style ($A$1 → A$1 → $A1 → A1)' },
      { keys: 'Ctrl + H', description: 'Find & Replace' },
    ],
  },
  {
    title: 'Clipboard',
    shortcuts: [
      { keys: 'Ctrl + A', description: 'Select all cells (or all text when editing)' },
      { keys: 'Ctrl + C', description: 'Copy selection' },
      { keys: 'Ctrl + X', description: 'Cut selection' },
      { keys: 'Ctrl + V', description: 'Paste to selection' },
    ],
  },
  {
    title: 'History',
    shortcuts: [
      { keys: 'Ctrl + Z', description: 'Undo last action' },
      { keys: 'Ctrl + Y', description: 'Redo last undo' },
      { keys: 'Ctrl + Shift + Z', description: 'Redo (alternate)' },
    ],
  },
  {
    title: 'Formatting',
    shortcuts: [
      { keys: 'Ctrl + B', description: 'Toggle bold' },
      { keys: 'Ctrl + I', description: 'Toggle italic' },
      { keys: 'Ctrl + U', description: 'Toggle underline' },
    ],
  },
  {
    title: 'File',
    shortcuts: [
      { keys: 'Ctrl + N', description: 'New workbook' },
      { keys: 'Ctrl + S', description: 'Save workbook' },
      { keys: 'Ctrl + O', description: 'Open workbook' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: 'Ctrl + `', description: 'Toggle formula view (show formulas vs values)' },
    ],
  },
];

const HINTS: string[] = [
  'Click column/row headers to select entire columns/rows.',
  'Shift + click to extend the selection range.',
  'Start a formula with = (e.g., =SUM(A1:A10)).',
  'Use $ for absolute references (e.g., $A$1 won\'t shift on paste).',
  'Freeze panes via View menu to keep headers visible while scrolling.',
  'Resize columns/rows by dragging header borders.',
  'Escape clears the marching-ants clipboard selection.',
  'Type =SUM( then click cells or drag to build ranges visually.',
];

/**
 * Modal displaying keyboard shortcuts and usage hints.
 * Triggered from the Help → Keyboard Shortcuts menu.
 */
export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-[640px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold">Keyboard Shortcuts &amp; Hints</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Shortcut groups */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold text-gray-700 mb-1.5">{group.title}</h3>
                <div className="space-y-1">
                  {group.shortcuts.map((sc) => (
                    <div key={sc.keys} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{sc.description}</span>
                      <kbd className="ml-2 px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[11px] font-mono text-gray-700 whitespace-nowrap">
                        {sc.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Hints section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1.5">💡 Tips &amp; Hints</h3>
            <ul className="space-y-1 text-xs text-gray-600 list-disc list-inside">
              {HINTS.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-gray-200">
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
