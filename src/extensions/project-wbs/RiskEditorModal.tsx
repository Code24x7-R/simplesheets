// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Risk Editor Modal
 *
 * Full-featured modal dialog for creating and editing risks.
 * Supports all risk fields including scoring, mitigation planning,
 * and residual risk assessment.
 */

import { useState, useEffect } from 'react';
import type { Risk, RiskStatus, RiskCategory, Resource, WBSTask } from '../types';
import { NumericInput } from '../../components/NumericInput';

interface RiskEditorModalProps {
  risk: Risk | null; // null = create mode
  resources: Resource[];
  allTasks: WBSTask[];
  onClose: () => void;
  onSave: (risk: Risk) => void;
  onDelete?: (riskId: string) => void;
}

const CATEGORIES: { value: RiskCategory; label: string }[] = [
  { value: 'technical', label: 'Technical' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'cost', label: 'Cost' },
  { value: 'resource', label: 'Resource' },
  { value: 'external', label: 'External' },
  { value: 'quality', label: 'Quality' },
  { value: 'scope', label: 'Scope' },
  { value: 'other', label: 'Other' },
];

const STATUSES: { value: RiskStatus; label: string }[] = [
  { value: 'identified', label: 'Identified' },
  { value: 'assessing', label: 'Assessing' },
  { value: 'mitigating', label: 'Mitigating' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'occurred', label: 'Occurred' },
  { value: 'closed', label: 'Closed' },
];

function computeScore(probability: number, impact: number): number {
  return probability * impact;
}

