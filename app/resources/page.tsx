'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserPermissions } from '@/lib/permissions';
import ResourceForm from '@/components/ResourceForm';
import ResourceDetails from '@/components/ResourceDetails';
import ResourceAssignmentModal from '@/components/ResourceAssignmentModal';
import ProtectedRoute from '@/components/ProtectedRoute';
import Pagination from '@/components/Pagination';
import { useNotification } from '@/components/Notification';
import ElegantSelect from '@/components/ElegantSelect';
import ElegantSearch from '@/components/ElegantSearch';
import { 
  Monitor, 
  Cloud, 
  Code, 
  Server, 
  Plus, 
  Filter, 
  Search,
  Eye,
  Calendar,
  DollarSign,
  MapPin,
  User,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Users,
  Package
} from 'lucide-react';

interface Resource {
  id: string;
  name: string;
  type: 'PHYSICAL' | 'SOFTWARE' | 'CLOUD';
  status: 'ACTIVE' | 'RETURNED' | 'LOST' | 'DAMAGED';
  category?: string;
  description?: string;
  
  // New quantity management fields
  owner: string; // Company name (e.g., "Unisouk")
  custodian: {
    id: string;
    name: string;
    role: string;
  };
  totalQuantity: number;
  allocatedQuantity: number;
  availableQuantity: number;
  
  // Current assignments
  currentAssignments: Array<{
    id: string;
    employee: {
      id: string;
      name: string;
      email: string;
      department: string;
      role: string;
    };
    quantityAssigned: number;
    assignedAt: string;
  }>;
  
  // Asset details
  createdAt: string;
  updatedAt: string;
  value?: number;
  monthlyRate?: number;
  annualRate?: number;
  serialNumber?: string;
  modelNumber?: string;
  brand?: string;
  location?: string;
  softwareVersion?: string;
  provider?: string;
  serviceLevel?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
}

