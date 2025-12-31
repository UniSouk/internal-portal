'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useNotification } from '@/components/Notification';
import ResourceItemsList from '@/components/ResourceItemsList';
import ResourceAssignmentsList from '@/components/ResourceAssignmentsList';
import ResourceItemForm from '@/components/ResourceItemForm';
import ResourceAssignmentForm from '@/components/ResourceAssignmentForm';

interface ResourceDetail {
  id: string;
  name: string;
  type: 'PHYSICAL' | 'SOFTWARE' | 'CLOUD';
  category: string;
  description?: string;
  status: string;
  custodian: {
    id: string;
    name: string;
    email: string;
    department: string;
  };
  quantity?: number;
  items: any[];
  assignments: any[];
  availability: {
    total: number;
    assigned: number;
    available: number;
    maintenance: number;
    lost: number;
    damaged: number;
  };
  auditLogs: any[];
  timeline: any[];
  metadata: {}[];
}

export default function ResourceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { showNotification, NotificationComponent } = useNotification();
  
  const [resource, setResource] = useState<ResourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showItemForm, setShowItemForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);

  const canManageResources = user ? ['CEO', 'CTO', 'ADMIN'].includes(user.role) : false;
  const canAssignResources = user ? ['CEO', 'CTO', 'ADMIN', 'ENGINEERING_MANAGER', 'HR_MANAGER'].includes(user.role) : false;

  // Assignment availability logic
  const getAssignmentAvailability = () => {
    if (!resource) return { canAssign: false, reason: 'Resource not loaded' };
    
    if (resource.type === 'PHYSICAL') {
      if (resource.items.length === 0) {
        // No items exist - can assign directly
        return { canAssign: true, reason: 'Direct assignment (no items)' };
      } else {
        // Items exist - check if any are available
        const availableItems = resource.items.filter(item => item.status === 'AVAILABLE');
        if (availableItems.length === 0) {
          return { 
            canAssign: false, 
            reason: 'No available hardware items',
            details: `All ${resource.items.length} hardware items are currently assigned or unavailable`
          };
        } else {
          return { 
            canAssign: true, 
            reason: 'Hardware items available',
            availableCount: availableItems.length
          };
        }
      }
    } else if (resource.type === 'SOFTWARE') {
      if (resource.items.length === 0) {
        // No license items exist - can assign directly (like old behavior)
        return { canAssign: true, reason: 'Direct assignment (no license items)' };
      } else {
        // License items exist - check if any are available
        const availableItems = resource.items.filter(item => item.status === 'AVAILABLE');
        if (availableItems.length === 0) {
          return { 
            canAssign: false, 
            reason: 'No available software licenses',
            details: `All ${resource.items.length} software licenses are currently assigned or unavailable`
          };
        } else {
          return { 
            canAssign: true, 
            reason: 'Software licenses available',
            availableCount: availableItems.length
          };
        }
      }
    } else {
      // Cloud resources can always be assigned (quantity-based)
      return { canAssign: true, reason: 'Cloud resource (quantity-based)' };
    }
  };

  const assignmentAvailability = getAssignmentAvailability();

  useEffect(() => {
    if (params.id) {
      fetchResourceDetail();
    }
  }, [params.id]);

  const fetchResourceDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/resources/catalog/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setResource(data);
      } else if (response.status === 404) {
        showNotification('error', 'Not Found', 'Resource not found');
        router.push('/resources/catalog');
      } else {
        showNotification('error', 'Error', 'Failed to fetch resource details');
      }
    } catch (error) {
      console.error('Error fetching resource detail:', error);
      showNotification('error', 'Network Error', 'Unable to fetch resource details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async () => {
    // Component handles the API call, we just need to refresh
    fetchResourceDetail();
  };

  const handleCreateAssignment = async () => {
    // Component handles the API call, we just need to refresh
    fetchResourceDetail();
  };

  const handleDeleteCloudResource = async () => {
    if (!resource) return;

    const hasAssignments = resource.assignments.length > 0;
    const confirmMessage = hasAssignments 
      ? `Are you sure you want to delete "${resource.name}"? This will automatically unallocate it from ${resource.assignments.length} employee(s). This action cannot be undone.`
      : `Are you sure you want to delete "${resource.name}"? This action cannot be undone.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`/api/resources/catalog/${resource.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json();
        showNotification('success', 'Resource Deleted', result.message);
        router.push('/resources/catalog');
      } else {
        const error = await response.json();
        showNotification('error', 'Delete Failed', error.error || 'Failed to delete resource');
      }
    } catch (error) {
      console.error('Error deleting resource:', error);
      showNotification('error', 'Network Error', 'Unable to delete resource. Please try again.');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PHYSICAL':
        return (
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'SOFTWARE':
        return (
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        );
      case 'CLOUD':
        return (
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <div className="text-lg text-gray-600">Loading resource details...</div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!resource) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Resource Not Found</h2>
            <p className="mt-2 text-gray-600">The resource you're looking for doesn't exist.</p>
            <button
              onClick={() => router.push('/resources/catalog')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Back to Catalog
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      {NotificationComponent}
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  {getTypeIcon(resource.type)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{resource.name}</h1>
                  <p className="text-gray-600 mt-1">{resource.category}</p>
                  {resource.description && (
                    <p className="text-gray-600 mt-2 max-w-2xl">{resource.description}</p>
                  )}
                  
                  {/* Custodian */}
                  <div className="flex items-center space-x-2 mt-3">
                    <span className="text-sm text-gray-500">Custodian:</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-indigo-600">
                          {resource.custodian.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {resource.custodian.name}
                      </span>
                      <span className="text-sm text-gray-500">
                        ({resource.custodian.department})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => router.push('/resources/catalog')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  ← Back to Catalog
                </button>
                
                {/* Assignment Button or Message */}
                {canAssignResources && (
                  <>
                    {assignmentAvailability?.canAssign ? (
                      <button
                        onClick={() => setShowAssignmentForm(true)}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                      >
                        Assign Resource
                      </button>
                    ) : (
                      <div className="relative group">
                        <button
                          disabled
                          className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 border border-gray-300 rounded-lg cursor-not-allowed"
                        >
                          Cannot Assign
                        </button>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {assignmentAvailability?.details || assignmentAvailability?.reason}
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {canManageResources && (resource.type === 'PHYSICAL' || resource.type === 'SOFTWARE') && (
                  <button
                    onClick={() => setShowItemForm(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                  >
                    {resource.type === 'SOFTWARE' ? 'Add License' : 'Add Item'}
                  </button>
                )}
                
                {/* Delete Button for Cloud Resources */}
                {canManageResources && resource.type === 'CLOUD' && (
                  <button
                    onClick={() => handleDeleteCloudResource()}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                  >
                    Delete Cloud Resource
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Assignment Status Banner */}
          {(resource.type === 'PHYSICAL' || resource.type === 'SOFTWARE') && (
            <div className="mb-6">
              {resource.items.length === 0 ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Direct Assignment Available</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        This {resource.type.toLowerCase()} resource has no {resource.type === 'SOFTWARE' ? 'license items' : 'hardware items'} yet. It can be assigned directly to employees.
                        {canManageResources && ` Add ${resource.type === 'SOFTWARE' ? 'license items' : 'hardware items'} below to enable item-specific tracking.`}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`border rounded-lg p-4 ${
                  assignmentAvailability?.canAssign 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start space-x-3">
                    <svg className={`w-5 h-5 mt-0.5 ${
                      assignmentAvailability?.canAssign ? 'text-green-600' : 'text-red-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {assignmentAvailability?.canAssign ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      )}
                    </svg>
                    <div>
                      <h4 className={`text-sm font-medium ${
                        assignmentAvailability?.canAssign ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {assignmentAvailability?.canAssign ? 'Hardware Items Available' : 'No Available Hardware Items'}
                      </h4>
                      <p className={`text-sm mt-1 ${
                        assignmentAvailability?.canAssign ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {assignmentAvailability?.canAssign ? (
                          `${assignmentAvailability?.availableCount} of ${resource.items.length} hardware items are available for assignment.`
                        ) : (
                          `${assignmentAvailability?.details} To assign this resource, you need to add new hardware items or return existing ones.`
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cloud Resource Warning Banner */}
          {resource.type === 'CLOUD' && resource.assignments.length > 0 && canManageResources && (
            <div className="mb-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-amber-900">Cloud Resource Management</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      This cloud resource is currently allocated to {resource.assignments.length} employee(s). 
                      Deleting this resource will automatically unallocate it from all employees. 
                      You can also manually remove individual allocations using the "Remove" button in the assignments tab.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Availability Stats - Only show for resources with items or Cloud resources */}
          {((resource.type === 'PHYSICAL') && resource.items.length > 0 ) || resource.type === 'CLOUD'  ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="text-2xl font-bold text-gray-900">
                  {resource.type === 'CLOUD' ? resource.quantity : resource.availability.total}
                </div>
                <div className="text-sm text-gray-500">
                  {'Total'}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="text-2xl font-bold text-green-600">{resource.type === 'CLOUD' ? ((resource.quantity || 0) - (resource?.assignments?.length || 0)) : resource.availability.available}</div>
                <div className="text-sm text-gray-500">
                  {'Available'}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="text-2xl font-bold text-blue-600">{resource?.assignments?.length || resource.availability.assigned}</div>
                <div className="text-sm text-gray-500">
                  {'Assigned'}
                </div>
              </div>
              {resource.type === 'PHYSICAL' && (
                <>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-yellow-600">{resource.availability.maintenance}</div>
                    <div className="text-sm text-gray-500">Maintenance</div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-orange-600">{resource.availability.damaged}</div>
                    <div className="text-sm text-gray-500">Damaged</div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="text-2xl font-bold text-red-600">{resource.availability.lost}</div>
                    <div className="text-sm text-gray-500">Lost</div>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'overview'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Overview
                </button>
                
                {(resource.type === 'PHYSICAL' || resource.type === 'SOFTWARE') && (
                  <button
                    onClick={() => setActiveTab('items')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'items'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {resource.type === 'SOFTWARE' ? 'Licenses' : 'Items'} ({resource.items.length})
                  </button>
                )}
                
                <button
                  onClick={() => setActiveTab('assignments')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'assignments'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {resource.type === 'SOFTWARE' ? 'Assignments' : resource.type === 'PHYSICAL' ? 'Assignments' : 'Seats'} ({resource.assignments.length})
                </button>
                
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'audit'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Audit Trail
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Resource Information</h3>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Type</dt>
                        <dd className="text-sm text-gray-900">{resource.type}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Category</dt>
                        <dd className="text-sm text-gray-900">{resource.category}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Status</dt>
                        <dd className="text-sm text-gray-900">{resource.status}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Custodian</dt>
                        <dd className="text-sm text-gray-900">{resource.custodian.name}</dd>
                      </div>
                    </dl>
                  </div>
                  
                  {resource.description && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
                      <p className="text-gray-600">{resource.description}</p>
                    </div>
                  )}
                  {resource?.type === "CLOUD" && <hr/>}

                  {resource?.metadata && (
    <>
      <p className="font-semibold mb-2">Other Specifications</p>

      {Object.entries(resource.metadata).map(([key, value]) => (
        <div key={key} className="flex gap-2 text-sm mb-2">
          <p className="font-medium capitalize">{key}</p>
          <p>{String(value)}</p>
        </div>
      ))}
    </>
  )}

                </div>
              )}

              {(activeTab === 'items' && (resource.type === 'SOFTWARE' || resource.type === 'PHYSICAL')) && (
                <ResourceItemsList
                  resourceId={resource.id}
                  items={resource.items}
                  onRefresh={fetchResourceDetail}
                  canManage={canManageResources}
                />
              )}

              {activeTab === 'assignments' && (
                <ResourceAssignmentsList
                  resourceId={resource.id}
                  resourceType={resource.type}
                  assignments={resource.assignments}
                  onAssignmentUpdate={fetchResourceDetail}
                />
              )}

              {activeTab === 'audit' && (
                <div className="space-y-4">
                  {resource.auditLogs.map((log, index) => (
                    <div key={index} className="border-l-4 border-indigo-500 pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-900">
                          {log.fieldChanged} changed
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        By {log.changedBy.name}
                      </div>
                      {log.oldValue && log.newValue && (
                        <div className="text-xs text-gray-500 mt-1">
                          {log.oldValue} → {log.newValue}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showItemForm && (
        <ResourceItemForm
          resourceId={resource.id}
          resourceType={resource.type}
          resourceName={resource.name}
          onItemCreated={handleCreateItem}
          onClose={() => setShowItemForm(false)}
        />
      )}

      {showAssignmentForm && (
        <ResourceAssignmentForm
          resourceId={resource.id}
          resourceType={resource.type}
          availableItems={resource.items}
          onAssignmentCreated={handleCreateAssignment}
          onClose={() => setShowAssignmentForm(false)}
        />
      )}
    </ProtectedRoute>
  );
}