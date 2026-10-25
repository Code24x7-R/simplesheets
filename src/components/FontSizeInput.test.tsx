// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { FontSizeInput } from './FontSizeInput';

function renderInput(value = 14) {
  const onChange = jest.fn();
  const utils = render(<FontSizeInput value={value} onChange={onChange} />);
  return { ...utils, onChange, input: screen.getByLabelText('Font Size') as HTMLInputElement };
}

describe('FontSizeInput', () => {
  it('renders the current size', () => {
    const { input } = renderInput(18);
    expect(input.value).toBe('18');
  });

  it('syncs when the value prop changes', () => {
    const { input, rerender } = renderInput(14);
    rerender(<FontSizeInput value={24} onChange={jest.fn()} />);
    expect(input.value).toBe('24');
  });

  it('snaps a typed value to the nearest size on Enter', () => {
    const { input, onChange } = renderInput(14);
    fireEvent.change(input, { target: { value: '11.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it('rounds a midpoint up (13 -> 14)', () => {
    const { input, onChange } = renderInput(10);
    fireEvent.change(input, { target: { value: '13' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(14);
  });

  it('picks the nearest size (30 -> 28)', () => {
    const { input, onChange } = renderInput(14);
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(28);
  });

  it('snaps values outside the range to the bounds', () => {
    const { input, onChange } = renderInput(14);
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(8);

    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(72);
  });

  it('displays the snapped value after committing', () => {
    const { input } = renderInput(14);
    fireEvent.change(input, { target: { value: '11.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('12');
  });

  it('commits on blur', () => {
    const { input, onChange } = renderInput(10);
    fireEvent.change(input, { target: { value: '13' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(14);
  });

  it('does not call onChange when the snapped value is unchanged', () => {
    const { input, onChange } = renderInput(14);
    fireEvent.change(input, { target: { value: '14' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reverts unparseable input', () => {
    const { input, onChange } = renderInput(14);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('14');
  });

  it('reverts on Escape without applying', () => {
    const { input, onChange } = renderInput(14);
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('14');
  });

  it('opens the dropdown and applies a picked size', () => {
    const { onChange } = renderInput(14);
    fireEvent.click(screen.getByLabelText('Font size options'));
    fireEvent.click(screen.getByText('20'));
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it('opens the dropdown with ArrowDown', () => {
    const { input } = renderInput(14);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByText('72')).toBeTruthy();
  });

  it('closes the dropdown on outside click', () => {
    renderInput(14);
    fireEvent.click(screen.getByLabelText('Font size options'));
    expect(screen.getByText('72')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('72')).toBeNull();
  });

  it('marks the active size in the dropdown', () => {
    renderInput(20);
    fireEvent.click(screen.getByLabelText('Font size options'));
    const option = screen.getByText('20');
    expect(option.className).toContain('font-size-option-active');
  });

  it('does not let key events bubble to global handlers', () => {
    const onKeyDown = jest.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <FontSizeInput value={14} onChange={jest.fn()} />
      </div>,
    );
    fireEvent.keyDown(screen.getByLabelText('Font Size'), { key: 'b', ctrlKey: true });
    expect(onKeyDown).not.toHaveBeenCalled();
  });
});
