// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarConfigModal } from './CalendarConfigModal';
import type { WorkingCalendar } from '../types';

function createMockCalendar(): WorkingCalendar {
  return {
    workingDays: new Set([1, 2, 3, 4, 5]),
    holidays: new Set(['2026-05-26']),
    hoursPerDay: 8,
  };
}

describe('CalendarConfigModal', () => {
  it('renders without crashing', () => {
    const calendar = createMockCalendar();
    const onSave = jest.fn();
    render(<CalendarConfigModal calendar={calendar} onClose={jest.fn()} onSave={onSave} />);
    expect(screen.getByText('Calendar Configuration')).toBeTruthy();
  });

  it('displays all days of the week', () => {
    const calendar = createMockCalendar();
    render(<CalendarConfigModal calendar={calendar} onClose={jest.fn()} onSave={jest.fn()} />);
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.getByText('Tue')).toBeTruthy();
    expect(screen.getByText('Wed')).toBeTruthy();
    expect(screen.getByText('Thu')).toBeTruthy();
    expect(screen.getByText('Fri')).toBeTruthy();
    expect(screen.getByText('Sat')).toBeTruthy();
    expect(screen.getByText('Sun')).toBeTruthy();
  });

  it('highlights selected working days', () => {
    const calendar = createMockCalendar();
    render(<CalendarConfigModal calendar={calendar} onClose={jest.fn()} onSave={jest.fn()} />);
    const monButton = screen.getByText('Mon').closest('button');
    expect(monButton).toHaveClass('bg-blue-600');
  });

  it('toggles day selection on click', () => {
    const calendar = createMockCalendar();
    render(<CalendarConfigModal calendar={calendar} onClose={jest.fn()} onSave={jest.fn()} />);
    const satButton = screen.getByText('Sat').closest('button');
    expect(satButton).toHaveClass('bg-gray-100');
    fireEvent.click(satButton!);
    expect(satButton).toHaveClass('bg-blue-600');
  });

  it('shows presets', () => {
    const calendar = createMockCalendar();
    render(<CalendarConfigModal calendar={calendar} onClose={jest.fn()} onSave={jest.fn()} />);
    expect(screen.getByText('Monday–Friday')).toBeTruthy();
    expect(screen.getByText('Monday–Saturday')).toBeTruthy();
  });

  it('applies preset on click', () => {
    const calendar = createMockCalendar();
    render(<CalendarConfigModal calendar={calendar} onClose={jest.fn()} onSave={jest.fn()} />);
    fireEvent.click(screen.getByText('Monday–Saturday'));
    const satButton = screen.getByText('Sat').closest('button');
    expect(satButton).toHaveClass('bg-blue-600');
  });

  it('shows hours per day slider', () => {
    const calendar = createMockCalendar();
    render(<CalendarConfigModal calendar={calendar} onClose={jest.fn()} onSave={jest.fn()} />);
    expect(screen.getByText('Hours per Day: 8')).toBeTruthy();
  });

  it('shows existing holidays', () => {
    const calendar = createMockCalendar();
    render(<CalendarConfigModal calendar={calendar} onClose={jest.fn()} onSave={jest.fn()} />);
    expect(screen.getByText('2026-05-26')).toBeTruthy();
  });

  it('adds new holiday', () => {
    const calendar = createMockCalendar();
    render(<CalendarConfigModal calendar={calendar} onClose={jest.fn()} onSave={jest.fn()} />);
    // Find the date input within the Holidays section
    const dateInputs = document.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
    expect(dateInputs.length).toBeGreaterThan(0);
    fireEvent.change(dateInputs[0], { target: { value: '2026-12-25' } });
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText('2026-12-25')).toBeTruthy();
  });

  it('removes holiday', () => {
    const calendar = createMockCalendar();
    render(<CalendarConfigModal calendar={calendar} onClose={jest.fn()} onSave={jest.fn()} />);
    // Find the row containing the holiday date and click its remove button
    const holidayRow = screen.getByText('2026-05-26').closest('div.flex') as HTMLDivElement;
    const removeButton = holidayRow.querySelector('button') as HTMLButtonElement;
    fireEvent.click(removeButton);
    expect(screen.queryByText('2026-05-26')).toBeNull();
  });

  it('calls onSave with updated calendar', () => {
    const calendar = createMockCalendar();
    const onSave = jest.fn();
    render(<CalendarConfigModal calendar={calendar} onClose={jest.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByText('Save Calendar'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        workingDays: expect.any(Set),
        holidays: expect.any(Set),
        hoursPerDay: 8,
      })
    );
  });

  it('calls onClose when cancel clicked', () => {
    const calendar = createMockCalendar();
    const onClose = jest.fn();
    render(<CalendarConfigModal calendar={calendar} onClose={onClose} onSave={jest.fn()} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
