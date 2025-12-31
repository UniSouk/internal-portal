'use client';

import { useState } from 'react';
import { useNotification } from '@/components/Notification';

interface ResourceItem {
  id: string;
  status: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'LOST' | 'DAMAGED';
  serialNumber?: string;
  hostname?: string;
  ipAddress?: string;
  macAddress?: string;
  operatingSystem?: string;
  osVersion?: string;
  processor?: string;
  memory?: string;
  storage?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  licenseExpiry?: string;
  softwareVersion?: string;
  licenseType?: string;
  value?: number;
  metadata?: Record<string, any>;
  assignments: Array<{
    id: string;
    employee: {
      id: string;
      name: string;
      email: string;
      department: string;
    };
  }>;
}

interface ResourceItemsListProps {
  resourceId: string;
  items: ResourceItem[];
  onRefresh: () => void;
  canManage: boolean;
}

export default function ResourceItemsList({
  resourceId,
  items,
  onRefresh,
  canManage
}: ResourceItemsListProps) {
  const { showNotification } = useNotification();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 text-green-800';
      case 'ASSIGNED':
        return 'bg-blue-100 text-blue-800';
      case 'MAINTENANCE':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOST':
        return 'bg-red-100 text-red-800';
      case 'DAMAGED':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'ASSIGNED':
        return (
          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        );
      case 'MAINTENANCE':
        return (
          <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        );
      case 'LOST':
        return (
          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'DAMAGED':
        return (
          <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.id));
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedItems.length === 0) return;

    try {
      const updatePromises = selectedItems.map(itemId =>
        fetch(`/api/resources/items/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        })
      );

      const results = await Promise.all(updatePromises);
      const successCount = results.filter(r => r.ok).length;

      if (successCount === selectedItems.length) {
        showNotification('success', 'Items Updated', `${successCount} items updated successfully`);
      } else {
        showNotification('warning', 'Partial Success', `${successCount}/${selectedItems.length} items updated`);
      }

      setSelectedItems([]);
      setShowBulkActions(false);
      onRefresh();
    } catch (error) {
      console.error('Error updating items:', error);
      showNotification('error', 'Update Failed', 'Failed to update items');
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8V4a1 1 0 00-1-1H7a1 1 0 00-1 1v1m8 0V4.5" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Items Found</h3>
        <p className="text-gray-600 mb-4">
          This resource doesn't have any physical items yet.
        </p>
        {canManage && (
          <p className="text-sm text-gray-500">
            Use the "Add Item" button to add physical hardware items to this resource.
          </p>
        )}
      </div>
    );
  }

  console.log("items: ", items);

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {canManage && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectedItems.length === items.length}
                onChange={handleSelectAll}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">
                Select All ({selectedItems.length}/{items.length})
              </span>
            </label>
            
            {selectedItems.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Bulk Actions ({selectedItems.length})
                </button>
                
                {showBulkActions && (
                  <div className="absolute top-8 left-0 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
                    <button
                      onClick={() => handleBulkStatusUpdate('AVAILABLE')}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Mark as Available
                    </button>
                    <button
                      onClick={() => handleBulkStatusUpdate('MAINTENANCE')}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Mark as Maintenance
                    </button>
                    <button
                      onClick={() => handleBulkStatusUpdate('DAMAGED')}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Mark as Damaged
                    </button>
                    <button
                      onClick={() => handleBulkStatusUpdate('LOST')}
                      className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Mark as Lost
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                {canManage && (
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={() => handleItemSelect(item.id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                )}
                <div className="flex items-center space-x-2">
                  {getStatusIcon(item.status)}
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Item Details */}
            <div className="space-y-2 text-sm">
              {item.serialNumber && (
                <div>
                  <span className="font-medium text-gray-700">Serial:</span>
                  <span className="ml-2 text-gray-900">{item.serialNumber}</span>
                </div>
              )}
              
              {item.hostname && (
                <div>
                  <span className="font-medium text-gray-700">Hostname:</span>
                  <span className="ml-2 text-gray-900">{item.hostname}</span>
                </div>
              )}
              
              {item.ipAddress && (
                <div>
                  <span className="font-medium text-gray-700">IP:</span>
                  <span className="ml-2 text-gray-900">{item.ipAddress}</span>
                </div>
              )}

              {item.operatingSystem && (
                <div>
                  <span className="font-medium text-gray-700">OS:</span>
                  <span className="ml-2 text-gray-900">
                    {item.operatingSystem} {item.osVersion && `(${item.osVersion})`}
                  </span>
                </div>
              )}

              {item.processor && (
                <div>
                  <span className="font-medium text-gray-700">CPU:</span>
                  <span className="ml-2 text-gray-900">{item.processor}</span>
                </div>
              )}

              {item.memory && (
                <div>
                  <span className="font-medium text-gray-700">RAM:</span>
                  <span className="ml-2 text-gray-900">{item.memory}</span>
                </div>
              )}

              {item.storage && (
                <div>
                  <span className="font-medium text-gray-700">Storage:</span>
                  <span className="ml-2 text-gray-900">{item.storage}</span>
                </div>
              )}

              {item.licenseExpiry && (
                <div>
                  <span className="font-medium text-gray-700">License Expiry:</span>
                  <span className="ml-2 text-gray-900">{item.licenseExpiry}</span>
                </div>
              )}

              {item.softwareVersion && (
                <div>
                  <span className="font-medium text-gray-700">Software Version:</span>
                  <span className="ml-2 text-gray-900">{item.softwareVersion}</span>
                </div>
              )}

              {item.licenseType && (
                <div>
                  <span className="font-medium text-gray-700">License Type:</span>
                  <span className="ml-2 text-gray-900">{item.licenseType}</span>
                </div>
              )}

              {/* Custom Metadata */}
              {item.metadata && Object.keys(item.metadata).length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-500 mb-1">Additional Specifications:</div>
                  {Object.entries(item.metadata).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="font-medium text-gray-700">{key}:</span>
                      <span className="ml-2 text-gray-900">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assignment Info */}
            {item.assignments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Assigned to:</span>
                  <div className="mt-1">
                    {item.assignments.map((assignment, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-indigo-600">
                            {assignment.employee.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-gray-900">{assignment.employee.name}</span>
                        <span className="text-gray-500">({assignment.employee.department})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Warranty Info */}
            {item.warrantyExpiry && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  Warranty expires: {new Date(item.warrantyExpiry).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}