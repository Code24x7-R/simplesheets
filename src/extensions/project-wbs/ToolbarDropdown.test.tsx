// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolbarDropdown } from './ToolbarDropdown';

describe('ToolbarDropdown', () => {
  it('renders the trigger button with label', () => {
    render(
      <ToolbarDropdown label="Actions">
        <button>Action 1</button>
      </ToolbarDropdown>
    );
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('does not show menu items by default', () => {
    render(
      <ToolbarDropdown label="Actions">
        <button data-testid="item-1">Action 1</button>
      </ToolbarDropdown>
    );
    expect(screen.queryByTestId('item-1')).toBeNull();
  });

  it('shows menu items when trigger is clicked', () => {
    render(
      <ToolbarDropdown label="Actions">
        <button data-testid="item-1">Action 1</button>
      </ToolbarDropdown>
    );

    fireEvent.click(screen.getByText('Actions'));
    expect(screen.getByTestId('item-1')).toBeTruthy();
  });

  it('hides menu items when trigger is clicked again', () => {
    render(
      <ToolbarDropdown label="Actions">
        <button data-testid="item-1">Action 1</button>
      </ToolbarDropdown>
    );

    const trigger = screen.getByText('Actions');
    fireEvent.click(trigger);
    expect(screen.getByTestId('item-1')).toBeTruthy();

    fireEvent.click(trigger);
    expect(screen.queryByTestId('item-1')).toBeNull();
  });

  it('calls item onClick and closes menu when item is clicked', () => {
    const onAction = jest.fn();
    render(
      <ToolbarDropdown label="Actions">
        <button data-testid="item-1" onClick={onAction}>
          Action 1
        </button>
      </ToolbarDropdown>
    );

    fireEvent.click(screen.getByText('Actions'));
    fireEvent.click(screen.getByTestId('item-1'));

    expect(onAction).toHaveBeenCalled();
    expect(screen.queryByTestId('item-1')).toBeNull();
  });

  it('closes menu when clicking outside', () => {
    render(
      <div>
        <ToolbarDropdown label="Actions">
          <button data-testid="item-1">Action 1</button>
        </ToolbarDropdown>
        <div data-testid="outside">Outside</div>
      </div>
    );

    fireEvent.click(screen.getByText('Actions'));
    expect(screen.getByTestId('item-1')).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('item-1')).toBeNull();
  });

  it('supports icon-only trigger button', () => {
    render(
      <ToolbarDropdown label="⚙️" iconOnly>
        <button data-testid="item-1">Settings</button>
      </ToolbarDropdown>
    );

    const trigger = screen.getByText('⚙️');
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.getByTestId('item-1')).toBeTruthy();
  });
});
