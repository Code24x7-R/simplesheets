// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useCallback, useRef, useEffect } from 'react';

interface ResizeHandleProps {
  /** Orientation of the resize handle. */
  orientation: 'column' | 'row';
  /** Current width (for column) or height (for row) in pixels. */
  currentSize: number;
  /** Minimum allowed size. */
  minSize?: number;
  /** Maximum allowed size. */
  maxSize?: number;
  /** Whether the handle is visible (hover or active drag). */
  visible?: boolean;
  /** Callback when resize drag starts. */
  onResizeStart?: () => void;
  /** Callback during resize drag for live preview. */
  onResizeMove?: (newSize: number) => void;
  /** Callback when resize completes with the new size. */
  onResizeEnd?: (newSize: number) => void;
}

/**
 * A draggable resize handle for column headers or row numbers.
 * Renders as a thin hit area at the right/bottom edge of the header.
 * Hidden by default — becomes visible on header hover or during an active drag.
 */
export function ResizeHandle({
  orientation,
  currentSize,
  minSize = 30,
  maxSize = 500,
  visible = false,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: ResizeHandleProps) {
  const startPos = useRef(0);
  const startSize = useRef(0);
  const isActive = useRef(false);
  const handleRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      isActive.current = true;
      startPos.current = orientation === 'column' ? e.clientX : e.clientY;
      startSize.current = currentSize;

      onResizeStart?.();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        /* istanbul ignore next - defensive guard */
        if (!isActive.current) return;
        const delta = (orientation === 'column' ? moveEvent.clientX : moveEvent.clientY) - startPos.current;
        const newSize = Math.min(maxSize, Math.max(minSize, startSize.current + delta));
        onResizeMove?.(newSize);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        /* istanbul ignore next - defensive guard */
        if (!isActive.current) return;
        isActive.current = false;
        const delta = (orientation === 'column' ? upEvent.clientX : upEvent.clientY) - startPos.current;
        const newSize = Math.min(maxSize, Math.max(minSize, startSize.current + delta));
        onResizeEnd?.(newSize);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = orientation === 'column' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [orientation, currentSize, minSize, maxSize, onResizeStart, onResizeMove, onResizeEnd]
  );

  const isColumn = orientation === 'column';

  // Touch support for mobile devices.
  // Mirrors the mouse drag logic using touch events.
  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only handle single-finger drags
      if (e.touches.length !== 1) return;
      e.preventDefault();

      isActive.current = true;
      startPos.current = isColumn ? e.touches[0].clientX : e.touches[0].clientY;
      startSize.current = currentSize;

      onResizeStart?.();

      const handleTouchMove = (moveEvent: TouchEvent) => {
        /* istanbul ignore next - defensive guard */
        if (!isActive.current) return;
        moveEvent.preventDefault();
        const clientPos = isColumn ? moveEvent.touches[0].clientX : moveEvent.touches[0].clientY;
        const delta = clientPos - startPos.current;
        const newSize = Math.min(maxSize, Math.max(minSize, startSize.current + delta));
        onResizeMove?.(newSize);
      };

      const handleTouchEnd = (endEvent: TouchEvent) => {
        /* istanbul ignore next - defensive guard */
        if (!isActive.current) return;
        isActive.current = false;
        const touch = endEvent.changedTouches[0];
        const clientPos = isColumn ? touch.clientX : touch.clientY;
        const delta = clientPos - startPos.current;
        const newSize = Math.min(maxSize, Math.max(minSize, startSize.current + delta));
        onResizeEnd?.(newSize);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };

      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
    };
  }, [orientation, currentSize, minSize, maxSize, isColumn, onResizeStart, onResizeMove, onResizeEnd]);

  return (
    <div
      ref={handleRef}
      className={`resize-handle absolute ${
        isColumn
          ? 'right-0 top-0 bottom-0 w-1.5 cursor-col-resize'
          : 'bottom-0 left-0 right-0 h-1.5 cursor-row-resize'
      } z-10 transition-opacity duration-150 ${
        visible ? 'opacity-100 bg-blue-500' : 'opacity-0'
      }`}
      onMouseDown={handleMouseDown}
      title={`Drag to resize ${orientation}`}
    />
  );
}
