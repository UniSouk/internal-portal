'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from './Notification';

interface Assignment {
  id: string;
  employee: {
    id: string;
    name: string;
    email: string;
    department: string;
  };
  assignedAt: string;
  status: string;
  notes?: string;
  item?: {
    id: string;
    serialNumber?: string;
    hostname?: string;
    status: string;
  };
  resource?: {
    id: string;
    name: string;
    type: 'PHYSICAL' | 'SOFTWARE' | 'CLOUD';
    category?: string;
  };
}

interface ResourceAssignmentsListProps {
  resourceId: string;
  resourceType: 'PHYSICAL' | 'SOFTWARE' | 'CLOUD';
  assignments: Assignment[];
  onAssignmentUpdate?: () => void;
}

export default function ResourceAssignmentsList({ 
  resourceId, 
  resourceType,
  assignments, 
  onAssignmentUpdate 
}: ResourceAssignmentsListProps) {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [showReturnModal, setShowReturnModal] = useState<string | null>(null);
  const [returnData, setReturnData] = useState({
    returnNotes: '',
    itemCondition: 'GOOD'
  });
  const [processing, setProcessing] = useState<string | null>(null);

  const canManageAssignments = user ? ['CEO', 'CTO', 'ADMIN', 'ENGINEERING_MANAGER', 'HR_MANAGER'].includes(user.role) : false;
  const handleUnassign = async (assignmentId: string) => {
    if (!canManageAssignments) {
      showNotification('error', 'Access Denied', 'You do not have permission to unassign resources');
      return;
    }

    setProcessing(assignmentId);
    try {
      const response = await fetch('/api/resources/assignments/return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignmentId,
          returnNotes: returnData.returnNotes,
          itemCondition: returnData.itemCondition
        }),
      });

      if (response.ok) {
        showNotification('success', 'Resource Unassigned', 'Resource has been successfully unassigned');
        setShowReturnModal(null);
        setReturnData({ returnNotes: '', itemCondition: 'GOOD' });
        if (onAssignmentUpdate) {
          onAssignmentUpdate();
        }
      } else {
        const error = await response.json();
        showNotification('error', 'Unassign Failed', error.error || 'Failed to unassign resource');
      }
    } catch (error) {
      console.error('Error unassigning resource:', error);
      showNotification('error', 'Network Error', 'Unable to unassign resource. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteCloudResource = async (assignmentId: string) => {
    if (!canManageAssignments) {
      showNotification('error', 'Access Denied', 'You do not have permission to manage cloud resources');
      return;
    }

    if (!confirm('Are you sure you want to remove this cloud resource allocation? This action cannot be undone.')) {
      return;
    }

    setProcessing(assignmentId);
    try {
      const response = await fetch('/api/resources/assignments/return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignmentId,
          returnNotes: 'Cloud resource allocation removed',
          itemCondition: 'GOOD'
        }),
      });

      if (response.ok) {
        showNotification('success', 'Cloud Resource Removed', 'Cloud resource allocation has been removed');
        if (onAssignmentUpdate) {
          onAssignmentUpdate();
        }
      } else {
        const error = await response.json();
        showNotification('error', 'Remove Failed', error.error || 'Failed to remove cloud resource allocation');
      }
    } catch (error) {
      console.error('Error removing cloud resource:', error);
      showNotification('error', 'Network Error', 'Unable to remove cloud resource. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const getActionButton = (assignment: Assignment) => {
    if (!canManageAssignments) return null;

    const isProcessing = processing === assignment.id;

    if (resourceType === 'CLOUD') {
      return (
        <button
          onClick={() => handleDeleteCloudResource(assignment.id)}
          disabled={isProcessing}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-red-700" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Removing...
            </>
          ) : (
            <>
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove
            </>
          )}
        </button>
      );
    } else {
      // Physical and Software resources
      return (
        <button
          onClick={() => setShowReturnModal(assignment.id)}
          disabled={isProcessing}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-orange-700" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Return
            </>
          )}
        </button>
      );
    }
  };
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Current Assignments</h3>
          <span className="text-sm text-gray-500">
            {assignments.length} active assignment{assignments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="mt-2">No active assignments</p>
            <p className="text-sm">This resource is not currently assigned to anyone</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-indigo-600">
                          {assignment.employee.name.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{assignment.employee.name}</p>
                      <p className="text-sm text-gray-500">{assignment.employee.department}</p>
                      {assignment.item && (
                        <p className="text-xs text-gray-400 mt-1">
                          {resourceType === 'SOFTWARE' ? 'License' : 'Item'}: {assignment.item.serialNumber || assignment.item.hostname || assignment.item.id}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        assignment.status === 'ACTIVE' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {assignment.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        Assigned {new Date(assignment.assignedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {getActionButton(assignment)}
                  </div>
                </div>
                {assignment.notes && (
                  <div className="mt-3 text-sm text-gray-600">
                    <p className="font-medium">Notes:</p>
                    <p>{assignment.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Return Modal for Physical/Software Resources */}
      {showReturnModal && (resourceType === 'PHYSICAL' || resourceType === 'SOFTWARE') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Return {resourceType === 'SOFTWARE' ? 'License' : 'Hardware'}
                </h3>
                <button
                  onClick={() => setShowReturnModal(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4">
              {resourceType === 'PHYSICAL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Item Condition <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={returnData.itemCondition}
                    onChange={(e) => setReturnData(prev => ({ ...prev, itemCondition: e.target.value }))}
                    className="block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="GOOD">Good Condition</option>
                    <option value="DAMAGED">Damaged</option>
                    <option value="LOST">Lost</option>
                    <option value="MAINTENANCE">Needs Maintenance</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Return Notes
                </label>
                <textarea
                  value={returnData.returnNotes}
                  onChange={(e) => setReturnData(prev => ({ ...prev, returnNotes: e.target.value }))}
                  rows={3}
                  className="block w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  placeholder="Optional notes about the return..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end space-x-3">
              <button
                onClick={() => setShowReturnModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnassign(showReturnModal)}
                disabled={processing === showReturnModal}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing === showReturnModal ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  `Return ${resourceType === 'SOFTWARE' ? 'License' : 'Hardware'}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}