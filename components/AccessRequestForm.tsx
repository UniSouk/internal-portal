'use client';

import { useState, useEffect } from 'react';
import { useNotification } from './Notification';
import { useAuth } from '@/contexts/AuthContext';

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
  const [resources, setResources] = useState<Array<{ 
    id: string; 
    name: string; 
    type: string; 
    category?: string;
    description?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [requestType, setRequestType] = useState<'software' | 'hardware' | ''>('');
  const [formData, setFormData] = useState({
    employeeId: user?.id || '',
    resourceId: '',
    hardwareRequest: '',
    justification: ''
  });

  useEffect(() => {
    fetchAccessibleEmployees();
    fetchResources();
  }, []);

  useEffect(() => {
    if (user && !formData.employeeId) {
      setFormData(prev => ({ ...prev, employeeId: user.id }));
    }
  }, [user]);

  useEffect(() => {
    if (requestType === 'software') {
      setFormData(prev => ({ ...prev, hardwareRequest: '' }));
    } else if (requestType === 'hardware') {
      setFormData(prev => ({ ...prev, resourceId: '' }));
    }
  }, [requestType]);

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
      // Add forAccessRequest=true to show ALL resources for access requests
      const response = await fetch('/api/resources?page=1&limit=1000&forAccessRequest=true');
      if (response.ok) {
        const data = await response.json();
        // Handle paginated response structure
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!requestType) {
      showNotification('warning', 'Selection Required', 'Please select either Software/Cloud Access or Hardware Request.');
      return;
    }
    
    if (requestType === 'software' && !formData.resourceId) {
      showNotification('warning', 'Selection Required', 'Please select a software or cloud service.');
      return;
    }
    
    if (requestType === 'hardware' && !formData.hardwareRequest) {
      showNotification('warning', 'Selection Required', 'Please select a hardware item.');
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

  const handleRequestTypeChange = (type: 'software' | 'hardware') => {
    setRequestType(type);
  };

  const selectedEmployee = accessibleEmployees.find(emp => emp.id === formData.employeeId);
  const isCurrentUser = selectedEmployee?.id === user?.id;

  const accessibleResources = resources.filter(resource => 
    resource.type === 'SOFTWARE' || resource.type === 'CLOUD'
  );

  const hardwareResources = resources.filter(resource => 
    resource.type === 'PHYSICAL'
  );

  const selectedResource = accessibleResources.find(res => res.id === formData.resourceId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Request Access</h3>
              <p className="text-sm text-gray-600 mt-1">Choose the type of access you need and provide the necessary details.</p>
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
          <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
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

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Employee Selection */}
            <div className="bg-gray-50 rounded-xl p-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Employee <span className="text-red-500">*</span>
                </div>
              </label>
              {loading ? (
                <div className="flex items-center justify-center py-4 bg-white rounded-lg border border-gray-200">
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
              {accessibleEmployees.length === 1 && accessibleEmployees[0]?.id === user?.id && (
                <p className="mt-2 text-xs text-gray-600 flex items-center">
                  <svg className="h-4 w-4 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  You can only request access for yourself
                </p>
              )}
              {accessibleEmployees.length > 1 && (
                <p className="mt-2 text-xs text-gray-600 flex items-center">
                  <svg className="h-4 w-4 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  You can request access for yourself and your team members
                </p>
              )}
            </div>

            {/* Request Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-4">
                Request Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Software/Cloud Option */}
                <div 
                  className={`group relative border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 transform hover:scale-[1.02] ${
                    requestType === 'software' 
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg' 
                      : 'border-gray-200 hover:border-blue-300 bg-white hover:shadow-md'
                  }`}
                  onClick={() => handleRequestTypeChange('software')}
                >
                  <div className="flex items-start">
                    <input
                      type="radio"
                      name="requestType"
                      value="software"
                      checked={requestType === 'software'}
                      onChange={() => handleRequestTypeChange('software')}
                      className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <div className="ml-4 flex-1">
                      <div className="flex items-center mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                          requestType === 'software' ? 'bg-blue-500' : 'bg-blue-100 group-hover:bg-blue-200'
                        }`}>
                          <svg className={`h-5 w-5 ${requestType === 'software' ? 'text-white' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900">Software/Cloud Access</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Request access to software applications, cloud services, or digital platforms
                      </p>
                      <div className="flex items-center text-sm">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          requestType === 'software' ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-700'
                        }`}>
                          <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {resourcesLoading ? 'Loading...' : `${accessibleResources.length} services available`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hardware Option */}
                <div 
                  className={`group relative border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 transform hover:scale-[1.02] ${
                    requestType === 'hardware' 
                      ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100 shadow-lg' 
                      : 'border-gray-200 hover:border-orange-300 bg-white hover:shadow-md'
                  }`}
                  onClick={() => handleRequestTypeChange('hardware')}
                >
                  <div className="flex items-start">
                    <input
                      type="radio"
                      name="requestType"
                      value="hardware"
                      checked={requestType === 'hardware'}
                      onChange={() => handleRequestTypeChange('hardware')}
                      className="mt-1 h-5 w-5 text-orange-600 focus:ring-orange-500 border-gray-300"
                    />
                    <div className="ml-4 flex-1">
                      <div className="flex items-center mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                          requestType === 'hardware' ? 'bg-orange-500' : 'bg-orange-100 group-hover:bg-orange-200'
                        }`}>
                          <svg className={`h-5 w-5 ${requestType === 'hardware' ? 'text-white' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900">Hardware Request</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Request physical equipment like laptops, monitors, or other devices
                      </p>
                      <div className="flex items-center text-sm">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          requestType === 'hardware' ? 'bg-orange-200 text-orange-800' : 'bg-orange-100 text-orange-700'
                        }`}>
                          <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {resourcesLoading ? 'Loading...' : `${hardwareResources.length} hardware resources available`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Software/Cloud Service Selection */}
            {requestType === 'software' && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 animate-fadeIn">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-semibold text-gray-900">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </div>
                      Select Software/Cloud Service <span className="text-red-500">*</span>
                    </div>
                  </label>
                  {!resourcesLoading && (
                    <button
                      type="button"
                      onClick={fetchResources}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  )}
                </div>
                <select
                  name="resourceId"
                  value={formData.resourceId}
                  onChange={handleChange}
                  required={requestType === 'software'}
                  disabled={resourcesLoading}
                  className="block w-full border border-gray-300 rounded-lg px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {resourcesLoading ? 'Loading services...' : 'Choose a service...'}
                  </option>
                  {!resourcesLoading && accessibleResources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name} ({resource.type})
                      {resource.category && ` - ${resource.category}`}
                      {resource.description && ` | ${resource.description.substring(0, 50)}${resource.description.length > 50 ? '...' : ''}`}
                    </option>
                  ))}
                </select>
                {!resourcesLoading && accessibleResources.length === 0 && (
                  <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start">
                      <svg className="h-5 w-5 text-amber-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-amber-800 mb-1">
                          No software or cloud services available
                        </p>
                        <p className="text-sm text-amber-700">
                          Resources need to be created first. Contact your administrator to add software licenses and cloud services to the system.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {resourcesLoading && (
                  <div className="mt-3 flex items-center justify-center py-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <svg className="animate-spin h-5 w-5 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm text-gray-600">Loading available services...</span>
                  </div>
                )}
              </div>
            )}

            {/* Hardware Request Selection */}
            {requestType === 'hardware' && (
              <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6 animate-fadeIn">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-semibold text-gray-900">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      Select Hardware Item <span className="text-red-500">*</span>
                    </div>
                  </label>
                  {!resourcesLoading && (
                    <button
                      type="button"
                      onClick={fetchResources}
                      className="text-sm text-orange-600 hover:text-orange-800 flex items-center"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  )}
                </div>
                <select
                  name="hardwareRequest"
                  value={formData.hardwareRequest}
                  onChange={handleChange}
                  required={requestType === 'hardware'}
                  disabled={resourcesLoading}
                  className="block w-full border border-gray-300 rounded-lg px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {resourcesLoading ? 'Loading hardware...' : hardwareResources.length > 0 ? 'Choose hardware...' : 'No hardware resources available'}
                  </option>
                  {!resourcesLoading && hardwareResources.map((hardware, index) => (
                    <option key={`${hardware.name}-${index}`} value={hardware.name}>
                      {hardware.name}
                      {hardware.category && ` (${hardware.category})`}
                    </option>
                  ))}
                </select>
                <div className="mt-3 p-3 bg-orange-100 border border-orange-200 rounded-lg">
                  <div className="flex items-start">
                    <svg className="h-4 w-4 text-orange-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      {resourcesLoading ? (
                        <p className="text-sm text-orange-800">Loading hardware inventory...</p>
                      ) : (
                        <>
                          <p className="text-sm text-orange-800">
                            {hardwareResources.length > 0 
                              ? `${hardwareResources.length} hardware items available in inventory.`
                              : 'No physical resources found in inventory. Using standard hardware request options - specific items will be assigned based on availability and approval.'
                            }
                          </p>
                          {formData.hardwareRequest === 'Other (specify in justification)' && (
                            <p className="text-sm text-orange-800 mt-1 font-medium">
                              Please specify details in the justification field below.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Justification */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center mr-3">
                    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  Justification <span className="text-red-500">*</span>
                </div>
              </label>
              <textarea
                name="justification"
                value={formData.justification}
                onChange={handleChange}
                required
                rows={5}
                className="block w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                placeholder={`Please provide a detailed justification for this request. Include:
${requestType === 'software' && formData.resourceId ? `- Why you need access to ${selectedResource?.name}` : ''}
${requestType === 'hardware' && formData.hardwareRequest ? `- Why you need ${formData.hardwareRequest}` : ''}
- How long you'll need it
- What you plan to do with it
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
              disabled={!requestType}
              className={`px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-all duration-200 ${
                requestType 
                  ? 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform hover:scale-105' 
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