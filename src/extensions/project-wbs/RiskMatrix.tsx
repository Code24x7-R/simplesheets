// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Risk Matrix Dashboard
 *
 * 5×5 probability/impact grid with key risks highlighted.
 * RHS key panel shows top risks sorted by score with truncation.
 */

import type { Risk, RiskLevel } from '../types';
import { getRiskMatrix } from './risks';

interface RiskMatrixProps {
  risks: Risk[];
  onCellClick?: (probability: number, impact: number) => void;
  onRiskClick?: (riskId: string) => void;
  width?: number;
  height?: number;
}

const CELL_SIZE = 50;
const LABEL_WIDTH = 40;
const LABEL_HEIGHT = 25;
const KEY_WIDTH = 220;
const MAX_KEY_ITEMS = 8;

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

const LEVEL_LABELS: Record<RiskLevel, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function RiskMatrix({ risks, onCellClick, onRiskClick, width: _width = 350, height: _height = 300 }: RiskMatrixProps) {
  const matrix = getRiskMatrix(risks);
  const gridSize = 5 * CELL_SIZE;
  const svgWidth = LABEL_WIDTH + gridSize;
  const svgHeight = LABEL_HEIGHT + gridSize;

  // Get top risks sorted by score (highest first) for the key
  const topRisks = [...risks]
    .filter((r) => r.status !== 'closed')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, MAX_KEY_ITEMS);

  const truncatedCount = risks.filter((r) => r.status !== 'closed').length - topRisks.length;

  // Count risks by level for summary
  const levelCounts: Record<RiskLevel, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const risk of risks) {
    if (risk.status === 'closed') continue;
    const score = risk.probability * risk.impact;
    levelCounts[getRiskLevel(score)]++;
  }

  return (
    <div className="border border-gray-200 rounded bg-white" data-testid="risk-matrix">
      {/* Dashboard Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Risk Matrix</h3>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-600" />
              {levelCounts.critical}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              {levelCounts.high}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              {levelCounts.medium}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {levelCounts.low}
            </span>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Matrix SVG */}
        <div className="p-3">
          <svg width={svgWidth} height={svgHeight} className="select-none">
            {/* Impact labels (Y axis) */}
            {[5, 4, 3, 2, 1].map((impact, i) => (
              <text
                key={`impact-${impact}`}
                x={LABEL_WIDTH - 4}
                y={LABEL_HEIGHT + i * CELL_SIZE + CELL_SIZE / 2 + 4}
                textAnchor="end"
                fontSize={10}
                fill="#6b7280"
              >
                {impact}
              </text>
            ))}

            {/* Probability labels (X axis) */}
            {[1, 2, 3, 4, 5].map((prob) => (
              <text
                key={`prob-${prob}`}
                x={LABEL_WIDTH + (prob - 1) * CELL_SIZE + CELL_SIZE / 2}
                y={LABEL_HEIGHT - 4}
                textAnchor="middle"
                fontSize={10}
                fill="#6b7280"
              >
                {prob}
              </text>
            ))}

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
                    className="cursor-pointer"
                  >
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width={CELL_SIZE - 2}
                      height={CELL_SIZE - 2}
                      fill={LEVEL_BG_COLORS[level]}
                      stroke={cell.count > 0 && (level === 'critical' || level === 'high') ? LEVEL_COLORS[level] : '#e5e7eb'}
                      strokeWidth={cell.count > 0 && (level === 'critical' || level === 'high') ? 2 : 1}
                      rx={3}
                    />
                    {cell.count > 0 && (
                      <>
                        <circle
                          cx={x + CELL_SIZE / 2}
                          cy={y + CELL_SIZE / 2}
                          r={Math.min(14, 7 + cell.count * 2)}
                          fill={LEVEL_COLORS[level]}
                          opacity={0.85}
                        />
                        <text
                          x={x + CELL_SIZE / 2}
                          y={y + CELL_SIZE / 2 + 4}
                          textAnchor="middle"
                          fontSize={11}
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

            {/* Axis labels */}
            <text x={LABEL_WIDTH + gridSize / 2} y={svgHeight - 2} textAnchor="middle" fontSize={9} fill="#9ca3af">
              Probability →
            </text>
            <text x={10} y={LABEL_HEIGHT + gridSize / 2} textAnchor="middle" fontSize={9} fill="#9ca3af" transform={`rotate(-90, 10, ${LABEL_HEIGHT + gridSize / 2})`}>
              Impact →
            </text>
          </svg>
        </div>

        {/* RHS Key Panel */}
        <div className="border-l border-gray-100 bg-gray-50/50 p-3 flex-1 min-w-0" style={{ width: KEY_WIDTH }}>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Risks</div>

          {topRisks.length === 0 ? (
            <div className="text-xs text-gray-400 italic py-4 text-center">No active risks</div>
          ) : (
            <div className="space-y-1">
              {topRisks.map((risk, index) => {
                const score = risk.probability * risk.impact;
                const level = getRiskLevel(score);
                return (
                  <div
                    key={risk.id}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white cursor-pointer transition-colors group"
                    onClick={() => onRiskClick?.(risk.id)}
                    title={`${risk.title} (${risk.description || 'No description'})`}
                  >
                    {/* Rank */}
                    <span className="text-[10px] text-gray-400 w-3 text-right flex-shrink-0">{index + 1}</span>

                    {/* Score badge */}
                    <span
                      className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ backgroundColor: LEVEL_COLORS[level] }}
                    >
                      {score}
                    </span>

                    {/* Title */}
                    <span className="text-xs text-gray-700 truncate group-hover:text-gray-900 flex-1 min-w-0">
                      {risk.title}
                    </span>
                  </div>
                );
              })}

              {/* Truncation indicator */}
              {truncatedCount > 0 && (
                <div className="text-[10px] text-gray-400 pt-1 px-2">
                  +{truncatedCount} more risk{truncatedCount !== 1 ? 's' : ''} in register
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Severity</div>
            <div className="grid grid-cols-2 gap-1">
              {(['critical', 'high', 'medium', 'low'] as RiskLevel[]).map((level) => (
                <div key={level} className="flex items-center gap-1.5 px-1">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: LEVEL_COLORS[level] }}
                  />
                  <span className="text-[10px] text-gray-600">{LEVEL_LABELS[level]}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{levelCounts[level]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Get risk level from score.
 */
function getRiskLevel(score: number): RiskLevel {
  if (score >= 15) return 'critical';
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}
