// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { PrintSetupModal } from './PrintSetupModal';
import { PrintSetupProvider } from '../context/PrintSetupContext';

describe('PrintSetupModal', () => {
  it('renders when isOpen is true', () => {
    render(<PrintSetupProvider><PrintSetupModal isOpen={true} onClose={jest.fn()} /></PrintSetupProvider>);
    expect(screen.getByText('Page Setup')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<PrintSetupProvider><PrintSetupModal isOpen={false} onClose={jest.fn()} /></PrintSetupProvider>);
    expect(container.firstChild).toBeNull();
  });

  it('shows orientation options', () => {
    render(<PrintSetupProvider><PrintSetupModal isOpen={true} onClose={jest.fn()} /></PrintSetupProvider>);
    expect(screen.getByText('portrait')).toBeInTheDocument();
    expect(screen.getByText('landscape')).toBeInTheDocument();
  });

  it('shows page size selector', () => {
    render(<PrintSetupProvider><PrintSetupModal isOpen={true} onClose={jest.fn()} /></PrintSetupProvider>);
    expect(screen.getByDisplayValue('A4')).toBeInTheDocument();
  });

  it('shows scaling selector', () => {
    render(<PrintSetupProvider><PrintSetupModal isOpen={true} onClose={jest.fn()} /></PrintSetupProvider>);
    expect(screen.getByDisplayValue('Fit to Page')).toBeInTheDocument();
  });

  it('shows margin inputs', () => {
    render(<PrintSetupProvider><PrintSetupModal isOpen={true} onClose={jest.fn()} /></PrintSetupProvider>);
    // Should have margin inputs with labels
    expect(screen.getByText('Margins (mm)')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = jest.fn();
    render(<PrintSetupProvider><PrintSetupModal isOpen={true} onClose={onClose} /></PrintSetupProvider>);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when apply is clicked', () => {
    const onClose = jest.fn();
    render(<PrintSetupProvider><PrintSetupModal isOpen={true} onClose={onClose} /></PrintSetupProvider>);

    fireEvent.click(screen.getByText('Apply'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X is clicked', () => {
    const onClose = jest.fn();
    render(<PrintSetupProvider><PrintSetupModal isOpen={true} onClose={onClose} /></PrintSetupProvider>);

    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('changes orientation to landscape', () => {
    const onClose = jest.fn();
    render(<PrintSetupProvider><PrintSetupModal isOpen={true} onClose={onClose} /></PrintSetupProvider>);

    fireEvent.click(screen.getByText('landscape'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('landscape').classList.contains('bg-blue-100')).toBe(true);
  });

  it('changes page size', () => {
    const onClose = jest.fn();
    render(<PrintSetupProvider><PrintSetupModal isOpen={true} onClose={onClose} /></PrintSetupProvider>);

    const select = screen.getByDisplayValue('A4') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'Letter' } });
    expect(screen.getByDisplayValue('Letter')).toBeInTheDocument();
  });

  it('changes scaling', () => {
    const onClose = jest.fn();
    render(<PrintSetupProvider><PrintSetupModal isOpen={true} onClose={onClose} /></PrintSetupProvider>);

    // Find the scaling select (second select element)
    const selects = document.querySelectorAll('select');
    const scalingSelect = selects[1] as HTMLSelectElement;
    fireEvent.change(scalingSelect, { target: { value: 'actual-size' } });
    expect(scalingSelect.value).toBe('actual-size');
  });

  it('changes margins', () => {
    const onClose = jest.fn();
    render(<PrintSetupProvider><PrintSetupModal isOpen={true} onClose={onClose} /></PrintSetupProvider>);

    const marginInputs = document.querySelectorAll('input[type="number"]');
    expect(marginInputs.length).toBe(4);
    fireEvent.change(marginInputs[0], { target: { value: '20' } });
    expect(marginInputs[0]).toHaveValue(20);
  });
});
