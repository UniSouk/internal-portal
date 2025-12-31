'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import ApprovalDashboard from '@/components/ApprovalDashboard';
import { getUserPermissions } from '@/lib/permissions';

interface DashboardStats {
  totalEmployees: number;
  pendingAccessRequests: number;
  pendingApprovals: number;
  activePolicies: number;
  recentActivities: number;
}

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    pendingAccessRequests: 0,
    pendingApprovals: 0,
    activePolicies: 0,
    recentActivities: 0
  });
  const [loading, setLoading] = useState(true);
  const [showApprovalDashboard, setShowApprovalDashboard] = useState(false);

  const permissions = user ? getUserPermissions(user.role as any) : null;

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user]);

  const fetchDashboardStats = async () => {
    try {
      // For CEO/CTO, fetch all data. For others, fetch user-specific data
      const isCeoOrCto = user?.role === 'CEO' || user?.role === 'CTO';
      
      const [employeesRes, accessRes, approvalsRes, policiesRes, timelineRes] = await Promise.all([
        // Employees - only CEO/CTO see all employees
        isCeoOrCto ? fetch('/api/employees').catch(() => null) : Promise.resolve(null),
        // Access requests - show user's own requests for non-CEO/CTO
        fetch('/api/access').catch(() => null),
        // Approvals - show user's own approval requests for non-CEO/CTO
        fetch('/api/approvals').catch(() => null),
        // Policies - already filtered by role in the API
        fetch('/api/policies').catch(() => null),
        // Timeline - show user's activities for non-CEO/CTO
        isCeoOrCto 
          ? fetch('/api/timeline?limit=10').catch(() => null)
          : fetch(`/api/timeline?limit=10&userId=${user?.id}`).catch(() => null)
      ]);

      const employeesData = employeesRes?.ok ? await employeesRes.json() : [];
      const accessData = accessRes?.ok ? await accessRes.json() : [];
      const approvalsData = approvalsRes?.ok ? await approvalsRes.json() : [];
      const policiesData = policiesRes?.ok ? await policiesRes.json() : [];
      const timelineData = timelineRes?.ok ? await timelineRes.json() : [];

      // Handle paginated responses
      const employees = employeesData.employees || employeesData || [];
      const accessRequests = accessData.accessRequests || accessData || [];
      const approvals = approvalsData.workflows || approvalsData || [];
      const policies = policiesData.policies || policiesData || [];
      const timeline = timelineData.activities || timelineData || [];

      if (isCeoOrCto) {
        // CEO/CTO see system-wide statistics
        setStats({
          totalEmployees: employees.length || 0,
          pendingAccessRequests: accessRequests.filter((req: any) => req.status === 'REQUESTED').length || 0,
          pendingApprovals: approvals.filter((app: any) => app.status === 'PENDING').length || 0,
          activePolicies: policies.filter((pol: any) => pol.status === 'PUBLISHED').length || 0,
          recentActivities: timeline.length || 0
        });
      } else {
        // Regular employees see their own statistics
        const userAccessRequests = accessRequests.filter((req: any) => req.requesterId === user?.id);
        const userApprovals = approvals.filter((app: any) => app.requesterId === user?.id);
        
        setStats({
          totalEmployees: 0, // Not shown for regular employees
          pendingAccessRequests: userAccessRequests.filter((req: any) => req.status === 'REQUESTED').length || 0,
          pendingApprovals: userApprovals.filter((app: any) => app.status === 'PENDING').length || 0,
          activePolicies: policies.length || 0, // User's own policies (already filtered by API)
          recentActivities: timeline.length || 0
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user?.name}!
            </h1>
            <p className="mt-2 text-gray-600">
              Internal Operations Portal - {user?.role.replace(/_/g, ' ')} • {user?.department}
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Employees - Only show for CEO/CTO */}
            {(user?.role === 'CEO' || user?.role === 'CTO') && (
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Total Employees</p>
                    <p className="text-2xl font-semibold text-gray-900">{loading ? '...' : stats.totalEmployees}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2v6a2 2 0 01-2 2m-2-2H9m10-2a2 2 0 002-2m0 0V9a2 2 0 00-2-2M9 7a2 2 0 00-2 2v6a2 2 0 002 2m0 0a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v2a2 2 0 001 1.732M9 7v2a2 2 0 001 1.732" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">
                    {(user?.role === 'CEO' || user?.role === 'CTO') ? 'Pending Access Requests' : 'My Pending Requests'}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">{loading ? '...' : stats.pendingAccessRequests}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">
                    {(user?.role === 'CEO' || user?.role === 'CTO') ? 'Pending Approvals' : 'My Pending Approvals'}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">{loading ? '...' : stats.pendingApprovals}</p>
                </div>
              </div>
            </div>

           {(user?.role === 'CEO' || user?.role === 'CTO') && (<div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">
                    Active Policies
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">{loading ? '...' : stats.activePolicies}</p>
                </div>
              </div>
            </div>)}

            {/* Recent Activities - Show for all users but with different context */}
            {permissions?.canApproveAccess && (
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">
                      {(user?.role === 'CEO' || user?.role === 'CTO') ? 'Recent Activities' : 'My Recent Activities'}
                    </p>
                    <p className="text-2xl font-semibold text-gray-900">{loading ? '...' : stats.recentActivities}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Approval Dashboard Toggle */}
          {permissions?.canApproveWorkflows && (
            <div className="mb-8 bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Approval Management Dashboard</h2>
                  <p className="text-sm text-gray-600">
                    Role-based approval system where CTO and CEO can approve requests, others can submit requests
                  </p>
                </div>
                <button
                  onClick={() => setShowApprovalDashboard(!showApprovalDashboard)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {showApprovalDashboard ? 'Hide' : 'Show'} Approval Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Approval Dashboard */}
          {showApprovalDashboard && user && permissions?.canApproveWorkflows && (
            <div className="mb-8">
              <ApprovalDashboard currentUserId={user.id} />
            </div>
          )}

          {/* Main Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Employee Management - Only CEO/CTO */}
            {permissions?.canViewAllEmployees && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Employee Management</h3>
                    <p className="text-sm text-gray-500">Manage employee records, roles, and organizational hierarchy</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Link href="/employees" className="text-blue-600 hover:text-blue-500 text-sm font-medium">
                    View Employees →
                  </Link>
                </div>
              </div>
            )}

            {/* Resource Management */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {permissions?.canViewAllResources ? 'Resource Management' : 'My Resources'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {permissions?.canViewAllResources 
                      ? 'Unified management of physical assets, software licenses, and cloud services' 
                      : 'View your assigned resources and request access to new ones'
                    }
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/resources" className="text-green-600 hover:text-green-500 text-sm font-medium">
                  {permissions?.canViewAllResources ? 'Manage Resources' : 'View My Resources'} →
                </Link>
              </div>
            </div>

            {/* Access Management */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2v6a2 2 0 01-2 2m-2-2H9m10-2a2 2 0 002-2m0 0V9a2 2 0 00-2-2M9 7a2 2 0 00-2 2v6a2 2 0 002 2m0 0a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v2a2 2 0 001 1.732M9 7v2a2 2 0 001 1.732" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {permissions?.canApproveAccess ? 'Access Management' : 'Access Requests'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {permissions?.canApproveAccess 
                      ? 'Handle access requests with automatic approval workflows' 
                      : 'Request access to resources and track your requests'
                    }
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/access" className="text-purple-600 hover:text-purple-500 text-sm font-medium">
                  {permissions?.canApproveAccess ? 'Manage Access' : 'My Requests'} →
                </Link>
              </div>
            </div>

            {/* Policy Management */}
           {permissions?.canApproveWorkflows && <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Policy Management</h3>
                  <p className="text-sm text-gray-500">
                    {permissions?.canEditPolicy 
                      ? 'Create and manage policies with version control and tracking' 
                      : 'View policies and submit new policy proposals'
                    }
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/policies" className="text-red-600 hover:text-red-500 text-sm font-medium">
                  View Policies →
                </Link>
              </div>
            </div>}
            

            
            {permissions?.canApproveWorkflows && (
              <>
              <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {permissions?.canApproveWorkflows ? 'Approval Workflows' : 'My Approvals'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {permissions?.canApproveWorkflows 
                      ? 'Manage all approval processes and connected workflows' 
                      : 'Track your submitted requests and their approval status'
                    }
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/approvals" className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
                  View Approvals →
                </Link>
              </div>
            </div>
              </>
            )}
          </div>

          {/* Admin-only sections */}
          {(permissions?.canViewAudit || permissions?.canViewTimeline) && (
            <div className="mt-6 bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gray-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Activity Timeline & Audit</h3>
                  <p className="text-sm text-gray-500">
                    Complete audit trail showing who updated what and when - track all changes across policies, documents, and workflows
                  </p>
                </div>
              </div>
              <div className="mt-4 flex space-x-4">
                {permissions.canViewTimeline && (
                  <Link href="/timeline" className="text-gray-600 hover:text-gray-500 text-sm font-medium">
                    View Timeline →
                  </Link>
                )}
                {permissions.canViewAudit && (
                  <Link href="/audit" className="text-gray-600 hover:text-gray-500 text-sm font-medium">
                    View Audit Logs →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}