// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Material Allocation & Consumption Modal
 *
 * Track material allocation to tasks and consumption:
 * - Allocate material to a task
 * - Record consumption quantity
 * - Track wastage
 * - View allocation history
 */

import { useState } from 'react';
import type { Material, MaterialAllocation, MaterialConsumption, WBSTask } from '../types';
import { NumericInput } from '../../components/NumericInput';

interface MaterialAllocationModalProps {
  material: Material;
  tasks: WBSTask[];
  allocations: MaterialAllocation[];
  consumptions: MaterialConsumption[];
  onClose: () => void;
  onAllocate: (allocation: MaterialAllocation) => void;
  onRecordConsumption: (consumption: MaterialConsumption) => void;
}

export function MaterialAllocationModal({
  material,
  tasks,
  allocations,
  consumptions,
  onClose,
  onAllocate,
  onRecordConsumption,
}: MaterialAllocationModalProps) {
  const [activeTab, setActiveTab] = useState<'allocate' | 'consume'>('allocate');

  // Allocation form state
  const [allocateTaskId, setAllocateTaskId] = useState('');
  const [allocateQuantity, setAllocateQuantity] = useState(0);
  const [allocateNotes, setAllocateNotes] = useState('');

  // Consumption form state
  const [consumeTaskId, setConsumeTaskId] = useState('');
  const [consumeQuantity, setConsumeQuantity] = useState(0);
  const [consumeWastage, setConsumeWastage] = useState(0);
  const [consumeNotes, setConsumeNotes] = useState('');

  // Filter allocations and consumptions for this material
  const materialAllocations = allocations.filter((a) => a.materialId === material.id);
  const materialConsumptions = consumptions.filter((c) => c.materialId === material.id);

  // Calculate totals
  const totalAllocated = materialAllocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);
  const totalConsumed = materialConsumptions.reduce((sum, c) => sum + c.quantity, 0);
  const totalWastage = materialConsumptions.reduce((sum, c) => sum + c.wastageQuantity, 0);
  const availableQuantity = material.quantity - totalAllocated;

  function handleAllocate() {
    if (!allocateTaskId || allocateQuantity <= 0) return;

    const allocation: MaterialAllocation = {
      id: `alloc-${Date.now()}`,
      materialId: material.id,
      taskId: allocateTaskId,
      allocatedQuantity: allocateQuantity,
      consumedQuantity: 0,
      allocationDate: new Date().toISOString().slice(0, 10),
      expectedReturnDate: null,
      actualCost: allocateQuantity * material.unitCost,
      notes: allocateNotes,
    };

    onAllocate(allocation);

    // Reset form
    setAllocateTaskId('');
    setAllocateQuantity(0);
    setAllocateNotes('');
  }

  function handleConsume() {
    if (!consumeTaskId || consumeQuantity <= 0) return;

    const consumption: MaterialConsumption = {
      id: `cons-${Date.now()}`,
      materialId: material.id,
      taskId: consumeTaskId,
      date: new Date().toISOString().slice(0, 10),
      quantity: consumeQuantity,
      wastageQuantity: consumeWastage,
      unitCostAtConsumption: material.unitCost,
      notes: consumeNotes,
    };

    onRecordConsumption(consumption);

    // Reset form
    setConsumeTaskId('');
    setConsumeQuantity(0);
    setConsumeWastage(0);
    setConsumeNotes('');
  }

  // Get task name for display
  const getTaskName = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    return task ? task.name : taskId;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="material-allocation-modal"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{material.name}</h2>
            <p className="text-sm text-gray-500">
              {material.classification.toUpperCase()} · {material.quantity} {material.unit} available
            </p>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            onClick={onClose}
            data-testid="close-modal"
          >
            ×
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{totalAllocated}</div>
            <div className="text-xs text-gray-500">Allocated</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{totalConsumed}</div>
            <div className="text-xs text-gray-500">Consumed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{totalWastage}</div>
            <div className="text-xs text-gray-500">Wastage</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-600">{availableQuantity}</div>
            <div className="text-xs text-gray-500">Available</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === 'allocate'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('allocate')}
          >
            Allocate to Task
          </button>
          <button
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === 'consume'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('consume')}
          >
            Record Consumption
          </button>
        </div>

        {/* Tab Content */}
        <div className="px-6 py-4">
          {activeTab === 'allocate' && (
            <div className="space-y-4">
              {/* Allocation Form */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label htmlFor="alloc-task" className="block text-sm font-medium text-gray-700 mb-1">
                    Task
                  </label>
                  <select
                    id="alloc-task"
                    value={allocateTaskId}
                    onChange={(e) => setAllocateTaskId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select task...</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {'  '.repeat(task.level)}{task.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="alloc-quantity" className="block text-sm font-medium text-gray-700 mb-1">
                    Qty
                  </label>
                  <NumericInput
                    id="alloc-quantity"
                    value={allocateQuantity}
                    onChange={setAllocateQuantity}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="alloc-notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <input
                  id="alloc-notes"
                  type="text"
                  value={allocateNotes}
                  onChange={(e) => setAllocateNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Optional notes..."
                />
              </div>
              <button
                className="w-full px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                onClick={handleAllocate}
                disabled={!allocateTaskId || allocateQuantity <= 0 || allocateQuantity > availableQuantity}
              >
                Allocate {allocateQuantity > 0 ? `${allocateQuantity} ${material.unit}` : ''}
              </button>

              {/* Allocation History */}
              {materialAllocations.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Allocation History</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {materialAllocations.map((alloc) => (
                      <div key={alloc.id} className="flex justify-between text-xs bg-gray-50 px-3 py-2 rounded">
                        <span>{getTaskName(alloc.taskId)}</span>
                        <span className="font-medium">{alloc.allocatedQuantity} {material.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'consume' && (
            <div className="space-y-4">
              {/* Consumption Form */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="cons-task" className="block text-sm font-medium text-gray-700 mb-1">
                    Task
                  </label>
                  <select
                    id="cons-task"
                    value={consumeTaskId}
                    onChange={(e) => setConsumeTaskId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select task...</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {'  '.repeat(task.level)}{task.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cons-quantity" className="block text-sm font-medium text-gray-700 mb-1">
                    Used
                  </label>
                  <NumericInput
                    id="cons-quantity"
                    value={consumeQuantity}
                    onChange={setConsumeQuantity}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label htmlFor="cons-wastage" className="block text-sm font-medium text-gray-700 mb-1">
                    Wastage
                  </label>
                  <NumericInput
                    id="cons-wastage"
                    value={consumeWastage}
                    onChange={setConsumeWastage}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cons-notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <input
                  id="cons-notes"
                  type="text"
                  value={consumeNotes}
                  onChange={(e) => setConsumeNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Optional notes..."
                />
              </div>
              <button
                className="w-full px-4 py-2 text-sm text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                onClick={handleConsume}
                disabled={!consumeTaskId || consumeQuantity <= 0}
              >
                Record Consumption
              </button>

              {/* Consumption History */}
              {materialConsumptions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Consumption History</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {materialConsumptions.map((cons) => (
                      <div key={cons.id} className="flex justify-between text-xs bg-gray-50 px-3 py-2 rounded">
                        <span>{getTaskName(cons.taskId)}</span>
                        <span className="font-medium">
                          {cons.quantity} {material.unit}
                          {cons.wastageQuantity > 0 && (
                            <span className="text-red-500 ml-1">(+{cons.wastageQuantity} waste)</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
