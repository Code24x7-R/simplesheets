// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * New Project Dialog
 *
 * Modal dialog for creating a blank project.
 * Collects project name and optional start/end dates.
 */

import { useState } from 'react';

interface NewProjectDialogProps {
  onClose: () => void;
  onConfirm: (name: string, startDate: string, endDate: string) => void;
}

export function NewProjectDialog({ onClose, onConfirm }: NewProjectDialogProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState('New Project');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalName = name.trim() || 'New Project';
    onConfirm(finalName, startDate, endDate);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" data-testid="new-project-dialog">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">New Project</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            data-testid="close-modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Project Name */}
            <div>
              <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Website Redesign, Q4 Campaign"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                data-testid="new-project-name"
                autoFocus
              />
            </div>

            {/* Start Date */}
            <div>
              <label htmlFor="project-start" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                id="project-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                data-testid="new-project-start"
              />
            </div>

            {/* End Date */}
            <div>
              <label htmlFor="project-end" className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                id="project-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                data-testid="new-project-end"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              data-testid="new-project-confirm"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
