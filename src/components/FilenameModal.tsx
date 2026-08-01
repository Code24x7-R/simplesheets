// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useState, useRef, useEffect } from 'react';

interface FilenameModalProps {
  isOpen: boolean;
  title: string;
  defaultName: string;
  extension: string;
  onConfirm: (filename: string) => void;
  onCancel: () => void;
}

/**
 * Modal that prompts the user for a filename before saving/exporting.
 * Validates the filename and handles collision warnings.
 */
export function FilenameModal({
  isOpen,
  title,
  defaultName,
  extension,
  onConfirm,
  onCancel,
}: FilenameModalProps) {
  const [filename, setFilename] = useState(defaultName);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFilename(defaultName);
      setError('');
      // Focus and select the filename input when modal opens
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const validateFilename = (name: string): string => {
    if (!name.trim()) return 'Filename is required';
    if (name.length > 255) return 'Filename too long (max 255 characters)';
    if (/[<>:"/\\|?*]/.test(name)) return 'Filename contains invalid characters (< > : " / \\ | ? *)';
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(name)) return 'Reserved system filename';
    if (name.startsWith('.') || name.endsWith('.') || name.endsWith(' ')) {
      return 'Filename cannot start/end with a period or space';
    }
    return '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = filename.trim();
    const validationError = validateFilename(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[420px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Enter a filename for your {extension.toUpperCase()} file
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={filename}
              onChange={(e) => {
                setFilename(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              className={`flex-1 px-3 py-2 border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error ? 'border-red-400' : 'border-gray-300'
              }`}
              placeholder="Enter filename"
            />
            <span className="text-sm text-gray-400 font-mono">.{extension}</span>
          </div>
          {error && (
            <p className="text-xs text-red-500 mt-2" role="alert">{error}</p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Only letters, numbers, hyphens, and underscores allowed
          </p>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200">
          <button
            type="button"
            className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
            onClick={handleSubmit}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
