// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, fireEvent } from '@testing-library/react';
import { ResizeHandle } from './ResizeHandle';

describe('ResizeHandle', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ResizeHandle
        orientation="column"
        currentSize={100}
        onResizeEnd={jest.fn()}
      />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('is hidden by default and visible when visible prop is true', () => {
    const { container, rerender } = render(
      <ResizeHandle
        orientation="column"
        currentSize={100}
        onResizeEnd={jest.fn()}
      />
    );
    const handle = container.firstChild as HTMLElement;
    expect(handle.classList.contains('opacity-0')).toBe(true);

    rerender(
      <ResizeHandle
        orientation="column"
        currentSize={100}
        visible
        onResizeEnd={jest.fn()}
      />
    );
    expect(handle.classList.contains('opacity-100')).toBe(true);
    expect(handle.classList.contains('bg-blue-500')).toBe(true);
  });

  it('calls onResizeStart, onResizeMove, and onResizeEnd during a drag', () => {
    const onResizeStart = jest.fn();
    const onResizeMove = jest.fn();
    const onResizeEnd = jest.fn();
    const { container } = render(
      <ResizeHandle
        orientation="column"
        currentSize={100}
        onResizeStart={onResizeStart}
        onResizeMove={onResizeMove}
        onResizeEnd={onResizeEnd}
      />
    );

    const handle = container.firstChild as HTMLElement;

    // Start drag
    fireEvent.mouseDown(handle, { clientX: 100 });
    expect(onResizeStart).toHaveBeenCalledTimes(1);

    // Move
    fireEvent.mouseMove(document, { clientX: 150 });
    expect(onResizeMove).toHaveBeenCalledWith(150);

    // End drag
    fireEvent.mouseUp(document, { clientX: 150 });
    expect(onResizeEnd).toHaveBeenCalledWith(150);
  });

  it('enforces minimum size', () => {
    const onResizeEnd = jest.fn();
    const { container } = render(
      <ResizeHandle
        orientation="column"
        currentSize={100}
        minSize={50}
        onResizeEnd={onResizeEnd}
      />
    );

    const handle = container.firstChild as HTMLElement;

    // Try to drag below minimum
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 10 }); // Would make size = 10
    fireEvent.mouseUp(document, { clientX: 10 });

    expect(onResizeEnd).toHaveBeenCalledWith(50);
  });

  it('enforces maximum size', () => {
    const onResizeEnd = jest.fn();
    const { container } = render(
      <ResizeHandle
        orientation="column"
        currentSize={100}
        maxSize={200}
        onResizeEnd={onResizeEnd}
      />
    );

    const handle = container.firstChild as HTMLElement;

    // Try to drag above maximum
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 500 }); // Would make size = 500
    fireEvent.mouseUp(document, { clientX: 500 });

    expect(onResizeEnd).toHaveBeenCalledWith(200);
  });

  it('supports row orientation', () => {
    const onResizeEnd = jest.fn();
    const { container } = render(
      <ResizeHandle
        orientation="row"
        currentSize={28}
        onResizeEnd={onResizeEnd}
      />
    );

    const handle = container.firstChild as HTMLElement;
    fireEvent.mouseDown(handle, { clientY: 50 });
    fireEvent.mouseMove(document, { clientY: 80 });
    fireEvent.mouseUp(document, { clientY: 80 });

    expect(onResizeEnd).toHaveBeenCalledWith(58);
  });

  it('does not call onResizeMove after mouseUp', () => {
    const onResizeMove = jest.fn();
    const { container } = render(
      <ResizeHandle
        orientation="column"
        currentSize={100}
        onResizeMove={onResizeMove}
        onResizeEnd={jest.fn()}
      />
    );

    const handle = container.firstChild as HTMLElement;
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 150 });
    fireEvent.mouseUp(document, { clientX: 150 });

    const callCountAfterUp = onResizeMove.mock.calls.length;

    // Move again after release — should not trigger
    fireEvent.mouseMove(document, { clientX: 200 });
    expect(onResizeMove).toHaveBeenCalledTimes(callCountAfterUp);
  });

  // ─── Touch support (mobile) ─────────────────────────────────────────

  it('calls onResizeStart, onResizeMove, and onResizeEnd during a touch drag', () => {
    const onResizeStart = jest.fn();
    const onResizeMove = jest.fn();
    const onResizeEnd = jest.fn();
    const { container } = render(
      <ResizeHandle
        orientation="column"
        currentSize={100}
        onResizeStart={onResizeStart}
        onResizeMove={onResizeMove}
        onResizeEnd={onResizeEnd}
      />
    );

    const handle = container.firstChild as HTMLElement;

    // Start touch
    fireEvent.touchStart(handle, { touches: [{ clientX: 100 }] });
    expect(onResizeStart).toHaveBeenCalledTimes(1);

    // Move touch
    fireEvent.touchMove(document, { touches: [{ clientX: 150 }] });
    expect(onResizeMove).toHaveBeenCalledWith(150);

    // End touch
    fireEvent.touchEnd(document, { changedTouches: [{ clientX: 150 }] });
    expect(onResizeEnd).toHaveBeenCalledWith(150);
  });

  it('supports touch drag in row orientation', () => {
    const onResizeEnd = jest.fn();
    const { container } = render(
      <ResizeHandle
        orientation="row"
        currentSize={28}
        onResizeEnd={onResizeEnd}
      />
    );

    const handle = container.firstChild as HTMLElement;
    fireEvent.touchStart(handle, { touches: [{ clientY: 50 }] });
    fireEvent.touchMove(document, { touches: [{ clientY: 80 }] });
    fireEvent.touchEnd(document, { changedTouches: [{ clientY: 80 }] });

    expect(onResizeEnd).toHaveBeenCalledWith(58);
  });

  it('enforces minimum size on touch drag', () => {
    const onResizeEnd = jest.fn();
    const { container } = render(
      <ResizeHandle
        orientation="column"
        currentSize={100}
        minSize={50}
        onResizeEnd={onResizeEnd}
      />
    );

    const handle = container.firstChild as HTMLElement;
    fireEvent.touchStart(handle, { touches: [{ clientX: 100 }] });
    fireEvent.touchMove(document, { touches: [{ clientX: 10 }] });
    fireEvent.touchEnd(document, { changedTouches: [{ clientX: 10 }] });

    expect(onResizeEnd).toHaveBeenCalledWith(50);
  });

  it('does not call onResizeMove after touchEnd', () => {
    const onResizeMove = jest.fn();
    const { container } = render(
      <ResizeHandle
        orientation="column"
        currentSize={100}
        onResizeMove={onResizeMove}
        onResizeEnd={jest.fn()}
      />
    );

    const handle = container.firstChild as HTMLElement;
    fireEvent.touchStart(handle, { touches: [{ clientX: 100 }] });
    fireEvent.touchMove(document, { touches: [{ clientX: 150 }] });
    fireEvent.touchEnd(document, { changedTouches: [{ clientX: 150 }] });

    const callCountAfterEnd = onResizeMove.mock.calls.length;

    // Move again after release — should not trigger
    fireEvent.touchMove(document, { touches: [{ clientX: 200 }] });
    expect(onResizeMove).toHaveBeenCalledTimes(callCountAfterEnd);
  });
});
