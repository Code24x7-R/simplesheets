// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Risk Matrix Visualization
 *
 * 5×5 probability/impact grid with plotted risks.
 */

import { useState } from 'react';
import type { Risk, RiskLevel } from '../types';
import { getRiskMatrix } from './risks';

interface RiskMatrixProps {
  risks: Risk[];
  onCellClick?: (probability: number, impact: number) => void;
  onRiskClick?: (riskId: string) => void;
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

export function RiskMatrix({ risks, onCellClick, onRiskClick, width: _width = 350, height: _height = 300 }: RiskMatrixProps) {
  const matrix = getRiskMatrix(risks);
  const gridSize = 5 * CELL_SIZE;
  const svgWidth = LABEL_WIDTH + gridSize;
  const svgHeight = LABEL_HEIGHT + gridSize;
  const [hoveredCell, setHoveredCell] = useState<{ prob: number; impact: number; x: number; y: number } | null>(null);

  // Build a map of riskId -> Risk for quick lookup
  const riskMap = new Map<string, Risk>();
  for (const risk of risks) {
    riskMap.set(risk.id, risk);
  }

  return (
    <div className="border border-gray-200 rounded bg-white p-3 relative" data-testid="risk-matrix">
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
              <g
                key={`${probIdx}-${impactIdx}`}
                onClick={() => onCellClick?.(cell.probability, cell.impact)}
                onMouseEnter={() => cell.count > 0 && setHoveredCell({ prob: cell.probability, impact: cell.impact, x, y })}
                onMouseLeave={() => setHoveredCell(null)}
                className="cursor-pointer"
              >
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

      {/* SVG Popup for risk details */}
      {hoveredCell && (() => {
        const cell = matrix.cells[hoveredCell.prob - 1][hoveredCell.impact - 1];
        if (!cell || cell.count === 0) return null;

        const risksInCell = cell.riskIds
          .map((id) => riskMap.get(id))
          .filter((r): r is Risk => r !== undefined);

        const popupX = hoveredCell.x + CELL_SIZE + 8;
        const popupY = hoveredCell.y;
        const popupWidth = 200;

        return (
          <div
            className="absolute bg-white border border-gray-300 rounded-lg shadow-lg z-10 pointer-events-auto overflow-hidden"
            style={{
              left: Math.min(popupX, svgWidth - popupWidth + LABEL_WIDTH),
              top: Math.max(0, popupY - 10),
              width: popupWidth,
            }}
          >
            {/* Header */}
            <div
              className="px-3 py-1.5 text-xs font-medium text-white"
              style={{ backgroundColor: LEVEL_COLORS[cell.level] }}
            >
              {cell.probability} × {cell.impact} = {cell.probability * cell.impact} ({cell.level})
            </div>
            {/* Risk list */}
            <div className="divide-y divide-gray-100">
              {risksInCell.map((risk) => (
                <div
                  key={risk.id}
                  className="px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                  onClick={() => onRiskClick?.(risk.id)}
                  title={risk.description || risk.title}
                >
                  <div className="text-xs font-medium text-gray-900 truncate">
                    {risk.title}
                  </div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      risk.status === 'mitigating' ? 'bg-green-500' :
                      risk.status === 'monitoring' ? 'bg-blue-500' :
                      risk.status === 'closed' ? 'bg-gray-500' :
                      risk.status === 'occurred' ? 'bg-red-500' :
                      'bg-yellow-500'
                    }`} />
                    <span>{risk.category}</span>
                    <span>•</span>
                    <span>P{risk.probability} I{risk.impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
