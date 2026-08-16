// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { ActualsEditorModal } from './ActualsEditorModal';
import type { ActualSpendEntry, WBSTask } from '../types';

const mockTasks: WBSTask[] = [
  {
    id: 'task-1',
    name: 'Design Phase',
    description: '',
    level: 0,
    parentId: null,
    children: [],
    startDate: '2025-01-01',
    endDate: '2025-01-15',
    duration: 10,
    progress: 50,
    effort: 80,
    effortUnit: 'hours',
    cost: 0,
    costCurrency: 'USD',
    responsibleResourceId: null,
    dependencies: [],
    isMilestone: false,
    isSummary: false,
    collapsed: false,
    color: '#3B82F6',
    riskIds: [],
    customFields: {},
  },
  {
    id: 'task-2',
    name: 'Development',
    description: '',
    level: 0,
    parentId: null,
    children: [],
    startDate: '2025-01-16',
    endDate: '2025-02-15',
    duration: 20,
    progress: 0,
    effort: 160,
    effortUnit: 'hours',
    cost: 0,
    costCurrency: 'USD',
    responsibleResourceId: null,
    dependencies: [],
    isMilestone: false,
    isSummary: false,
    collapsed: false,
    color: '#10B981',
    riskIds: [],
    customFields: {},
  },
];

const mockEntry: ActualSpendEntry = {
  id: 'act-1',
  taskId: 'task-1',
  date: '2025-01-10',
  amount: 1500,
  currency: 'USD',
  source: 'Acme Corp',
  notes: 'Design services invoice',
};

describe('ActualsEditorModal', () => {
  const defaultProps = {
    entry: null,
    tasks: mockTasks,
    defaultCurrency: 'USD',
    onClose: jest.fn(),
    onSave: jest.fn(),
    onDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create mode', () => {
    it('renders modal with correct title', () => {
      render(<ActualsEditorModal {...defaultProps} entry={null} />);
      expect(screen.getByText('Add Actual Spend')).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(<ActualsEditorModal {...defaultProps} entry={null} />);
      expect(screen.getByLabelText(/task/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/source/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    it('shows task options', () => {
      render(<ActualsEditorModal {...defaultProps} entry={null} />);
      expect(screen.getByText('Design Phase')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', () => {
      const onClose = jest.fn();
      render(<ActualsEditorModal {...defaultProps} entry={null} onClose={onClose} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when X is clicked', () => {
      const onClose = jest.fn();
      render(<ActualsEditorModal {...defaultProps} entry={null} onClose={onClose} />);
      fireEvent.click(screen.getByTestId('close-modal'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows validation error when saving without required fields', () => {
      const onSave = jest.fn();
      render(<ActualsEditorModal {...defaultProps} entry={null} onSave={onSave} />);
      fireEvent.click(screen.getByText('Add Entry'));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByText('Task is required')).toBeInTheDocument();
    });

    it('calls onSave with form data when valid', () => {
      const onSave = jest.fn();
      render(<ActualsEditorModal {...defaultProps} entry={null} onSave={onSave} />);

      // Fill in the form
      fireEvent.change(screen.getByLabelText(/task/i), { target: { value: 'task-1' } });
      fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2025-01-10' } });
      // NumericInput requires blur to commit the value
      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '1500' } });
      fireEvent.blur(amountInput);
      fireEvent.change(screen.getByPlaceholderText(/vendor/i), { target: { value: 'Acme Corp' } });

      fireEvent.click(screen.getByText('Add Entry'));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          date: '2025-01-10',
          amount: 1500,
          source: 'Acme Corp',
        }),
      );
    });
  });

  describe('edit mode', () => {
    it('renders modal with correct title', () => {
      render(<ActualsEditorModal {...defaultProps} entry={mockEntry} />);
      expect(screen.getByText('Edit Actual Spend')).toBeInTheDocument();
    });

    it('populates form with entry data', () => {
      render(<ActualsEditorModal {...defaultProps} entry={mockEntry} />);
      expect(screen.getByDisplayValue('2025-01-10')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Design services invoice')).toBeInTheDocument();
    });

    it('shows delete button in edit mode', () => {
      render(<ActualsEditorModal {...defaultProps} entry={mockEntry} />);
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('calls onDelete when Delete is clicked', () => {
      const onDelete = jest.fn();
      render(<ActualsEditorModal {...defaultProps} entry={mockEntry} onDelete={onDelete} />);
      fireEvent.click(screen.getByText('Delete'));
      expect(onDelete).toHaveBeenCalledWith('act-1');
    });

    it('calls onSave with updated data', () => {
      const onSave = jest.fn();
      render(<ActualsEditorModal {...defaultProps} entry={mockEntry} onSave={onSave} />);

      fireEvent.change(screen.getByPlaceholderText(/vendor/i), { target: { value: 'New Vendor' } });
      fireEvent.click(screen.getByText('Save Changes'));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'act-1',
          source: 'New Vendor',
        }),
      );
    });
  });

  describe('validation', () => {
    it('shows error for zero amount', () => {
      const onSave = jest.fn();
      render(<ActualsEditorModal {...defaultProps} entry={null} onSave={onSave} />);

      fireEvent.change(screen.getByLabelText(/task/i), { target: { value: 'task-1' } });
      fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2025-01-10' } });
      fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '0' } });
      fireEvent.change(screen.getByPlaceholderText(/vendor/i), { target: { value: 'Vendor' } });

      fireEvent.click(screen.getByText('Add Entry'));

      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByText('Amount must be positive')).toBeInTheDocument();
    });

    it('shows error for empty source', () => {
      const onSave = jest.fn();
      render(<ActualsEditorModal {...defaultProps} entry={null} onSave={onSave} />);

      fireEvent.change(screen.getByLabelText(/task/i), { target: { value: 'task-1' } });
      fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2025-01-10' } });
      fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });

      fireEvent.click(screen.getByText('Add Entry'));

      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByText('Source is required')).toBeInTheDocument();
    });
  });
});
