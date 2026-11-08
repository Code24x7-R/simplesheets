// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FontFamilyInput } from './FontFamilyInput';
import { listSystemFontFamilies } from '../utils/fontFamily';

jest.mock('../utils/fontFamily', () => {
  const actual = jest.requireActual('../utils/fontFamily');
  return {
    ...actual,
    listSystemFontFamilies: jest.fn(),
  };
});

const mockList = listSystemFontFamilies as jest.MockedFunction<typeof listSystemFontFamilies>;

beforeEach(() => {
  mockList.mockReset();
  mockList.mockResolvedValue({
    families: ['Arial', 'Calibri', 'Verdana'],
    source: 'system',
  });
});

describe('FontFamilyInput', () => {
  it('shows the default family when no value is set', () => {
    render(<FontFamilyInput onChange={jest.fn()} />);
    expect(screen.getByLabelText('Font Family').textContent).toContain('Default (monospace)');
  });

  it('shows the current family', () => {
    render(<FontFamilyInput value="Georgia" onChange={jest.fn()} />);
    expect(screen.getByLabelText('Font Family').textContent).toContain('Georgia');
  });

  it('loads installed families and selects one', async () => {
    const onChange = jest.fn();
    render(<FontFamilyInput onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Font Family'));
    expect(await screen.findByRole('option', { name: 'Calibri' })).toBeTruthy();

    fireEvent.click(screen.getByRole('option', { name: 'Calibri' }));
    expect(onChange).toHaveBeenCalledWith('Calibri');
  });

  it('clears the family when Default is selected', async () => {
    const onChange = jest.fn();
    render(<FontFamilyInput value="Calibri" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Font Family'));
    await screen.findByRole('option', { name: 'Default (monospace)' });
    fireEvent.click(screen.getByRole('option', { name: 'Default (monospace)' }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('filters the list with the search field', async () => {
    render(<FontFamilyInput onChange={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Font Family'));
    await screen.findByRole('option', { name: 'Arial' });

    fireEvent.change(screen.getByLabelText('Search font families'), {
      target: { value: 'ver' },
    });

    expect(screen.getByRole('option', { name: 'Verdana' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Arial' })).toBeNull();
  });

  it('shows a fallback note when system enumeration is unavailable', async () => {
    mockList.mockResolvedValue({
      families: ['Arial'],
      source: 'fallback',
    });
    render(<FontFamilyInput onChange={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Font Family'));

    expect(await screen.findByText(/Showing common fonts/)).toBeTruthy();
  });

  it('shows no matches for an unknown search', async () => {
    render(<FontFamilyInput onChange={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Font Family'));
    await screen.findByRole('option', { name: 'Arial' });

    fireEvent.change(screen.getByLabelText('Search font families'), {
      target: { value: 'not-a-real-font' },
    });
    expect(screen.getByText('No matching fonts.')).toBeTruthy();
  });

  it('closes on Escape', async () => {
    render(<FontFamilyInput onChange={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Font Family'));
    await screen.findByRole('option', { name: 'Arial' });

    fireEvent.keyDown(screen.getByLabelText('Search font families'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByLabelText('Search font families')).toBeNull();
    });
  });
});
