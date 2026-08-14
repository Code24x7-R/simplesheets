// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { RiskMatrix } from './RiskMatrix';
import type { Risk } from '../types';

function createRisk(overrides: Partial<Risk> = {}): Risk {
  return {
    id: 'risk-1', projectId: 'proj-1', taskId: null, title: 'Risk', description: '',
    category: 'technical', probability: 3, impact: 4, riskScore: 12, status: 'identified',
    mitigationPlan: '', contingencyPlan: '', mitigationCost: 0, ownerId: null,
    identifiedDate: '2026-01-01', reviewDate: '2026-02-01', triggerCondition: '',
    residualProbability: 2, residualImpact: 3, residualRiskScore: 6, customFields: {},
    ...overrides,
  };
}

describe('RiskMatrix', () => {
  it('renders the risk matrix', () => {
    render(<RiskMatrix risks={[]} />);
    expect(screen.getByTestId('risk-matrix')).toBeInTheDocument();
  });

  it('renders SVG grid', () => {
    render(<RiskMatrix risks={[]} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    // 25 cells (5×5)
    const cells = svg!.querySelectorAll('rect');
    expect(cells.length).toBe(25);
  });

  it('plots risks as circles', () => {
    const risks = [
      createRisk({ id: 'r1', probability: 2, impact: 3 }),
      createRisk({ id: 'r2', probability: 4, impact: 5 }),
    ];
    render(<RiskMatrix risks={risks} />);
    const circles = document.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });

  it('excludes closed risks', () => {
    const risks = [
      createRisk({ id: 'r1', probability: 3, impact: 3, status: 'closed' }),
    ];
    render(<RiskMatrix risks={risks} />);
    const circles = document.querySelectorAll('circle');
    expect(circles.length).toBe(0);
  });

  it('calls onCellClick when a cell is clicked', () => {
    const onCellClick = jest.fn();
    render(<RiskMatrix risks={[]} onCellClick={onCellClick} />);
    // Click on the first cell (probability=1, impact=5 — top-left)
    const cells = document.querySelectorAll('rect');
    fireEvent.click(cells[0]);
    expect(onCellClick).toHaveBeenCalled();
  });

  it('displays risk count labels', () => {
    const risks = [
      createRisk({ id: 'r1', probability: 3, impact: 3 }),
      createRisk({ id: 'r2', probability: 3, impact: 3 }),
    ];
    render(<RiskMatrix risks={risks} />);
    // The count label '2' appears in the circle text
    const countLabels = screen.getAllByText('2');
    expect(countLabels.length).toBeGreaterThanOrEqual(1);
  });
});
