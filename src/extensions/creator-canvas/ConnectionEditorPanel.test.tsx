// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectionEditorPanel } from './ConnectionEditorPanel';
import { createDefaultCanvasConnection } from './schema';

describe('ConnectionEditorPanel', () => {
  it('renders connector attributes and saves edited values', () => {
    const onSave = jest.fn();
    const connection = createDefaultCanvasConnection('c1', 'from', 'to', {
      relationship: 'reference',
      label: 'inspiration',
      style: { color: '#64748b', strokeWidth: 2, strokeDash: 'solid', arrowEnd: true },
    });

    render(
      <ConnectionEditorPanel
        connection={connection}
        fromNodeTitle="Research"
        toNodeTitle="Brief"
        onSave={onSave}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Research → Brief')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Connector relationship'), { target: { value: 'dependency' } });
    fireEvent.change(screen.getByLabelText('Connector label'), { target: { value: 'blocks' } });
    fireEvent.change(screen.getByLabelText('Connector stroke width'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Connector line style'), { target: { value: 'dashed' } });
    fireEvent.click(screen.getByLabelText('Arrow at start'));
    fireEvent.click(screen.getByLabelText('Arrow at end'));
    fireEvent.click(screen.getByRole('button', { name: /Save Connector/i }));

    const updated = onSave.mock.calls[0][0];
    expect(updated.id).toBe('c1');
    expect(updated.relationship).toBe('dependency');
    expect(updated.label).toBe('blocks');
    expect(updated.style).toMatchObject({ strokeWidth: 4, strokeDash: 'dashed', arrowStart: true, arrowEnd: false });
  });

  it('closes without saving', () => {
    const onClose = jest.fn();
    render(
      <ConnectionEditorPanel
        connection={createDefaultCanvasConnection('c1', 'from', 'to')}
        fromNodeTitle="From"
        toNodeTitle="To"
        onSave={jest.fn()}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close connector editor' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
