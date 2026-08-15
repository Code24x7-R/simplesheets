// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Dependency Notification Panel
 *
 * Shows notifications for unblocked tasks, blocked tasks, and status changes.
 */

import type { TaskNotification } from './dependencyWorkflows';

interface NotificationPanelProps {
  notifications: TaskNotification[];
  onDismiss: (index: number) => void;
  onTaskClick: (taskId: string) => void;
}

export function NotificationPanel({ notifications, onDismiss, onTaskClick }: NotificationPanelProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="absolute top-2 right-2 z-50 w-80 max-h-96 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">
            Notifications ({notifications.length})
          </span>
          <button
            onClick={() => onDismiss(-1)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear all
          </button>
        </div>

        {/* Notification list */}
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {notifications.map((notification, index) => (
            <div
              key={`${notification.taskId}-${notification.timestamp.getTime()}`}
              className={`px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                notification.type === 'unblocked' ? 'border-l-2 border-l-green-500' :
                notification.type === 'blocked' ? 'border-l-2 border-l-yellow-500' :
                'border-l-2 border-l-red-500'
              }`}
              onClick={() => onTaskClick(notification.taskId)}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5">
                  {notification.type === 'unblocked' ? '✅' :
                   notification.type === 'blocked' ? '⚠️' : '🔴'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900 truncate">
                    {notification.message}
                  </div>
                  {notification.assigneeName && (
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Assignee: {notification.assigneeName}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {notification.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(index);
                  }}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
