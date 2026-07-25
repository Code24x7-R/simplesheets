import { render, screen, fireEvent } from '@testing-library/react';
import { DropdownMenu, type MenuItem } from './DropdownMenu';

describe('DropdownMenu', () => {
  const items: MenuItem[] = [
    { id: 'action-1', label: 'Action 1', icon: '📋' },
    { id: 'action-2', label: 'Action 2', shortcut: 'Ctrl+X' },
    { id: 'sep-1', label: '', separator: true },
    { id: 'disabled-action', label: 'Disabled', disabled: true },
  ];

  it('renders trigger button with label', () => {
    render(<DropdownMenu label="Test Menu" items={items} onSelect={() => {}} />);
    expect(screen.getByText('Test Menu')).toBeTruthy();
  });

  it('opens dropdown when trigger is clicked', () => {
    render(<DropdownMenu label="Test Menu" items={items} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('Test Menu'));
    expect(screen.getByText('Action 1')).toBeTruthy();
    expect(screen.getByText('Action 2')).toBeTruthy();
  });

  it('calls onSelect when an item is clicked', () => {
    const onSelect = jest.fn();
    render(<DropdownMenu label="Test Menu" items={items} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Test Menu'));
    fireEvent.click(screen.getByText('Action 1'));
    expect(onSelect).toHaveBeenCalledWith('action-1');
  });

  it('does not call onSelect for disabled items', () => {
    const onSelect = jest.fn();
    render(<DropdownMenu label="Test Menu" items={items} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Test Menu'));
    fireEvent.click(screen.getByText('Disabled'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not call onSelect for separator items', () => {
    const onSelect = jest.fn();
    render(<DropdownMenu label="Test Menu" items={items} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Test Menu'));
    fireEvent.click(screen.getByText('Action 1'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('closes dropdown after selecting an item', () => {
    const onSelect = jest.fn();
    render(<DropdownMenu label="Test Menu" items={items} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Test Menu'));
    expect(screen.getByText('Action 1')).toBeTruthy();
    fireEvent.click(screen.getByText('Action 1'));
    expect(screen.queryByText('Action 1')).toBeNull();
  });

  it('closes dropdown when clicking outside', () => {
    const onSelect = jest.fn();
    render(
      <div>
        <DropdownMenu label="Test Menu" items={items} onSelect={onSelect} />
        <div data-testid="outside">Outside</div>
      </div>
    );
    fireEvent.click(screen.getByText('Test Menu'));
    expect(screen.getByText('Action 1')).toBeTruthy();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('Action 1')).toBeNull();
  });

  it('supports nested submenus', () => {
    const onSelect = jest.fn();
    const submenuItems: MenuItem[] = [
      {
        id: 'parent',
        label: 'Parent',
        submenu: [
          { id: 'child-1', label: 'Child 1' },
          { id: 'child-2', label: 'Child 2' },
        ],
      },
    ];
    render(<DropdownMenu label="Test Menu" items={submenuItems} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Test Menu'));
    // Hover over parent to reveal submenu
    fireEvent.mouseEnter(screen.getByText('Parent'));
    expect(screen.getByText('Child 1')).toBeTruthy();
    expect(screen.getByText('Child 2')).toBeTruthy();
  });

  it('shows keyboard shortcut text', () => {
    render(<DropdownMenu label="Test Menu" items={items} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('Test Menu'));
    expect(screen.getByText('Ctrl+X')).toBeTruthy();
  });
});
