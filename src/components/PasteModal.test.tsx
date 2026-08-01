// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { PasteModal } from './PasteModal';

describe('PasteModal', () => {
  it('does not render when isOpen is false', () => {
    render(
      <PasteModal
        isOpen={false}
        onClose={jest.fn()}
        onPasteFormatted={jest.fn()}
        onPastePlainText={jest.fn()}
      />
    );
    expect(screen.queryByText('Paste from clipboard')).not.toBeInTheDocument();
  });

  it('renders the modal with title and description when open', () => {
    render(
      <PasteModal
        isOpen={true}
        onClose={jest.fn()}
        onPasteFormatted={jest.fn()}
        onPastePlainText={jest.fn()}
      />
    );
    expect(screen.getByText('Paste from clipboard')).toBeInTheDocument();
    expect(screen.getByText(/formatted content/i)).toBeInTheDocument();
  });

  it('shows both paste options and cancel', () => {
    render(
      <PasteModal
        isOpen={true}
        onClose={jest.fn()}
        onPasteFormatted={jest.fn()}
        onPastePlainText={jest.fn()}
      />
    );
    expect(screen.getByTestId('paste-formatted')).toHaveTextContent('Paste Formatted Text');
    expect(screen.getByTestId('paste-plain')).toHaveTextContent('Paste Plain Text');
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onPasteFormatted when formatted button clicked', () => {
    const onPasteFormatted = jest.fn();
    render(
      <PasteModal
        isOpen={true}
        onClose={jest.fn()}
        onPasteFormatted={onPasteFormatted}
        onPastePlainText={jest.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('paste-formatted'));
    expect(onPasteFormatted).toHaveBeenCalledTimes(1);
  });

  it('calls onPastePlainText when plain button clicked', () => {
    const onPastePlainText = jest.fn();
    render(
      <PasteModal
        isOpen={true}
        onClose={jest.fn()}
        onPasteFormatted={jest.fn()}
        onPastePlainText={onPastePlainText}
      />
    );
    fireEvent.click(screen.getByTestId('paste-plain'));
    expect(onPastePlainText).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel clicked', () => {
    const onClose = jest.fn();
    render(
      <PasteModal
        isOpen={true}
        onClose={onClose}
        onPasteFormatted={jest.fn()}
        onPastePlainText={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the backdrop', () => {
    const onClose = jest.fn();
    render(
      <PasteModal
        isOpen={true}
        onClose={onClose}
        onPasteFormatted={jest.fn()}
        onPastePlainText={jest.fn()}
      />
    );
    // Click the backdrop (outer div)
    fireEvent.click(document.querySelector('.bg-black\\/30')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    const onClose = jest.fn();
    render(
      <PasteModal
        isOpen={true}
        onClose={onClose}
        onPasteFormatted={jest.fn()}
        onPastePlainText={jest.fn()}
      />
    );
    const dialog = document.querySelector('[role="dialog"]')!;
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows preview with dimensions when html provided', () => {
    const html = '<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></table>';
    render(
      <PasteModal
        isOpen={true}
        onClose={jest.fn()}
        onPasteFormatted={jest.fn()}
        onPastePlainText={jest.fn()}
        html={html}
      />
    );
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText(/3 rows × 2 cols/)).toBeInTheDocument();
  });

  it('shows preview with plain text dimensions', () => {
    render(
      <PasteModal
        isOpen={true}
        onClose={jest.fn()}
        onPasteFormatted={jest.fn()}
        onPastePlainText={jest.fn()}
        plain={'Line 1\nLine 2\nLine 3\nLine 4'}
      />
    );
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText(/4 rows × 1 col/)).toBeInTheDocument();
  });

  it('shows formatted indicator when styles present', () => {
    const html = '<table><tr><td style="font-weight: bold">Bold</td></tr></table>';
    render(
      <PasteModal
        isOpen={true}
        onClose={jest.fn()}
        onPasteFormatted={jest.fn()}
        onPastePlainText={jest.fn()}
        html={html}
      />
    );
    // The preview shows 'formatted' in the dimensions row when styles detected
    const previewSection = screen.getByText('Preview').closest('.bg-gray-50');
    expect(previewSection?.textContent).toContain('formatted');
  });
});
