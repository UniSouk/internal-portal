'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ElegantSelect from '@/components/ElegantSelect';

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
}

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
}

interface ResourceCatalogFormProps {
  resource?: ResourceCatalog | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function ResourceCatalogForm({
  resource,
  onSubmit,
  onCancel
}: ResourceCatalogFormProps) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'PHYSICAL' as 'PHYSICAL' | 'SOFTWARE' | 'CLOUD',
    category: '',
    description: '',
    custodianId: user?.id || '',
    status: 'ACTIVE',
    quantity: 1, // For Cloud resources
    metadata: {} as Record<string, string> // For Software/Cloud resources
  });

  // Metadata state for Software/Cloud resources
  const [metadataFields, setMetadataFields] = useState<Array<{key: string, value: string}>>([
    { key: '', value: '' }
  ]);

  // Metadata helper functions
  const addMetadataField = () => {
    setMetadataFields([...metadataFields, { key: '', value: '' }]);
  };

  const removeMetadataField = (index: number) => {
    if (metadataFields.length > 1) {
      setMetadataFields(metadataFields.filter((_, i) => i !== index));
    }
  };

  const updateMetadataField = (index: number, field: 'key' | 'value', newValue: string) => {
    const updated = metadataFields.map((item, i) => 
      i === index ? { ...item, [field]: newValue } : item
    );
    setMetadataFields(updated);
  };

  useEffect(() => {
    fetchEmployees();
    
    if (resource) {
      setFormData({
        name: resource.name,
        type: resource.type,
        category: resource.category,
        description: resource.description || '',
        custodianId: resource.custodian.id,
        status: resource.status,
        quantity: (resource as any).quantity || 1,
        metadata: (resource as any).metadata || {}
      });

      // Initialize metadata fields if resource has metadata
      if ((resource as any).metadata && typeof (resource as any).metadata === 'object') {
        const metadataEntries = Object.entries((resource as any).metadata).map(([key, value]) => ({
          key,
          value: String(value)
        }));
        if (metadataEntries.length > 0) {
          setMetadataFields(metadataEntries);
        }
      }
    }
  }, [resource, user]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees?limit=100');
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
    
    try {
      // Build metadata object from key-value pairs for Cloud resources only
      const metadata: Record<string, string> = {};
      if (formData.type === 'CLOUD') {
        metadataFields.forEach(field => {
          if (field.key.trim() && field.value.trim()) {
            metadata[field.key.trim()] = field.value.trim();
          }
        });
      }

      const submitData = {
        ...formData,
        quantity: formData.type === 'CLOUD' ? parseInt(formData.quantity.toString()) || 1 : null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null
      };

      await onSubmit(submitData);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Reset metadata fields when resource type changes to Cloud
    if (field === 'type' && value === 'CLOUD') {
      setMetadataFields([{ key: '', value: '' }]);
    }
  };

  const typeOptions = [
    { value: 'PHYSICAL', label: 'Physical Hardware', description: 'Laptops, desktops, monitors, etc.' },
    { value: 'SOFTWARE', label: 'Software Licenses', description: 'Applications, tools, subscriptions' },
    { value: 'CLOUD', label: 'Cloud Services', description: 'SaaS, PaaS, cloud platforms' }
  ];

  const statusOptions = [
    { value: 'ACTIVE', label: 'Active', description: 'Available for assignment' },
    { value: 'RETURNED', label: 'Returned', description: 'Returned to inventory' },
    { value: 'LOST', label: 'Lost', description: 'Missing or lost' },
    { value: 'DAMAGED', label: 'Damaged', description: 'Needs repair or replacement' }
  ];

  const custodianOptions = employees.map(emp => ({
    value: emp.id,
    label: emp.name,
    description: `${emp.email} • ${emp.department}`
  }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {resource ? 'Edit Resource' : 'Add New Resource'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {resource ? 'Update resource catalog entry' : 'Create a new resource catalog entry'}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resource Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., MacBook Pro 16-inch, Figma License, AWS EC2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resource Type *
              </label>
              <ElegantSelect
                value={formData.type}
                onChange={(value) => {
                  handleChange('type', value);
                  // Note: We no longer reset category when type changes to allow custom categories
                }}
                options={typeOptions}
                placeholder="Select resource type"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Laptop, Design Software, Cloud Platform"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a custom category or use common ones like: Laptop, Desktop, Monitor, Software License, Cloud Service, etc.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Brief description of the resource..."
              />
            </div>
          </div>

          {/* Management */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Management</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custodian *
              </label>
              <ElegantSelect
                value={formData.custodianId}
                onChange={(value) => handleChange('custodianId', value)}
                options={custodianOptions}
                placeholder="Select custodian"
                searchable
              />
              <p className="text-xs text-gray-500 mt-1">
                The person responsible for managing this resource
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <ElegantSelect
                value={formData.status}
                onChange={(value) => handleChange('status', value)}
                options={statusOptions}
                placeholder="Select status"
              />
            </div>

            {/* Cloud Quantity Field */}
            {formData.type === 'CLOUD' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., 5, 10, 999999 for unlimited"
                  min="1"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Number of instances/licenses available (use 999999 for unlimited)</p>
              </div>
            )}
          </div>

          {/* Software/Cloud Metadata Section - Only for Cloud now */}
          {formData.type === 'CLOUD' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">
                Cloud Service Specifications (Optional)
              </h3>
              
              <div className="space-y-3">
                {metadataFields.map((field, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Specification name (e.g., CPU Cores, RAM, Storage)"
                      value={field.key}
                      onChange={(e) => updateMetadataField(index, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g., 4, 16GB, 100GB SSD)"
                      value={field.value}
                      onChange={(e) => updateMetadataField(index, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeMetadataField(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      disabled={metadataFields.length === 1}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addMetadataField}
                  className="flex items-center space-x-2 px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add Specification</span>
                </button>
              </div>
            </div>
          )}

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Resource Catalog vs Items</p>
                <p>
                  This creates a catalog entry (e.g., "Microsoft Office"). 
                  For physical resources, you'll add individual items (with serial numbers) separately.
                  For software resources, you'll add individual licenses (with license keys) separately.
                  Cloud resources work with quantity-based assignments.
                  {formData.type === 'CLOUD' && ' Cloud resources require a quantity to track available instances.'}
                  {formData.type === 'CLOUD' && ' Use specifications to store additional details like technical specs.'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name || !formData.custodianId || (formData.type === 'CLOUD' && (!formData.quantity || formData.quantity < 1))}
              className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : resource ? 'Update Resource' : 'Create Resource'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}