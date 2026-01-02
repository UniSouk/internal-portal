'use client';

import { useState, useEffect } from 'react';
import ElegantSelect from './ElegantSelect';
import { AllocationType } from '@/types/resource-structure';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
}

interface ResourceItem {
  id: string;
  serialNumber?: string;
  hostname?: string;
  licenseKey?: string;
  softwareVersion?: string;
  licenseType?: string;
  status: string;
}

interface ResourceAssignmentFormProps {
  resourceId: string;
  resourceType: 'PHYSICAL' | 'SOFTWARE' | 'CLOUD';
  allocationType?: AllocationType;
  quantity?: number;
  currentAssignments?: number;
  availableItems?: ResourceItem[];
  onAssignmentCreated?: () => void;
  onClose?: () => void;
}

export default function ResourceAssignmentForm({ 
  resourceId, 
  resourceType,
  allocationType = 'EXCLUSIVE',
  quantity,
  currentAssignments = 0,
  availableItems = [],
  onAssignmentCreated, 
  onClose 
}: ResourceAssignmentFormProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formData, setFormData] = useState({
    employeeId: '',
    itemId: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if this is a SHARED allocation resource
  const isSharedAllocation = allocationType === 'SHARED';
  
  // For SHARED resources, calculate capacity
  const isUnlimitedCapacity = isSharedAllocation && quantity === -1;
  const remainingCapacity = isSharedAllocation && quantity !== undefined && quantity > 0 
    ? quantity - currentAssignments 
    : (isUnlimitedCapacity ? Infinity : 0);
  const hasCapacity = isSharedAllocation ? (isUnlimitedCapacity || remainingCapacity > 0) : true;

  // Determine assignment logic for physical and software resources
  const totalItems = availableItems.length;
  // For EXCLUSIVE allocation, we need items; for SHARED, we don't need items
  const hasItems = !isSharedAllocation && (resourceType === 'PHYSICAL' || resourceType === 'SOFTWARE') && totalItems > 0;
  const availableResourceItems = availableItems.filter(item => item.status === 'AVAILABLE');
  const noItemsExist = !isSharedAllocation && totalItems === 0;

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees', {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/resources/assignments/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resourceId,
          employeeId: formData.employeeId,
          // For EXCLUSIVE allocation with items, include itemId; for SHARED, no itemId needed
          ...(!isSharedAllocation && hasItems && formData.itemId && { itemId: formData.itemId }),
          notes: formData.notes
        })
      });

      if (response.ok) {
        onAssignmentCreated?.();
        onClose?.();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create assignment');
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const employeeOptions = employees.map(emp => ({
    value: emp.id,
    label: `${emp.name} (${emp.department})`,
    description: emp.role
  }));

  const itemOptions = availableResourceItems.map(item => ({
    value: item.id,
    label: resourceType === 'SOFTWARE' 
      ? (item.licenseKey || item.serialNumber || item.id)
      : (item.serialNumber || item.hostname || item.id),
    description: `Status: ${item.status}${resourceType === 'SOFTWARE' && item.softwareVersion ? ` • Version: ${item.softwareVersion}` : ''}`
  }));

  // Form validation - depends on allocation type
  // For SHARED: just need employee selected and capacity available
  // For EXCLUSIVE: need employee and item selected (if items exist)
  const isFormValid = isSharedAllocation 
    ? (formData.employeeId && hasCapacity)
    : (!noItemsExist && formData.employeeId && (resourceType === 'CLOUD' || (hasItems && formData.itemId && availableResourceItems.length > 0)));

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Assign Resource</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800">Assignment Failed</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Assignment Type Info */}
          {isSharedAllocation ? (
            /* SHARED Allocation Info */
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-purple-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <div className="text-sm">
                  <p className="font-medium text-purple-900">Shared Resource Assignment</p>
                  <p className="text-purple-700">
                    This is a shared resource that can be assigned to multiple employees.
                  </p>
                  {/* Capacity Information */}
                  <div className="mt-2 p-2 bg-purple-100 rounded">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-800 font-medium">Capacity:</span>
                      <span className="text-purple-900">
                        {isUnlimitedCapacity ? (
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                            </svg>
                            Unlimited
                          </span>
                        ) : (
                          `${currentAssignments} / ${quantity} seats used`
                        )}
                      </span>
                    </div>
                    {!isUnlimitedCapacity && (
                      <div className="mt-1">
                        <div className="w-full bg-purple-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${remainingCapacity > 0 ? 'bg-purple-600' : 'bg-red-500'}`}
                            style={{ width: `${Math.min((currentAssignments / (quantity || 1)) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-purple-700 mt-1">
                          {remainingCapacity > 0 
                            ? `${remainingCapacity} seat${remainingCapacity !== 1 ? 's' : ''} remaining`
                            : 'No seats available - capacity reached'}
                        </p>
                      </div>
                    )}
                  </div>
                  {!hasCapacity && (
                    <p className="text-red-700 mt-2">⚠️ This resource has reached its maximum capacity. No more assignments can be made.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (resourceType === 'PHYSICAL' || resourceType === 'SOFTWARE') && (
            /* EXCLUSIVE Allocation Info */
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  {hasItems ? (
                    <div>
                      <p className="font-medium text-blue-900">
                        {resourceType === 'SOFTWARE' ? 'License Assignment' : 'Hardware Item Assignment'}
                      </p>
                      <p className="text-blue-700">
                        This {resourceType.toLowerCase()} resource has {availableItems.length} {resourceType === 'SOFTWARE' ? 'licenses' : 'hardware items'}. You must select a specific {resourceType === 'SOFTWARE' ? 'license' : 'item'} to assign.
                      </p>
                      {availableResourceItems.length === 0 && (
                        <p className="text-red-700 mt-1">⚠️ No available {resourceType === 'SOFTWARE' ? 'licenses' : 'items'}. All {resourceType === 'SOFTWARE' ? 'licenses' : 'items'} are currently assigned or unavailable.</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-blue-900">Direct Resource Assignment</p>
                      <p className="text-blue-700">
                        This {resourceType.toLowerCase()} resource has no {resourceType === 'SOFTWARE' ? 'license items' : 'hardware items'} yet. It can be assigned directly.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign to Employee
            </label>
            <ElegantSelect
              options={employeeOptions}
              value={formData.employeeId}
              onChange={(value) => setFormData({ ...formData, employeeId: value })}
              placeholder="Select an employee"
              searchable
            />
          </div>

          {/* Item Selection - Only for EXCLUSIVE allocation with items */}
          {!isSharedAllocation && hasItems && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select {resourceType === 'SOFTWARE' ? 'License' : 'Hardware Item'} <span className="text-red-500">*</span>
              </label>
              {availableResourceItems.length > 0 ? (
                <ElegantSelect
                  options={itemOptions}
                  value={formData.itemId}
                  onChange={(value) => setFormData({ ...formData, itemId: value })}
                  placeholder={`Select a ${resourceType === 'SOFTWARE' ? 'license' : 'hardware item'}`}
                  searchable
                />
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-800">
                        No {resourceType === 'SOFTWARE' ? 'Licenses' : 'Hardware Items'} Available
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        All {availableItems.length} {resourceType === 'SOFTWARE' ? 'licenses' : 'hardware items'} are currently assigned or unavailable. 
                        You cannot assign this resource until {resourceType === 'SOFTWARE' ? 'licenses' : 'items'} become available.
                      </p>
                      <p className="text-sm text-red-600 mt-2 font-medium">
                        Solutions:
                      </p>
                      <ul className="text-sm text-red-700 mt-1 ml-4 list-disc">
                        <li>Return existing assignments to make {resourceType === 'SOFTWARE' ? 'licenses' : 'items'} available</li>
                        <li>Add new hardware items to this resource</li>
                        <li>Wait for maintenance items to become available</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Optional notes about this assignment"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!isFormValid ? (
                isSharedAllocation 
                  ? (!hasCapacity ? 'Resource has reached maximum capacity' : 'Please select an employee')
                  : `Please select an employee and available ${resourceType === 'SOFTWARE' ? 'license' : 'hardware item'}`
              ) : ''}
            >
              {loading ? 'Assigning...' : (
                isSharedAllocation 
                  ? (!hasCapacity ? 'Capacity Reached' : 'Assign Resource')
                  : (hasItems && availableResourceItems.length === 0 
                      ? `No ${resourceType === 'SOFTWARE' ? 'Licenses' : 'Items'} Available` 
                      : 'Assign Resource')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}