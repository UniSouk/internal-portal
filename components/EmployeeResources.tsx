'use client';

import { useState, useEffect } from 'react';

interface AssignedResource {
  id: string;
  name: string;
  type: 'PHYSICAL' | 'SOFTWARE' | 'CLOUD';
  category?: string;
  status: string;
  assignedDate?: string;
  expiryDate?: string;
  monthlyRate?: number;
  annualRate?: number;
  value?: number;
  serialNumber?: string;
  softwareVersion?: string;
  provider?: string;
}

interface EmployeeResourcesProps {
  employeeId: string;
  employeeName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function EmployeeResources({ employeeId, employeeName, isOpen, onClose }: EmployeeResourcesProps) {
  const [resources, setResources] = useState<AssignedResource[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && employeeId) {
      fetchAssignedResources();
    }
  }, [isOpen, employeeId]);

  const fetchAssignedResources = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/resources?assignedTo=${employeeId}`);
      if (response.ok) {
        const data = await response.json();
        // Handle paginated response structure
        const allResources = data.resources || data; // Support both paginated and direct array responses
        
        // Filter resources assigned to this employee (if needed for additional filtering)
        const assignedResources = Array.isArray(allResources) 
          ? allResources.filter((resource: any) => 
              resource.assignedToId === employeeId || 
              (resource.assignedToIds && resource.assignedToIds.includes(employeeId))
            )
          : [];
        
        setResources(assignedResources);
      }
    } catch (error) {
      console.error('Error fetching assigned resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'ASSIGNED':
        return 'bg-blue-100 text-blue-800';
      case 'EXPIRED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-medium text-gray-900">
            Resources Assigned to {employeeName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-lg">Loading assigned resources...</div>
          </div>
        ) : (
          <>
            {resources.length === 0 ? (
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
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No resources assigned</h3>
                <p className="mt-1 text-sm text-gray-500">
                  This employee doesn't have any resources assigned to them yet.
                </p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {resources.filter(r => r.type === 'PHYSICAL').length}
                    </div>
                    <div className="text-sm text-blue-800">Physical Assets</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {resources.filter(r => r.type === 'SOFTWARE').length}
                    </div>
                    <div className="text-sm text-green-800">Software Licenses</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {resources.filter(r => r.type === 'CLOUD').length}
                    </div>
                    <div className="text-sm text-purple-800">Cloud Services</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {formatCurrency(
                        resources.reduce((sum, r) => sum + (r.monthlyRate || 0), 0)
                      )}
                    </div>
                    <div className="text-sm text-orange-800">Monthly Cost</div>
                  </div>
                </div>

                {/* Resources List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {resources.map((resource) => (
                    <div key={resource.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <div>
                            <h4 className="font-medium text-gray-900 text-sm">{resource.name}</h4>
                            {resource.category && (
                              <p className="text-xs text-gray-500">{resource.category}</p>
                            )}
                          </div>
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(resource.status)}`}>
                          {resource.status}
                        </span>
                      </div>

                      {/* Resource-specific details */}
                      <div className="space-y-2 text-sm">
                        {resource.type === 'PHYSICAL' && (
                          <>
                            {resource.serialNumber && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Serial:</span>
                                <span className="text-gray-900 font-mono text-xs">{resource.serialNumber}</span>
                              </div>
                            )}
                            {resource.value && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Value:</span>
                                <span className="text-gray-900">{formatCurrency(resource.value)}</span>
                              </div>
                            )}
                          </>
                        )}

                        {resource.type === 'SOFTWARE' && (
                          <>
                            {resource.softwareVersion && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Version:</span>
                                <span className="text-gray-900">{resource.softwareVersion}</span>
                              </div>
                            )}
                            {resource.annualRate && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Annual Cost:</span>
                                <span className="text-gray-900">{formatCurrency(resource.annualRate)}</span>
                              </div>
                            )}
                          </>
                        )}

                        {resource.type === 'CLOUD' && (
                          <>
                            {resource.provider && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Provider:</span>
                                <span className="text-gray-900">{resource.provider}</span>
                              </div>
                            )}
                            {resource.monthlyRate && (
                              <div className="flex justify-between">
                                <span className="text-gray-500">Monthly:</span>
                                <span className="text-gray-900">{formatCurrency(resource.monthlyRate)}</span>
                              </div>
                            )}
                          </>
                        )}

                        {resource.assignedDate && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Assigned:</span>
                            <span className="text-gray-900">{new Date(resource.assignedDate).toLocaleDateString()}</span>
                          </div>
                        )}

                        {resource.expiryDate && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Expires:</span>
                            <span className={`${new Date(resource.expiryDate) < new Date() ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                              {new Date(resource.expiryDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}