export function RiskEditorModal({
  risk,
  resources,
  allTasks,
  onClose,
  onSave,
  onDelete,
}: RiskEditorModalProps) {
  const isNew = risk === null;
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<Risk>(
    risk ?? {
      id: `risk-${Date.now()}`,
      projectId: '',
      taskId: null,
      title: '',
      description: '',
      category: 'technical',
      probability: 3,
      impact: 3,
      riskScore: 9,
      status: 'identified',
      mitigationPlan: '',
      contingencyPlan: '',
      mitigationCost: 0,
      ownerId: null,
      identifiedDate: today,
      reviewDate: '',
      triggerCondition: '',
      residualProbability: 3,
      residualImpact: 3,
      residualRiskScore: 9,
      customFields: {},
    },
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync form when risk prop changes
  useEffect(() => {
    if (risk) {
      setForm(risk);
    }
  }, [risk]);

  function updateField<K extends keyof Risk>(key: K, value: Risk[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-compute risk score
      if (key === 'probability' || key === 'impact') {
        const prob = key === 'probability' ? (value as number) : prev.probability;
        const imp = key === 'impact' ? (value as number) : prev.impact;
        next.riskScore = computeScore(prob, imp);
      }
      // Auto-compute residual risk score
      if (key === 'residualProbability' || key === 'residualImpact') {
        const prob = key === 'residualProbability' ? (value as number) : prev.residualProbability;
        const imp = key === 'residualImpact' ? (value as number) : prev.residualImpact;
        next.residualRiskScore = computeScore(prob, imp);
      }
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.title.trim()) newErrors.title = 'Risk title is required';
    if (form.probability < 1 || form.probability > 5) newErrors.probability = 'Must be 1-5';
    if (form.impact < 1 || form.impact > 5) newErrors.impact = 'Must be 1-5';
    if (form.residualProbability < 1 || form.residualProbability > 5) newErrors.residualProbability = 'Must be 1-5';
    if (form.residualImpact < 1 || form.residualImpact > 5) newErrors.residualImpact = 'Must be 1-5';
    if (form.mitigationCost < 0) newErrors.mitigationCost = 'Must be non-negative';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form, title: form.title.trim() });
  }

  function handleDelete() {
    if (risk && onDelete) {
      onDelete(risk.id);
    }
  }

  function riskLevelColor(score: number): string {
    if (score >= 15) return 'bg-red-100 text-red-800';
    if (score >= 10) return 'bg-orange-100 text-orange-800';
    if (score >= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="risk-editor-modal"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {isNew ? 'Add Risk' : 'Edit Risk'}
          </h2>
          <button
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              className={`w-full border rounded px-3 py-2 text-sm ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter risk title..."
              autoFocus
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              rows={2}
              placeholder="Describe the risk scenario..."
            />
          </div>

          {/* Category + Status Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => updateField('category', e.target.value as RiskCategory)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField('status', e.target.value as RiskStatus)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Risk Scoring */}
          <div className="border border-gray-200 rounded p-3 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Inherent Risk Score</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Probability (1-5)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={form.probability}
                    onChange={(e) => updateField('probability', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-6 text-center text-sm font-medium">{form.probability}</span>
                </div>
                {errors.probability && <p className="text-red-500 text-xs mt-1">{errors.probability}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Impact (1-5)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={form.impact}
                    onChange={(e) => updateField('impact', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-6 text-center text-sm font-medium">{form.impact}</span>
                </div>
                {errors.impact && <p className="text-red-500 text-xs mt-1">{errors.impact}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Score</label>
                <span className={`inline-block px-3 py-1 rounded text-sm font-bold ${riskLevelColor(form.riskScore)}`}>
                  {form.riskScore}
                </span>
              </div>
            </div>
          </div>

          {/* Residual Risk */}
          <div className="border border-gray-200 rounded p-3 bg-blue-50">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Residual Risk (Post-Mitigation)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Probability (1-5)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={form.residualProbability}
                    onChange={(e) => updateField('residualProbability', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-6 text-center text-sm font-medium">{form.residualProbability}</span>
                </div>
                {errors.residualProbability && <p className="text-red-500 text-xs mt-1">{errors.residualProbability}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Impact (1-5)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={form.residualImpact}
                    onChange={(e) => updateField('residualImpact', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-6 text-center text-sm font-medium">{form.residualImpact}</span>
                </div>
                {errors.residualImpact && <p className="text-red-500 text-xs mt-1">{errors.residualImpact}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Score</label>
                <span className={`inline-block px-3 py-1 rounded text-sm font-bold ${riskLevelColor(form.residualRiskScore)}`}>
                  {form.residualRiskScore}
                </span>
              </div>
            </div>
          </div>

          {/* Mitigation + Contingency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mitigation Plan</label>
              <textarea
                value={form.mitigationPlan}
                onChange={(e) => updateField('mitigationPlan', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                rows={2}
                placeholder="How will you reduce this risk?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contingency Plan</label>
              <textarea
                value={form.contingencyPlan}
                onChange={(e) => updateField('contingencyPlan', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                rows={2}
                placeholder="What will you do if it occurs?"
              />
            </div>
          </div>

          {/* Trigger + Cost Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Condition</label>
              <input
                type="text"
                value={form.triggerCondition}
                onChange={(e) => updateField('triggerCondition', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="What indicates the risk is occurring?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mitigation Cost</label>
              <NumericInput
                value={form.mitigationCost}
                onChange={(v) => updateField('mitigationCost', Math.max(0, v))}
                className={`w-full border rounded px-3 py-2 text-sm ${
                  errors.mitigationCost ? 'border-red-500' : 'border-gray-300'
                }`}
                min={0}
              />
              {errors.mitigationCost && <p className="text-red-500 text-xs mt-1">{errors.mitigationCost}</p>}
            </div>
          </div>

          {/* Linked Task + Owner Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Linked Task</label>
              <select
                value={form.taskId ?? ''}
                onChange={(e) => updateField('taskId', e.target.value || null)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">Project-level</option>
                {allTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
              <select
                value={form.ownerId ?? ''}
                onChange={(e) => updateField('ownerId', e.target.value || null)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Identified Date</label>
              <input
                type="date"
                value={form.identifiedDate}
                onChange={(e) => updateField('identifiedDate', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Review Date</label>
              <input
                type="date"
                value={form.reviewDate}
                onChange={(e) => updateField('reviewDate', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div>
            {!isNew && onDelete && (
              <button
                className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                onClick={handleDelete}
              >
                Delete Risk
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-100"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
              onClick={handleSave}
            >
              {isNew ? 'Add Risk' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
