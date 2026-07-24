import { render, screen, fireEvent } from '@testing-library/react';
import { FreezeProvider, useFreeze } from './FreezeContext';

function TestComponent() {
  const {
    frozenColumns,
    frozenRows,
    isFrozen,
    freeze,
    freezeFirstColumn,
    freezeFirstRow,
    freezeFirstRowAndColumn,
    unfreeze,
  } = useFreeze();

  return (
    <div>
      <span data-testid="frozen-cols">{frozenColumns}</span>
      <span data-testid="frozen-rows">{frozenRows}</span>
      <span data-testid="is-frozen">{String(isFrozen)}</span>
      <button data-testid="freeze-2-3" onClick={() => freeze(2, 3)}>Freeze 2x3</button>
      <button data-testid="freeze-col" onClick={freezeFirstColumn}>Freeze Col</button>
      <button data-testid="freeze-row" onClick={freezeFirstRow}>Freeze Row</button>
      <button data-testid="freeze-both" onClick={freezeFirstRowAndColumn}>Freeze Both</button>
      <button data-testid="unfreeze" onClick={unfreeze}>Unfreeze</button>
    </div>
  );
}

describe('FreezeContext', () => {
  it('starts unfrozen', () => {
    render(
      <FreezeProvider>
        <TestComponent />
      </FreezeProvider>
    );

    expect(screen.getByTestId('frozen-cols').textContent).toBe('0');
    expect(screen.getByTestId('frozen-rows').textContent).toBe('0');
    expect(screen.getByTestId('is-frozen').textContent).toBe('false');
  });

  it('freezes specified columns and rows', () => {
    render(
      <FreezeProvider>
        <TestComponent />
      </FreezeProvider>
    );

    fireEvent.click(screen.getByTestId('freeze-2-3'));
    expect(screen.getByTestId('frozen-cols').textContent).toBe('2');
    expect(screen.getByTestId('frozen-rows').textContent).toBe('3');
    expect(screen.getByTestId('is-frozen').textContent).toBe('true');
  });

  it('freezeFirstColumn freezes one column', () => {
    render(
      <FreezeProvider>
        <TestComponent />
      </FreezeProvider>
    );

    fireEvent.click(screen.getByTestId('freeze-col'));
    expect(screen.getByTestId('frozen-cols').textContent).toBe('1');
    expect(screen.getByTestId('is-frozen').textContent).toBe('true');
  });

  it('freezeFirstRow freezes one row', () => {
    render(
      <FreezeProvider>
        <TestComponent />
      </FreezeProvider>
    );

    fireEvent.click(screen.getByTestId('freeze-row'));
    expect(screen.getByTestId('frozen-rows').textContent).toBe('1');
    expect(screen.getByTestId('is-frozen').textContent).toBe('true');
  });

  it('freezeFirstRowAndColumn freezes both', () => {
    render(
      <FreezeProvider>
        <TestComponent />
      </FreezeProvider>
    );

    fireEvent.click(screen.getByTestId('freeze-both'));
    expect(screen.getByTestId('frozen-cols').textContent).toBe('1');
    expect(screen.getByTestId('frozen-rows').textContent).toBe('1');
  });

  it('unfreeze clears all frozen panes', () => {
    render(
      <FreezeProvider>
        <TestComponent />
      </FreezeProvider>
    );

    fireEvent.click(screen.getByTestId('freeze-both'));
    fireEvent.click(screen.getByTestId('unfreeze'));
    expect(screen.getByTestId('frozen-cols').textContent).toBe('0');
    expect(screen.getByTestId('frozen-rows').textContent).toBe('0');
    expect(screen.getByTestId('is-frozen').textContent).toBe('false');
  });

  it('throws when used outside provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow('useFreeze must be used within FreezeProvider');
    spy.mockRestore();
  });
});
