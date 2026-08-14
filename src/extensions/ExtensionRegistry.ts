// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Extension Registry
 *
 * Singleton registry for managing loaded extensions.
 * Supports:
 * - Register/unregister extensions at runtime
 * - Lazy loading (extensions loaded on demand)
 * - Settings persistence per extension (localStorage)
 * - Error isolation (extensions can't crash each other)
 */

import type { SheetExtension, ExtensionContext } from './types';
import type { Workbook } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExtensionEntry {
  extension: SheetExtension;
  initialized: boolean;
  settings: Record<string, unknown>;
}

type ExtensionLoader = () => Promise<SheetExtension>;

// ─── Singleton ──────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'simplesheets:extension:';

class ExtensionRegistryImpl {
  private extensions = new Map<string, ExtensionEntry>();
  private loaders = new Map<string, ExtensionLoader>();
  private getWorkbook: (() => Workbook) | null = null;

  /**
   * Set the workbook provider (called once during app initialization).
   */
  setWorkbookProvider(provider: () => Workbook): void {
    this.getWorkbook = provider;
  }

  /**
   * Build the extension context.
   */
  private createContext(extensionId: string): ExtensionContext {
    const entry = this.extensions.get(extensionId);
    return {
      getWorkbook: () => {
        if (!this.getWorkbook) throw new Error('Workbook provider not set');
        return this.getWorkbook();
      },
      getCellValue: (row: number, col: number) => {
        if (!this.getWorkbook) return null;
        const wb = this.getWorkbook();
        const sheet = wb.sheets[wb.activeSheetIndex];
        if (!sheet) return null;
        const cell = sheet.cells[`${row}:${col}`];
        const value = cell?.computedValue ?? cell?.rawValue ?? null;
        // Filter out boolean values to match the ExtensionContext type
        if (typeof value === 'boolean') return String(value);
        return value;
      },
      saveSettings: (settings: Record<string, unknown>) => {
        if (entry) entry.settings = settings;
        try {
          localStorage.setItem(
            `${STORAGE_PREFIX}${extensionId}`,
            JSON.stringify(settings),
          );
        } catch {
          // localStorage full or unavailable — ignore
        }
      },
      loadSettings: () => {
        if (entry) return entry.settings;
        try {
          const raw = localStorage.getItem(`${STORAGE_PREFIX}${extensionId}`);
          return raw ? JSON.parse(raw) : {};
        } catch {
          return {};
        }
      },
    };
  }

  /**
   * Register an extension.
   */
  register(extension: SheetExtension): void {
    if (this.extensions.has(extension.id)) {
      throw new Error(`Extension "${extension.id}" is already registered`);
    }
    this.extensions.set(extension.id, {
      extension,
      initialized: false,
      settings: this.loadStoredSettings(extension.id),
    });
  }

  /**
   * Register a lazy-loaded extension.
   */
  registerLazy(id: string, loader: ExtensionLoader): void {
    this.loaders.set(id, loader);
  }

  /**
   * Unregister an extension.
   */
  unregister(id: string): void {
    const entry = this.extensions.get(id);
    if (entry) {
      try {
        entry.extension.destroy();
      } catch {
        // Swallow errors during destroy
      }
      this.extensions.delete(id);
    }
    this.loaders.delete(id);
  }

  /**
   * Get an extension by ID (lazy-loads if needed).
   */
  async get(id: string): Promise<SheetExtension | null> {
    // Return if already registered
    const entry = this.extensions.get(id);
    if (entry) return entry.extension;

    // Try lazy loading
    const loader = this.loaders.get(id);
    if (loader) {
      try {
        const extension = await loader();
        this.register(extension);
        return extension;
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Get all registered extensions.
   */
  getAll(): SheetExtension[] {
    return Array.from(this.extensions.values()).map((e) => e.extension);
  }

  /**
   * Get all views from all extensions.
   */
  getAllViews(): Array<{ extensionId: string; view: import('./types').ExtensionView }> {
    const views: Array<{ extensionId: string; view: import('./types').ExtensionView }> = [];
    for (const [id, entry] of this.extensions) {
      for (const view of entry.extension.getViews()) {
        views.push({ extensionId: id, view });
      }
    }
    return views;
  }

  /**
   * Get all templates from all extensions.
   */
  getAllTemplates(): Array<{ extensionId: string; template: import('./types').ExtensionTemplate }> {
    const templates: Array<{ extensionId: string; template: import('./types').ExtensionTemplate }> = [];
    for (const [id, entry] of this.extensions) {
      for (const template of entry.extension.getTemplates()) {
        templates.push({ extensionId: id, template });
      }
    }
    return templates;
  }

  /**
   * Initialize an extension (idempotent).
   */
  initialize(id: string): void {
    const entry = this.extensions.get(id);
    if (!entry || entry.initialized) return;

    try {
      const context = this.createContext(id);
      entry.extension.initialize(context);
      entry.initialized = true;
    } catch {
      // Error isolation: one extension failure doesn't affect others
    }
  }

  /**
   * Initialize all registered extensions.
   */
  initializeAll(): void {
    for (const id of this.extensions.keys()) {
      this.initialize(id);
    }
  }

  /**
   * Check if an extension is registered.
   */
  has(id: string): boolean {
    return this.extensions.has(id) || this.loaders.has(id);
  }

  /**
   * Load stored settings for an extension.
   */
  private loadStoredSettings(id: string): Record<string, unknown> {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}

// ─── Export singleton ───────────────────────────────────────────────────────

export const ExtensionRegistry = new ExtensionRegistryImpl();
