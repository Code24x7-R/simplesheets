// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * CloudStorageModal — Save to Cloud / Open from Cloud
 *
 * A two-view modal:
 *  - Home view (no provider): userland actions (Copy Link, Share File,
 *    Save to File, Open from File) + Advanced collapsible for cloud accounts.
 *  - Provider view (after connecting): save form or file list.
 *
 * Userland actions require zero configuration — they work immediately on any
 * device. Cloud accounts are opt-in behind the Advanced collapsible.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ComponentType, SVGProps } from 'react';
import {
  X,
  Link,
  Share2,
  Download,
  Upload,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Cloud,
  HardDrive,
  RefreshCw,
  Loader2,
  AlertCircle,
  Check,
  Trash2,
  FileJson,
  ExternalLink,
} from 'lucide-react';
import type { Workbook } from '../types';
import type { CloudProvider, CloudFile } from '../cloud/types';
import { encodeDocToUrl, estimateShareSize, canShareViaUrl } from '../utils/shareUrl';
import { shareDocument } from '../utils/webShare';
import { readWorkbookFile, ACCEPTED_FILE_TYPES } from '../utils/fileIO';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Any component that accepts SVGProps (lucide icons). */
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface CloudStorageModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Callback to close the modal. */
  onClose: () => void;
  /** Whether the modal is in save or open mode. */
  mode: 'save' | 'open';
  /** The current workbook (for save/share operations). */
  workbook: Workbook;
  /** Callback when a document is opened from a file or cloud provider. */
  onOpenDocument: (workbook: Workbook, fileName: string) => void;
  /** Callback to show a status message in the host app. */
  onStatusMessage?: (msg: string) => void;
  /** Callback after a file is saved locally (for MRU recording, title update, history). */
  onSaveFile?: (fileName: string, sizeBytes: number) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Cloud providers shown in the Advanced collapsible. */
