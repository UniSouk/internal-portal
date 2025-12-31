'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { 
  Eye, 
  Edit, 
  Trash2, 
  FileText, 
  Users, 
  Shield, 
  CheckCircle, 
  Plus, 
  Filter, 
  Search,
  Calendar,
  User,
  Settings,
  AlertCircle,
  Clock,
  XCircle,
  Download
} from 'lucide-react';
import PolicyForm from '@/components/PolicyForm';
import PolicyChangeHistory from '@/components/PolicyChangeHistory';
import Pagination from '@/components/Pagination';
import { useNotification } from '@/components/Notification';
import ElegantSearch from '@/components/ElegantSearch';
import ElegantSelect from '@/components/ElegantSelect';

interface Policy {
  id: string;
  title: string;
  category: 'HR' | 'IT' | 'SECURITY' | 'COMPLIANCE';
  version: number;
  status: 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  content?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  effectiveDate?: string;
  expiryDate?: string;
  reviewDate?: string;
  lastReviewDate?: string;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string;
    email: string;
    department: string;
  };
}

export default function PoliciesPage() {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string; department: string }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [localSearchQuery, setLocalSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [totalPolicies, setTotalPolicies] = useState(0);
  const { showNotification, NotificationComponent } = useNotification();

  useEffect(() => {
    if (user) {
      if (policies.length === 0) {
        fetchPolicies();
      } else {
        fetchPoliciesWithSearchLoading();
      }
    }
  }, [user, currentPage, itemsPerPage, searchQuery, selectedCategory, selectedStatus]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchPolicies = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let url = `/api/policies?page=${currentPage}&limit=${itemsPerPage}`;
      
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      
      if (selectedCategory) {
        url += `&category=${selectedCategory}`;
      }
      
      if (selectedStatus) {
        url += `&status=${selectedStatus}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.policies || data);
        setTotalPolicies(data.total || data.length);
      } else {
        showNotification('error', 'Load Failed', 'Failed to load policies. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
      showNotification('error', 'Network Error', 'Unable to load policies. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPoliciesWithSearchLoading = async () => {
    if (!user) return;
    
    setSearchLoading(true);
    try {
      let url = `/api/policies?page=${currentPage}&limit=${itemsPerPage}`;
      
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      
      if (selectedCategory) {
        url += `&category=${selectedCategory}`;
      }
      
      if (selectedStatus) {
        url += `&status=${selectedStatus}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.policies || data);
        setTotalPolicies(data.total || data.length);
      } else {
        showNotification('error', 'Load Failed', 'Failed to load policies. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
      showNotification('error', 'Network Error', 'Unable to load policies. Please check your connection and try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleStatusSelect = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSelectedCategory('');
    setSelectedStatus('');
    setSearchQuery('');
    setLocalSearchQuery('');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalPolicies / itemsPerPage);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      } else {
        showNotification('error', 'Load Failed', 'Failed to load employees.');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      showNotification('error', 'Network Error', 'Unable to load employees.');
    }
  };

  const handleCreatePolicy = async (policyData: any) => {
    try {
      if (editingPolicy) {
        const response = await fetch(`/api/policies?id=${editingPolicy.id}&updatedBy=system`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(policyData),
        });

        if (response.ok) {
          const updatedPolicy = await response.json();
          setPolicies(policies.map(policy => policy.id === editingPolicy.id ? updatedPolicy : policy));
          setShowForm(false);
          setEditingPolicy(null);
          showNotification('success', 'Policy Updated', 'Policy has been successfully updated.');
        } else {
          const errorData = await response.json();
          showNotification('error', 'Update Failed', errorData.error || 'Failed to update policy');
        }
      } else {
        const response = await fetch('/api/policies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(policyData),
        });

        if (response.ok) {
          const newPolicy = await response.json();
          setPolicies([newPolicy, ...policies]);
          setShowForm(false);
          showNotification('success', 'Policy Created', 'Policy has been successfully created.');
        } else {
          const errorData = await response.json();
          showNotification('error', 'Creation Failed', errorData.error || 'Failed to create policy');
        }
      }
    } catch (error) {
      console.error('Error saving policy:', error);
      showNotification('error', 'Network Error', 'Unable to save policy. Please check your connection and try again.');
    }
  };

  const handleEditPolicy = (policy: Policy) => {
    if (policy.status === 'REJECTED') {
      showNotification('warning', 'Cannot Edit', 'Rejected policies cannot be edited. Use "Create New Version" to create a new policy based on this one.');
      return;
    }
    
    setEditingPolicy(policy);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingPolicy(null);
  };

  const handleDeletePolicy = async (id: string) => {
    try {
      const response = await fetch(`/api/policies?id=${id}&deletedBy=system`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPolicies(policies.filter(policy => policy.id !== id));
        setDeleteConfirm(null);
        showNotification('success', 'Policy Deleted', 'Policy has been successfully deleted.');
      } else {
        const errorData = await response.json();
        showNotification('error', 'Deletion Failed', errorData.error || 'Failed to delete policy');
      }
    } catch (error) {
      console.error('Error deleting policy:', error);
      showNotification('error', 'Network Error', 'Unable to delete policy. Please check your connection and try again.');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'HR':
        return <Users className="h-4 w-4" />;
      case 'IT':
        return <Settings className="h-4 w-4" />;
      case 'SECURITY':
        return <Shield className="h-4 w-4" />;
      case 'COMPLIANCE':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Edit className="h-4 w-4 text-gray-500" />;
      case 'IN_PROGRESS':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'REVIEW':
        return <Eye className="h-4 w-4 text-yellow-500" />;
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'PUBLISHED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'REVIEW':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTED':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'PUBLISHED':
        return 'bg-green-50 text-green-700 border-green-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'HR':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'IT':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'SECURITY':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'COMPLIANCE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const activeFiltersCount = [selectedCategory, selectedStatus, localSearchQuery].filter(Boolean).length;

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={['CEO', 'CTO', 'HR', 'MANAGER', 'HR_MANAGER', 'ENGINEERING_MANAGER']}>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <div className="text-lg text-gray-600">Loading policies...</div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['CEO', 'CTO', 'HR', 'MANAGER', 'HR_MANAGER', 'ENGINEERING_MANAGER']}>
      <div className="min-h-screen bg-gray-50">
      {NotificationComponent}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                Policy Management
              </h1>
              <p className="mt-2 text-gray-600">
                {user && (user.role === 'CEO' || user.role === 'CTO') 
                  ? 'Create, manage, and publish company policies across different categories.'
                  : 'Create and manage your own policies. CEO and CTO can view all policies.'
                }
              </p>
            </div>
            
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create Policy
            </button>
          </div>
        </div>

        {/* Policy Workflow Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-1 bg-blue-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-2">Policy Workflow Process</h4>
              <div className="text-sm text-blue-800 space-y-2">
                <p className="font-medium">
                  Workflow: DRAFT → IN_PROGRESS → REVIEW → [APPROVED/REJECTED] → PUBLISHED
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-blue-700">
                  <div>• <strong>DRAFT/IN_PROGRESS:</strong> You can edit and modify policies</div>
                  <div>• <strong>REVIEW:</strong> Automatically creates approval workflow</div>
                  <div>• <strong>APPROVED/REJECTED:</strong> Set automatically by approval workflow</div>
                  <div>• <strong>PUBLISHED:</strong> Live policy - contact administrator for changes</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <ElegantSearch
                placeholder="Search policies by title, category, or content..."
                value={localSearchQuery}
                onChange={setLocalSearchQuery}
                onSearch={handleSearch}
                size="md"
                className="w-full"
                debounceMs={500}
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="bg-indigo-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Expandable Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Policy Category
                  </label>
                  <ElegantSelect
                    options={[
                      { value: '', label: 'All categories' },
                      { 
                        value: 'HR', 
                        label: 'HR',
                        icon: <Users className="h-4 w-4 text-purple-600" />,
                        description: 'Human Resources policies'
                      },
                      { 
                        value: 'IT', 
                        label: 'IT',
                        icon: <Settings className="h-4 w-4 text-indigo-600" />,
                        description: 'Information Technology policies'
                      },
                      { 
                        value: 'SECURITY', 
                        label: 'Security',
                        icon: <Shield className="h-4 w-4 text-red-600" />,
                        description: 'Security and privacy policies'
                      },
                      { 
                        value: 'COMPLIANCE', 
                        label: 'Compliance',
                        icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
                        description: 'Regulatory compliance policies'
                      }
                    ]}
                    value={selectedCategory}
                    onChange={handleCategorySelect}
                    placeholder="All categories"
                    showClearButton={true}
                    className="w-full"
                    size="md"
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Policy Status
                  </label>
                  <ElegantSelect
                    options={[
                      { value: '', label: 'All statuses' },
                      { 
                        value: 'DRAFT', 
                        label: 'Draft',
                        icon: <Edit className="h-4 w-4 text-gray-600" />,
                        description: 'Policy is being drafted'
                      },
                      { 
                        value: 'IN_PROGRESS', 
                        label: 'In Progress',
                        icon: <Clock className="h-4 w-4 text-blue-600" />,
                        description: 'Policy is being actively worked on'
                      },
                      { 
                        value: 'REVIEW', 
                        label: 'Under Review',
                        icon: <Eye className="h-4 w-4 text-yellow-600" />,
                        description: 'Policy is under review'
                      },
                      { 
                        value: 'APPROVED', 
                        label: 'Approved',
                        icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
                        description: 'Policy has been approved'
                      },
                      { 
                        value: 'REJECTED', 
                        label: 'Rejected',
                        icon: <XCircle className="h-4 w-4 text-red-600" />,
                        description: 'Policy was rejected'
                      },
                      { 
                        value: 'PUBLISHED', 
                        label: 'Published',
                        icon: <CheckCircle className="h-4 w-4 text-green-600" />,
                        description: 'Policy is live and in effect'
                      }
                    ]}
                    value={selectedStatus}
                    onChange={handleStatusSelect}
                    placeholder="All statuses"
                    showClearButton={true}
                    className="w-full"
                    size="md"
                  />
                </div>

                {/* Clear Filters */}
                <div className="flex items-end">
                  <button
                    onClick={clearAllFilters}
                    disabled={activeFiltersCount === 0}
                    className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-indigo-900">Active filters:</span>
                {selectedCategory && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md text-xs font-medium text-indigo-700 border border-indigo-200">
                    {getCategoryIcon(selectedCategory)}
                    {selectedCategory}
                    <span
                      onClick={() => handleCategorySelect('')}
                      className="ml-1 hover:text-indigo-900 cursor-pointer"
                    >
                      <XCircle className="h-3 w-3" />
                    </span>
                  </span>
                )}
                {selectedStatus && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md text-xs font-medium text-indigo-700 border border-indigo-200">
                    {getStatusIcon(selectedStatus)}
                    {selectedStatus}
                    <span
                      onClick={() => handleStatusSelect('')}
                      className="ml-1 hover:text-indigo-900 cursor-pointer"
                    >
                      <XCircle className="h-3 w-3" />
                    </span>
                  </span>
                )}
                {localSearchQuery && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md text-xs font-medium text-indigo-700 border border-indigo-200">
                    <Search className="h-3 w-3" />
                    "{localSearchQuery}"
                    <span
                      onClick={() => {
                        setLocalSearchQuery('');
                        handleSearch('');
                      }}
                      className="ml-1 hover:text-indigo-900 cursor-pointer"
                    >
                      <XCircle className="h-3 w-3" />
                    </span>
                  </span>
                )}
                <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">
                  {totalPolicies} result{totalPolicies !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={clearAllFilters}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* Policies Grid */}
        <div className="relative">
          {/* Loading Overlay for Search/Filter */}
          {searchLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
              <div className="flex flex-col items-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <div className="text-sm text-gray-600">Searching policies...</div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {policies.map((policy) => (
              <div key={policy.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden">
                {/* Card Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${getCategoryColor(policy.category).replace('border-', 'bg-').replace('text-', 'text-')}`}>
                      {getCategoryIcon(policy.category)}
                    </div>
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(policy.status)}`}>
                      {getStatusIcon(policy.status)}
                      {policy.status}
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 text-lg mb-1 line-clamp-1">
                    {policy.title}
                  </h3>
                  
                  <p className="text-sm text-gray-500 mb-2">
                    Version {policy.version} • by {policy.owner?.name || 'Unknown'}
                  </p>
                  
                  {/* Show ownership indicator for non-CEO/CTO users */}
                  {user && user.role !== 'CEO' && user.role !== 'CTO' && policy.owner?.id === user.id && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-200">
                      <CheckCircle className="h-3 w-3" />
                      Your Policy
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Status-specific notices */}
                  {policy.status === 'REVIEW' && (
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm text-yellow-800 font-medium">Under Review</span>
                      </div>
                      <p className="text-xs text-yellow-700 mt-1">
                        Approval workflow is active. Waiting for manager approval.
                      </p>
                    </div>
                  )}

                  {policy.status === 'REJECTED' && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-800 font-medium">Policy Rejected</span>
                      </div>
                      <p className="text-xs text-red-700 mt-1">
                        This policy was rejected during review. Create a new version to make revisions.
                      </p>
                    </div>
                  )}

                  {policy.status === 'APPROVED' && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm text-emerald-800 font-medium">Policy Approved</span>
                      </div>
                      <p className="text-xs text-emerald-700 mt-1">
                        Ready to be published. Contact administrator to publish.
                      </p>
                    </div>
                  )}

                  {/* File Information */}
                  {policy.filePath && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span className="text-xs text-blue-700 truncate">
                            {policy.fileName}
                          </span>
                        </div>
                        <a
                          href={policy.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0 ml-2"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </a>
                      </div>
                      {policy.fileSize && (
                        <p className="text-xs text-blue-600 mt-1">
                          {(policy.fileSize / 1024 / 1024).toFixed(2)} MB
                        </p>
                      )}
                    </div>
                  )}

                  {/* Content Preview (only if no file) */}
                  {!policy.filePath && policy.content && (
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {policy.content.substring(0, 150)}...
                      </p>
                    </div>
                  )}

                  {/* Key Details */}
                  <div className="space-y-2">
                    {policy.effectiveDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">
                          Effective {new Date(policy.effectiveDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {policy.expiryDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className={`${new Date(policy.expiryDate) < new Date() ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          Expires {new Date(policy.expiryDate).toLocaleDateString()}
                          {new Date(policy.expiryDate) < new Date() && ' (Expired)'}
                        </span>
                      </div>
                    )}
                    {policy.reviewDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className={`${new Date(policy.reviewDate) < new Date() ? 'text-amber-600 font-medium' : 'text-gray-600'}`}>
                          Review due {new Date(policy.reviewDate).toLocaleDateString()}
                          {new Date(policy.reviewDate) < new Date() && ' (Overdue)'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Updated {new Date(policy.updatedAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Only CEO and CTO can view policy details */}
                    {user && (user.role === 'CEO' || user.role === 'CTO') && (
                      <button
                        onClick={() => setSelectedPolicy(policy)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </button>
                    )}
                    
                    {(policy.status === "IN_PROGRESS" || policy.status === "DRAFT" || policy.status === "REVIEW") && (
                      <button
                        onClick={() => handleEditPolicy(policy)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                    )}
                    
                    {/* Only allow deletion of DRAFT, IN_PROGRESS, and REJECTED policies */}
                    {['DRAFT', 'IN_PROGRESS', 'REJECTED'].includes(policy.status) && (
                      <button
                        onClick={() => setDeleteConfirm(policy.id)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalPolicies}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
        )}

        {/* Empty State */}
        {policies.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeFiltersCount > 0 ? 'No policies match your filters' : 
                (user && (user.role === 'CEO' || user.role === 'CTO') 
                  ? 'No policies in the system'
                  : 'No policies created by you'
                )
              }
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {activeFiltersCount > 0
                ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                : (user && (user.role === 'CEO' || user.role === 'CTO') 
                    ? 'Get started by creating the first company policy.'
                    : 'Get started by creating your first policy.'
                  )
              }
            </p>
            {activeFiltersCount > 0 ? (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-2 px-4 py-2 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Clear all filters
              </button>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create your first policy
              </button>
            )}
          </div>
        )}

        {/* Modals */}
        {showForm && (
          <PolicyForm
            onSubmit={handleCreatePolicy}
            onCancel={handleCancelForm}
            editingPolicy={editingPolicy}
            isEditing={!!editingPolicy}
          />
        )}

        {selectedPolicy && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-4/5 xl:w-3/4 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
              <div className="mt-3">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{selectedPolicy.title}</h3>
                    <p className="text-sm text-gray-500">
                      Version {selectedPolicy.version} • by {selectedPolicy.owner?.name || 'Unknown'} • {selectedPolicy.owner?.department || 'No Department'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPolicy(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="flex space-x-2 mb-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full border ${getCategoryColor(selectedPolicy.category)}`}>
                    {getCategoryIcon(selectedPolicy.category)}
                    {selectedPolicy.category}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(selectedPolicy.status)}`}>
                    {getStatusIcon(selectedPolicy.status)}
                    {selectedPolicy.status}
                  </span>
                </div>

                {/* Main content in two columns */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left column - Policy details */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Version and Change Summary */}
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-800 mb-2">Version Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Current Version:</span>
                          <span className="ml-2 text-gray-900 font-semibold">v{selectedPolicy.version}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Status:</span>
                          <span className={`ml-2 inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(selectedPolicy.status)}`}>
                            {getStatusIcon(selectedPolicy.status)}
                            {selectedPolicy.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-600 flex items-start gap-2">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        View the Activity Timeline on the right to see detailed change history, including what was modified, when, and by whom.
                      </div>
                    </div>

                    {/* Timeframe Information */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-800 mb-2">Policy Timeline</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <span className="ml-2 text-gray-900">{new Date(selectedPolicy.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Last Updated:</span>
                          <span className="ml-2 text-gray-900">{new Date(selectedPolicy.updatedAt).toLocaleDateString()}</span>
                        </div>
                        {selectedPolicy.effectiveDate && (
                          <div>
                            <span className="text-gray-500">Effective Date:</span>
                            <span className="ml-2 text-gray-900">{new Date(selectedPolicy.effectiveDate).toLocaleDateString()}</span>
                          </div>
                        )}
                        {selectedPolicy.expiryDate && (
                          <div>
                            <span className="text-gray-500">Expiry Date:</span>
                            <span className={`ml-2 ${new Date(selectedPolicy.expiryDate) < new Date() ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                              {new Date(selectedPolicy.expiryDate).toLocaleDateString()}
                              {new Date(selectedPolicy.expiryDate) < new Date() && ' (Expired)'}
                            </span>
                          </div>
                        )}
                        {selectedPolicy.reviewDate && (
                          <div>
                            <span className="text-gray-500">Next Review:</span>
                            <span className={`ml-2 ${new Date(selectedPolicy.reviewDate) < new Date() ? 'text-orange-600 font-medium' : 'text-gray-900'}`}>
                              {new Date(selectedPolicy.reviewDate).toLocaleDateString()}
                              {new Date(selectedPolicy.reviewDate) < new Date() && ' (Due)'}
                            </span>
                          </div>
                        )}
                        {selectedPolicy.lastReviewDate && (
                          <div>
                            <span className="text-gray-500">Last Reviewed:</span>
                            <span className="ml-2 text-gray-900">{new Date(selectedPolicy.lastReviewDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* File Information */}
                    {selectedPolicy.filePath ? (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-800 mb-2">Policy Document</h4>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="text-sm font-medium text-blue-900">{selectedPolicy.fileName}</p>
                              {selectedPolicy.fileSize && (
                                <p className="text-xs text-blue-700">
                                  {(selectedPolicy.fileSize / 1024 / 1024).toFixed(2)} MB
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <a
                              href={selectedPolicy.filePath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1 border border-blue-300 text-xs font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </a>
                            <a
                              href={selectedPolicy.filePath}
                              download={selectedPolicy.fileName}
                              className="inline-flex items-center gap-1 px-3 py-1 border border-blue-300 text-xs font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100"
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : selectedPolicy.content && (
                      <div className="prose max-w-none">
                        <h4 className="text-sm font-medium text-gray-800 mb-2">Policy Content</h4>
                        <div className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                          {selectedPolicy.content}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right column - Activity Timeline */}
                  <div className="lg:col-span-1">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-800 mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                        Activity Timeline
                      </h4>
                      <div className="max-h-96 overflow-y-auto">
                        <PolicyChangeHistory 
                          policyId={selectedPolicy.id}
                          policyTitle={selectedPolicy.title}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mt-2">Delete Policy</h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete this policy? This action cannot be undone.
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
                    onClick={() => handleDeletePolicy(deleteConfirm)}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </ProtectedRoute>
  );
}