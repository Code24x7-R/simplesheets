// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import type { CanvasBounds, CanvasPosition } from './types';

/**
 * Finds where the segment between two rectangle centres intersects a rectangle.
 * The returned point is on the rectangle boundary, rather than at its centre.
 */
export function getRectBoundaryPoint(
  sourceCenter: CanvasPosition,
  target: CanvasBounds
): CanvasPosition {
  const targetCenter = {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  };
  const dx = sourceCenter.x - targetCenter.x;
  const dy = sourceCenter.y - targetCenter.y;

  if (dx === 0 && dy === 0) return targetCenter;

  const halfWidth = Math.max(target.width / 2, 0);
  const halfHeight = Math.max(target.height / 2, 0);
  const scaleX = dx === 0 ? Infinity : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : halfHeight / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: targetCenter.x + dx * scale,
    y: targetCenter.y + dy * scale,
  };
}

export function getCanvasNodeCenter(node: Pick<CanvasBounds, 'x' | 'y' | 'width' | 'height'>): CanvasPosition {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

/** Returns edge-docked endpoints for a connection between two node rectangles. */
export function getDockedConnectionEndpoints(
  from: CanvasBounds,
  to: CanvasBounds
): { start: CanvasPosition; end: CanvasPosition } {
  const fromCenter = getCanvasNodeCenter(from);
  const toCenter = getCanvasNodeCenter(to);
  return {
    start: getRectBoundaryPoint(toCenter, from),
    end: getRectBoundaryPoint(fromCenter, to),
  };
}
