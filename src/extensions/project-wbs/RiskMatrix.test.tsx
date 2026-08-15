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

  it('shows popup with risk details on hover', () => {
    const risks = [
      createRisk({ id: 'r1', probability: 3, impact: 4, title: 'Scope Creep', category: 'scope' }),
      createRisk({ id: 'r2', probability: 3, impact: 4, title: 'Resource Issue', category: 'resource' }),
    ];
    const { container } = render(<RiskMatrix risks={risks} width={400} height={400} />);

    // Find the cell with probability=3 (x=170), impact=4 (y=90)
    // Note: Y is flipped - impact=5 is at top (y=30), impact=4 is at y=90
    const allG = container.querySelectorAll('g.cursor-pointer');
    const targetCell = Array.from(allG).find((g) => {
      const rect = g.querySelector('rect');
      if (!rect) return false;
      const x = parseFloat(rect.getAttribute('x') || '0');
      const y = parseFloat(rect.getAttribute('y') || '0');
      // probability=3 -> x=170, impact=4 -> y=90
      return x === 170 && y === 90;
    });
    expect(targetCell).toBeTruthy();

    // Hover over the cell
    fireEvent.mouseEnter(targetCell!);

    // Popup should show with risk titles
    expect(screen.getByText('Scope Creep')).toBeInTheDocument();
    expect(screen.getByText('Resource Issue')).toBeInTheDocument();
  });

  it('popup shows risk level and score in header', () => {
    const risks = [
      createRisk({ id: 'r1', probability: 4, impact: 5, title: 'Critical Risk' }),
    ];
    const { container } = render(<RiskMatrix risks={risks} width={400} height={400} />);

    // Find the cell with probability=4 (x=230), impact=5 (y=30)
    const allG = container.querySelectorAll('g.cursor-pointer');
    const targetCell = Array.from(allG).find((g) => {
      const rect = g.querySelector('rect');
      if (!rect) return false;
      const x = parseFloat(rect.getAttribute('x') || '0');
      const y = parseFloat(rect.getAttribute('y') || '0');
      // probability=4 -> x=230, impact=5 -> y=30
      return x === 230 && y === 30;
    });
    expect(targetCell).toBeTruthy();

    fireEvent.mouseEnter(targetCell!);

    // Header shows score: 4 × 5 = 20
    expect(screen.getByText(/4 × 5 = 20/)).toBeInTheDocument();
  });
});
