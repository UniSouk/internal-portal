'use client';

import { useState } from 'react';

interface ResourceDetailsProps {
  resource: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ResourceDetails({ resource, isOpen, onClose }: ResourceDetailsProps) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen || !resource) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      case 'ASSIGNED':
        return 'bg-blue-100 text-blue-800';
      case 'EXPIRED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPermissionColor = (level: string) => {
    switch (level) {
      case 'read':
        return 'bg-green-100 text-green-800';
      case 'WRITE':
        return 'bg-blue-100 text-blue-800';
      case 'EDIT':
        return 'bg-orange-100 text-orange-800';
      case 'ADMIN':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{resource.name}</h2>
              <div className="flex items-center mt-1">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(resource.status)} mr-2`}>
                  {resource.status}
                </span>
                {resource.permissionLevel && (
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPermissionColor(resource.permissionLevel)} mr-2`}>
                    {resource.permissionLevel.toUpperCase()}
                  </span>
                )}
                <span className="text-sm text-gray-500">{resource.type} Resource</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('technical')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'technical'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Technical Details
            </button>
            <button
              onClick={() => setActiveTab('financial')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'financial'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Financial
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'timeline'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Timeline
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="max-h-96 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Name:</span>
                    <span className="text-sm text-gray-900">{resource.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Type:</span>
                    <span className="text-sm text-gray-900">{resource.type}</span>
                  </div>
                  {resource.category && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Category:</span>
                      <span className="text-sm text-gray-900">{resource.category}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-500">Status:</span>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(resource.status)}`}>
                      {resource.status}
                    </span>
                  </div>
                  {resource.description && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Description:</span>
                      <p className="text-sm text-gray-900 mt-1">{resource.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment Information */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Assignment Details</h3>
                <div className="space-y-3">
                  {/* Permission Level */}
                  {resource.permissionLevel && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Permission Level:</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPermissionColor(resource.permissionLevel)}`}>
                        {resource.permissionLevel.toUpperCase()}
                      </span>
                    </div>
                  )}
                  
                  {/* Single Assignment (Physical devices) */}
                  {resource.type === 'PHYSICAL' && resource.assignedTo && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Assigned To:</span>
                        <span className="text-sm text-gray-900">{resource.assignedTo.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Role:</span>
                        <span className="text-sm text-gray-900">{resource.assignedTo.role.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Department:</span>
                        <span className="text-sm text-gray-900">{resource.assignedTo.department}</span>
                      </div>
                    </>
                  )}
                  
                  {/* Multiple Assignments (Software/Cloud) */}
                  {(resource.type === 'SOFTWARE' || resource.type === 'CLOUD') && resource.assignedEmployees && resource.assignedEmployees.length > 0 && (
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-gray-500">Assigned To:</span>
                        <span className="text-sm text-gray-900">{resource.assignedEmployees.length} employee{resource.assignedEmployees.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {resource.assignedEmployees.map((employee: any) => (
                          <div key={employee.id} className="bg-white p-2 rounded border">
                            <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                            <div className="text-xs text-gray-500">{employee.role.replace(/_/g, ' ')} • {employee.department}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Fallback for single assignment on software/cloud (backward compatibility) */}
                  {(resource.type === 'SOFTWARE' || resource.type === 'CLOUD') && resource.assignedTo && (!resource.assignedEmployees || resource.assignedEmployees.length === 0) && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Assigned To:</span>
                        <span className="text-sm text-gray-900">{resource.assignedTo.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Role:</span>
                        <span className="text-sm text-gray-900">{resource.assignedTo.role.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Department:</span>
                        <span className="text-sm text-gray-900">{resource.assignedTo.department}</span>
                      </div>
                    </>
                  )}
                  {resource.owner && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Managed By:</span>
                        <span className="text-sm text-gray-900">{resource.owner.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Manager Dept:</span>
                        <span className="text-sm text-gray-900">{resource.owner.department}</span>
                      </div>
                    </>
                  )}
                  {resource.assignedDate && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Assigned Date:</span>
                      <span className="text-sm text-gray-900">{formatDate(resource.assignedDate)}</span>
                    </div>
                  )}
                  {resource.expiryDate && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Expires:</span>
                      <span className={`text-sm ${new Date(resource.expiryDate) < new Date() ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                        {formatDate(resource.expiryDate)}
                        {new Date(resource.expiryDate) < new Date() && ' (Expired)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'technical' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {resource.type === 'PHYSICAL' && (
                <>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Hardware Specifications</h3>
                    <div className="space-y-3">
                      {resource.serialNumber && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">Serial Number:</span>
                          <span className="text-sm text-gray-900 font-mono">{resource.serialNumber}</span>
                        </div>
                      )}
                      {resource.modelNumber && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">Model:</span>
                          <span className="text-sm text-gray-900">{resource.modelNumber}</span>
                        </div>
                      )}
                      {resource.brand && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">Brand:</span>
                          <span className="text-sm text-gray-900">{resource.brand}</span>
                        </div>
                      )}
                      {resource.processor && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">Processor:</span>
                          <span className="text-sm text-gray-900">{resource.processor}</span>
                        </div>
                      )}
                      {resource.memory && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">Memory:</span>
                          <span className="text-sm text-gray-900">{resource.memory}</span>
                        </div>
                      )}
                      {resource.storage && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">Storage:</span>
                          <span className="text-sm text-gray-900">{resource.storage}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
                    <div className="space-y-3">
                      {resource.operatingSystem && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">OS:</span>
                          <span className="text-sm text-gray-900">{resource.operatingSystem}</span>
                        </div>
                      )}
                      {resource.osVersion && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">OS Version:</span>
                          <span className="text-sm text-gray-900">{resource.osVersion}</span>
                        </div>
                      )}
                      {resource.location && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">Location:</span>
                          <span className="text-sm text-gray-900">{resource.location}</span>
                        </div>
                      )}
                      {resource.ipAddress && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">IP Address:</span>
                          <span className="text-sm text-gray-900 font-mono">{resource.ipAddress}</span>
                        </div>
                      )}
                      {resource.macAddress && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-gray-500">MAC Address:</span>
                          <span className="text-sm text-gray-900 font-mono">{resource.macAddress}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {resource.type === 'SOFTWARE' && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Software Details</h3>
                  <div className="space-y-3">
                    {resource.softwareVersion && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Version:</span>
                        <span className="text-sm text-gray-900">{resource.softwareVersion}</span>
                      </div>
                    )}
                    {resource.licenseKey && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">License Key:</span>
                        <span className="text-sm text-gray-900 font-mono">{resource.licenseKey}</span>
                      </div>
                    )}
                    {resource.provider && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Provider:</span>
                        <span className="text-sm text-gray-900">{resource.provider}</span>
                      </div>
                    )}
                    {resource.serviceLevel && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Service Level:</span>
                        <span className="text-sm text-gray-900">{resource.serviceLevel}</span>
                      </div>
                    )}
                    {resource.licenseExpiry && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">License Expires:</span>
                        <span className={`text-sm ${new Date(resource.licenseExpiry) < new Date() ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                          {formatDate(resource.licenseExpiry)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {resource.type === 'CLOUD' && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Cloud Service Details</h3>
                  <div className="space-y-3">
                    {resource.provider && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Provider:</span>
                        <span className="text-sm text-gray-900">{resource.provider}</span>
                      </div>
                    )}
                    {resource.serviceLevel && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Service Tier:</span>
                        <span className="text-sm text-gray-900">{resource.serviceLevel}</span>
                      </div>
                    )}
                    {resource.subscriptionId && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Subscription ID:</span>
                        <span className="text-sm text-gray-900 font-mono">{resource.subscriptionId}</span>
                      </div>
                    )}
                    {resource.subscriptionExpiry && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500">Subscription Expires:</span>
                        <span className={`text-sm ${new Date(resource.subscriptionExpiry) < new Date() ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                          {formatDate(resource.subscriptionExpiry)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Information</h3>
                <div className="space-y-3">
                  {resource.value && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Purchase Value:</span>
                      <span className="text-sm text-gray-900 font-semibold">{formatCurrency(resource.value)}</span>
                    </div>
                  )}
                  {resource.monthlyRate && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Monthly Cost:</span>
                      <span className="text-sm text-gray-900 font-semibold">{formatCurrency(resource.monthlyRate)}</span>
                    </div>
                  )}
                  {resource.annualRate && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Annual Cost:</span>
                      <span className="text-sm text-gray-900 font-semibold">{formatCurrency(resource.annualRate)}</span>
                    </div>
                  )}
                  {resource.purchaseDate && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Purchase Date:</span>
                      <span className="text-sm text-gray-900">{formatDate(resource.purchaseDate)}</span>
                    </div>
                  )}
                  {resource.warrantyExpiry && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Warranty Expires:</span>
                      <span className={`text-sm ${new Date(resource.warrantyExpiry) < new Date() ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                        {formatDate(resource.warrantyExpiry)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cost Analysis */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Analysis</h3>
                <div className="space-y-3">
                  {resource.monthlyRate && resource.annualRate && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Annual vs Monthly:</span>
                      <span className="text-sm text-gray-900">
                        {resource.annualRate < (resource.monthlyRate * 12) ? 
                          `Save ${formatCurrency((resource.monthlyRate * 12) - resource.annualRate)}` : 
                          'No annual discount'
                        }
                      </span>
                    </div>
                  )}
                  {resource.value && resource.purchaseDate && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Age:</span>
                      <span className="text-sm text-gray-900">
                        {Math.floor((new Date().getTime() - new Date(resource.purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365))} years
                      </span>
                    </div>
                  )}
                  {resource.monthlyRate && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500">Yearly Total:</span>
                      <span className="text-sm text-gray-900 font-semibold">{formatCurrency(resource.monthlyRate * 12)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Resource Timeline</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">Resource Created</p>
                    <p className="text-sm text-gray-500">{formatDate(resource.createdAt)}</p>
                  </div>
                </div>
                {resource.assignedDate && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Assigned to {resource.assignedTo?.name}</p>
                      <p className="text-sm text-gray-500">{formatDate(resource.assignedDate)}</p>
                    </div>
                  </div>
                )}
                {resource.lastUpdate && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Last Updated</p>
                      <p className="text-sm text-gray-500">{formatDate(resource.lastUpdate)}</p>
                    </div>
                  </div>
                )}
                {resource.lastMaintenance && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-2 h-2 bg-purple-400 rounded-full mt-2"></div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Last Maintenance</p>
                      <p className="text-sm text-gray-500">{formatDate(resource.lastMaintenance)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t">
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