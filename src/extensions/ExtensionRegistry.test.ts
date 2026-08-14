// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { ExtensionRegistry } from './ExtensionRegistry';
import type { SheetExtension, ExtensionContext, ExtensionView, ExtensionTemplate } from './types';
import type { Workbook } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockWorkbook(): Workbook {
  return {
    id: 'wb-1',
    title: 'Test',
    sheets: [{
      id: 's1', name: 'Sheet1', cells: {},
      defaultColWidth: 100, defaultRowHeight: 28,
      columnWidths: {}, rowHeights: {},
      columnCount: 26, rowCount: 100,
      frozenColumns: 0, frozenRows: 0,
    }],
    activeSheetIndex: 0,
    lastModified: Date.now(),
  };
}

function createMockExtension(overrides: Partial<SheetExtension> = {}): SheetExtension {
  return {
    id: 'test-ext',
    name: 'Test Extension',
    description: 'A test extension',
    version: '1.0.0',
    icon: () => null,
    category: 'project',
    initialize: jest.fn(),
    destroy: jest.fn(),
    getTaskModels: jest.fn(() => []),
    getViews: jest.fn(() => []),
    getTemplates: jest.fn(() => []),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ExtensionRegistry', () => {
  beforeEach(() => {
    // Clear all extensions before each test
    for (const ext of ExtensionRegistry.getAll()) {
      ExtensionRegistry.unregister(ext.id);
    }
    ExtensionRegistry.setWorkbookProvider(() => createMockWorkbook());
  });

  describe('register', () => {
    it('registers an extension', () => {
      const ext = createMockExtension();
      ExtensionRegistry.register(ext);
      expect(ExtensionRegistry.has('test-ext')).toBe(true);
    });

    it('throws if already registered', () => {
      const ext = createMockExtension();
      ExtensionRegistry.register(ext);
      expect(() => ExtensionRegistry.register(ext)).toThrow();
    });
  });

  describe('unregister', () => {
    it('unregisters an extension', () => {
      const ext = createMockExtension();
      ExtensionRegistry.register(ext);
      ExtensionRegistry.unregister('test-ext');
      expect(ExtensionRegistry.has('test-ext')).toBe(false);
    });

    it('calls destroy on unregister', () => {
      const ext = createMockExtension();
      ExtensionRegistry.register(ext);
      ExtensionRegistry.unregister('test-ext');
      expect(ext.destroy).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('returns a registered extension', async () => {
      const ext = createMockExtension();
      ExtensionRegistry.register(ext);
      const result = await ExtensionRegistry.get('test-ext');
      expect(result).toBe(ext);
    });

    it('returns null for unknown extension', async () => {
      const result = await ExtensionRegistry.get('unknown');
      expect(result).toBeNull();
    });
  });

  describe('lazy loading', () => {
    it('registers a lazy loader', async () => {
      const ext = createMockExtension({ id: 'lazy-ext' });
      ExtensionRegistry.registerLazy('lazy-ext', async () => ext);
      expect(ExtensionRegistry.has('lazy-ext')).toBe(true);

      const result = await ExtensionRegistry.get('lazy-ext');
      expect(result).toBe(ext);
    });

    it('returns null if loader fails', async () => {
      ExtensionRegistry.registerLazy('failing-ext', async () => {
        throw new Error('Load failed');
      });
      const result = await ExtensionRegistry.get('failing-ext');
      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('returns all registered extensions', () => {
      ExtensionRegistry.register(createMockExtension({ id: 'ext-1' }));
      ExtensionRegistry.register(createMockExtension({ id: 'ext-2' }));
      expect(ExtensionRegistry.getAll()).toHaveLength(2);
    });

    it('returns empty array when none registered', () => {
      expect(ExtensionRegistry.getAll()).toEqual([]);
    });
  });

  describe('getAllViews', () => {
    it('aggregates views from all extensions', () => {
      const view1: ExtensionView = { id: 'v1', name: 'View 1', icon: () => null, component: () => null, position: 'panel' };
      ExtensionRegistry.register(createMockExtension({ id: 'ext-1', getViews: () => [view1] }));
      ExtensionRegistry.register(createMockExtension({ id: 'ext-2', getViews: () => [] }));
      const views = ExtensionRegistry.getAllViews();
      expect(views).toHaveLength(1);
      expect(views[0].extensionId).toBe('ext-1');
    });
  });

  describe('getAllTemplates', () => {
    it('aggregates templates from all extensions', () => {
      const tmpl: ExtensionTemplate = { id: 't1', name: 'Template', description: '', category: 'test', data: {} };
      ExtensionRegistry.register(createMockExtension({ id: 'ext-1', getTemplates: () => [tmpl] }));
      ExtensionRegistry.register(createMockExtension({ id: 'ext-2', getTemplates: () => [] }));
      const templates = ExtensionRegistry.getAllTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].template.id).toBe('t1');
    });
  });

  describe('initialize', () => {
    it('initializes an extension', () => {
      const ext = createMockExtension();
      ExtensionRegistry.register(ext);
      ExtensionRegistry.initialize('test-ext');
      expect(ext.initialize).toHaveBeenCalled();
    });

    it('initializes all extensions', () => {
      const ext1 = createMockExtension({ id: 'ext-1' });
      const ext2 = createMockExtension({ id: 'ext-2' });
      ExtensionRegistry.register(ext1);
      ExtensionRegistry.register(ext2);
      ExtensionRegistry.initializeAll();
      expect(ext1.initialize).toHaveBeenCalled();
      expect(ext2.initialize).toHaveBeenCalled();
    });
  });

  describe('ExtensionContext', () => {
    it('provides workbook access', () => {
      let contextReceived: ExtensionContext | null = null;
      const ext = createMockExtension({
        initialize: (ctx: ExtensionContext) => { contextReceived = ctx; },
      });
      ExtensionRegistry.register(ext);
      ExtensionRegistry.initialize('test-ext');
      expect(contextReceived).not.toBeNull();
      expect(contextReceived!.getWorkbook().id).toBe('wb-1');
    });

    it('provides cell value access', () => {
      let contextReceived: ExtensionContext | null = null;
      const ext = createMockExtension({
        initialize: (ctx: ExtensionContext) => { contextReceived = ctx; },
      });
      ExtensionRegistry.register(ext);
      ExtensionRegistry.initialize('test-ext');
      const value = contextReceived!.getCellValue(0, 0);
      expect(value).toBeNull();
    });
  });
});
