// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * SheetLink Components
 *
 * Cross-tab data bridge for SimpleSheet.
 * - SheetLinkProvider: Mount in App.tsx to expose spreadsheet data
 * - SheetLinkTrustPrompt: Authorization dialog for new consumer tabs
 * - SheetLinkRangePicker: Modal for visual range selection
 */

export { SheetLinkProvider } from './SheetLinkProvider';
export { SheetLinkTrustPrompt } from './SheetLinkTrustPrompt';
export { SheetLinkRangePicker } from './SheetLinkRangePicker';
