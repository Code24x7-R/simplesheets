// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * CloudStorageModal — Save / Open / Share
 *
 * Zero-config actions (Copy Link, Share File, Save to File, Open from File)
 * work immediately on any device. Cloud accounts are opt-in behind the
 * Advanced collapsible; selecting one shows an invite/setup panel rather than
 * a dead-end error, since OAuth credentials are required before any provider
 * can be wired up.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ComponentType, SVGProps } from 'react';
import {
  X,
  Link,
  Share2,
  Download,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Cloud,
  HardDrive,
  AlertCircle,
  Check,
  Info,
} from 'lucide-react';
import type { Workbook } from '../types';
import type { CloudProvider } from '../cloud/types';
import { encodeDocToUrl, estimateShareSize, canShareViaUrl } from '../utils/shareUrl';
import { downloadDocument, shareDocument } from '../utils/webShare';
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

/** localStorage key for the "don't show again" cloud invite preference. */
const CLOUD_INVITE_DISMISSED_KEY = 'simplesheets:cloud-invite-dismissed';

function providerLabel(provider: CloudProvider): string {
  return provider === 'google' ? 'Google Drive' : provider === 'onedrive' ? 'OneDrive' : 'S3-Compatible';
}

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
  const [fileName, setFileName] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [inviteProvider, setInviteProvider] = useState<CloudProvider | null>(null);
  const [hideInvite, setHideInvite] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CLOUD_INVITE_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

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
      setInviteProvider(null);
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
      const name = fileName.trim() || 'Untitled';
      const result = await shareDocument(workbook, name);
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
  }, [workbook, fileName, onClose, onStatusMessage]);

  const handleSaveToFile = useCallback(() => {
    setError(null);
    const name = fileName.trim() || 'Untitled';
    downloadDocument(workbook, name);
    onStatusMessage?.(`Saved "${name}.ssjson" — download started`);
    // Notify host app for MRU recording, title update, and history push
    onSaveFile?.(name, JSON.stringify(workbook).length);
    onClose();
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

  // ─── Cloud provider invite handlers ─────────────────────────────────────

  const handleConnect = useCallback((providerId: CloudProvider) => {
    setError(null);
    setInviteProvider(providerId);
  }, []);

  const handleDismissInviteForever = useCallback(() => {
    try {
      localStorage.setItem(CLOUD_INVITE_DISMISSED_KEY, 'true');
    } catch {
      // ignore storage failures
    }
    setHideInvite(true);
    setInviteProvider(null);
  }, []);

  const handleShowProviders = useCallback(() => {
    try {
      localStorage.removeItem(CLOUD_INVITE_DISMISSED_KEY);
    } catch {
      // ignore storage failures
    }
    setHideInvite(false);
    setAdvancedOpen(true);
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────

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
        aria-label={mode === 'save' ? 'Share' : 'Open from Cloud'}
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
              {mode === 'save' ? 'Share' : 'Open from Cloud'}
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
          {inviteProvider ? (
            <InvitePanel
              provider={inviteProvider}
              onBack={() => setInviteProvider(null)}
              onDismissForever={handleDismissInviteForever}
            />
          ) : (
            <HomeView
              mode={mode}
              linkTooLarge={linkTooLarge}
              linkSizeLabel={linkSizeLabel}
              linkCopied={linkCopied}
              advancedOpen={advancedOpen}
              hideInvite={hideInvite}
              fileName={fileName}
              onFileNameChange={setFileName}
              onCopyLink={handleCopyLink}
              onShareFile={handleShareFile}
              onSaveToFile={handleSaveToFile}
              onOpenFile={handleOpenFile}
              onToggleAdvanced={() => setAdvancedOpen((prev) => !prev)}
              onConnect={handleConnect}
              onShowProviders={handleShowProviders}
            />
          )}
        </div>

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
  fileName: string;
  onFileNameChange: (name: string) => void;
  linkTooLarge: boolean;
  linkSizeLabel: string;
  linkCopied: boolean;
  advancedOpen: boolean;
  hideInvite: boolean;
  onCopyLink: () => void;
  onShareFile: () => void;
  onSaveToFile: () => void;
  onOpenFile: () => void;
  onToggleAdvanced: () => void;
  onConnect: (provider: CloudProvider) => void;
  onShowProviders: () => void;
}

function HomeView({
  mode,
  fileName,
  onFileNameChange,
  linkTooLarge,
  linkSizeLabel,
  linkCopied,
  advancedOpen,
  hideInvite,
  onCopyLink,
  onShareFile,
  onSaveToFile,
  onOpenFile,
  onToggleAdvanced,
  onConnect,
  onShowProviders,
}: HomeViewProps) {
  return (
    <div className="space-y-2">
      {/* Filename — save mode only */}
      {mode === 'save' && (
        <div className="mb-3">
          <label htmlFor="cloud-filename" className="block text-xs font-medium text-gray-600 mb-1">
            Filename
          </label>
          <div className="flex items-center gap-2">
            <input
              id="cloud-filename"
              type="text"
              value={fileName}
              onChange={(e) => onFileNameChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter filename"
            />
            <span className="text-sm text-gray-400 font-mono">.ssjson</span>
          </div>
        </div>
      )}

      {/* Copy Link — save mode only */}
      {mode === 'save' && (
        <button
          onClick={onCopyLink}
          disabled={linkTooLarge}
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
          className="w-full flex items-start gap-3 px-3 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
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
          className="w-full flex items-start gap-3 px-3 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
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
          className="w-full flex items-start gap-3 px-3 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
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
      {hideInvite ? (
        <div className="pt-2">
          <button
            onClick={onShowProviders}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cloud accounts hidden — show again
          </button>
        </div>
      ) : (
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
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                >
                  <p.icon className="w-5 h-5 text-gray-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{p.label}</div>
                    <div className="text-xs text-gray-500">{p.description}</div>
                  </div>
                </button>
              ))}
              <p className="text-xs text-gray-400 pt-1 px-1">
                Cloud accounts require setup. Use the options above for instant sharing.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Invite Panel ───────────────────────────────────────────────────────────

interface InvitePanelProps {
  provider: CloudProvider;
  onBack: () => void;
  onDismissForever: () => void;
}

function InvitePanel({ provider, onBack, onDismissForever }: InvitePanelProps) {
  const label = providerLabel(provider);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Cloud className="w-4 h-4 text-blue-600" />
        Connect {label}
      </div>

      <div className="px-3 py-3 bg-blue-50 border border-blue-200 rounded flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-800 flex-1">
          {label} requires one-time setup before it can be used. Until then, use
          Copy Link, Share File, or Save to File — they work instantly with no
          configuration.
        </div>
      </div>

      <ul className="space-y-2 text-sm text-gray-700">
        <li className="flex gap-2">
          <span className="text-blue-600">1.</span>
          <span>Create OAuth credentials in the {label} developer console.</span>
        </li>
        <li className="flex gap-2">
          <span className="text-blue-600">2.</span>
          <span>Add the redirect URI for this app to the credentials.</span>
        </li>
        <li className="flex gap-2">
          <span className="text-blue-600">3.</span>
          <span>Wire the credentials into the app&apos;s provider integration.</span>
        </li>
      </ul>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
        <button
          onClick={onDismissForever}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Don&apos;t show again
        </button>
      </div>
    </div>
  );
}
