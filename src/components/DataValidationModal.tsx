// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Data Validation Modal — manage data validation rules.
 */
import { useState } from 'react';
import type { DataValidationRule } from '../types';
import { createDefaultValidationRule } from '../utils/dataValidationEngine';

interface DataValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: DataValidationRule[];
  onRulesChange: (rules: DataValidationRule[]) => void;
}

/**
 * Modal for managing data validation rules.
 */
export function DataValidationModal({
  isOpen,
  onClose,
  rules,
  onRulesChange,
}: DataValidationModalProps) {
  const [editingRule, setEditingRule] = useState<DataValidationRule | null>(null);

  if (!isOpen) return null;

  function handleAddRule() {
    setEditingRule(createDefaultValidationRule());
  }

  function handleEditRule(rule: DataValidationRule) {
    setEditingRule({ ...rule });
  }

  function handleDeleteRule(ruleId: string) {
    onRulesChange(rules.filter((r) => r.id !== ruleId));
  }

  function handleSaveRule() {
    if (!editingRule) return;

    const existingIndex = rules.findIndex((r) => r.id === editingRule.id);
    if (existingIndex >= 0) {
      const updated = [...rules];
      updated[existingIndex] = editingRule;
      onRulesChange(updated);
    } else {
      onRulesChange([...rules, editingRule]);
    }
    setEditingRule(null);
  }

  function handleToggleRule(ruleId: string) {
    onRulesChange(
      rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Data Validation"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Data Validation</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
            data-testid="close-modal"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {editingRule ? (
            <ValidationRuleEditor
              rule={editingRule}
              onChange={setEditingRule}
              onSave={handleSaveRule}
              onCancel={() => setEditingRule(null)}
            />
          ) : (
            <>
              {/* Rule list */}
              <div className="space-y-2 mb-4">
                {rules.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No data validation rules. Click "Add Rule" to create one.
                  </p>
                ) : (
                  rules.map((rule) => (
                    <ValidationRuleItem
                      key={rule.id}
                      rule={rule}
                      onEdit={() => handleEditRule(rule)}
                      onDelete={() => handleDeleteRule(rule.id)}
                      onToggle={() => handleToggleRule(rule.id)}
                    />
                  ))
                )}
              </div>

              <button
                onClick={handleAddRule}
                className="w-full py-2 text-sm text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
              >
                + Add Rule
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Validation rule item in the list. */
function ValidationRuleItem({
  rule,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: DataValidationRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const typeLabels: Record<string, string> = {
    whole: 'Whole Number',
    decimal: 'Decimal',
    list: 'List',
    date: 'Date',
    textLength: 'Text Length',
    custom: 'Custom Formula',
  };

  return (
    <div className={`flex items-center gap-2 p-3 border rounded ${rule.enabled ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-gray-100 opacity-60'}`}>
      {/* Toggle */}
      <input
        type="checkbox"
        checked={rule.enabled}
        onChange={onToggle}
        className="w-4 h-4"
        title={rule.enabled ? 'Disable rule' : 'Enable rule'}
      />

      {/* Rule info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">
          {typeLabels[rule.type] || rule.type}
        </div>
        <div className="text-xs text-gray-500">
          {rule.type === 'list' && `List: ${rule.listSource?.slice(0, 30) ?? ''}`}
          {rule.type !== 'list' && `${rule.operator} ${rule.value1}${rule.value2 ? ` and ${rule.value2}` : ''}`}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Edit"
        >
          ✎
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-600"
          title="Delete"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

/** Validation rule editor form. */
function ValidationRuleEditor({
  rule,
  onChange,
  onSave,
  onCancel,
}: {
  rule: DataValidationRule;
  onChange: (rule: DataValidationRule) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Rule Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Validation Type</label>
        <select
          value={rule.type}
          onChange={(e) => onChange({ ...rule, type: e.target.value as DataValidationRule['type'] })}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="whole">Whole Number</option>
          <option value="decimal">Decimal</option>
          <option value="list">List</option>
          <option value="date">Date</option>
          <option value="textLength">Text Length</option>
          <option value="custom">Custom Formula</option>
        </select>
      </div>

      {/* Operator */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
        <select
          value={rule.operator}
          onChange={(e) => onChange({ ...rule, operator: e.target.value as DataValidationRule['operator'] })}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="between">Between</option>
          <option value="notBetween">Not between</option>
          <option value="eq">Equal to</option>
          <option value="neq">Not equal to</option>
          <option value="gt">Greater than</option>
          <option value="gte">Greater than or equal</option>
          <option value="lt">Less than</option>
          <option value="lte">Less than or equal</option>
        </select>
      </div>

      {/* Values */}
      {rule.type !== 'list' && rule.type !== 'custom' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Value 1</label>
            <input
              type="text"
              value={rule.value1}
              onChange={(e) => onChange({ ...rule, value1: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          {(rule.operator === 'between' || rule.operator === 'notBetween') && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Value 2</label>
              <input
                type="text"
                value={rule.value2 ?? ''}
                onChange={(e) => onChange({ ...rule, value2: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* List source */}
      {rule.type === 'list' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">List Source</label>
          <input
            type="text"
            value={rule.listSource ?? ''}
            onChange={(e) => onChange({ ...rule, listSource: e.target.value })}
            placeholder="Option1, Option2, Option3"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Enter comma-separated values or a range reference.</p>
          <label className="flex items-center gap-2 text-sm mt-2">
            <input
              type="checkbox"
              checked={rule.showDropdown ?? true}
              onChange={(e) => onChange({ ...rule, showDropdown: e.target.checked })}
            />
            Show dropdown in cell
          </label>
        </div>
      )}

      {/* Custom formula */}
      {rule.type === 'custom' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Formula</label>
          <input
            type="text"
            value={String(rule.value1)}
            onChange={(e) => onChange({ ...rule, value1: e.target.value })}
            placeholder="=LEN(A1)<=10"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
      )}

      {/* Allow blank */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={rule.allowBlank ?? true}
          onChange={(e) => onChange({ ...rule, allowBlank: e.target.checked })}
        />
        Allow blank values
      </label>

      {/* Input message */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Input Message</h3>
        <div className="space-y-2">
          <input
            type="text"
            value={rule.inputTitle ?? ''}
            onChange={(e) => onChange({ ...rule, inputTitle: e.target.value })}
            placeholder="Title"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <input
            type="text"
            value={rule.inputMessage ?? ''}
            onChange={(e) => onChange({ ...rule, inputMessage: e.target.value })}
            placeholder="Message to show when cell is selected"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>

      {/* Error alert */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Error Alert</h3>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Style</label>
            <select
              value={rule.errorAlert?.style ?? 'stop'}
              onChange={(e) => onChange({
                ...rule,
                errorAlert: {
                  ...rule.errorAlert,
                  style: e.target.value as 'stop' | 'warning' | 'information',
                  title: rule.errorAlert?.title || 'Invalid Entry',
                  message: rule.errorAlert?.message || 'Please enter a valid value.',
                },
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="stop">Stop (prevents entry)</option>
              <option value="warning">Warning (allows entry)</option>
              <option value="information">Information (allows entry)</option>
            </select>
          </div>
          <input
            type="text"
            value={rule.errorAlert?.title ?? ''}
            onChange={(e) => onChange({
              ...rule,
              errorAlert: {
                ...rule.errorAlert,
                style: rule.errorAlert?.style || 'stop',
                title: e.target.value,
                message: rule.errorAlert?.message || '',
              },
            })}
            placeholder="Error title"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <input
            type="text"
            value={rule.errorAlert?.message ?? ''}
            onChange={(e) => onChange({
              ...rule,
              errorAlert: {
                ...rule.errorAlert,
                style: rule.errorAlert?.style || 'stop',
                title: rule.errorAlert?.title || '',
                message: e.target.value,
              },
            })}
            placeholder="Error message"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Save Rule
        </button>
      </div>
    </div>
  );
}
