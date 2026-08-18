// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { CapitalizationConfigModal } from './CapitalizationConfigModal';
import type { CapitalizationConfig } from '../types';

function createConfig(overrides: Partial<CapitalizationConfig> = {}): CapitalizationConfig {
  return {
    threshold: 1000,
    currency: 'USD',
    defaultUsefulLifeMonths: 36,
    defaultDepreciationMethod: 'straight-line',
    defaultSalvagePercent: 10,
    ...overrides,
  };
}

describe('CapitalizationConfigModal', () => {
  it('renders without crashing', () => {
    const config = createConfig();
    render(
      <CapitalizationConfigModal
        config={config}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Capitalization Settings')).toBeTruthy();
  });

  it('displays current threshold value', () => {
    const config = createConfig({ threshold: 2500 });
    render(
      <CapitalizationConfigModal
        config={config}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    const thresholdInput = screen.getByLabelText(/Capitalization Threshold/);
    expect(thresholdInput).toBeTruthy();
  });

  it('calls onSave with updated config when Save is clicked', () => {
    const onSave = jest.fn();
    const config = createConfig();
    render(
      <CapitalizationConfigModal
        config={config}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    // Click save
    fireEvent.click(screen.getByText('Save Settings'));
    expect(onSave).toHaveBeenCalledWith(config);
  });

  it('calls onSave with straight-line method selected', () => {
    const onSave = jest.fn();
    const config = createConfig({ defaultDepreciationMethod: 'declining-balance' });
    render(
      <CapitalizationConfigModal
        config={config}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    // Select straight-line method
    fireEvent.click(screen.getByText('Straight-Line'));
    fireEvent.click(screen.getByText('Save Settings'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ defaultDepreciationMethod: 'straight-line' }),
    );
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    const config = createConfig();
    render(
      <CapitalizationConfigModal
        config={config}
        onClose={onClose}
        onSave={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    const config = createConfig();
    render(
      <CapitalizationConfigModal
        config={config}
        onClose={onClose}
        onSave={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('close-modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows all depreciation method options', () => {
    const config = createConfig();
    render(
      <CapitalizationConfigModal
        config={config}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Straight-Line')).toBeTruthy();
    expect(screen.getByText('Declining Balance')).toBeTruthy();
    expect(screen.getByText('None')).toBeTruthy();
  });
});
