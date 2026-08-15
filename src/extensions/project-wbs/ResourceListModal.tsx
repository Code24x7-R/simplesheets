// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Resource List Modal
 *
 * Modal dialog showing all resources in a table view with CRUD operations.
 * Allows adding, editing, and deleting project resources.
 */

import { useState } from 'react';
import type { Resource } from '../types';
import { ResourceEditorModal } from './ResourceEditorModal';

interface ResourceListModalProps {
  resources: Resource[];
  onClose: () => void;
  onSave: (resource: Resource) => void;
  onDelete: (resourceId: string) => void;
}

export function ResourceListModal({
  resources,
  onClose,
  onSave,
  onDelete,
}: ResourceListModalProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  function handleAdd() {
    setEditingResource(null);
    setEditorOpen(true);
  }

  function handleEdit(resource: Resource) {
    setEditingResource(resource);
    setEditorOpen(true);
  }

  function handleEditorClose() {
    setEditorOpen(false);
    setEditingResource(null);
  }

  function handleEditorSave(resource: Resource) {
    onSave(resource);
    setEditorOpen(false);
    setEditingResource(null);
  }

  function handleDelete(resource: Resource) {
    if (window.confirm(`Delete resource "${resource.name}"? This will unassign it from any tasks.`)) {
      onDelete(resource.id);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Manage Resources</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {resources.length} resource{resources.length !== 1 ? 's' : ''} in project
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAdd}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Resource
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Resource Table */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {resources.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-gray-500 mb-4">No resources defined yet</p>
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
                >
                  Add your first resource
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    <th className="pb-3 pr-4">Resource</th>
                    <th className="pb-3 pr-4">Role</th>
                    <th className="pb-3 pr-4">Cost Rate</th>
                    <th className="pb-3 pr-4">Availability</th>
                    <th className="pb-3 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resources.map((resource) => (
                    <tr key={resource.id} className="hover:bg-gray-50 group">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: resource.color }}
                          />
                          <span className="font-medium text-gray-900">{resource.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-600">
                        {resource.role || <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-600">
                        {resource.costRate > 0
                          ? `${resource.costRate}/${resource.costCurrency}`
                          : <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                resource.availability >= 80
                                  ? 'bg-green-500'
                                  : resource.availability >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${resource.availability}%` }}
                            />
                          </div>
                          <span className="text-gray-600">{resource.availability}%</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(resource)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit resource"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(resource)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete resource"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 rounded-b-lg flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Nested Resource Editor Modal */}
      {editorOpen && (
        <ResourceEditorModal
          resource={editingResource}
          onClose={handleEditorClose}
          onSave={handleEditorSave}
          onDelete={editingResource ? () => {
            onDelete(editingResource.id);
            handleEditorClose();
          } : undefined}
        />
      )}
    </>
  );
}
