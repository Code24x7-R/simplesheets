import { useState, useEffect, useRef } from 'react';
import type { Sheet } from '../types';
import { getUniqueValues } from '../utils/sheetFilter';
import type { ColumnFilter, FilterCondition } from '../utils/sheetFilter';

interface FilterDropdownProps {
  /** The sheet data. */
  sheet: Sheet;
  /** Column index this dropdown is for. */
  column: number;
  /** Header row index (0-based). */
  headerRow: number;
  /** Current filter for this column (if any). */
  currentFilter?: ColumnFilter;
  /** Callback when filter is applied. */
  onApply: (filter: ColumnFilter | undefined) => void;
  /** Callback when dropdown closes without applying. */
  onClose: () => void;
}

/**
 * Filter dropdown component — shows checkbox list of unique values
 * and custom filter options for a column.
 */
export function FilterDropdown({
  sheet,
  column,
  headerRow,
  currentFilter,
  onApply,
  onClose,
}: FilterDropdownProps) {
  // Determine if the existing filter is a custom condition
  const getInitialCustomCondition = (): { type: string; value: string } | null => {
    if (!currentFilter) return null;
    const customCond = currentFilter.conditions.find(
      (c): c is FilterCondition =>
        c.type !== 'includes'
    );
    if (!customCond) return null;
    switch (customCond.type) {
      case 'contains':
      case 'notContains':
      case 'equals':
      case 'notEquals':
      case 'startsWith':
      case 'endsWith':
        return { type: customCond.type, value: customCond.value };
      case 'greaterThan':
      case 'lessThan':
      case 'greaterOrEqual':
      case 'lessOrEqual':
        return { type: customCond.type, value: String(customCond.value) };
      case 'isEmpty':
      case 'isNotEmpty':
        return { type: customCond.type, value: '' };
      default:
        return null;
    }
  };

  const initialCustom = getInitialCustomCondition();
  const [selectedValues, setSelectedValues] = useState<Set<string>>(() => {
    // Initialize from existing filter if present
    if (currentFilter) {
      const includesCondition = currentFilter.conditions.find(
        (c): c is { type: 'includes'; values: string[] } => c.type === 'includes'
      );
      if (includesCondition) {
        return new Set(includesCondition.values);
      }
    }
    return new Set();
  });
  const [searchText, setSearchText] = useState('');
  const [showCustomFilter, setShowCustomFilter] = useState(() => initialCustom !== null);
  const [customFilterType, setCustomFilterType] = useState<string>(() => initialCustom?.type ?? 'contains');
  const [customFilterValue, setCustomFilterValue] = useState<string>(() => initialCustom?.value ?? '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get unique values for this column
  const allUniqueValues = getUniqueValues(sheet, column, headerRow);

  // Filter values based on search text
  const filteredValues = searchText
    ? allUniqueValues.filter((v) => v.toLowerCase().includes(searchText.toLowerCase()))
    : allUniqueValues;

  // Check if all visible values are selected
  const allSelected = filteredValues.length > 0 && filteredValues.every((v) => selectedValues.has(v));

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape and prevent key events from propagating to Grid
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
      // Stop propagation of all keys except Tab (for accessibility)
      // This prevents backspace from deleting cell contents,
      // arrow keys from moving selection, etc.
      if (event.key !== 'Tab') {
        event.stopPropagation();
      }
    }
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  const toggleValue = (value: string) => {
    setSelectedValues((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      // Deselect all visible values
      setSelectedValues((prev) => {
        const next = new Set(prev);
        filteredValues.forEach((v) => next.delete(v));
        return next;
      });
    } else {
      // Select all visible values
      setSelectedValues((prev) => {
        const next = new Set(prev);
        filteredValues.forEach((v) => next.add(v));
        return next;
      });
    }
  };

  const handleApply = () => {
    if (showCustomFilter && (customFilterValue || customFilterType === 'isEmpty' || customFilterType === 'isNotEmpty')) {
      // Build custom filter condition
      const condition = buildCustomCondition(customFilterType, customFilterValue);
      if (condition) {
        onApply({ conditions: [condition], logic: 'AND' });
      }
    } else if (selectedValues.size > 0) {
      // Build includes filter from selected values
      onApply({
        conditions: [{ type: 'includes', values: Array.from(selectedValues) }],
        logic: 'AND',
      });
    } else {
      // No filter — clear
      onApply(undefined);
    }
  };

  const handleClear = () => {
    setSelectedValues(new Set());
    setCustomFilterValue('');
    onApply(undefined);
  };

  return (
    <div
      ref={dropdownRef}
      className="filter-dropdown"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search input */}
      <div className="filter-dropdown-search">
        <input
          type="text"
          placeholder="Search values..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="filter-dropdown-search-input"
          data-testid="filter-search-input"
        />
      </div>

      {/* Toggle between value list and custom filter */}
      <div className="filter-dropdown-tabs">
        <button
          className={`filter-tab ${!showCustomFilter ? 'active' : ''}`}
          onClick={() => setShowCustomFilter(false)}
        >
          Filter by values
        </button>
        <button
          className={`filter-tab ${showCustomFilter ? 'active' : ''}`}
          onClick={() => setShowCustomFilter(true)}
        >
          Custom filter
        </button>
      </div>

      {!showCustomFilter ? (
        <>
          {/* Select all checkbox */}
          <div className="filter-dropdown-select-all">
            <label>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                data-testid="filter-select-all"
              />
              <span>(Select All)</span>
            </label>
          </div>

          {/* Value list */}
          <div className="filter-dropdown-values" data-testid="filter-values-list">
            {filteredValues.length === 0 ? (
              <div className="filter-dropdown-empty">No values</div>
            ) : (
              filteredValues.map((value) => (
                <div key={value} className="filter-dropdown-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedValues.has(value)}
                      onChange={() => toggleValue(value)}
                    />
                    <span className="filter-value-text">{value}</span>
                  </label>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Custom filter */
        <div className="filter-dropdown-custom">
          <select
            value={customFilterType}
            onChange={(e) => setCustomFilterType(e.target.value)}
            className="filter-custom-select"
            data-testid="filter-custom-type"
          >
            <option value="contains">Contains</option>
            <option value="notContains">Does not contain</option>
            <option value="equals">Equals</option>
            <option value="notEquals">Does not equal</option>
            <option value="startsWith">Starts with</option>
            <option value="endsWith">Ends with</option>
            <option value="greaterThan">Greater than</option>
            <option value="lessThan">Less than</option>
            <option value="greaterOrEqual">Greater or equal</option>
            <option value="lessOrEqual">Less or equal</option>
            <option value="isEmpty">Is empty</option>
            <option value="isNotEmpty">Is not empty</option>
          </select>
          <input
            type="text"
            placeholder="Value..."
            value={customFilterValue}
            onChange={(e) => setCustomFilterValue(e.target.value)}
            className="filter-custom-input"
            data-testid="filter-custom-value"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="filter-dropdown-actions">
        <button
          className="filter-btn-apply"
          onClick={handleApply}
          data-testid="filter-apply"
        >
          Apply
        </button>
        <button
          className="filter-btn-clear"
          onClick={handleClear}
          data-testid="filter-clear"
        >
          Clear
        </button>
        <button className="filter-btn-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Builds a FilterCondition from custom filter type and value.
 */
function buildCustomCondition(type: string, value: string): FilterCondition | null {
  switch (type) {
    case 'contains':
      return { type: 'contains', value };
    case 'notContains':
      return { type: 'notContains', value };
    case 'equals':
      return { type: 'equals', value };
    case 'notEquals':
      return { type: 'notEquals', value };
    case 'startsWith':
      return { type: 'startsWith', value };
    case 'endsWith':
      return { type: 'endsWith', value };
    case 'greaterThan':
      return { type: 'greaterThan', value: Number(value) || 0 };
    case 'lessThan':
      return { type: 'lessThan', value: Number(value) || 0 };
    case 'greaterOrEqual':
      return { type: 'greaterOrEqual', value: Number(value) || 0 };
    case 'lessOrEqual':
      return { type: 'lessOrEqual', value: Number(value) || 0 };
    case 'isEmpty':
      return { type: 'isEmpty' };
    case 'isNotEmpty':
      return { type: 'isNotEmpty' };
    /* istanbul ignore next - defensive fallback for unknown filter type */
    default:
      return null;
  }
}
