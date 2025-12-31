'use client';

import { useState, useEffect } from 'react';
import { useNotification } from './Notification';
import ElegantSelect from './ElegantSelect';
import { getCompanyName } from '@/lib/config/company';
import { getResourceCategories, getCloudProviders } from '@/lib/config/resources';

interface ResourceFormProps {
  resource?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function ResourceForm({ resource, onSubmit, onCancel }: ResourceFormProps) {
  const { showNotification } = useNotification();
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    category: '',
    description: '',
    owner: getCompanyName(), // Company owns all resources
    status: 'ACTIVE',
    quantity: 1, // For Cloud resources
    
    // Physical asset fields
    serialNumber: '',
    modelNumber: '',
    brand: '',
    location: '',
    purchaseDate: '',
    warrantyExpiry: '',
    value: '',
    
    // Technical specifications
    operatingSystem: '',
    osVersion: '',
    processor: '',
    memory: '',
    storage: '',
    
    // Network and connectivity
    ipAddress: '',
    macAddress: '',
    hostname: '',
    
    // Software and licensing
    softwareVersion: '',
    licenseKey: '',
    licenseExpiry: '',
    
    // Cloud and subscription details
    subscriptionId: '',
    subscriptionExpiry: '',
    monthlyRate: '',
    annualRate: '',
    provider: '',
    serviceLevel: '',
    
    // Maintenance
    lastMaintenance: '',
    nextMaintenance: '',
    lastUpdate: '',
    updateVersion: ''
  });

  // Metadata state for Software/Cloud resources
  const [metadataFields, setMetadataFields] = useState<Array<{key: string, value: string}>>([
    { key: '', value: '' }
  ]);

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ceoInfo, setCeoInfo] = useState<any>(null);

  // Reset metadata fields when resource type changes
  const handleTypeChange = (newType: string) => {
    setFormData(prev => ({ ...prev, type: newType }));
    
    // Reset metadata fields for Software/Cloud resources
    if (newType === 'SOFTWARE' || newType === 'CLOUD') {
      setMetadataFields([{ key: '', value: '' }]);
    }
  };

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
    fetchCeoInfo();
    if (resource) {
      setFormData({
        ...formData,
        ...resource,
        purchaseDate: resource.purchaseDate ? new Date(resource.purchaseDate).toISOString().split('T')[0] : '',
        warrantyExpiry: resource.warrantyExpiry ? new Date(resource.warrantyExpiry).toISOString().split('T')[0] : '',
        licenseExpiry: resource.licenseExpiry ? new Date(resource.licenseExpiry).toISOString().split('T')[0] : '',
        subscriptionExpiry: resource.subscriptionExpiry ? new Date(resource.subscriptionExpiry).toISOString().split('T')[0] : '',
        lastMaintenance: resource.lastMaintenance ? new Date(resource.lastMaintenance).toISOString().split('T')[0] : '',
        nextMaintenance: resource.nextMaintenance ? new Date(resource.nextMaintenance).toISOString().split('T')[0] : '',
        lastUpdate: resource.lastUpdate ? new Date(resource.lastUpdate).toISOString().split('T')[0] : '',
        value: resource.value || '',
        monthlyRate: resource.monthlyRate || '',
        annualRate: resource.annualRate || '',
        quantity: resource.quantity || 1
      });

      // Initialize metadata fields if resource has metadata
      if (resource.metadata && typeof resource.metadata === 'object') {
        const metadataEntries = Object.entries(resource.metadata).map(([key, value]) => ({
          key,
          value: String(value)
        }));
        if (metadataEntries.length > 0) {
          setMetadataFields(metadataEntries);
        }
      }
    }
  }, [resource]);

  const fetchCeoInfo = async () => {
    try {
      const response = await fetch('/api/employees/accessible');
      if (response.ok) {
        const data = await response.json();
        const ceo = data.find((emp: any) => emp.role === 'CEO');
        setCeoInfo(ceo);
      }
    } catch (error) {
      console.error('Error fetching CEO info:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build metadata object from key-value pairs for Software/Cloud resources
      const metadata: Record<string, string> = {};
      if (formData.type === 'SOFTWARE' || formData.type === 'CLOUD') {
        metadataFields.forEach(field => {
          if (field.key.trim() && field.value.trim()) {
            metadata[field.key.trim()] = field.value.trim();
          }
        });
      }

      const submitData = {
        ...formData,
        value: formData.value ? parseFloat(formData.value) : null,
        monthlyRate: formData.monthlyRate ? parseFloat(formData.monthlyRate) : null,
        annualRate: formData.annualRate ? parseFloat(formData.annualRate) : null,
        purchaseDate: formData.purchaseDate || null,
        warrantyExpiry: formData.warrantyExpiry || null,
        licenseExpiry: formData.licenseExpiry || null,
        subscriptionExpiry: formData.subscriptionExpiry || null,
        lastMaintenance: formData.lastMaintenance || null,
        nextMaintenance: formData.nextMaintenance || null,
        lastUpdate: formData.lastUpdate || null,
        quantity: formData.type === 'CLOUD' ? parseInt(formData.quantity.toString()) || 1 : null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null
      };

      onSubmit(submitData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const isFieldDisabled = !formData.type;

  const renderFieldsByType = () => {
    if (!formData.type) {
      return (
        <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-blue-800 font-medium">Select a resource type to unlock additional fields</p>
        </div>
      );
    }

    switch (formData.type) {
      case 'PHYSICAL':
        return (
          <>
            <h3 className="col-span-2 text-lg font-medium text-gray-900 border-b pb-2">Physical Asset Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Serial Number</label>
              <input
                type="text"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., SN123456789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Model Number</label>
              <input
                type="text"
                name="modelNumber"
                value={formData.modelNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Business Laptop Pro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Apple, Dell, HP"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Office Floor 2, Desk 15"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Date</label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Warranty Expiry</label>
              <input
                type="date"
                name="warrantyExpiry"
                value={formData.warrantyExpiry}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Value ($)</label>
              <input
                type="number"
                name="value"
                value={formData.value}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 2500"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Processor</label>
              <input
                type="text"
                name="processor"
                value={formData.processor}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Intel i7-12700H"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Memory (RAM)</label>
              <input
                type="text"
                name="memory"
                value={formData.memory}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 16GB DDR4"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Storage</label>
              <input
                type="text"
                name="storage"
                value={formData.storage}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 512GB SSD"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Operating System</label>
              <input
                type="text"
                name="operatingSystem"
                value={formData.operatingSystem}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., macOS, Windows 11"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">OS Version</label>
              <input
                type="text"
                name="osVersion"
                value={formData.osVersion}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 14.2.1, 22H2"
              />
            </div>
          </>
        );

      case 'SOFTWARE':
        return (
          <>
            <h3 className="col-span-2 text-lg font-medium text-gray-900 border-b pb-2">Software License Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Software Version</label>
              <input
                type="text"
                name="softwareVersion"
                value={formData.softwareVersion}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., v2.1.3, 2024.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">License Key</label>
              <input
                type="text"
                name="licenseKey"
                value={formData.licenseKey}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="License key or activation code"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">License Expiry</label>
              <input
                type="date"
                name="licenseExpiry"
                value={formData.licenseExpiry}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Annual Cost ($)</label>
              <input
                type="number"
                name="annualRate"
                value={formData.annualRate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 299"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Provider/Vendor</label>
              <input
                type="text"
                name="provider"
                value={formData.provider}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Design Suite, Office Suite, Communication Platform"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Service Level</label>
              <ElegantSelect
                options={[
                  { value: '', label: 'Select service level' },
                  { value: 'Basic', label: 'Basic', description: 'Standard features' },
                  { value: 'Professional', label: 'Professional', description: 'Enhanced features' },
                  { value: 'Enterprise', label: 'Enterprise', description: 'Full feature set' },
                  { value: 'Premium', label: 'Premium', description: 'Premium support' }
                ]}
                value={formData.serviceLevel}
                onChange={(value) => setFormData(prev => ({ ...prev, serviceLevel: value }))}
                placeholder="Select service level"
                showClearButton={true}
                className="w-full"
                size="md"
              />
            </div>

            {/* Software Metadata Section */}
            <div className="col-span-2">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Software Specifications (Optional)</h4>
              <div className="space-y-3">
                {metadataFields.map((field, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Specification name (e.g., License Type, Max Users, Features)"
                      value={field.key}
                      onChange={(e) => updateMetadataField(index, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g., Per-seat, 50, Advanced Analytics)"
                      value={field.value}
                      onChange={(e) => updateMetadataField(index, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeMetadataField(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
                  className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add Specification</span>
                </button>
              </div>
            </div>
          </>
        );

      case 'CLOUD':
        return (
          <>
            <h3 className="col-span-2 text-lg font-medium text-gray-900 border-b pb-2">Cloud Service Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cloud Provider</label>
              <ElegantSelect
                options={[
                  { value: '', label: 'Select provider' },
                  ...getCloudProviders().map(provider => ({
                    value: provider.value,
                    label: provider.label,
                    description: provider.description,
                    icon: provider.value === 'AWS' ? (
                      <div className="h-4 w-4 bg-orange-500 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-white">A</span>
                      </div>
                    ) : provider.value === 'Azure' ? (
                      <div className="h-4 w-4 bg-blue-500 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-white">M</span>
                      </div>
                    ) : provider.value === 'GCP' ? (
                      <div className="h-4 w-4 bg-red-500 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-white">G</span>
                      </div>
                    ) : undefined
                  }))
                ]}
                value={formData.provider}
                onChange={(value) => setFormData(prev => ({ ...prev, provider: value }))}
                placeholder="Select provider"
                searchable={true}
                showClearButton={true}
                className="w-full"
                size="md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Service Level/Tier</label>
              <input
                type="text"
                name="serviceLevel"
                value={formData.serviceLevel}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., t3.medium, Standard_D2s_v3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subscription ID</label>
              <input
                type="text"
                name="subscriptionId"
                value={formData.subscriptionId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Cloud subscription or instance ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Cost ($)</label>
              <input
                type="number"
                name="monthlyRate"
                value={formData.monthlyRate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 45.50"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Annual Cost ($)</label>
              <input
                type="number"
                name="annualRate"
                value={formData.annualRate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 500"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Expiry</label>
              <input
                type="date"
                name="subscriptionExpiry"
                value={formData.subscriptionExpiry}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantity <span className="text-red-500">*</span></label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 5, 10, 999999 for unlimited"
                min="1"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Number of instances/licenses available (use 999999 for unlimited)</p>
            </div>

            {/* Cloud Metadata Section */}
            <div className="col-span-2">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Cloud Service Specifications (Optional)</h4>
              <div className="space-y-3">
                {metadataFields.map((field, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Specification name (e.g., CPU Cores, RAM, Storage)"
                      value={field.key}
                      onChange={(e) => updateMetadataField(index, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g., 4, 16GB, 100GB SSD)"
                      value={field.value}
                      onChange={(e) => updateMetadataField(index, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeMetadataField(index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
                  className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add Specification</span>
                </button>
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              {resource ? 'Edit Resource' : 'Add New Resource'}
            </h3>
            <button
              type="button"
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <h3 className="col-span-2 text-lg font-medium text-gray-900 border-b pb-2">Basic Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resource Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Business Laptop, Communication Platform, Cloud Instance"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resource Type <span className="text-red-500">*</span>
                </label>
                <ElegantSelect
                  options={[
                    { value: '', label: 'Select resource type to unlock fields', disabled: true },
                    { 
                      value: 'PHYSICAL', 
                      label: 'Physical Asset (Hardware, Equipment)',
                      icon: (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      ),
                      description: 'Laptops, desktops, monitors, phones'
                    },
                    { 
                      value: 'SOFTWARE', 
                      label: 'Software License (Applications, Tools)',
                      icon: (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      ),
                      description: 'Design software, office suites, development tools'
                    },
                    { 
                      value: 'CLOUD', 
                      label: 'Cloud Service (Compute, Storage, SaaS)',
                      icon: (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                      ),
                      description: 'Cloud platforms, storage, SaaS applications'
                    }
                  ]}
                  value={formData.type}
                  onChange={(value) => handleTypeChange(value)}
                  placeholder="🔒 Select resource type to unlock fields"
                  className="w-full"
                  size="md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  disabled={isFieldDisabled}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldDisabled ? 'bg-gray-100 text-gray-500' : ''}`}
                  placeholder="e.g., Laptop, Development Tool, Infrastructure"
                />
              </div>

              {/* Company Ownership Info */}
              <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Resource Ownership</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">Owner (Company)</label>
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 bg-blue-600 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          {getCompanyName().charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-blue-900">{getCompanyName()}</span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">All resources are owned by the company</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">Default Custodian</label>
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 bg-gradient-to-r from-purple-500 to-purple-600 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          {ceoInfo?.name?.charAt(0)?.toUpperCase() || 'C'}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-blue-900">
                        {ceoInfo?.name || 'CEO'} (CEO)
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">CEO manages all resources by default</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <ElegantSelect
                  options={[
                    { 
                      value: 'ACTIVE', 
                      label: 'Active',
                      icon: (
                        <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ),
                      description: 'Resource is available and working'
                    },
                    { 
                      value: 'RETURNED', 
                      label: 'Returned',
                      icon: (
                        <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      ),
                      description: 'Resource has been returned'
                    },
                    { 
                      value: 'LOST', 
                      label: 'Lost',
                      icon: (
                        <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      ),
                      description: 'Resource is lost or missing'
                    },
                    { 
                      value: 'DAMAGED', 
                      label: 'Damaged',
                      icon: (
                        <svg className="h-4 w-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      ),
                      description: 'Resource is damaged'
                    }
                  ]}
                  value={formData.status}
                  onChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  disabled={isFieldDisabled}
                  className="w-full"
                  size="md"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={isFieldDisabled}
                  rows={3}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldDisabled ? 'bg-gray-100 text-gray-500' : ''}`}
                  placeholder="Detailed description of the resource..."
                />
              </div>

              {/* Dynamic fields based on resource type */}
              {renderFieldsByType()}
            </div>
            
            <div className="flex justify-end space-x-3 mt-8 pt-6 border-t">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Saving...' : (resource ? 'Update Resource' : 'Create Resource')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}