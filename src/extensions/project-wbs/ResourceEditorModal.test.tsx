// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceEditorModal } from './ResourceEditorModal';
import type { Resource } from '../types';

describe('ResourceEditorModal', () => {
  const mockResource: Resource = {
    id: 'r1',
    name: 'Alice Smith',
    role: 'Developer',
    costRate: 100,
    costCurrency: 'USD',
    availability: 100,
    color: '#3B82F6',
  };

  it('renders in create mode', () => {
    render(
      <ResourceEditorModal
        resource={null}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Add Resource' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., Alice Smith')).toBeInTheDocument();
  });

  it('renders in edit mode', () => {
    render(
      <ResourceEditorModal
        resource={mockResource}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Edit Resource')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alice Smith')).toBeInTheDocument();
  });

  it('calls onSave with form data', () => {
    const onSave = jest.fn();
    render(
      <ResourceEditorModal
        resource={null}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('e.g., Alice Smith'), {
      target: { value: 'Bob' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Resource' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Bob' }),
    );
  });

  it('validates required name field', () => {
    const onSave = jest.fn();
    render(
      <ResourceEditorModal
        resource={null}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Resource' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Resource name is required')).toBeInTheDocument();
  });

  it('validates availability range', () => {
    const onSave = jest.fn();
    render(
      <ResourceEditorModal
        resource={null}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('e.g., Alice Smith'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByLabelText(/availability/i), {
      target: { value: '-10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Resource' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Availability must be between 0 and 100')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    render(
      <ResourceEditorModal
        resource={null}
        onClose={onClose}
        onSave={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onDelete when Delete is clicked', () => {
    const onDelete = jest.fn();
    render(
      <ResourceEditorModal
        resource={mockResource}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith('r1');
  });

  it('does not show Delete button in create mode', () => {
    render(
      <ResourceEditorModal
        resource={null}
        onClose={jest.fn()}
        onSave={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('updates color when color swatch is clicked', () => {
    const onSave = jest.fn();
    render(
      <ResourceEditorModal
        resource={null}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('e.g., Alice Smith'), {
      target: { value: 'Test' },
    });

    // Click the green color swatch
    const greenSwatch = screen.getByLabelText('Select color #10B981');
    fireEvent.click(greenSwatch);

    fireEvent.click(screen.getByRole('button', { name: 'Add Resource' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ color: '#10B981' }),
    );
  });

  it('pre-fills form when editing existing resource', () => {
    render(
      <ResourceEditorModal
        resource={mockResource}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(screen.getByDisplayValue('Alice Smith')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Developer')).toBeInTheDocument();
    // Check cost rate and availability separately
    expect(screen.getByLabelText(/cost rate/i)).toHaveValue(100);
    expect(screen.getByLabelText(/availability/i)).toHaveValue(100);
  });

  it('renders in edit mode with correct header', () => {
    render(
      <ResourceEditorModal
        resource={mockResource}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Edit Resource' })).toBeInTheDocument();
  });

  it('updates role field', () => {
    const onSave = jest.fn();
    render(
      <ResourceEditorModal
        resource={null}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('e.g., Alice Smith'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g., Developer, Designer, QA'), {
      target: { value: 'Designer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Resource' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'Designer' }),
    );
  });
});
