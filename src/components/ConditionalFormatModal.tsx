// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Conditional Format Modal — manage conditional formatting rules.
 */
import { useState } from 'react';
import type { ConditionalFormatRule, IconSetConfig } from '../types';
import { createDefaultRule } from '../utils/conditionalFormatEngine';

interface ConditionalFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: ConditionalFormatRule[];
  onRulesChange: (rules: ConditionalFormatRule[]) => void;
}

/**
 * Modal for managing conditional formatting rules.
 */
export function ConditionalFormatModal({
  isOpen,
  onClose,
  rules,
  onRulesChange,
}: ConditionalFormatModalProps) {
  const [editingRule, setEditingRule] = useState<ConditionalFormatRule | null>(null);

  if (!isOpen) return null;

  function handleAddRule() {
    const newRule = createDefaultRule();
    newRule.priority = rules.length;
    setEditingRule(newRule);
  }

  function handleEditRule(rule: ConditionalFormatRule) {
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

  function handleMoveUp(ruleId: string) {
    const index = rules.findIndex((r) => r.id === ruleId);
    if (index <= 0) return;
    const updated = [...rules];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    // Update priorities
    updated.forEach((r, i) => { r.priority = i; });
    onRulesChange(updated);
  }

  function handleMoveDown(ruleId: string) {
    const index = rules.findIndex((r) => r.id === ruleId);
    if (index < 0 || index >= rules.length - 1) return;
    const updated = [...rules];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    // Update priorities
    updated.forEach((r, i) => { r.priority = i; });
    onRulesChange(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Conditional Formatting"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Conditional Formatting</h2>
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
            <RuleEditor
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
                    No conditional formatting rules. Click "Add Rule" to create one.
                  </p>
                ) : (
                  rules.map((rule, index) => (
                    <RuleItem
                      key={rule.id}
                      rule={rule}
                      onEdit={() => handleEditRule(rule)}
                      onDelete={() => handleDeleteRule(rule.id)}
                      onMoveUp={() => handleMoveUp(rule.id)}
                      onMoveDown={() => handleMoveDown(rule.id)}
                      isFirst={index === 0}
                      isLast={index === rules.length - 1}
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

/** Rule item in the list. */
function RuleItem({
  rule,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  rule: ConditionalFormatRule;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const typeLabels: Record<string, string> = {
    cellValue: 'Cell Value',
    colorScale: 'Color Scale',
    dataBar: 'Data Bar',
    iconSet: 'Icon Set',
    formula: 'Formula',
  };

  return (
    <div className="flex items-center gap-2 p-3 border border-gray-200 rounded bg-gray-50">
      {/* Color preview */}
      <div
        className="w-6 h-6 rounded border border-gray-300"
        style={{
          backgroundColor: rule.format.backgroundColor || '#fff',
        }}
      />

      {/* Rule info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">
          {typeLabels[rule.type] || rule.type}
        </div>
        <div className="text-xs text-gray-500">
          {rule.type === 'cellValue' && `${rule.operator} ${rule.value1}`}
          {rule.type === 'colorScale' && 'Color scale'}
          {rule.type === 'dataBar' && 'Data bar'}
          {rule.type === 'iconSet' && 'Icon set'}
          {rule.type === 'formula' && rule.formula}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          title="Move up"
        >
          ▲
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          title="Move down"
        >
          ▼
        </button>
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

/** Rule editor form. */
function RuleEditor({
  rule,
  onChange,
  onSave,
  onCancel,
}: {
  rule: ConditionalFormatRule;
  onChange: (rule: ConditionalFormatRule) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Rule Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Rule Type</label>
        <select
          value={rule.type}
          onChange={(e) => onChange({ ...rule, type: e.target.value as ConditionalFormatRule['type'] })}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        >
          <option value="cellValue">Cell Value</option>
          <option value="colorScale">Color Scale</option>
          <option value="dataBar">Data Bar</option>
          <option value="iconSet">Icon Set</option>
          <option value="formula">Formula</option>
        </select>
      </div>

      {/* Cell Value options */}
      {rule.type === 'cellValue' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
            <select
              value={rule.operator}
              onChange={(e) => onChange({ ...rule, operator: e.target.value as ConditionalFormatRule['operator'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="gt">Greater than</option>
              <option value="gte">Greater than or equal</option>
              <option value="lt">Less than</option>
              <option value="lte">Less than or equal</option>
              <option value="eq">Equal to</option>
              <option value="neq">Not equal to</option>
              <option value="between">Between</option>
              <option value="notBetween">Not between</option>
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Value 1</label>
              <input
                type="text"
                value={rule.value1 ?? ''}
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
        </>
      )}

      {/* Formula */}
      {rule.type === 'formula' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Formula</label>
          <input
            type="text"
            value={rule.formula ?? ''}
            onChange={(e) => onChange({ ...rule, formula: e.target.value })}
            placeholder="=value>100"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Use "value" to reference the current cell.</p>
        </div>
      )}

      {/* Color Scale options */}
      {rule.type === 'colorScale' && (
        <ColorScaleEditor
          rule={rule}
          onChange={onChange}
        />
      )}

      {/* Data Bar options */}
      {rule.type === 'dataBar' && (
        <DataBarEditor
          rule={rule}
          onChange={onChange}
        />
      )}

      {/* Icon Set options */}
      {rule.type === 'iconSet' && (
        <IconSetEditor
          rule={rule}
          onChange={onChange}
        />
      )}

      {/* Format styling */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Font Color</label>
          <input
            type="color"
            value={rule.format.color || '#000000'}
            onChange={(e) => onChange({
              ...rule,
              format: { ...rule.format, color: e.target.value },
            })}
            className="w-full h-8 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
          <input
            type="color"
            value={rule.format.backgroundColor || '#ffffff'}
            onChange={(e) => onChange({
              ...rule,
              format: { ...rule.format, backgroundColor: e.target.value },
            })}
            className="w-full h-8 border border-gray-300 rounded"
          />
        </div>
      </div>

      {/* Font styling */}
      <div className="flex gap-2">
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={rule.format.fontWeight === 'bold'}
            onChange={(e) => onChange({
              ...rule,
              format: { ...rule.format, fontWeight: e.target.checked ? 'bold' : 'normal' },
            })}
          />
          Bold
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={rule.format.fontStyle === 'italic'}
            onChange={(e) => onChange({
              ...rule,
              format: { ...rule.format, fontStyle: e.target.checked ? 'italic' : 'normal' },
            })}
          />
          Italic
        </label>
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

/** Color scale editor. */
function ColorScaleEditor({
  rule,
  onChange,
}: {
  rule: ConditionalFormatRule;
  onChange: (rule: ConditionalFormatRule) => void;
}) {
  const colorScale = rule.colorScale || {
    minType: 'min',
    minColor: '#F8696B',
    midType: 'percentile',
    midValue: 50,
    midColor: '#FFEB84',
    maxType: 'max',
    maxColor: '#63BE7B',
  };

  return (
    <div className="space-y-3 p-3 bg-gray-50 rounded">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Min</label>
          <input
            type="color"
            value={colorScale.minColor}
            onChange={(e) => onChange({
              ...rule,
              colorScale: { ...colorScale, minColor: e.target.value },
            })}
            className="w-full h-6 rounded"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Mid</label>
          <input
            type="color"
            value={colorScale.midColor || '#FFEB84'}
            onChange={(e) => onChange({
              ...rule,
              colorScale: { ...colorScale, midColor: e.target.value },
            })}
            className="w-full h-6 rounded"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Max</label>
          <input
            type="color"
            value={colorScale.maxColor}
            onChange={(e) => onChange({
              ...rule,
              colorScale: { ...colorScale, maxColor: e.target.value },
            })}
            className="w-full h-6 rounded"
          />
        </div>
      </div>
    </div>
  );
}

/** Data bar editor. */
function DataBarEditor({
  rule,
  onChange,
}: {
  rule: ConditionalFormatRule;
  onChange: (rule: ConditionalFormatRule) => void;
}) {
  const dataBar = rule.dataBar || {
    color: '#638EC6',
    showValue: true,
    minType: 'min',
    maxType: 'max',
  };

  return (
    <div className="space-y-3 p-3 bg-gray-50 rounded">
      <div>
        <label className="block text-xs text-gray-600 mb-1">Bar Color</label>
        <input
          type="color"
          value={dataBar.color}
          onChange={(e) => onChange({
            ...rule,
            dataBar: { ...dataBar, color: e.target.value },
          })}
          className="w-full h-6 rounded"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={dataBar.showValue}
          onChange={(e) => onChange({
            ...rule,
            dataBar: { ...dataBar, showValue: e.target.checked },
          })}
        />
        Show cell value
      </label>
    </div>
  );
}

/** Icon set editor. */
function IconSetEditor({
  rule,
  onChange,
}: {
  rule: ConditionalFormatRule;
  onChange: (rule: ConditionalFormatRule) => void;
}) {
  const iconSet = rule.iconSet || {
    iconSet: '3Arrows',
    showValue: true,
    thresholds: [0, 33, 67],
  };

  return (
    <div className="space-y-3 p-3 bg-gray-50 rounded">
      <div>
        <label className="block text-xs text-gray-600 mb-1">Icon Set</label>
        <select
          value={iconSet.iconSet}
          onChange={(e) => onChange({
            ...rule,
            iconSet: { ...iconSet, iconSet: e.target.value as IconSetConfig['iconSet'] },
          })}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        >
          <option value="3Arrows">3 Arrows</option>
          <option value="3TrafficLights">3 Traffic Lights</option>
          <option value="3Flags">3 Flags</option>
          <option value="3Symbols">3 Symbols</option>
          <option value="4Arrows">4 Arrows</option>
          <option value="5Arrows">5 Arrows</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={iconSet.showValue}
          onChange={(e) => onChange({
            ...rule,
            iconSet: { ...iconSet, showValue: e.target.checked },
          })}
        />
        Show cell value
      </label>
    </div>
  );
}

