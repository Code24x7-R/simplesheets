// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import '@testing-library/jest-dom';

// Mock navigator.clipboard for tests (jsdom doesn't provide it)
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve('')),
  },
});
