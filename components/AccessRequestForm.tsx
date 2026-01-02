'use client';

import { useState, useEffect } from 'react';
import { useNotification } from './Notification';
import { useAuth } from '@/contexts/AuthContext';
import ElegantSelect from './ElegantSelect';

interface ResourceType {
  id: string;
  name: string;
  description?: string;
}

interface Resource {
  id: string;
  name: string;
  type: string;
  category?: string;
  description?: string;
  resourceTypeEntity?: {
    id: string;
    name: string;
  } | null;
  resourceTypeName?: string;
}

interface AccessRequestFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function AccessRequestForm({ onSubmit, onCancel }: AccessRequestFormProps) {
  const { showNotification } = useNotification();
  const { user } = useAuth();
  const [accessibleEmployees, setAccessibleEmployees] = useState<Array<{ 
    id: string; 
    name: string; 
    email: string; 
    department: string; 
    role: string;
  }>>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [employeeAssignments, setEmployeeAssignments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [typesLoading, setTypesLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [formData, setFormData] = useState({
    employeeId: user?.id || '',
    resourceId: '',
    justification: ''
  });

  useEffect(() => {
    fetchAccessibleEmployees();
    fetchResources();
    fetchResourceTypes();
  }, []);

  useEffect(() => {
    if (user && !formData.employeeId) {
      setFormData(prev => ({ ...prev, employeeId: user.id }));
    }
  }, [user]);

  // Fetch employee's current assignments when employee changes
  useEffect(() => {
    if (formData.employeeId) {
      fetchEmployeeAssignments(formData.employeeId);
    }
  }, [formData.employeeId]);

  // Clear resource selection when type changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, resourceId: '' }));
  }, [selectedTypeId]);

