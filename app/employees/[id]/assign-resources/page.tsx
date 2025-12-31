'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useNotification } from '@/components/Notification';

interface Resource {
  id: string;
  name: string;
  type: 'PHYSICAL' | 'SOFTWARE' | 'CLOUD';
  category: string;
  description?: string;
  permissionLevel: string;
  status: string;
  assignedToId?: string;
  assignedToIds?: string[];
}

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
}

export default function AssignResourcesPage() {
  const router = useRouter();
  const params = useParams();
  const { showNotification, NotificationComponent } = useNotification();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResources, setSelectedResources] = useState<{
    physical: string[];
    software: string[];
    cloud: string[];
  }>({
    physical: [],
    software: [],
    cloud: []
  });
  const [autoSelectedResources, setAutoSelectedResources] = useState<{
    physical: string[];
    software: string[];
    cloud: string[];
  }>({
    physical: [],
    software: [],
    cloud: []
  });
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeAndResources();
    }
  }, [employeeId]);

  // Auto-select resources based on employee department
  useEffect(() => {
    if (employee && resources.length > 0) {
      autoSelectResourcesByDepartment();
    }
  }, [employee, resources]);

  const autoSelectResourcesByDepartment = () => {
    if (!employee) return;

    const autoSelectedIds = getAutoSelectionsByDepartment(employee.department, employee.role);
    
    // Organize auto-selected resources by type
    const physicalSelections: string[] = [];
    const softwareSelections: string[] = [];
    const cloudSelections: string[] = [];

    autoSelectedIds.forEach(resourceId => {
      const resource = resources.find(r => r.id === resourceId);
      if (resource) {
        if (resource.type === 'PHYSICAL') {
          physicalSelections.push(resource.id);
        } else if (resource.type === 'SOFTWARE') {
          softwareSelections.push(resource.id);
        } else if (resource.type === 'CLOUD') {
          cloudSelections.push(resource.id);
        }
      }
    });

    // Update selected resources with auto-selections
    setSelectedResources({
      physical: physicalSelections,
      software: softwareSelections,
      cloud: cloudSelections
    });

    // Track which resources were auto-selected
    setAutoSelectedResources({
      physical: physicalSelections,
      software: softwareSelections,
      cloud: cloudSelections
    });

    // Show notification about auto-selection
    if (physicalSelections.length > 0 || softwareSelections.length > 0 || cloudSelections.length > 0) {
      const totalSelected = physicalSelections.length + softwareSelections.length + cloudSelections.length;
      showNotification(
        'info', 
        'Resources Auto-Selected', 
        `${totalSelected} resources have been automatically selected based on ${employee.name}'s department (${employee.department}) and role (${employee.role.replace(/_/g, ' ')}). You can modify the selection as needed.`
      );
    } else {
      // No resources were auto-selected, show helpful message
      showNotification(
        'info', 
        'No Auto-Selection Available', 
        `No resources were automatically selected for ${employee.name}. Please manually select appropriate resources from the available options below.`
      );
    }
  };

  const getAutoSelectionsByDepartment = (department: string, role: string) => {
    // Dynamic auto-selection based on available resources in database
    // This function now works with actual database resources instead of hard-coded patterns
    
    const autoSelections: string[] = [];
    
    // Get resources by category preferences for different departments
    const departmentPreferences = getDepartmentResourcePreferences(department, role);
    
    // Find matching resources from available resources
    departmentPreferences.forEach(preference => {
      const matchingResources = resources.filter(resource => 
        resource.type === preference.type && 
        preference.categories.includes(resource.category) &&
        resource.status === 'AVAILABLE' // Only auto-select available resources
      );
      
      // Auto-select up to the preferred quantity for each category
      matchingResources.slice(0, preference.maxQuantity || 1).forEach(resource => {
        autoSelections.push(resource.id);
      });
    });
    
    return autoSelections;
  };

  const getDepartmentResourcePreferences = (department: string, role: string) => {
    const preferences: Array<{
      type: 'PHYSICAL' | 'SOFTWARE' | 'CLOUD';
      categories: string[];
      maxQuantity?: number;
    }> = [];

    // Common resources for all employees
    preferences.push(
      { type: 'PHYSICAL', categories: ['Peripherals', 'Other Hardware'], maxQuantity: 2 },
      { type: 'SOFTWARE', categories: ['Communication', 'Productivity Suite'], maxQuantity: 2 },
      { type: 'CLOUD', categories: ['Productivity Cloud', 'Communication'], maxQuantity: 2 }
    );

    // Department-specific preferences based on available categories
    switch (department.toLowerCase()) {
      case 'engineering':
      case 'technology':
        preferences.push(
          { type: 'PHYSICAL', categories: ['Laptop', 'Desktop', 'Monitor'], maxQuantity: 1 },
          { type: 'PHYSICAL', categories: ['Peripherals'], maxQuantity: 2 },
          { type: 'SOFTWARE', categories: ['Development IDE', 'Database'], maxQuantity: 2 },
          { type: 'CLOUD', categories: ['Development Platform', 'Code Repository'], maxQuantity: 2 }
        );
        
        // Role-specific additions for engineering
        if (role.includes('FRONTEND') || role.includes('DESIGNER')) {
          preferences.push({ type: 'SOFTWARE', categories: ['Design Tool'], maxQuantity: 1 });
        }
        if (role.includes('CREATIVE') || role.includes('DESIGNER')) {
          preferences.push({ type: 'SOFTWARE', categories: ['Design Software'], maxQuantity: 1 });
        }
        break;

      case 'design':
      case 'creative':
        preferences.push(
          { type: 'PHYSICAL', categories: ['Laptop', 'Desktop', 'Monitor'], maxQuantity: 1 },
          { type: 'SOFTWARE', categories: ['Design Software', 'Design Tool'], maxQuantity: 2 }
        );
        break;

      case 'sales':
      case 'marketing':
        preferences.push(
          { type: 'PHYSICAL', categories: ['Laptop', 'Mobile Device'], maxQuantity: 1 },
          { type: 'SOFTWARE', categories: ['Productivity Suite'], maxQuantity: 1 },
          { type: 'CLOUD', categories: ['CRM'], maxQuantity: 1 }
        );
        break;

      case 'human resources':
      case 'hr':
        preferences.push(
          { type: 'PHYSICAL', categories: ['Laptop', 'Desktop'], maxQuantity: 1 },
          { type: 'SOFTWARE', categories: ['Productivity Suite'], maxQuantity: 1 }
        );
        break;

      case 'finance':
      case 'accounting':
        preferences.push(
          { type: 'PHYSICAL', categories: ['Laptop', 'Desktop'], maxQuantity: 1 },
          { type: 'SOFTWARE', categories: ['Productivity Suite', 'Database'], maxQuantity: 2 }
        );
        break;

      default:
        // General office worker
        preferences.push(
          { type: 'PHYSICAL', categories: ['Laptop', 'Desktop'], maxQuantity: 1 },
          { type: 'SOFTWARE', categories: ['Productivity Suite'], maxQuantity: 1 }
        );
        break;
    }

    // Office furniture for all employees
    preferences.push({ type: 'PHYSICAL', categories: ['Furniture'], maxQuantity: 1 });

    return preferences;
  };

  const fetchEmployeeAndResources = async () => {
    try {
      // Fetch employee details
      const employeeResponse = await fetch(`/api/employees?id=${employeeId}`);
      if (employeeResponse.ok) {
        const employeeData = await employeeResponse.json();
        setEmployee(employeeData);
      }

      // Fetch all available resources
      const resourcesResponse = await fetch('/api/resources?limit=100');
      if (resourcesResponse.ok) {
        const resourcesData = await resourcesResponse.json();
        const allResources = resourcesData.resources || resourcesData;
        setResources(allResources);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResourceToggle = (resourceId: string, type: 'physical' | 'software' | 'cloud') => {
    setSelectedResources(prev => ({
      ...prev,
      [type]: prev[type].includes(resourceId)
        ? prev[type].filter(id => id !== resourceId)
        : [...prev[type], resourceId]
    }));
  };

  const handleAssignResources = async () => {
    if (!employee) return;

    setAssigning(true);
    const allSelectedIds = [
      ...selectedResources.physical,
      ...selectedResources.software,
      ...selectedResources.cloud
    ];

    if (allSelectedIds.length === 0) {
      showNotification('warning', 'No Resources Selected', 'Please select at least one resource to assign');
      setAssigning(false);
      return;
    }

    try {
      const assignmentPromises = allSelectedIds.map(async (resourceId) => {
        const resource = resources.find(r => r.id === resourceId);
        if (!resource) {
          console.error('Resource not found in local state:', resourceId);
          return { ok: false, error: 'Resource not found in local state' };
        }

        const assignmentData = {
          resourceId,
          employeeId: employee.id,
          quantityRequested: 1, // Default to 1 unit
          notes: `Auto-assigned during onboarding for ${employee.department} department`
        };

        try {
          const response = await fetch('/api/resources/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assignmentData)
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('Assignment failed for resource:', resource.name, errorData);
            return { ok: false, error: errorData.error, details: errorData.details };
          }

          const result = await response.json();
          return { ok: true, result };
        } catch (error) {
          console.error('Network error during assignment:', error);
          return { ok: false, error: 'Network error' };
        }
      });

      const results = await Promise.all(assignmentPromises);
      const successResults = results.filter(r => r?.ok);
      const failureResults = results.filter(r => r && !r.ok);

      if (successResults.length > 0) {
        let message = `Successfully assigned ${successResults.length} resources to ${employee.name}`;
        
        if (failureResults.length > 0) {
          message += `\n\nFailed assignments (${failureResults.length}):`;
          failureResults.forEach((failure) => {
            if (failure.error) {
              message += `\n• ${failure.error}`;
            }
          });
        }
        
        showNotification('success', 'Resources Assigned', message);
        
        // Redirect back to employees page
        router.push('/employees');
      } else {
        let errorMessage = 'Failed to assign resources. Please try again.';
        
        if (failureResults.length > 0 && failureResults[0].error) {
          errorMessage = `Assignment failed: ${failureResults[0].error}`;
          
          if (failureResults.length > 1) {
            errorMessage += ` (and ${failureResults.length - 1} other error${failureResults.length > 2 ? 's' : ''})`;
          }
        }
        
        showNotification('error', 'Assignment Failed', errorMessage);
      }
    } catch (error) {
      console.error('Error assigning resources:', error);
      showNotification('error', 'Network Error', 'Unable to assign resources. Please check your connection and try again.');
    } finally {
      setAssigning(false);
    }
  };

  const handleSkip = () => {
    router.push('/employees');
  };

  const getResourcesByType = (type: 'PHYSICAL' | 'SOFTWARE' | 'CLOUD') => {
    return resources.filter(resource => resource.type === type);
  };

  const getSelectedCount = (type: 'physical' | 'software' | 'cloud') => {
    return selectedResources[type].length;
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={['CEO', 'CTO', 'HR', 'MANAGER', 'HR_MANAGER', 'ENGINEERING_MANAGER']}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading employee and resources...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!employee) {
    return (
      <ProtectedRoute requiredRoles={['CEO', 'CTO', 'HR', 'MANAGER', 'HR_MANAGER', 'ENGINEERING_MANAGER']}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Employee Not Found</h2>
            <p className="mt-2 text-gray-600">The employee you're looking for doesn't exist.</p>
            <button
              onClick={() => router.push('/employees')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Back to Employees
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['CEO', 'CTO', 'HR', 'MANAGER', 'HR_MANAGER', 'ENGINEERING_MANAGER']}>
      {NotificationComponent}
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Assign Resources</h1>
                <p className="mt-1 text-gray-600">
                  Assign physical, software, and cloud resources to <strong>{employee.name}</strong>
                </p>
                <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                  <span>📧 {employee.email}</span>
                  <span>👤 {employee.role}</span>
                  <span>🏢 {employee.department}</span>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Skip for Now
                </button>
                <button
                  onClick={handleAssignResources}
                  disabled={assigning || (getSelectedCount('physical') + getSelectedCount('software') + getSelectedCount('cloud')) === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigning ? 'Assigning...' : `Assign ${getSelectedCount('physical') + getSelectedCount('software') + getSelectedCount('cloud')} Resources`}
                </button>
              </div>
            </div>
          </div>

          {/* Auto-Selection Info Banner */}
          {employee && (autoSelectedResources.physical.length > 0 || autoSelectedResources.software.length > 0 || autoSelectedResources.cloud.length > 0) && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-indigo-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-indigo-800">Smart Resource Selection</h4>
                  <div className="mt-1 text-sm text-indigo-700">
                    Based on <strong>{employee.name}'s</strong> department (<strong>{employee.department}</strong>) and role (<strong>{employee.role.replace(/_/g, ' ')}</strong>), 
                    we've automatically selected <strong>{autoSelectedResources.physical.length + autoSelectedResources.software.length + autoSelectedResources.cloud.length} essential resources</strong>. 
                    You can modify this selection by checking or unchecking items below.
                  </div>
                  <div className="mt-2 text-xs text-indigo-600">
                    💡 Auto-selected resources are marked with badges and can be customized as needed.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resource Categories */}
          {resources.length === 0 ? (
            // Empty state when no resources exist
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8V4a1 1 0 00-1-1H7a1 1 0 00-1 1v1m8 0V4.5" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Resources Available</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                There are currently no resources in the system to assign to <strong>{employee?.name}</strong>. 
                Resources need to be created first before they can be assigned to employees.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push('/resources')}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                >
                  Create Resources
                </button>
                <button
                  onClick={handleSkip}
                  className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Skip for Now
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Physical Resources */}
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-lg font-medium text-gray-900">Physical Assets</h3>
                        <p className="text-sm text-gray-500">Hardware and equipment</p>
                      </div>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {getSelectedCount('physical')} selected
                    </span>
                  </div>
                </div>
                <div className="p-6 max-h-96 overflow-y-auto">
                  <div className="space-y-3">
                    {getResourcesByType('PHYSICAL').map((resource) => (
                      <div key={resource.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`physical-${resource.id}`}
                          checked={selectedResources.physical.includes(resource.id)}
                          onChange={() => handleResourceToggle(resource.id, 'physical')}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`physical-${resource.id}`} className="ml-3 flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{resource.name}</div>
                              <div className="text-xs text-gray-500">{resource.category} • {resource.permissionLevel}</div>
                              {resource.description && (
                                <div className="text-xs text-gray-400 mt-1">{resource.description}</div>
                              )}
                            </div>
                            {autoSelectedResources.physical.includes(resource.id) && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Auto-selected
                              </span>
                            )}
                          </div>
                        </label>
                      </div>
                    ))}
                    {getResourcesByType('PHYSICAL').length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No physical resources available</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Software Resources */}
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-lg font-medium text-gray-900">Software Licenses</h3>
                        <p className="text-sm text-gray-500">Applications and tools</p>
                      </div>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {getSelectedCount('software')} selected
                    </span>
                  </div>
                </div>
                <div className="p-6 max-h-96 overflow-y-auto">
                  <div className="space-y-3">
                    {getResourcesByType('SOFTWARE').map((resource) => (
                      <div key={resource.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`software-${resource.id}`}
                          checked={selectedResources.software.includes(resource.id)}
                          onChange={() => handleResourceToggle(resource.id, 'software')}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`software-${resource.id}`} className="ml-3 flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{resource.name}</div>
                              <div className="text-xs text-gray-500">{resource.category} • {resource.permissionLevel}</div>
                              {resource.description && (
                                <div className="text-xs text-gray-400 mt-1">{resource.description}</div>
                              )}
                            </div>
                            {autoSelectedResources.software.includes(resource.id) && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Auto-selected
                              </span>
                            )}
                          </div>
                        </label>
                      </div>
                    ))}
                    {getResourcesByType('SOFTWARE').length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No software resources available</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Cloud Resources */}
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-lg font-medium text-gray-900">Cloud Services</h3>
                        <p className="text-sm text-gray-500">Online platforms and services</p>
                      </div>
                    </div>
                    <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {getSelectedCount('cloud')} selected
                    </span>
                  </div>
                </div>
                <div className="p-6 max-h-96 overflow-y-auto">
                  <div className="space-y-3">
                    {getResourcesByType('CLOUD').map((resource) => (
                      <div key={resource.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`cloud-${resource.id}`}
                          checked={selectedResources.cloud.includes(resource.id)}
                          onChange={() => handleResourceToggle(resource.id, 'cloud')}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`cloud-${resource.id}`} className="ml-3 flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{resource.name}</div>
                              <div className="text-xs text-gray-500">{resource.category} • {resource.permissionLevel}</div>
                              {resource.description && (
                                <div className="text-xs text-gray-400 mt-1">{resource.description}</div>
                              )}
                            </div>
                            {autoSelectedResources.cloud.includes(resource.id) && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                Auto-selected
                              </span>
                            )}
                          </div>
                        </label>
                      </div>
                    ))}
                    {getResourcesByType('CLOUD').length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No cloud resources available</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          {(getSelectedCount('physical') + getSelectedCount('software') + getSelectedCount('cloud')) > 0 && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">Assignment Summary</h4>
                  <div className="mt-1 text-sm text-blue-700">
                    You're about to assign <strong>{getSelectedCount('physical') + getSelectedCount('software') + getSelectedCount('cloud')} resources</strong> to <strong>{employee.name}</strong>:
                    <ul className="mt-2 space-y-1">
                      {getSelectedCount('physical') > 0 && (
                        <li>• {getSelectedCount('physical')} Physical Asset{getSelectedCount('physical') > 1 ? 's' : ''}</li>
                      )}
                      {getSelectedCount('software') > 0 && (
                        <li>• {getSelectedCount('software')} Software License{getSelectedCount('software') > 1 ? 's' : ''}</li>
                      )}
                      {getSelectedCount('cloud') > 0 && (
                        <li>• {getSelectedCount('cloud')} Cloud Service{getSelectedCount('cloud') > 1 ? 's' : ''}</li>
                      )}
                    </ul>
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