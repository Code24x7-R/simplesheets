import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  const defaultProps = {
    onToggleBold: jest.fn(),
    onToggleItalic: jest.fn(),
    onToggleUnderline: jest.fn(),
    onToggleStrikethrough: jest.fn(),
    onSetTextColor: jest.fn(),
    onSetBackgroundColor: jest.fn(),
    onSetAlignLeft: jest.fn(),
    onSetAlignCenter: jest.fn(),
    onSetAlignRight: jest.fn(),
    onSetNumberFormat: jest.fn(),
    onSetBorderTop: jest.fn(),
    onSetBorderBottom: jest.fn(),
    onSetBorderLeft: jest.fn(),
    onSetBorderRight: jest.fn(),
    onSetBorderAll: jest.fn(),
    onSetBorderOutside: jest.fn(),
    onClearBorders: jest.fn(),
    onSetBorderColor: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    onCopy: jest.fn(),
    onCut: jest.fn(),
    onPaste: jest.fn(),
    isBold: false,
    isItalic: false,
    isUnderline: false,
    canUndo: true,
    canRedo: true,
    borderColor: '#000000',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<Toolbar {...defaultProps} />);
    // Toolbar should render with buttons
    expect(screen.getByTitle('Bold (Ctrl+B)')).toBeTruthy();
    expect(screen.getByTitle('Italic (Ctrl+I)')).toBeTruthy();
    expect(screen.getByTitle('Underline (Ctrl+U)')).toBeTruthy();
  });

  it('calls onToggleBold when bold button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Bold (Ctrl+B)'));
    expect(defaultProps.onToggleBold).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleItalic when italic button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Italic (Ctrl+I)'));
    expect(defaultProps.onToggleItalic).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleUnderline when underline button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Underline (Ctrl+U)'));
    expect(defaultProps.onToggleUnderline).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleStrikethrough when strikethrough button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Strikethrough'));
    expect(defaultProps.onToggleStrikethrough).toHaveBeenCalledTimes(1);
  });

  it('calls onUndo when undo button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Undo (Ctrl+Z)'));
    expect(defaultProps.onUndo).toHaveBeenCalledTimes(1);
  });

  it('calls onRedo when redo button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Redo (Ctrl+Y)'));
    expect(defaultProps.onRedo).toHaveBeenCalledTimes(1);
  });

  it('calls onCopy when copy button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Copy (Ctrl+C)'));
    expect(defaultProps.onCopy).toHaveBeenCalledTimes(1);
  });

  it('calls onCut when cut button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Cut (Ctrl+X)'));
    expect(defaultProps.onCut).toHaveBeenCalledTimes(1);
  });

  it('calls onPaste when paste button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Paste (Ctrl+V)'));
    expect(defaultProps.onPaste).toHaveBeenCalledTimes(1);
  });

  it('calls onSetAlignLeft when left align button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Align Left'));
    expect(defaultProps.onSetAlignLeft).toHaveBeenCalledTimes(1);
  });

  it('calls onSetAlignCenter when center align button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Align Center'));
    expect(defaultProps.onSetAlignCenter).toHaveBeenCalledTimes(1);
  });

  it('calls onSetAlignRight when right align button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Align Right'));
    expect(defaultProps.onSetAlignRight).toHaveBeenCalledTimes(1);
  });

  it('disables undo button when canUndo is false', () => {
    render(<Toolbar {...defaultProps} canUndo={false} />);
    const undoBtn = screen.getByTitle('Undo (Ctrl+Z)');
    expect(undoBtn).toBeDisabled();
  });

  it('disables redo button when canRedo is false', () => {
    render(<Toolbar {...defaultProps} canRedo={false} />);
    const redoBtn = screen.getByTitle('Redo (Ctrl+Y)');
    expect(redoBtn).toBeDisabled();
  });

  it('shows bold button as active when isBold is true', () => {
    render(<Toolbar {...defaultProps} isBold={true} />);
    const boldBtn = screen.getByTitle('Bold (Ctrl+B)');
    expect(boldBtn.className).toContain('bg-blue-100');
  });

  it('shows italic button as active when isItalic is true', () => {
    render(<Toolbar {...defaultProps} isItalic={true} />);
    const italicBtn = screen.getByTitle('Italic (Ctrl+I)');
    expect(italicBtn.className).toContain('bg-blue-100');
  });

  it('shows underline button as active when isUnderline is true', () => {
    render(<Toolbar {...defaultProps} isUnderline={true} />);
    const underlineBtn = screen.getByTitle('Underline (Ctrl+U)');
    expect(underlineBtn.className).toContain('bg-blue-100');
  });

  it('opens border dropdown when borders button is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Borders'));
    // Border presets should be visible
    expect(screen.getByText('No Border')).toBeTruthy();
    expect(screen.getByText('All Borders')).toBeTruthy();
    expect(screen.getByText('Outside Borders')).toBeTruthy();
  });

  it('calls onSetBorderAll when All Borders preset is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Borders'));
    fireEvent.click(screen.getByText('All Borders'));
    expect(defaultProps.onSetBorderAll).toHaveBeenCalledTimes(1);
  });

  it('calls onSetBorderOutside when Outside Borders preset is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Borders'));
    fireEvent.click(screen.getByText('Outside Borders'));
    expect(defaultProps.onSetBorderOutside).toHaveBeenCalledTimes(1);
  });

  it('calls onClearBorders when No Border preset is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Borders'));
    fireEvent.click(screen.getByText('No Border'));
    expect(defaultProps.onClearBorders).toHaveBeenCalledTimes(1);
  });

  it('calls onSetBorderTop when Top Border preset is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Borders'));
    fireEvent.click(screen.getByText('Top Border'));
    expect(defaultProps.onSetBorderTop).toHaveBeenCalledTimes(1);
  });

  it('calls onSetBorderBottom when Bottom Border preset is clicked', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Borders'));
    fireEvent.click(screen.getByText('Bottom Border'));
    expect(defaultProps.onSetBorderBottom).toHaveBeenCalledTimes(1);
  });

  it('calls number format callbacks', () => {
    render(<Toolbar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('General format'));
    expect(defaultProps.onSetNumberFormat).toHaveBeenCalledWith('General');

    fireEvent.click(screen.getByTitle('Number format (0.00)'));
    expect(defaultProps.onSetNumberFormat).toHaveBeenCalledWith('0.00');

    fireEvent.click(screen.getByTitle('Currency format'));
    expect(defaultProps.onSetNumberFormat).toHaveBeenCalledWith('$#,##0.00');

    fireEvent.click(screen.getByTitle('Percent format'));
    expect(defaultProps.onSetNumberFormat).toHaveBeenCalledWith('0.00%');
  });
});