const PROVIDERS: { id: CloudProvider; label: string; icon: IconComponent; description: string }[] = [
  { id: 'google', label: 'Google Drive', icon: HardDrive, description: 'Save and open from Google Drive' },
  { id: 'onedrive', label: 'OneDrive', icon: HardDrive, description: 'Save and open from Microsoft OneDrive' },
  { id: 's3', label: 'S3-Compatible', icon: Cloud, description: 'Save and open from S3-compatible storage' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function CloudStorageModal({
  isOpen,
  onClose,
  mode,
  workbook,
  onOpenDocument,
  onStatusMessage,
  onSaveFile,
}: CloudStorageModalProps) {
  // View state
  const [provider, setProvider] = useState<CloudProvider | null>(null);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [fileName, setFileName] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Async / loading state
  // setLoadingFiles / setSaving are reserved for cloud provider integration
  // (they remain unused until OAuth/API flows are wired up).
  const [loadingFiles, _setLoadingFiles] = useState(false);
  const [saving, _setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // Mark setters as intentionally reserved for future provider integration
  void _setLoadingFiles;
  void _setSaving;

  // Refs
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // ─── Reset on open ──────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      // Remember the element that had focus so we can restore it on close
      triggerRef.current = document.activeElement as HTMLElement;
      setFileName(workbook.title.replace(/[^a-zA-Z0-9-_]/g, '_') || 'Untitled');
      setError(null);
      setProvider(null);
      setFiles([]);
      setAdvancedOpen(false);
      setLinkCopied(false);
    }
  }, [isOpen, workbook.title]);

  // ─── Focus trap ─────────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Trap focus within the modal
      const focusable = cardRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  // Restore focus to the trigger element on close
  useEffect(() => {
    if (!isOpen && triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [isOpen]);

  // ─── Size guard ─────────────────────────────────────────────────────────

  let linkTooLarge = false;
  let linkSizeLabel = '';
  try {
    const size = estimateShareSize(workbook);
    linkTooLarge = !canShareViaUrl(workbook);
    linkSizeLabel = `${Math.round(size / 1024)} KB`;
  } catch {
    linkTooLarge = true;
  }

  // ─── Userland handlers ──────────────────────────────────────────────────

  const handleCopyLink = useCallback(async () => {
    setError(null);
    try {
      const baseUrl = `${window.location.origin}${window.location.pathname}`;
      const url = encodeDocToUrl(workbook, baseUrl);
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      onStatusMessage?.('Link copied to clipboard — share it with anyone');
      setTimeout(() => onClose(), 1200);
    } catch {
      setError('Failed to copy link to clipboard');
    }
  }, [workbook, onClose, onStatusMessage]);

  const handleShareFile = useCallback(async () => {
    setError(null);
    try {
      const result = await shareDocument(workbook, workbook.title || 'Untitled');
      if (result === 'shared') {
        onStatusMessage?.('Share sheet opened');
        onClose();
      } else if (result === 'fallback') {
        onStatusMessage?.('File downloaded — sharing not supported on this browser');
        onClose();
      }
      // 'cancelled' — stay open, no error.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share file');
    }
  }, [workbook, onClose, onStatusMessage]);

  const handleSaveToFile = useCallback(() => {
    setError(null);
    const name = fileName.trim() || 'Untitled';
    // Import here to avoid circular deps; reuses the download logic
    import('../utils/webShare').then(({ downloadDocument }) => {
      downloadDocument(workbook, name);
      onStatusMessage?.(`Saved "${name}.ssjson" — download started`);
      // Notify host app for MRU recording, title update, and history push
      onSaveFile?.(name, JSON.stringify(workbook).length);
      onClose();
    });
  }, [workbook, fileName, onClose, onStatusMessage, onSaveFile]);

  const handleOpenFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilePicked = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // Reset so the same file can be re-selected
      if (!file) return;
      setError(null);
      try {
        const wb = await readWorkbookFile(file);
        onOpenDocument(wb, file.name);
        onStatusMessage?.(`Opened "${file.name}"`);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open file');
      }
    },
    [onOpenDocument, onClose, onStatusMessage],
  );

  // ─── Cloud provider handlers (stubs — require SDK setup) ────────────────

  const handleConnect = useCallback(
    async (providerId: CloudProvider) => {
      setBusy(true);
      setError(null);
      try {
        // Cloud providers require OAuth / SDK setup that is beyond the
        // zero-config userland flow. Surface a helpful message.
        throw new Error(
          `${providerId === 'google' ? 'Google Drive' : providerId === 'onedrive' ? 'OneDrive' : 'S3'} integration requires OAuth configuration. Use Copy Link, Share File, or Save to File for instant sharing.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const handleDisconnect = useCallback(() => {
    setProvider(null);
    setFiles([]);
    setError(null);
  }, []);

  // ─── Render helpers ─────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'save' ? 'Save to Cloud' : 'Open from Cloud'}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl w-[480px] flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold">
              {mode === 'save' ? 'Save to Cloud' : 'Open from Cloud'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded flex items-start gap-2" role="alert">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <span className="text-sm text-red-700 flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600" aria-label="Dismiss error">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {provider === null ? (
            <HomeView
              mode={mode}
              linkTooLarge={linkTooLarge}
              linkSizeLabel={linkSizeLabel}
              linkCopied={linkCopied}
              advancedOpen={advancedOpen}
              busy={busy}
              onCopyLink={handleCopyLink}
              onShareFile={handleShareFile}
              onSaveToFile={handleSaveToFile}
              onOpenFile={handleOpenFile}
              onToggleAdvanced={() => setAdvancedOpen((prev) => !prev)}
              onConnect={handleConnect}
            />
          ) : (
            <ProviderView
              provider={provider}
              mode={mode}
              files={files}
              fileName={fileName}
              loadingFiles={loadingFiles}
              saving={saving}
              onFileNameChange={setFileName}
            />
          )}
        </div>

        {/* Footer — only when a provider is connected */}
        {provider && (
          <div className="px-5 py-2 border-t border-gray-200 flex justify-between items-center">
            <button
              onClick={() => { setProvider(null); setFiles([]); }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Switch provider
            </button>
            <button
              onClick={handleDisconnect}
              disabled={busy}
              className="text-xs text-gray-500 hover:text-red-500"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Hidden file input for Open from File */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
          onChange={handleFilePicked}
        />
      </div>
    </div>
  );
}

// ─── Home View ──────────────────────────────────────────────────────────────

interface HomeViewProps {
  mode: 'save' | 'open';
  linkTooLarge: boolean;
  linkSizeLabel: string;
  linkCopied: boolean;
  advancedOpen: boolean;
  busy: boolean;
  onCopyLink: () => void;
  onShareFile: () => void;
  onSaveToFile: () => void;
  onOpenFile: () => void;
  onToggleAdvanced: () => void;
  onConnect: (provider: CloudProvider) => void;
}

function HomeView({
  mode,
  linkTooLarge,
  linkSizeLabel,
  linkCopied,
  advancedOpen,
  busy,
  onCopyLink,
  onShareFile,
  onSaveToFile,
  onOpenFile,
  onToggleAdvanced,
  onConnect,
}: HomeViewProps) {
  return (
    <div className="space-y-2">
      {/* Copy Link — save mode only */}
      {mode === 'save' && (
        <button
          onClick={onCopyLink}
          disabled={busy || linkTooLarge}
          className="w-full flex items-start gap-3 px-3 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {linkCopied ? (
            <Check className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          ) : (
            <Link className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">
              {linkCopied ? 'Link copied!' : 'Copy Link'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {linkTooLarge
                ? `Too large for a link (${linkSizeLabel}). Use Share File instead.`
                : 'Share a link that contains the whole workbook.'}
            </div>
          </div>
        </button>
      )}

      {/* Share File — save mode only */}
      {mode === 'save' && (
        <button
          onClick={onShareFile}
          disabled={busy}
          className="w-full flex items-start gap-3 px-3 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
        >
          <Share2 className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">Share File</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Send the workbook as a .ssjson file via the system share sheet.
            </div>
          </div>
        </button>
      )}

      {/* Save to File — save mode only */}
      {mode === 'save' && (
        <button
          onClick={onSaveToFile}
          disabled={busy}
          className="w-full flex items-start gap-3 px-3 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
        >
          <Download className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">Save to File</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Download the workbook as a .ssjson file to your device.
            </div>
          </div>
        </button>
      )}

      {/* Open from File — open mode only */}
      {mode === 'open' && (
        <button
          onClick={onOpenFile}
          disabled={busy}
          className="w-full flex items-start gap-3 px-3 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
        >
          <FolderOpen className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">Open from File</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Choose a .ssjson file from your device.
            </div>
          </div>
        </button>
      )}

      {/* Advanced collapsible — cloud accounts */}
      <div className="pt-2">
        <button
          onClick={onToggleAdvanced}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          Advanced: cloud accounts
        </button>

        {advancedOpen && (
          <div className="mt-2 space-y-2 pl-1">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => onConnect(p.id)}
                disabled={busy}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
              >
                <p.icon className="w-5 h-5 text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{p.label}</div>
                  <div className="text-xs text-gray-500">{p.description}</div>
                </div>
                {busy ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                ) : (
                  <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </button>
            ))}
            <p className="text-xs text-gray-400 pt-1 px-1">
              Cloud accounts require OAuth setup. Use the options above for instant sharing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Provider View ──────────────────────────────────────────────────────────

interface ProviderViewProps {
  provider: CloudProvider;
  mode: 'save' | 'open';
  files: CloudFile[];
  fileName: string;
  loadingFiles: boolean;
  saving: boolean;
  onFileNameChange: (name: string) => void;
}

function ProviderView({
  provider,
  mode,
  files,
  fileName,
  loadingFiles,
  saving,
  onFileNameChange,
}: ProviderViewProps) {
  const providerLabel = provider === 'google' ? 'Google Drive' : provider === 'onedrive' ? 'OneDrive' : 'S3';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Cloud className="w-4 h-4 text-blue-600" />
        {providerLabel}
      </div>

      {mode === 'save' ? (
        /* Save mode: filename input + Save button */
        <div className="space-y-3">
          <div>
            <label htmlFor="cloud-filename" className="block text-xs font-medium text-gray-600 mb-1">
              Filename
            </label>
            <div className="flex items-center gap-2">
              <input
                id="cloud-filename"
                type="text"
                value={fileName}
                onChange={(e) => onFileNameChange(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter filename"
              />
              <span className="text-sm text-gray-400 font-mono">.ssjson</span>
            </div>
          </div>
          <button
            disabled={saving || !fileName.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Save
          </button>
        </div>
      ) : (
        /* Open mode: file list */
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Files</span>
            <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>

          {loadingFiles ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading files…
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <FileJson className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No .ssjson files found.
            </div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {files.map((file) => (
                <div key={file.id} className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-50 group">
                  <FileJson className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate">{file.name}</div>
                    <div className="text-xs text-gray-400">{file.modifiedTime}</div>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs text-blue-600 hover:text-blue-700">
                    Open
                  </button>
                  <button className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs text-red-500 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
