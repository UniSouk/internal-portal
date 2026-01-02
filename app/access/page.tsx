'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AccessRequestForm from '@/components/AccessRequestForm';
import { useNotification } from '@/components/Notification';

interface AccessRequest {
  id: string;
  status: 'REQUESTED' | 'APPROVED' | 'GRANTED' | 'REVOKED';
  permissionLevel: 'READ' | 'WRITE' | 'EDIT' | 'ADMIN';
  justification?: string;
  hardwareRequest?: string; // Add hardware request field
  requestedAt: string;
  approvedAt?: string;
  grantedAt?: string;
  revokedAt?: string;
  employee: {
    id: string;
    name: string;
    email: string;
    department: string;
  };
  approver?: {
    id: string;
    name: string;
    email: string;
    department: string;
  };
  resource?: {
    id: string;
    name: string;
    type: string;
  };
}

export default function AccessPage() {
  const { user } = useAuth();
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { showNotification, NotificationComponent } = useNotification();

  const isCEOOrCTO = user?.role === 'CEO' || user?.role === 'CTO';

  const fetchAccessRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/access');
      if (response.ok) {
        const data = await response.json();
        setAccessRequests(data);
        setDataLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching access requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadData = () => {
    fetchAccessRequests();
  };

  const handleCreateAccessRequest = async (requestData: any) => {
    try {
      const response = await fetch('/api/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const result = await response.json();
        setAccessRequests([result.accessRequest, ...accessRequests]);
        setShowForm(false);
        setDataLoaded(true); // Mark data as loaded after creating a request
        
        // Show success message with workflow info
        showNotification('success', 'Request Submitted', 'Access request created successfully! An approval workflow has been automatically created and sent to the appropriate manager.');
      } else {
        const errorData = await response.json();
        showNotification('error', 'Request Failed', errorData.error || 'Failed to create access request');
      }
    } catch (error) {
      console.error('Error creating access request:', error);
      showNotification('error', 'Network Error', 'Unable to create access request. Please check your connection and try again.');
    }
  };

  const handleDeleteAccess = async (accessId: string) => {
    try {
      const response = await fetch(`/api/access?id=${accessId}&deletedBy=system`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAccessRequests(accessRequests.filter(request => request.id !== accessId));
        setDeleteConfirm(null);
        showNotification('success', 'Request Deleted', 'Access request has been successfully deleted.');
      } else {
        const errorData = await response.json();
        showNotification('error', 'Delete Failed', errorData.error || 'Failed to delete access request');
      }
    } catch (error) {
      console.error('Error deleting access request:', error);
      showNotification('error', 'Network Error', 'Unable to delete access request. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-blue-100 text-blue-800';
      case 'GRANTED':
        return 'bg-green-100 text-green-800';
      case 'REVOKED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPermissionColor = (level: string) => {
    switch (level) {
      case 'read':
        return 'bg-green-100 text-green-800';
      case 'WRITE':
        return 'bg-blue-100 text-blue-800';
      case 'EDIT':
        return 'bg-orange-100 text-orange-800';
      case 'ADMIN':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ProtectedRoute>
      {NotificationComponent}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Access Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            {isCEOOrCTO 
              ? "Manage access requests and permissions for company resources. All requests automatically create approval workflows."
              : "View your access requests and request new permissions for company resources. All requests automatically create approval workflows."
            }
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3 flex">
          <button
            type="button"
            onClick={handleLoadData}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </>
            ) : (
              <>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isCEOOrCTO ? 'Load All Requests' : 'Load My Requests'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            Request Access
          </button>
        </div>
      </div>

      {!dataLoaded && !loading && (
        <div className="mt-8 text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Access requests not loaded</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isCEOOrCTO 
              ? 'Click "Load All Requests" to view all company access requests or "Request Access" to submit a new request.'
              : 'Click "Load My Requests" to view your access history or "Request Access" to submit a new request.'
            }
          </p>
        </div>
      )}

      {dataLoaded && (
        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Resource
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requested
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Approver
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {accessRequests.map((request) => (
                      <tr key={request.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{request.employee.name}</div>
                          <div className="text-sm text-gray-500">{request.employee.department}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {request.resource?.name || request.hardwareRequest || 'Unknown Request'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {request.resource?.type || (request.hardwareRequest ? 'PHYSICAL' : 'Unknown')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                            {request.status === "REVOKED" ? "DENIED" : request.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(request.requestedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {request.approver ? request.approver.name : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {dataLoaded && accessRequests.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2v6a2 2 0 01-2 2m-2-2H9m10-2a2 2 0 002-2m0 0V9a2 2 0 00-2-2M9 7a2 2 0 00-2 2v6a2 2 0 002 2m0 0a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v2a2 2 0 001 1.732M9 7v2a2 2 0 001 1.732"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No access requests</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isCEOOrCTO 
              ? 'No access requests found in the system. Get started by creating a new access request.'
              : 'You have no access requests yet. Get started by creating a new access request.'
            }
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-2">Delete Access Request</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete this access request? This will also delete any related approval workflows. This action cannot be undone and will be logged in the audit trail.
                </p>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteAccess(deleteConfirm)}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <AccessRequestForm
          onSubmit={handleCreateAccessRequest}
          onCancel={() => setShowForm(false)}
        />
      )}
      </div>
    </ProtectedRoute>
  );
}