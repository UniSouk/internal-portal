'use client';

import { useState, useEffect } from 'react';
import { canApproveOperationalLevel, canApproveExecutiveLevel, canApproveDepartmentLevel } from '@/lib/roleAuthClient';
import { useNotification } from './Notification';
import OperationalRequestForm from './OperationalRequestForm';

interface WorkflowItem {
  id: string;
  type: string;
  status: string;
  priority: string;
  displayTitle: string;
  displayDescription: string;
  createdAt: string;
  requester: {
    name: string;
    role: string;
    department: string;
  };
  data: any;
}

interface WorkflowStats {
  pendingApprovals: number;
  approvedRequests: number;
  rejectedRequests: number;
  myRequests: number;
  totalProcessed: number;
}

interface ApprovalDashboardProps {
  currentUserId: string;
}

export default function ApprovalDashboard({ currentUserId }: ApprovalDashboardProps) {
  const { showNotification } = useNotification();
  const [pendingWorkflows, setPendingWorkflows] = useState<WorkflowItem[]>([]);
  const [stats, setStats] = useState<WorkflowStats>({
    pendingApprovals: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    myRequests: 0,
    totalProcessed: 0
  });
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState<string | null>(null);

  const canApproveRequests = (role: string): boolean => {
    return canApproveOperationalLevel(role) || canApproveExecutiveLevel(role) || canApproveDepartmentLevel(role);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentUserId]);

  const fetchDashboardData = async () => {
    try {
      // Fetch user context
      const userResponse = await fetch(`/api/employees/${currentUserId}`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUserRole(userData.role);

        // Fetch pending workflows if user can approve
        if (canApproveRequests(userData.role)) {
          const workflowsResponse = await fetch(`/api/workflows/pending?approverId=${currentUserId}`);
          if (workflowsResponse.ok) {
            const workflows = await workflowsResponse.json();
            setPendingWorkflows(workflows);
          }
        }

        // Fetch workflow statistics
        const statsResponse = await fetch(`/api/workflows/stats?userId=${currentUserId}`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (workflowId: string) => {
    try {
      const response = await fetch(`/api/approvals/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          approverId: currentUserId,
          comments: 'Approved via dashboard'
        })
      });

      if (response.ok) {
        fetchDashboardData(); // Refresh data
        showNotification('success', 'Request Approved', 'The request has been successfully approved.');
      } else {
        const error = await response.json();
        showNotification('error', 'Approval Failed', error.error || 'Failed to approve request');
      }
    } catch (error) {
      console.error('Error approving workflow:', error);
      showNotification('error', 'Network Error', 'Unable to approve request. Please try again.');
    }
  };

  const handleReject = async (workflowId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/approvals/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          approverId: currentUserId,
          comments: reason
        })
      });

      if (response.ok) {
        fetchDashboardData(); // Refresh data
        showNotification('info', 'Request Rejected', 'The request has been rejected with the provided reason.');
      } else {
        const error = await response.json();
        showNotification('error', 'Rejection Failed', error.error || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting workflow:', error);
      showNotification('error', 'Network Error', 'Unable to reject request. Please try again.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getWorkflowTypeIcon = (type: string) => {
    switch (type) {
      case 'IT_EQUIPMENT_REQUEST': return '💻';
      case 'SOFTWARE_LICENSE_REQUEST': return '📦';
      case 'CLOUD_SERVICE_REQUEST': return '☁️';
      case 'ACCESS_REQUEST': return '🔑';
      case 'ELEVATED_ACCESS_REQUEST': return '🔐';
      case 'SYSTEM_ADMIN_REQUEST': return '⚙️';
      case 'POLICY_UPDATE_REQUEST': return '📋';
      case 'PROCEDURE_CHANGE_REQUEST': return '📝';
      case 'EXPENSE_APPROVAL_REQUEST': return '💰';
      case 'BUDGET_REQUEST': return '💳';
      case 'HIRING_REQUEST': return '👤';
      case 'ROLE_CHANGE_REQUEST': return '🔄';
      case 'VENDOR_CONTRACT_REQUEST': return '🤝';
      case 'TRAINING_REQUEST': return '🎓';
      default: return '📄';
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">⏳</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending Approvals</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.pendingApprovals}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">✓</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Approved</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.approvedRequests}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">✗</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Rejected</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.rejectedRequests}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">📝</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">My Requests</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.myRequests}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      {canApproveRequests(userRole) && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Pending Approvals ({pendingWorkflows.length})
            </h3>
            
            {pendingWorkflows.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-2">✅</div>
                <p className="text-gray-500">No pending approvals</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingWorkflows.map((workflow) => (
                  <div key={workflow.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-lg">{getWorkflowTypeIcon(workflow.type)}</span>
                          <h4 className="text-sm font-medium text-gray-900">
                            {workflow.displayTitle}
                          </h4>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(workflow.priority)}`}>
                            {workflow.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {workflow.displayDescription}
                        </p>
                        <div className="flex items-center text-xs text-gray-500 space-x-4">
                          <span>Requested by: {workflow.requester.name}</span>
                          <span>Department: {workflow.requester.department}</span>
                          <span>Role: {workflow.requester.role}</span>
                          <span>Date: {new Date(workflow.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleApprove(workflow.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(workflow.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions for Non-Executives */}
      {!canApproveRequests(userRole) && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Submit Operational Requests
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button 
                onClick={() => setShowRequestForm('IT_EQUIPMENT')}
                className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <span className="text-2xl mb-2">💻</span>
                <span className="text-sm font-medium">IT Equipment</span>
              </button>
              <button 
                onClick={() => setShowRequestForm('SOFTWARE_LICENSE')}
                className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <span className="text-2xl mb-2">📦</span>
                <span className="text-sm font-medium">Software License</span>
              </button>
              <button 
                onClick={() => setShowRequestForm('EXPENSE_APPROVAL')}
                className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <span className="text-2xl mb-2">💰</span>
                <span className="text-sm font-medium">Expense Approval</span>
              </button>
              <button 
                onClick={() => setShowRequestForm('HIRING')}
                className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <span className="text-2xl mb-2">👤</span>
                <span className="text-sm font-medium">New Hire</span>
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Submit operational requests that will be automatically routed to the appropriate approvers based on your role and request type.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Operational Request Form Modal */}
      {showRequestForm && (
        <OperationalRequestForm
          currentUserId={currentUserId}
          requestType={showRequestForm as any}
          onClose={() => setShowRequestForm(null)}
          onSuccess={() => {
            fetchDashboardData(); // Refresh dashboard data
          }}
        />
      )}
    </div>
  );
}