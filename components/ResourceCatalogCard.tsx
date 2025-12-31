'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

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

interface ResourceCatalogCardProps {
  resource: ResourceCatalog;
  onEdit?: (resource: ResourceCatalog) => void;
  onDelete?: (resourceId: string) => void;
  onViewDetails: (resourceId: string) => void;
}

export default function ResourceCatalogCard({
  resource,
  onEdit,
  onDelete,
  onViewDetails
}: ResourceCatalogCardProps) {
  const [showActions, setShowActions] = useState(false);
  const {user} = useAuth();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PHYSICAL':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'SOFTWARE':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        );
      case 'CLOUD':
        return (
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PHYSICAL':
        return 'bg-blue-100 text-blue-800';
      case 'SOFTWARE':
        return 'bg-green-100 text-green-800';
      case 'CLOUD':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'RETURNED':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOST':
        return 'bg-red-100 text-red-800';
      case 'DAMAGED':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAvailabilityColor = (available: number, total: number) => {
    if (total === 999) return 'text-green-600'; // Unlimited (software/cloud)
    const percentage = (available / total) * 100;
    if (percentage > 50) return 'text-green-600';
    if (percentage > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gray-50 rounded-lg">
              {getTypeIcon(resource.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {resource.name}
              </h3>
              <p className="text-xs text-gray-500 truncate">
                {resource.category}
              </p>
            </div>
          </div>
          
          {(onEdit || onDelete) && (
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
              
              {showActions && (
                <div className="absolute right-0 top-8 w-32 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
                  {onEdit && (
                    <button
                      onClick={() => {
                        onEdit(resource);
                        setShowActions(false);
                      }}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        onDelete(resource.id);
                        setShowActions(false);
                      }}
                      className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Type and Status Badges */}
        <div className="flex items-center space-x-2 mt-3">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(resource.type)}`}>
            {resource.type}
          </span>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(resource.status)}`}>
            {resource.status}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Description */}
        {resource.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {resource.description}
          </p>
        )}

        {/* Availability */}
        {/* <div className="mb-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Availability</span>
            <span className={`font-medium ${getAvailabilityColor(resource.availability.available, resource.availability.total)}`}>
              {resource.availability.available === 999 
                ? 'Unlimited' 
                : `${resource.availability.available}/${resource.availability.total}`
              }
            </span>
          </div>
          
          {resource.availability.total !== 999 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  resource.availability.available > resource.availability.total * 0.5
                    ? 'bg-green-500'
                    : resource.availability.available > resource.availability.total * 0.2
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{
                  width: `${Math.max(5, (resource.availability.available / resource.availability.total) * 100)}%`
                }}
              />
            </div>
          )}
        </div> */}

        {/* Stats */}
        {/* <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="font-semibold text-gray-900">
            </div>
            <div className="text-xs text-gray-500">
              {resource.type === 'PHYSICAL' ? 'Items' : 'Seats'}
            </div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="font-semibold text-gray-900">
              {resource.availability.assigned}
            </div>
            <div className="text-xs text-gray-500">Assigned</div>
          </div>
        </div> */}

        {/* Custodian */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-indigo-600">
                {resource.custodian.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">
                {resource.custodian.name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {resource.custodian.department}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
     {user?.role === "CEO" && <div className="px-4 py-3 bg-gray-50 rounded-b-lg">
        <button
          onClick={() => onViewDetails(resource.id)}
          className="w-full text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          View Details →
        </button>
      </div>}
    </div>
  );
}