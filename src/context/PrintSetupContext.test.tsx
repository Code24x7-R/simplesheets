// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { PrintSetupProvider, usePrintSetup } from './PrintSetupContext';

function TestComponent() {
  const { setup, updateSetup, updateMargins, resetSetup } = usePrintSetup();

  return (
    <div>
      <span data-testid="orientation">{setup.orientation}</span>
      <span data-testid="page-size">{setup.pageSize}</span>
      <span data-testid="scaling">{setup.scaling}</span>
      <span data-testid="margin-top">{setup.margins.top}</span>
      <span data-testid="margin-left">{setup.margins.left}</span>
      <button data-testid="set-landscape" onClick={() => updateSetup({ orientation: 'landscape' })}>
        Landscape
      </button>
      <button data-testid="set-letter" onClick={() => updateSetup({ pageSize: 'Letter' })}>
        Letter
      </button>
      <button data-testid="set-actual" onClick={() => updateSetup({ scaling: 'actual-size' })}>
        Actual Size
      </button>
      <button data-testid="set-margin-top" onClick={() => updateMargins({ top: 25 })}>
        Margin Top 25
      </button>
      <button data-testid="reset" onClick={resetSetup}>Reset</button>
    </div>
  );
}

describe('PrintSetupContext', () => {
  it('provides default setup', () => {
    render(
      <PrintSetupProvider>
        <TestComponent />
      </PrintSetupProvider>
    );

    expect(screen.getByTestId('orientation').textContent).toBe('portrait');
    expect(screen.getByTestId('page-size').textContent).toBe('A4');
    expect(screen.getByTestId('scaling').textContent).toBe('fit-to-page');
    expect(screen.getByTestId('margin-top').textContent).toBe('10');
  });

  it('updates orientation', () => {
    render(
      <PrintSetupProvider>
        <TestComponent />
      </PrintSetupProvider>
    );

    fireEvent.click(screen.getByTestId('set-landscape'));
    expect(screen.getByTestId('orientation').textContent).toBe('landscape');
  });

  it('updates page size', () => {
    render(
      <PrintSetupProvider>
        <TestComponent />
      </PrintSetupProvider>
    );

    fireEvent.click(screen.getByTestId('set-letter'));
    expect(screen.getByTestId('page-size').textContent).toBe('Letter');
  });

  it('updates margins', () => {
    render(
      <PrintSetupProvider>
        <TestComponent />
      </PrintSetupProvider>
    );

    fireEvent.click(screen.getByTestId('set-margin-top'));
    expect(screen.getByTestId('margin-top').textContent).toBe('25');
    // Other margins unchanged
    expect(screen.getByTestId('margin-left').textContent).toBe('10');
  });

  it('resets to defaults', () => {
    render(
      <PrintSetupProvider>
        <TestComponent />
      </PrintSetupProvider>
    );

    fireEvent.click(screen.getByTestId('set-landscape'));
    fireEvent.click(screen.getByTestId('set-letter'));
    fireEvent.click(screen.getByTestId('set-margin-top'));
    fireEvent.click(screen.getByTestId('reset'));

    expect(screen.getByTestId('orientation').textContent).toBe('portrait');
    expect(screen.getByTestId('page-size').textContent).toBe('A4');
    expect(screen.getByTestId('margin-top').textContent).toBe('10');
  });

  it('throws when used outside provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow('usePrintSetup must be used within PrintSetupProvider');
    spy.mockRestore();
  });
});