export default function ResourcesPage() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false); // Separate loading state for search/filters
  const [viewMode, setViewMode] = useState<'all' | 'own'>('all');
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string; department: string; role: string }>>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedResourceType, setSelectedResourceType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [localSearchQuery, setLocalSearchQuery] = useState<string>(''); // For immediate UI updates
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [totalResources, setTotalResources] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isRestrictedView, setIsRestrictedView] = useState(false); // Track if user has restricted view

  const permissions = user ? getUserPermissions(user.role as any) : null;
  const { showNotification, NotificationComponent } = useNotification();

  useEffect(() => {
    if (user) {
      // Only show full page loading on initial load
      if (resources.length === 0) {
        fetchResources();
      } else {
        // For subsequent searches/filters, use search loading
        fetchResourcesWithSearchLoading();
      }
    }
  }, [user, viewMode, currentPage, itemsPerPage, selectedEmployeeId, selectedResourceType, searchQuery]);

  useEffect(() => {
    if (user && (user.role === 'CEO' || user.role === 'CTO') && employees.length === 0) {
      fetchEmployees();
    }
  }, [user?.role]);

  const fetchEmployees = async () => {
    if (loadingEmployees) return;
    
    setLoadingEmployees(true);
    try {
      const response = await fetch('/api/employees?page=1&limit=1000');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      showNotification('error', 'Load Failed', 'Unable to load employees for filtering');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchResources = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let url = `/api/resources?page=${currentPage}&limit=${itemsPerPage}`;
      
      if (selectedEmployeeId) {
        url += `&assignedTo=${selectedEmployeeId}`;
      } else if (viewMode === 'own') {
        url += `&assignedTo=${user.id}`;
      }
      
      if (selectedResourceType) {
        url += `&type=${selectedResourceType}`;
      }

      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setResources(data.resources || data);
        setTotalResources(data.pagination?.total || data.total || data.length);
        setTotalPages(data.pagination?.totalPages || Math.ceil((data.pagination?.total || data.total || data.length) / itemsPerPage));
        setIsRestrictedView(data.isRestrictedView || false);
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
      showNotification('error', 'Load Failed', 'Unable to load resources. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchResourcesWithSearchLoading = async () => {
    if (!user) return;
    
    setSearchLoading(true);
    try {
      let url = `/api/resources?page=${currentPage}&limit=${itemsPerPage}`;
      
      if (selectedEmployeeId) {
        url += `&assignedTo=${selectedEmployeeId}`;
      } else if (viewMode === 'own') {
        url += `&assignedTo=${user.id}`;
      }
      
      if (selectedResourceType) {
        url += `&type=${selectedResourceType}`;
      }

      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setResources(data.resources || data);
        setTotalResources(data.pagination?.total || data.total || data.length);
        setTotalPages(data.pagination?.totalPages || Math.ceil((data.pagination?.total || data.total || data.length) / itemsPerPage));
        setIsRestrictedView(data.isRestrictedView || false);
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
      showNotification('error', 'Load Failed', 'Unable to load resources. Please try again.');
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

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setCurrentPage(1);
    setViewMode('all');
  };

  const handleViewModeChange = (mode: 'all' | 'own') => {
    setViewMode(mode);
    setSelectedEmployeeId('');
    setSelectedResourceType('');
    setSearchQuery('');
    setLocalSearchQuery('');
    setCurrentPage(1);
  };

  const handleResourceTypeSelect = (resourceType: string) => {
    setSelectedResourceType(resourceType);
    setCurrentPage(1);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSelectedEmployeeId('');
    setSelectedResourceType('');
    setSearchQuery('');
    setLocalSearchQuery('');
    setViewMode('all');
    setCurrentPage(1);
  };

  const handleCreateResource = async (resourceData: any) => {
    try {
      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resourceData),
      });

      if (response.ok) {
        const newResource = await response.json();
        setResources([newResource, ...resources]);
        setShowForm(false);
        showNotification('success', 'Resource Created', `${newResource.name} has been successfully created.`);
        fetchResources();
      } else {
        const errorData = await response.json();
        console.error('Failed to create resource:', errorData);
        showNotification('error', 'Creation Failed', errorData.error || 'Failed to create resource. Please try again.');
      }
    } catch (error) {
      console.error('Error creating resource:', error);
      showNotification('error', 'Network Error', 'Unable to create resource. Please check your connection and try again.');
    }
  };

  const handleViewDetails = (resource: Resource) => {
    setSelectedResource(resource);
    setShowDetails(true);
  };

  const handleCloseDetails = () => {
    setSelectedResource(null);
    setShowDetails(false);
  };

  const handleManageAssignments = (resource: Resource) => {
    setSelectedResource(resource);
    setShowAssignmentModal(true);
  };

  const handleCloseAssignmentModal = () => {
    setSelectedResource(null);
    setShowAssignmentModal(false);
  };

  const handleAssignmentChange = () => {
    // Refresh resources data when assignments change
    fetchResources();
    
    // Show a subtle loading indicator
    setSearchLoading(true);
    setTimeout(() => {
      setSearchLoading(false);
    }, 500);
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'PHYSICAL':
        return <Monitor className="h-5 w-5" />;
      case 'SOFTWARE':
        return <Code className="h-5 w-5" />;
      case 'CLOUD':
        return <Cloud className="h-5 w-5" />;
      default:
        return <Server className="h-5 w-5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'RETURNED':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'LOST':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'DAMAGED':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'RETURNED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'LOST':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'DAMAGED':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PHYSICAL':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'SOFTWARE':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'CLOUD':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const activeFiltersCount = [selectedEmployeeId, selectedResourceType, localSearchQuery].filter(Boolean).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <div className="text-lg text-gray-600">Loading resources...</div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      {NotificationComponent}
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Server className="h-6 w-6 text-indigo-600" />
                  </div>
                  {permissions?.canViewAllResources ? 'Resource Management' : 'My Resources'}
                </h1>
                <p className="mt-2 text-gray-600">
                  {permissions?.canViewAllResources 
                    ? 'Manage company resources including physical assets, software, and cloud services.'
                    : 'View your assigned resources and request access to additional resources.'
                  }
                </p>
              </div>
              
              {permissions?.canAddResource && (
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Resource
                </button>
              )}
            </div>
          </div>

          {/* Search and Filters Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <ElegantSearch
                  placeholder="Search resources by name, category, or description..."
                  value={localSearchQuery}
                  onChange={setLocalSearchQuery}
                  onSearch={handleSearch}
                  size="md"
                  className="w-full"
                  debounceMs={500}
                />
              </div>

              {/* View Mode Toggle */}
              {permissions?.canViewAllResources && (
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => handleViewModeChange('all')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'all' && !selectedEmployeeId
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    All Resources
                  </button>
                  <button
                    onClick={() => handleViewModeChange('own')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'own'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    My Resources
                  </button>
                </div>
              )}

              {/* Filter Toggle */}
             {permissions?.canViewAllResources && <button
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
              </button>}
            </div>

            {/* Expandable Filters */}
            {showFilters && permissions?.canViewAllResources && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Employee Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Employee
                    </label>
                    <ElegantSelect
                      options={[
                        { value: '', label: loadingEmployees ? 'Loading employees...' : 'All employees' },
                        ...employees.map((employee) => ({
                          value: employee.id,
                          label: employee.name,
                          description: `${employee.role.replace(/_/g, ' ')} • ${employee.department}`,
                          icon: (
                            <div className="h-4 w-4 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center">
                              <span className="text-xs font-medium text-white">
                                {employee.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )
                        }))
                      ]}
                      value={selectedEmployeeId}
                      onChange={handleEmployeeSelect}
                      placeholder="All employees"
                      disabled={loadingEmployees}
                      searchable={true}
                      showClearButton={true}
                      className="w-full"
                      size="md"
                    />
                  </div>

                  {/* Resource Type Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resource Type
                    </label>
                    <ElegantSelect
                      options={[
                        { value: '', label: 'All types' },
                        { 
                          value: 'PHYSICAL', 
                          label: 'Physical',
                          icon: <Monitor className="h-4 w-4 text-purple-600" />,
                          description: 'Hardware, equipment, devices'
                        },
                        { 
                          value: 'SOFTWARE', 
                          label: 'Software',
                          icon: <Code className="h-4 w-4 text-indigo-600" />,
                          description: 'Applications, licenses, tools'
                        },
                        { 
                          value: 'CLOUD', 
                          label: 'Cloud',
                          icon: <Cloud className="h-4 w-4 text-sky-600" />,
                          description: 'AWS, Azure, SaaS services'
                        }
                      ]}
                      value={selectedResourceType}
                      onChange={handleResourceTypeSelect}
                      placeholder="All types"
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
                  {selectedEmployeeId && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md text-xs font-medium text-indigo-700 border border-indigo-200">
                      <User className="h-3 w-3" />
                      {employees.find(emp => emp.id === selectedEmployeeId)?.name}
                      <span
                        onClick={() => handleEmployeeSelect('')}
                        className="ml-1 hover:text-indigo-900 cursor-pointer"
                      >
                        <XCircle className="h-3 w-3" />
                      </span>
                    </span>
                  )}
                  {selectedResourceType && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md text-xs font-medium text-indigo-700 border border-indigo-200">
                      {getResourceIcon(selectedResourceType)}
                      {selectedResourceType}
                      <span
                        onClick={() => handleResourceTypeSelect('')}
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
                    {totalResources} result{totalResources !== 1 ? 's' : ''}
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

          {/* Resources Grid */}
          <div className="relative">
            {/* Loading Overlay for Search/Filter */}
            {searchLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                <div className="flex flex-col items-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <div className="text-sm text-gray-600">Searching resources...</div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resources.map((resource) => (
              <div key={resource.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden">
                {/* Card Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${getTypeColor(resource.type).replace('border-', 'bg-').replace('text-', 'text-')}`}>
                      {getResourceIcon(resource.type)}
                    </div>
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(resource.status)}`}>
                      {getStatusIcon(resource.status)}
                      {resource.status}
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 text-lg mb-1 line-clamp-1">
                    {resource.name}
                  </h3>
                  
                  {resource.category && (
                    <p className="text-sm text-gray-500 mb-2">{resource.category}</p>
                  )}
                  
                  {resource.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{resource.description}</p>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Quantity Management Info */}
                  <div className="space-y-2">
                    {/* Owner & Custodian */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Owner:</span>
                      <span className="font-medium text-gray-900">{resource.owner}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Custodian:</span>
                      <span className="font-medium text-gray-900">{resource.custodian.name}</span>
                    </div>
                    
                    {/* Quantity Display */}
                   { permissions?.canAddResource  && <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Inventory</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            resource.availableQuantity > 0 ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <span className={`text-xs font-medium ${
                            resource.availableQuantity > 0 ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {resource.availableQuantity > 0 ? 'Available' : 'Fully Allocated'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-lg font-bold text-gray-900">{resource.totalQuantity}</div>
                          <div className="text-xs text-gray-500">Total</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-blue-600">{resource.allocatedQuantity}</div>
                          <div className="text-xs text-gray-500">Allocated</div>
                        </div>
                        <div>
                          <div className={`text-lg font-bold ${
                            resource.availableQuantity > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {resource.availableQuantity}
                          </div>
                          <div className="text-xs text-gray-500">Available</div>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${resource.totalQuantity > 0 ? (resource.allocatedQuantity / resource.totalQuantity) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>}
                  </div>

                  {/* Current Assignments */}
                  {resource.currentAssignments.length > 0 && permissions?.canAddResource && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">
                          Current Assignments ({resource.currentAssignments.length})
                        </span>
                      </div>
                      <div className="space-y-1 max-h-20 overflow-y-auto">
                        {resource.currentAssignments.slice(0, 3).map((assignment) => (
                          <div key={assignment.id} className="flex items-center justify-between text-xs bg-blue-50 rounded px-2 py-1">
                            <span className="font-medium text-blue-900 truncate">
                              {user && (user.role === 'CEO' || user.role === 'CTO') 
                                ? assignment.employee.name 
                                : assignment.employee.id === user?.id 
                                  ? 'You' 
                                  : 'Assigned'
                              }
                            </span>
                            <span className="text-blue-600 font-medium">
                              {assignment.quantityAssigned}
                            </span>
                          </div>
                        ))}
                        {resource.currentAssignments.length > 3 && (
                          <div className="text-xs text-gray-500 text-center py-1">
                            +{resource.currentAssignments.length - 3} more assignments
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Key Details */}
                  {/* <div className="space-y-2">
                    {resource.type === 'PHYSICAL' && (
                      <>
                        {resource.brand && resource.modelNumber && (
                          <div className="flex items-center gap-2 text-sm">
                            <Settings className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600 truncate">{resource.brand} {resource.modelNumber}</span>
                          </div>
                        )}
                        {resource.location && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600 truncate">{resource.location}</span>
                          </div>
                        )}
                        {resource.value && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-900 font-medium">${resource.value.toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}

                    {resource.type === 'SOFTWARE' && (
                      <>
                        {resource.provider && (
                          <div className="flex items-center gap-2 text-sm">
                            <Settings className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600 truncate">{resource.provider}</span>
                          </div>
                        )}
                        {resource.softwareVersion && (
                          <div className="flex items-center gap-2 text-sm">
                            <Code className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600 truncate">v{resource.softwareVersion}</span>
                          </div>
                        )}
                        {resource.annualRate && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-900 font-medium">${resource.annualRate.toLocaleString()}/year</span>
                          </div>
                        )}
                      </>
                    )}

                    {resource.type === 'CLOUD' && (
                      <>
                        {resource.provider && (
                          <div className="flex items-center gap-2 text-sm">
                            <Cloud className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600 truncate">{resource.provider}</span>
                          </div>
                        )}
                        {resource.serviceLevel && (
                          <div className="flex items-center gap-2 text-sm">
                            <Server className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600 truncate">{resource.serviceLevel}</span>
                          </div>
                        )}
                        {resource.monthlyRate && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-900 font-medium">${resource.monthlyRate.toLocaleString()}/month</span>
                          </div>
                        )}
                      </>
                    )}

                    {resource.expiryDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className={`${new Date(resource.expiryDate) < new Date() ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          Expires {new Date(resource.expiryDate).toLocaleDateString()}
                          {new Date(resource.expiryDate) < new Date() && ' (Expired)'}
                        </span>
                      </div>
                    )}
                  </div> */}
                </div>

                {/* Card Footer */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Created {new Date(resource.createdAt).toLocaleDateString()}
                  </div>
                  {user && (user.role === 'CEO' || user.role === 'CTO') && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleManageAssignments(resource)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        <Users className="h-4 w-4" />
                        Manage
                      </button>
                      <button 
                        onClick={() => handleViewDetails(resource)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-700 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </button>
                    </div>
                  )}
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
                totalItems={totalResources}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </div>
          )}

          {/* Empty State */}
          {resources.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Server className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {isRestrictedView 
                  ? (activeFiltersCount > 0 ? 'No assigned resources match your search' : 'No resources assigned to you')
                  : (activeFiltersCount > 0 ? 'No resources match your filters' : 'No resources found')
                }
              </h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                {isRestrictedView
                  ? (activeFiltersCount > 0
                      ? 'Try adjusting your search terms to find your assigned resources.'
                      : 'You don\'t have any resources assigned to you yet. Contact your manager or request access to resources you need.'
                    )
                  : (activeFiltersCount > 0
                      ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                      : 'Get started by adding your first resource to the system.'
                    )
                }
              </p>
              {activeFiltersCount > 0 ? (
                <button
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Clear search
                </button>
              ) : (
                <>
                  {isRestrictedView ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">Need access to resources?</p>
                      <button
                        onClick={() => window.location.href = '/access'}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Request Resource Access
                      </button>
                    </div>
                  ) : permissions?.canAddResource && (
                    <button
                      onClick={() => setShowForm(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add your first resource
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Modals */}
          {showForm && permissions?.canAddResource && (
            <ResourceForm
              onSubmit={handleCreateResource}
              onCancel={() => setShowForm(false)}
            />
          )}

          {showDetails && selectedResource && (
            <ResourceDetails
              resource={selectedResource}
              isOpen={showDetails}
              onClose={handleCloseDetails}
            />
          )}

          {showAssignmentModal && selectedResource && (
            <ResourceAssignmentModal
              resource={selectedResource}
              isOpen={showAssignmentModal}
              onClose={handleCloseAssignmentModal}
              onAssignmentChange={handleAssignmentChange}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}