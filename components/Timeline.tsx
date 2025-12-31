'use client';

import { useState, useEffect } from 'react';
import { formatMultipleChanges, parseChangesFromAuditLog } from '@/lib/changeFormatter';
import Pagination from '@/components/Pagination';

interface TimelineActivity {
  id: string;
  entityType: string;
  entityId: string;
  activityType: string;
  title: string;
  description?: string;
  metadata?: any;
  timestamp: string;
  performer: {
    id: string;
    name: string;
    email: string;
    department: string;
  } | null; // Allow null for deleted employees
}

interface TimelineProps {
  entityType?: string;
  entityId?: string;
  limit?: number;
  showEntityInfo?: boolean;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

export default function Timeline({ 
  entityType, 
  entityId, 
  limit = 50, 
  showEntityInfo = false,
  currentPage = 1,
  onPageChange,
  onItemsPerPageChange
}: TimelineProps) {
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalActivities, setTotalActivities] = useState(0);

  useEffect(() => {
    fetchTimeline();
  }, [entityType, entityId, limit, currentPage]);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      let url = '/api/timeline';
      
      if (entityType && entityId) {
        url = `/api/timeline/${entityType}/${entityId}?limit=${limit}&page=${currentPage}`;
      } else if (entityType) {
        url = `/api/timeline?entityType=${entityType}&limit=${limit}&page=${currentPage}`;
      } else {
        url = `/api/timeline?limit=${limit}&page=${currentPage}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch timeline');
      }

      const data = await response.json();
      setActivities(data.activities || data);
      setTotalActivities(data.total || data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalActivities / limit);

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'CREATED':
        return '🆕';
      case 'UPDATED':
        return '✏️';
      case 'DELETED':
        return '🗑️';
      case 'DELETION_ATTEMPTED':
        return '⚠️';
      case 'DELETION_FAILED':
        return '❗';
      case 'STATUS_CHANGED':
        return '🔄';
      case 'APPROVED':
        return '✅';
      case 'REJECTED':
        return '❌';
      case 'PUBLISHED':
        return '📢';
      case 'ARCHIVED':
        return '📦';
      case 'FILE_UPLOADED':
        return '📁';
      case 'FILE_UPDATED':
        return '📝';
      case 'ASSET_ASSIGNED':
        return '🔗';
      case 'ASSET_UNASSIGNED':
        return '🔓';
      case 'SOFTWARE_UPDATED':
        return '🔧';
      case 'POLICY_REVIEWED':
        return '👀';
      case 'EMPLOYEE_HIRED':
        return '👋';
      case 'EMPLOYEE_PROMOTED':
        return '⬆️';
      default:
        return '📋';
    }
  };

  const getActivityColor = (activityType: string) => {
    switch (activityType) {
      case 'CREATED':
        return 'text-green-600 bg-green-50';
      case 'UPDATED':
        return 'text-blue-600 bg-blue-50';
      case 'DELETED':
        return 'text-red-600 bg-red-50';
      case 'DELETION_ATTEMPTED':
        return 'text-yellow-600 bg-yellow-50';
      case 'DELETION_FAILED':
        return 'text-red-700 bg-red-100';
      case 'STATUS_CHANGED':
        return 'text-purple-600 bg-purple-50';
      case 'APPROVED':
        return 'text-green-600 bg-green-50';
      case 'REJECTED':
        return 'text-red-600 bg-red-50';
      case 'PUBLISHED':
        return 'text-indigo-600 bg-indigo-50';
      case 'ARCHIVED':
        return 'text-gray-600 bg-gray-50';
      case 'FILE_UPLOADED':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 168) { // 7 days
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex space-x-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 p-4 rounded-lg">
        <p>Error loading timeline: {error}</p>
        <button 
          onClick={fetchTimeline}
          className="mt-2 text-sm underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        <p>No activity found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flow-root">
        <ul className="-mb-8">
          {activities.map((activity, index) => (
            <li key={activity.id}>
              <div className="relative pb-8">
                {index !== activities.length - 1 && (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center text-sm ${getActivityColor(activity.activityType)}`}>
                      {getActivityIcon(activity.activityType)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">
                          {activity.title}
                        </span>
                        {showEntityInfo && (
                          <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {activity.entityType}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-gray-500">
                        by {typeof activity.performer === 'object' && activity.performer?.name ? activity.performer.name : 'Unknown User'} • {formatTimestamp(activity.timestamp)}
                      </p>
                    </div>
                    {activity.description && (
                      <div className="mt-2 text-sm text-gray-700">
                        {activity.description}
                        
                        {/* Show formatted changes if available in metadata */}
                        {activity.metadata?.changes && Array.isArray(activity.metadata.changes) && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <span className="font-medium">Changes: </span>
                            {formatMultipleChanges(activity.metadata.changes)}
                          </div>
                        )}
                      </div>
                    )}
                    {activity.metadata && (
                      <div className="mt-2">
                        {activity.metadata.changes && (
                          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                            <strong>Changes:</strong>
                            <ul className="mt-1 space-y-1">
                              {activity.metadata.changes.map((change: any, i: number) => (
                                <li key={i}>
                                  <span className="font-medium">{change.field}:</span>{' '}
                                  <span className="text-red-600">{
                                    typeof change.oldValue === 'object' 
                                      ? JSON.stringify(change.oldValue) 
                                      : (change.oldValue || 'null')
                                  }</span>{' '}
                                  → <span className="text-green-600">{
                                    typeof change.newValue === 'object' 
                                      ? JSON.stringify(change.newValue) 
                                      : (change.newValue || 'null')
                                  }</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {activity.metadata.fileName && (
                          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                            <strong>File:</strong> {activity.metadata.fileName}
                            {activity.metadata.fileSize && (
                              <span className="ml-2">
                                ({Math.round(activity.metadata.fileSize / 1024)} KB)
                              </span>
                            )}
                          </div>
                        )}
                        {activity.metadata.oldStatus && activity.metadata.newStatus && (
                          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                            <strong>Status:</strong>{' '}
                            <span className="text-red-600">{activity.metadata.oldStatus}</span>{' '}
                            → <span className="text-green-600">{activity.metadata.newStatus}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      
      {/* Pagination */}
      {onPageChange && onItemsPerPageChange && totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalActivities}
            itemsPerPage={limit}
            onPageChange={onPageChange}
            onItemsPerPageChange={onItemsPerPageChange}
          />
        </div>
      )}
    </div>
  );
}