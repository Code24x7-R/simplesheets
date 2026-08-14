// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Risk Matrix Visualization
 *
 * 5×5 probability/impact grid with plotted risks.
 */

import type { Risk, RiskLevel } from '../types';
import { getRiskMatrix } from './risks';

interface RiskMatrixProps {
  risks: Risk[];
  onCellClick?: (probability: number, impact: number) => void;
  width?: number;
  height?: number;
}

const CELL_SIZE = 60;
const LABEL_WIDTH = 50;
const LABEL_HEIGHT = 30;

const LEVEL_COLORS: Record<RiskLevel, string> = {
  critical: '#DC2626',
  high: '#F97316',
  medium: '#EAB308',
  low: '#22C55E',
};

const LEVEL_BG_COLORS: Record<RiskLevel, string> = {
  critical: '#FEE2E2',
  high: '#FED7AA',
  medium: '#FEF3C7',
  low: '#DCFCE7',
};

export function RiskMatrix({ risks, onCellClick, width: _width = 350, height: _height = 300 }: RiskMatrixProps) {
  const matrix = getRiskMatrix(risks);
  const gridSize = 5 * CELL_SIZE;
  const svgWidth = LABEL_WIDTH + gridSize;
  const svgHeight = LABEL_HEIGHT + gridSize;

  return (
    <div className="border border-gray-200 rounded bg-white p-3" data-testid="risk-matrix">
      <h3 className="text-sm font-medium mb-2">Risk Matrix</h3>
      <svg width={svgWidth} height={svgHeight} className="select-none">
        {/* Impact labels (Y axis) */}
        {[5, 4, 3, 2, 1].map((impact, i) => (
          <text
            key={`impact-${impact}`}
            x={LABEL_WIDTH - 5}
            y={LABEL_HEIGHT + i * CELL_SIZE + CELL_SIZE / 2 + 4}
            textAnchor="end"
            fontSize={11}
            fill="#6b7280"
          >
            {impact}
          </text>
        ))}
        <text x={LABEL_WIDTH - 5} y={LABEL_HEIGHT - 10} textAnchor="end" fontSize={10} fill="#9ca3af">
          Impact →
        </text>

        {/* Probability labels (X axis) */}
        {[1, 2, 3, 4, 5].map((prob) => (
          <text
            key={`prob-${prob}`}
            x={LABEL_WIDTH + (prob - 1) * CELL_SIZE + CELL_SIZE / 2}
            y={LABEL_HEIGHT - 5}
            textAnchor="middle"
            fontSize={11}
            fill="#6b7280"
          >
            {prob}
          </text>
        ))}
        <text x={LABEL_WIDTH + gridSize / 2} y={svgHeight - 2} textAnchor="middle" fontSize={10} fill="#9ca3af">
          Probability →
        </text>

        {/* Grid cells */}
        {matrix.cells.map((row, probIdx) =>
          row.map((cell, impactIdx) => {
            const x = LABEL_WIDTH + probIdx * CELL_SIZE;
            const y = LABEL_HEIGHT + (4 - impactIdx) * CELL_SIZE; // Flip Y so high impact is at top
            const level = cell.level;

            return (
              <g key={`${probIdx}-${impactIdx}`} onClick={() => onCellClick?.(cell.probability, cell.impact)} className="cursor-pointer">
                <rect
                  x={x}
                  y={y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  fill={LEVEL_BG_COLORS[level]}
                  stroke="#d1d5db"
                  strokeWidth={1}
                />
                {cell.count > 0 && (
                  <>
                    <circle
                      cx={x + CELL_SIZE / 2}
                      cy={y + CELL_SIZE / 2}
                      r={Math.min(15, 8 + cell.count * 3)}
                      fill={LEVEL_COLORS[level]}
                      opacity={0.8}
                    />
                    <text
                      x={x + CELL_SIZE / 2}
                      y={y + CELL_SIZE / 2 + 4}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight="bold"
                      fill="white"
                    >
                      {cell.count}
                    </text>
                  </>
                )}
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}
