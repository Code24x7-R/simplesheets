// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutsModal } from './ShortcutsModal';

describe('ShortcutsModal', () => {
  it('renders when isOpen is true', () => {
    render(<ShortcutsModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('Keyboard Shortcuts & Hints')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<ShortcutsModal isOpen={false} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = jest.fn();
    render(<ShortcutsModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Close button is clicked', () => {
    const onClose = jest.fn();
    render(<ShortcutsModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<ShortcutsModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Keyboard Shortcuts & Hints').parentElement!.parentElement!.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when clicking inside the modal content', () => {
    const onClose = jest.fn();
    render(<ShortcutsModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Navigation'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('displays all shortcut group titles', () => {
    render(<ShortcutsModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Editing')).toBeInTheDocument();
    expect(screen.getByText('Clipboard')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Formatting')).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
  });

  it('displays specific shortcuts', () => {
    render(<ShortcutsModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('F2')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + F2')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + Shift + F')).toBeInTheDocument();
    expect(screen.getByText('Escape')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + Z')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + C')).toBeInTheDocument();
  });

  it('displays hints section', () => {
    render(<ShortcutsModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText(/Tips & Hints/)).toBeInTheDocument();
    expect(screen.getByText(/Click column\/row headers to select entire columns\/rows/)).toBeInTheDocument();
  });
});
