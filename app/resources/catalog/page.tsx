'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useNotification } from '@/components/Notification';
import ElegantSearch from '@/components/ElegantSearch';
import ElegantSelect from '@/components/ElegantSelect';
import Pagination from '@/components/Pagination';
import ResourceCatalogCard from '@/components/ResourceCatalogCard';
import ResourceCatalogForm from '@/components/ResourceCatalogForm';

interface ResourceCatalog {
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
  availability: {
    total: number;
    assigned: number;
    available: number;
  };
  _count: {
    items: number;
    assignments: number;
  };
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export default function ResourceCatalogPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { showNotification, NotificationComponent } = useNotification();

  const [resources, setResources] = useState<ResourceCatalog[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string; department: string }>>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [loading, setLoading] = useState(true); // For initial page load
  const [searchLoading, setSearchLoading] = useState(false); // For search/filter updates
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceCatalog | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  
  // Pagination
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
    hasNextPage: false,
    hasPreviousPage: false
  });

  const canManageResources = user && ['CEO', 'CTO', 'ADMIN'].includes(user.role);
  const canViewEmployeeFilter = user && ['CEO', 'CTO'].includes(user.role);

  useEffect(() => {
    if (user) {
      fetchResources(true); // Initial load
      if (canViewEmployeeFilter) {
        fetchEmployees(); // Only fetch employees for CEO/CTO
      }
    }
  }, [user, canViewEmployeeFilter]); // Add canViewEmployeeFilter dependency

  useEffect(() => {
    if (!loading) { // Only run after initial load is complete
      fetchResources(false); // Search/filter updates
    }
  }, [pagination.currentPage, pagination.itemsPerPage, searchQuery, selectedType, selectedStatus, selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      setEmployeesLoading(true);
      const response = await fetch('/api/employees?limit=100');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      } else {
        console.error('Failed to fetch employees:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setEmployeesLoading(false);
    }
  };

  const fetchResources = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setSearchLoading(true);
      }
      
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: pagination.itemsPerPage.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(selectedType && { type: selectedType }),
        ...(selectedStatus && { status: selectedStatus }),
        ...(selectedEmployee && { assignedTo: selectedEmployee })
      });

      const response = await fetch(`/api/resources/catalog?${params}`);
      if (response.ok) {
        const data = await response.json();
        setResources(data.resources);
        setPagination(data.pagination);
      } else {
        showNotification('error', 'Error', 'Failed to fetch resource catalog');
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
      showNotification('error', 'Network Error', 'Unable to fetch resources');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setSearchLoading(false);
      }
    }
  };

  const handleCreateResource = async (resourceData: any) => {
    try {
      const response = await fetch('/api/resources/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resourceData)
      });

      if (response.ok) {
        showNotification('success', 'Resource Created', 'Resource catalog entry created successfully');
        setShowForm(false);
        fetchResources(false);
      } else {
        const errorData = await response.json();
        showNotification('error', 'Creation Failed', errorData.error || 'Failed to create resource');
      }
    } catch (error) {
      console.error('Error creating resource:', error);
      showNotification('error', 'Network Error', 'Unable to create resource');
    }
  };

  const handleUpdateResource = async (resourceData: any) => {
    if (!editingResource) return;

    try {
      const response = await fetch(`/api/resources/catalog/${editingResource.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resourceData)
      });

      if (response.ok) {
        showNotification('success', 'Resource Updated', 'Resource catalog entry updated successfully');
        setEditingResource(null);
        setShowForm(false);
        fetchResources(false);
      } else {
        const errorData = await response.json();
        showNotification('error', 'Update Failed', errorData.error || 'Failed to update resource');
      }
    } catch (error) {
      console.error('Error updating resource:', error);
      showNotification('error', 'Network Error', 'Unable to update resource');
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/resources/catalog/${resourceId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showNotification('success', 'Resource Deleted', 'Resource catalog entry deleted successfully');
        fetchResources(false);
      } else {
        const errorData = await response.json();
        showNotification('error', 'Deletion Failed', errorData.error || 'Failed to delete resource');
      }
    } catch (error) {
      console.error('Error deleting resource:', error);
      showNotification('error', 'Network Error', 'Unable to delete resource');
    }
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleItemsPerPageChange = (itemsPerPage: number) => {
    setPagination(prev => ({ 
      ...prev, 
      itemsPerPage, 
      currentPage: 1 
    }));
  };

  const typeOptions = [
    { value: '', label: 'All Types' },
    { value: 'PHYSICAL', label: 'Physical Hardware' },
    { value: 'SOFTWARE', label: 'Software Licenses' },
    { value: 'CLOUD', label: 'Cloud Services' }
  ];

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'RETURNED', label: 'Returned' },
    { value: 'LOST', label: 'Lost' },
    { value: 'DAMAGED', label: 'Damaged' }
  ];

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <div className="text-lg text-gray-600">Loading resource catalog...</div>
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
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Resource Catalog</h1>
                <p className="text-gray-600 mt-1">
                  Manage your organization's resource catalog and inventory
                </p>
              </div>
              {canManageResources && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Resource
                </button>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <ElegantSearch
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search resources..."
                  size="md"
                />
              </div>
              <ElegantSelect
                value={selectedType}
                onChange={setSelectedType}
                options={typeOptions}
                placeholder="Filter by type"
              />
              <ElegantSelect
                value={selectedStatus}
                onChange={setSelectedStatus}
                options={statusOptions}
                placeholder="Filter by status"
              />
            </div>
            
            {/* Employee Filter - Only visible to CEO/CTO */}
            {canViewEmployeeFilter && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Employee
                    </label>
                    {employeesLoading ? (
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                        Loading employees...
                      </div>
                    ) : (
                      <ElegantSelect
                        value={selectedEmployee}
                        onChange={setSelectedEmployee}
                        options={[
                          { value: '', label: 'All Employees' },
                          ...employees.map(emp => ({
                            value: emp.id,
                            label: emp.name,
                            description: `${emp.email} • ${emp.department}`,
                            icon: (
                              <div className="h-4 w-4 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 flex items-center justify-center">
                                <span className="text-xs font-medium text-white">
                                  {emp.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )
                          }))
                        ]}
                        placeholder="Select employee to view their resources"
                        searchable={true}
                        showClearButton={true}
                        size="md"
                      />
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      View resources allocated to a specific employee
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Filters Indicator */}
          {(selectedEmployee || selectedType || selectedStatus || searchQuery) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Active Filters:</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedEmployee && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        Employee: {employees.find(emp => emp.id === selectedEmployee)?.name}
                        <button
                          onClick={() => setSelectedEmployee('')}
                          className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-600"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {selectedType && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Type: {typeOptions.find(opt => opt.value === selectedType)?.label}
                        <button
                          onClick={() => setSelectedType('')}
                          className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-600"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {selectedStatus && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Status: {statusOptions.find(opt => opt.value === selectedStatus)?.label}
                        <button
                          onClick={() => setSelectedStatus('')}
                          className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-green-400 hover:bg-green-200 hover:text-green-600"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {searchQuery && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Search: "{searchQuery}"
                        <button
                          onClick={() => setSearchQuery('')}
                          className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-purple-400 hover:bg-purple-200 hover:text-purple-600"
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedType('');
                    setSelectedStatus('');
                    setSelectedEmployee('');
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}

          {/* Resource Grid */}
          <div className="relative">
            {/* Search Loading Overlay */}
            {searchLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                <div className="flex flex-col items-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <div className="text-sm text-gray-600">Searching resources...</div>
                </div>
              </div>
            )}
            
            {resources.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {resources.map((resource) => (
                  <ResourceCatalogCard
                    key={resource.id}
                    resource={resource}
                    onEdit={canManageResources ? (resource: ResourceCatalog) => {
                      setEditingResource(resource);
                      setShowForm(true);
                    } : undefined}
                    onDelete={canManageResources ? handleDeleteResource : undefined}
                    onViewDetails={(id: string) => router.push(`/resources/catalog/${id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8V4a1 1 0 00-1-1H7a1 1 0 00-1 1v1m8 0V4.5" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Resources Found</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  {selectedEmployee
                    ? `No resources are currently allocated to ${employees.find(emp => emp.id === selectedEmployee)?.name || 'this employee'}.`
                    : searchQuery || selectedType || selectedStatus
                    ? 'No resources match your current filters. Try adjusting your search criteria.'
                    : 'Get started by adding your first resource to the catalog.'
                  }
                </p>
                {canManageResources && !searchQuery && !selectedType && !selectedStatus && !selectedEmployee && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Add First Resource
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              itemsPerPage={pagination.itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          )}
        </div>
      </div>

      {/* Resource Form Modal */}
      {showForm && (
        <ResourceCatalogForm
          resource={editingResource}
          onSubmit={editingResource ? handleUpdateResource : handleCreateResource}
          onCancel={() => {
            setShowForm(false);
            setEditingResource(null);
          }}
        />
      )}
    </ProtectedRoute>
  );
}