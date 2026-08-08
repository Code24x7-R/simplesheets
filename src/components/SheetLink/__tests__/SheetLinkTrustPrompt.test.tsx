// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Unit tests for SheetLinkTrustPrompt.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { SheetLinkTrustPrompt } from '../SheetLinkTrustPrompt';

describe('SheetLinkTrustPrompt', () => {
  const defaultProps = {
    isOpen: true,
    consumerTabId: 'tab-abc123',
    consumerOrigin: 'simplesheets.app',
    requestedOperation: 'getRangeValues',
    requestedTarget: 'Sheet1!A1:D10',
    onAllow: jest.fn(),
    onDeny: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<SheetLinkTrustPrompt {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the dialog when isOpen is true', () => {
    render(<SheetLinkTrustPrompt {...defaultProps} />);
    expect(screen.getByText('Data Access Request')).toBeInTheDocument();
  });

  it('displays the consumer tab ID', () => {
    render(<SheetLinkTrustPrompt {...defaultProps} />);
    expect(screen.getByText('tab-abc123')).toBeInTheDocument();
  });

  it('displays the requested operation', () => {
    render(<SheetLinkTrustPrompt {...defaultProps} />);
    expect(screen.getByText('Get Range Values')).toBeInTheDocument();
  });

  it('displays the requested target', () => {
    render(<SheetLinkTrustPrompt {...defaultProps} />);
    expect(screen.getByText('Sheet1!A1:D10')).toBeInTheDocument();
  });

  it('calls onAllow when Allow button is clicked', () => {
    const onAllow = jest.fn();
    render(<SheetLinkTrustPrompt {...defaultProps} onAllow={onAllow} />);
    fireEvent.click(screen.getByText('Allow'));
    expect(onAllow).toHaveBeenCalledTimes(1);
  });

  it('calls onDeny when Deny button is clicked', () => {
    const onDeny = jest.fn();
    render(<SheetLinkTrustPrompt {...defaultProps} onDeny={onDeny} />);
    fireEvent.click(screen.getByText('Deny'));
    expect(onDeny).toHaveBeenCalledTimes(1);
  });

  it('calls onDeny when clicking outside the dialog', () => {
    const onDeny = jest.fn();
    render(<SheetLinkTrustPrompt {...defaultProps} onDeny={onDeny} />);
    // Click the overlay (parent of the dialog content)
    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.click(overlay);
    expect(onDeny).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onAllow when clicking outside', () => {
    const onAllow = jest.fn();
    render(<SheetLinkTrustPrompt {...defaultProps} onAllow={onAllow} />);
    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.click(overlay);
    expect(onAllow).not.toHaveBeenCalled();
  });

  it('formats camelCase operation names with spaces', () => {
    render(<SheetLinkTrustPrompt {...defaultProps} requestedOperation="getCellValue" />);
    expect(screen.getByText('Get Cell Value')).toBeInTheDocument();
  });

  it('handles empty target gracefully', () => {
    render(<SheetLinkTrustPrompt {...defaultProps} requestedTarget="" />);
    expect(screen.queryByText('Target:')).not.toBeInTheDocument();
  });
});