  const fetchAccessibleEmployees = async () => {
    try {
      const response = await fetch('/api/employees/accessible');
      if (response.ok) {
        const employees = await response.json();
        setAccessibleEmployees(employees);
      } else {
        console.error('Failed to fetch accessible employees');
      }
    } catch (error) {
      console.error('Error fetching accessible employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    setResourcesLoading(true);
    try {
      const response = await fetch('/api/resources?page=1&limit=1000&forAccessRequest=true');
      if (response.ok) {
        const data = await response.json();
        const resourcesArray = data.resources || data;
        setResources(Array.isArray(resourcesArray) ? resourcesArray : []);
      } else {
        console.error('Failed to fetch resources');
        showNotification('error', 'Load Failed', 'Unable to load available resources');
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
      showNotification('error', 'Network Error', 'Unable to load resources. Please try again.');
    } finally {
      setResourcesLoading(false);
    }
  };

  const fetchResourceTypes = async () => {
    setTypesLoading(true);
    try {
      const response = await fetch('/api/resource-types');
      if (response.ok) {
        const data = await response.json();
        setResourceTypes(data.types || []);
      } else {
        console.error('Failed to fetch resource types');
      }
    } catch (error) {
      console.error('Error fetching resource types:', error);
    } finally {
      setTypesLoading(false);
    }
  };

  const fetchEmployeeAssignments = async (employeeId: string) => {
    setAssignmentsLoading(true);
    try {
      const response = await fetch(`/api/resources/assignments?employeeId=${employeeId}&status=ACTIVE`);
      if (response.ok) {
        const data = await response.json();
        const assignments = data.assignments || data;
        // Extract resource IDs that are already assigned to this employee
        const assignedResourceIds = Array.isArray(assignments) 
          ? assignments.map((a: any) => a.resourceId)
          : [];
        setEmployeeAssignments(assignedResourceIds);
      }
    } catch (error) {
      console.error('Error fetching employee assignments:', error);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTypeId) {
      showNotification('warning', 'Selection Required', 'Please select a resource type.');
      return;
    }
    
    if (!formData.resourceId) {
      showNotification('warning', 'Selection Required', 'Please select a resource.');
      return;
    }
    
    if (!formData.justification.trim()) {
      showNotification('warning', 'Justification Required', 'Please provide a justification for your request.');
      return;
    }
    
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const selectedEmployee = accessibleEmployees.find(emp => emp.id === formData.employeeId);
  const isCurrentUser = selectedEmployee?.id === user?.id;

  // Get the display type name for a resource
  const getResourceTypeName = (resource: Resource): string => {
    return resource.resourceTypeEntity?.name || resource.resourceTypeName || resource.type;
  };

  // Filter resources by selected type and exclude already assigned ones
  const filteredResources = resources.filter(resource => {
    // Check if resource matches selected type
    const resourceTypeName = getResourceTypeName(resource);
    const selectedType = resourceTypes.find(t => t.id === selectedTypeId);
    
    if (!selectedType) return false;
    
    // Match by type name (handles both new and legacy types)
    const typeMatches = resourceTypeName === selectedType.name || 
      (selectedType.name === 'Hardware' && resource.type === 'PHYSICAL') ||
      (selectedType.name === 'Software' && resource.type === 'SOFTWARE') ||
      (selectedType.name === 'Cloud' && resource.type === 'CLOUD');
    
    // Exclude resources already assigned to the employee
    const notAlreadyAssigned = !employeeAssignments.includes(resource.id);
    
    return typeMatches && notAlreadyAssigned;
  });

  const selectedResource = resources.find(res => res.id === formData.resourceId);
  const selectedType = resourceTypes.find(t => t.id === selectedTypeId);

  // Build type options for dropdown
  const typeOptions = [
    { value: '', label: 'Select resource type', disabled: true },
    ...resourceTypes.map(type => ({
      value: type.id,
      label: type.name,
      description: type.description || undefined,
    })),
  ];

  // Build resource options for dropdown
  const resourceOptions = [
    { value: '', label: selectedTypeId ? 'Select a resource' : 'Select a type first', disabled: true },
    ...filteredResources.map(resource => ({
      value: resource.id,
      label: resource.name,
      description: resource.category ? `${resource.category}${resource.description ? ` - ${resource.description.substring(0, 40)}...` : ''}` : resource.description?.substring(0, 50),
    })),
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 overflow-y-auto h-full w-full z-40 flex items-center justify-center p-4">
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Request Access</h3>
              <p className="text-sm text-gray-600 mt-1">Select the resource type and resource you need access to.</p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Automated Approval Notice */}
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-semibold text-blue-900">Automated Approval Process</h4>
                <p className="text-sm text-blue-800 mt-1">
                  {isCurrentUser 
                    ? 'Your access request will be automatically sent to your manager for approval.'
                    : 'This access request will be sent to the appropriate manager for approval.'
                  }
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Employee Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Employee <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <div className="flex items-center justify-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                  <svg className="animate-spin h-5 w-5 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading employees...
                </div>
              ) : (
                <select
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  required
                  className="block w-full border border-gray-300 rounded-lg px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                >
                  <option value="">Select Employee</option>
                  {accessibleEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.department})
                      {employee.id === user?.id ? ' - You' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Resource Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Resource Type <span className="text-red-500">*</span>
              </label>
              {typesLoading ? (
                <div className="flex items-center justify-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                  <svg className="animate-spin h-5 w-5 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading resource types...
                </div>
              ) : (
                <ElegantSelect
                  value={selectedTypeId}
                  onChange={setSelectedTypeId}
                  options={typeOptions}
                  placeholder="Select resource type"
                />
              )}
            </div>

            {/* Resource Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Resource <span className="text-red-500">*</span>
              </label>
              {resourcesLoading || assignmentsLoading ? (
                <div className="flex items-center justify-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                  <svg className="animate-spin h-5 w-5 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading resources...
                </div>
              ) : (
                <>
                  <ElegantSelect
                    value={formData.resourceId}
                    onChange={(value) => setFormData(prev => ({ ...prev, resourceId: value }))}
                    options={resourceOptions}
                    placeholder={selectedTypeId ? "Select a resource" : "Select a type first"}
                    disabled={!selectedTypeId}
                    searchable
                  />
                  
                  {selectedTypeId && filteredResources.length === 0 && (
                    <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start">
                        <svg className="h-5 w-5 text-amber-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-amber-800 mb-1">
                            No {selectedType?.name} resources available
                          </p>
                          <p className="text-sm text-amber-700">
                            {employeeAssignments.length > 0 
                              ? 'All resources of this type are either already assigned to this employee or not available.'
                              : 'No resources of this type exist in the system yet. Contact your administrator.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedTypeId && filteredResources.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      {filteredResources.length} {selectedType?.name} resource{filteredResources.length !== 1 ? 's' : ''} available
                      {employeeAssignments.length > 0 && ` (${employeeAssignments.length} already assigned to this employee)`}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Justification */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                name="justification"
                value={formData.justification}
                onChange={handleChange}
                required
                rows={4}
                className="block w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                placeholder={`Please provide a detailed justification for this request. Include:
${selectedResource ? `- Why you need access to ${selectedResource.name}` : '- Why you need this resource'}
- How long you'll need it
- Business justification...`}
              />
            </div>
          </form>
        </div>

        {/* Footer with Action Buttons */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl">
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!selectedTypeId || !formData.resourceId}
              className={`px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-all duration-200 ${
                selectedTypeId && formData.resourceId
                  ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Submit Request
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
