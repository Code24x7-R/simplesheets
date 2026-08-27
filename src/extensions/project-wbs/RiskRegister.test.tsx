// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { RiskRegister } from './RiskRegister';
import type { Risk } from '../types';

function createRisk(overrides: Partial<Risk> = {}): Risk {
  return {
    id: 'risk-1',
    projectId: 'proj-1',
    taskId: null,
    title: 'Test Risk',
    description: '',
    category: 'technical',
    probability: 3,
    impact: 4,
    riskScore: 12,
    status: 'identified',
    mitigationPlan: '',
    contingencyPlan: '',
    mitigationCost: 0,
    ownerId: null,
    identifiedDate: '2026-01-01',
    reviewDate: '2026-02-01',
    triggerCondition: '',
    residualProbability: 2,
    residualImpact: 3,
    residualRiskScore: 6,
    customFields: {},
    ...overrides,
  };
}

describe('RiskRegister', () => {
  const risks = [
    createRisk({ id: 'r1', title: 'Scope Creep', category: 'scope', probability: 4, impact: 5, riskScore: 20, status: 'identified' }),
    createRisk({ id: 'r2', title: 'Budget Overrun', category: 'cost', probability: 3, impact: 4, riskScore: 12, status: 'mitigating' }),
    createRisk({ id: 'r3', title: 'Staff Turnover', category: 'resource', probability: 2, impact: 3, riskScore: 6, status: 'closed' }),
  ];

  it('renders the risk register', () => {
    render(<RiskRegister risks={risks} />);
    expect(screen.getByTestId('risk-register')).toBeInTheDocument();
  });

  it('renders all risk titles', () => {
    render(<RiskRegister risks={risks} />);
    expect(screen.getByText('Scope Creep')).toBeInTheDocument();
    expect(screen.getByText('Budget Overrun')).toBeInTheDocument();
    expect(screen.getByText('Staff Turnover')).toBeInTheDocument();
  });

  it('displays risk scores with color coding', () => {
    render(<RiskRegister risks={risks} />);
    const score = screen.getByText('20');
    expect(score.className).toContain('bg-red-100'); // Critical = red
  });

  it('calls onRiskSelect when a row is clicked', () => {
    const onRiskSelect = jest.fn();
    render(<RiskRegister risks={risks} onRiskSelect={onRiskSelect} />);
    fireEvent.click(screen.getByText('Scope Creep'));
    expect(onRiskSelect).toHaveBeenCalledWith('r1');
  });

  it('calls onRiskClose when close button is clicked', () => {
    const onRiskClose = jest.fn();
    render(<RiskRegister risks={risks} onRiskClose={onRiskClose} />);
    const closeButtons = screen.getAllByText('Close');
    fireEvent.click(closeButtons[0]);
    expect(onRiskClose).toHaveBeenCalledWith('r1');
  });

  it('filters risks by status', () => {
    render(<RiskRegister risks={risks} />);
    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'closed' } });
    expect(screen.queryByText('Scope Creep')).not.toBeInTheDocument();
    expect(screen.getByText('Staff Turnover')).toBeInTheDocument();
  });

  it('filters risks by category', () => {
    render(<RiskRegister risks={risks} />);
    const categorySelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(categorySelect, { target: { value: 'cost' } });
    expect(screen.getByText('Budget Overrun')).toBeInTheDocument();
    expect(screen.queryByText('Scope Creep')).not.toBeInTheDocument();
  });

  it('shows empty state when no risks match', () => {
    render(<RiskRegister risks={[]} />);
    expect(screen.getByText(/No risks match/)).toBeInTheDocument();
  });

  it('sorts by score descending by default', () => {
    render(<RiskRegister risks={risks} />);
    // The first row should have the highest score (Scope Creep, score 20)
    const rows = screen.getAllByRole('row');
    // Row 0 is header, Row 1 should be Scope Creep (highest score)
    expect(rows[1]).toHaveTextContent('Scope Creep');
  });

  // ─── Phase 2: Grouping tests ──────────────────────────────────────

  it('renders grouping selector', () => {
    render(<RiskRegister risks={risks} />);
    expect(screen.getByText('Group by:')).toBeTruthy();
  });

  it('groups risks by category', () => {
    render(<RiskRegister risks={risks} />);

    // Select category grouping (click the button in the filter area)
    const groupButtons = screen.getAllByText('Category');
    fireEvent.click(groupButtons[0]);

    // Should show group headers for each category (in table body)
    // Use getAllByText since labels may appear in both selector and header
    expect(screen.getAllByText('Cost').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Resource').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Scope').length).toBeGreaterThanOrEqual(1);
  });

  it('groups risks by status', () => {
    render(<RiskRegister risks={risks} />);

    // Select status grouping (click the button in the filter area)
    const groupButtons = screen.getAllByText('Status');
    fireEvent.click(groupButtons[0]);

    // Should show group headers for each status
    expect(screen.getAllByText('Identified').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Mitigating').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Closed').length).toBeGreaterThanOrEqual(1);
  });

  it('shows risk count per group', () => {
    render(<RiskRegister risks={risks} />);

    // Select category grouping (click the button in the filter area)
    const groupButtons = screen.getAllByText('Category');
    fireEvent.click(groupButtons[0]);

    // Each group should show count (all have 1 risk each)
    // The count is shown as "(1 risk)" in the group header
    const counts = screen.getAllByText(/\d+ risk/);
    expect(counts.length).toBe(3); // 3 categories with 1 risk each
  });
});
