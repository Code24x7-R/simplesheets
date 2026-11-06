// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Platform adapter selection.
 *
 * Presence of the frozen preload bridge is the only desktop signal. Tests and
 * the browser build always get the web adapter.
 */

import { createDesktopAdapter } from './desktop';
import { createWebAdapter } from './web';
import type { PlatformAdapter } from './types';

/**
 * Resolve the adapter for the current environment.
 *
 * @returns The desktop adapter when the preload bridge exists, otherwise the web adapter.
 */
export function getPlatform(): PlatformAdapter {
  const bridge = typeof window !== 'undefined' ? window.simplesheetsDesktop : undefined;
  return bridge ? createDesktopAdapter(bridge) : createWebAdapter();
}

export type {
  AppEdition,
  AppInfo,
  PlatformAdapter,
  PlatformCapabilities,
  PlatformFailureCode,
  PlatformKind,
  PlatformResult,
} from './types';
