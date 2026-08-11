// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { AboutModal } from './AboutModal';

describe('AboutModal', () => {
  it('renders when isOpen is true', () => {
    render(<AboutModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('SimpleSheet')).toBeInTheDocument();
  });

  it('displays the application version', () => {
    render(<AboutModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<AboutModal isOpen={false} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = jest.fn();
    render(<AboutModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Close button is clicked', () => {
    const onClose = jest.fn();
    render(<AboutModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<AboutModal isOpen={true} onClose={onClose} />);
    // Click on the backdrop (the outermost fixed container)
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when clicking inside the modal content', () => {
    const onClose = jest.fn();
    render(<AboutModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('SimpleSheet'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders the app description', () => {
    render(<AboutModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText(/lightweight, browser-based spreadsheet/)).toBeInTheDocument();
    expect(screen.getByText(/React, TypeScript, and Tailwind CSS/)).toBeInTheDocument();
    expect(screen.getByText(/Vite, SheetJS, PapaParse/)).toBeInTheDocument();
  });

  it('renders section headings', () => {
    render(<AboutModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('Related Apps')).toBeInTheDocument();
    expect(screen.getByText('License')).toBeInTheDocument();
  });

  it('renders the no-server tagline', () => {
    render(<AboutModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText(/No server, no account, no bloat/)).toBeInTheDocument();
  });

  it('renders tech stack in description', () => {
    render(<AboutModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText(/Vite/)).toBeInTheDocument();
    expect(screen.getByText(/SheetJS/)).toBeInTheDocument();
    expect(screen.getByText(/html2pdf\.js/)).toBeInTheDocument();
  });

  it('renders license section', () => {
    render(<AboutModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('MIT')).toBeInTheDocument();
  });

  it('displays build info', () => {
    render(<AboutModal isOpen={true} onClose={jest.fn()} />);
    // Should show 'dev' when __BUILD_TIMESTAMP__ is undefined (test env)
    expect(screen.getByText(/build dev/)).toBeInTheDocument();
  });

  it('renders Related Apps section with SimpleDocs link', () => {
    render(<AboutModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('Related Apps')).toBeInTheDocument();
    const link = screen.getByText('SimpleDocs') as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.href).toBe('https://simpledocs.mouseclick.au/');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('displays build info with timestamp when __BUILD_TIMESTAMP__ is set', () => {
    // Mock the global constants (ISO string format, as injected by Vite)
    (global as Record<string, unknown>)['__BUILD_TIMESTAMP__'] = '2024-03-01T00:00:00.000Z';
    (global as Record<string, unknown>)['__GIT_COMMIT_HASH__'] = 'abc1234';
    render(<AboutModal isOpen={true} onClose={jest.fn()} />);
    // When timestamp is set, should show commit hash (not 'dev')
    expect(screen.getByText(/abc1234/)).toBeInTheDocument();
    // Clean up
    delete (global as Record<string, unknown>)['__BUILD_TIMESTAMP__'];
    delete (global as Record<string, unknown>)['__GIT_COMMIT_HASH__'];
  });
});
