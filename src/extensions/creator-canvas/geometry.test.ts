// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import { getDockedConnectionEndpoints, getRectBoundaryPoint } from './geometry';

describe('Creator Canvas connection geometry', () => {
  it('docks a horizontal connection to left and right edges', () => {
    const endpoints = getDockedConnectionEndpoints(
      { x: 0, y: 0, width: 100, height: 60 },
      { x: 300, y: 0, width: 100, height: 60 }
    );
    expect(endpoints.start).toEqual({ x: 100, y: 30 });
    expect(endpoints.end).toEqual({ x: 300, y: 30 });
  });

  it('docks diagonal connections to the appropriate boundaries', () => {
    const point = getRectBoundaryPoint(
      { x: 0, y: 0 },
      { x: 100, y: 100, width: 100, height: 100 }
    );
    expect(point).toEqual({ x: 100, y: 100 });
  });

  it('handles coincident centres without producing NaN', () => {
    expect(getRectBoundaryPoint({ x: 150, y: 150 }, { x: 100, y: 100, width: 100, height: 100 }))
      .toEqual({ x: 150, y: 150 });
  });
});
