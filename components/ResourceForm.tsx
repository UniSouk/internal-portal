'use client';

import { useState, useEffect } from 'react';
import { useNotification } from './Notification';
import ElegantSelect from './ElegantSelect';

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
    owner: 'Unisouk', // Company owns all resources
    totalQuantity: 1, // Default quantity
    status: 'ACTIVE',
    defaultPermission: 'READ', // Default permission for software/cloud resources
    
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

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ceoInfo, setCeoInfo] = useState<any>(null);

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
        totalQuantity: resource.totalQuantity || 1,
        defaultPermission: resource.defaultPermission || 'READ'
      });
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

    // Validate total quantity
    const totalQuantity = parseInt(formData.totalQuantity.toString()) || 0;
    if (totalQuantity <= 0) {
      showNotification('warning', 'Invalid Quantity', 'Total quantity must be greater than 0.');
      setLoading(false);
      return;
    }

    try {
      const submitData = {
        ...formData,
        totalQuantity,
        value: formData.value ? parseFloat(formData.value) : null,
        monthlyRate: formData.monthlyRate ? parseFloat(formData.monthlyRate) : null,
        annualRate: formData.annualRate ? parseFloat(formData.annualRate) : null,
        purchaseDate: formData.purchaseDate || null,
        warrantyExpiry: formData.warrantyExpiry || null,
        licenseExpiry: formData.licenseExpiry || null,
        subscriptionExpiry: formData.subscriptionExpiry || null,
        lastMaintenance: formData.lastMaintenance || null,
        nextMaintenance: formData.nextMaintenance || null,
        lastUpdate: formData.lastUpdate || null
      };

      console.log('Submitting resource data:', submitData);
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
                placeholder="e.g., MacBook Pro 16-inch"
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
                placeholder="e.g., Adobe, Microsoft, Slack"
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

            {/* Default Permission Level for Software */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Permission Level
                <span className="text-sm text-gray-500 block">Default access level when assigned to employees</span>
              </label>
              <ElegantSelect
                options={[
                  { 
                    value: 'READ', 
                    label: 'Read Only',
                    icon: (
                      <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ),
                    description: 'View and read data only'
                  },
                  { 
                    value: 'WRITE', 
                    label: 'Write Access',
                    icon: (
                      <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    ),
                    description: 'Create and modify data'
                  },
                  { 
                    value: 'EDIT', 
                    label: 'Full Edit',
                    icon: (
                      <svg className="h-4 w-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                    ),
                    description: 'Full editing capabilities including delete'
                  }
                ]}
                value={formData.defaultPermission}
                onChange={(value) => setFormData(prev => ({ ...prev, defaultPermission: value }))}
                placeholder="Select default permission"
                className="w-full"
                size="md"
              />
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
                  { 
                    value: 'AWS', 
                    label: 'Amazon Web Services (AWS)',
                    icon: (
                      <div className="h-4 w-4 bg-orange-500 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-white">A</span>
                      </div>
                    ),
                    description: 'Amazon cloud services'
                  },
                  { 
                    value: 'Azure', 
                    label: 'Microsoft Azure',
                    icon: (
                      <div className="h-4 w-4 bg-blue-500 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-white">M</span>
                      </div>
                    ),
                    description: 'Microsoft cloud platform'
                  },
                  { 
                    value: 'GCP', 
                    label: 'Google Cloud Platform',
                    icon: (
                      <div className="h-4 w-4 bg-red-500 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-white">G</span>
                      </div>
                    ),
                    description: 'Google cloud services'
                  },
                  { value: 'DigitalOcean', label: 'DigitalOcean', description: 'Simple cloud hosting' },
                  { value: 'Heroku', label: 'Heroku', description: 'Platform as a service' },
                  { value: 'Vercel', label: 'Vercel', description: 'Frontend cloud platform' },
                  { value: 'Other', label: 'Other', description: 'Other cloud provider' }
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

            {/* Default Permission Level for Cloud */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Permission Level
                <span className="text-sm text-gray-500 block">Default access level when assigned to employees</span>
              </label>
              <ElegantSelect
                options={[
                  { 
                    value: 'READ', 
                    label: 'Read Only',
                    icon: (
                      <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ),
                    description: 'View and read data only'
                  },
                  { 
                    value: 'WRITE', 
                    label: 'Write Access',
                    icon: (
                      <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    ),
                    description: 'Create and modify data'
                  },
                  { 
                    value: 'EDIT', 
                    label: 'Full Edit',
                    icon: (
                      <svg className="h-4 w-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                    ),
                    description: 'Full editing capabilities including delete'
                  }
                ]}
                value={formData.defaultPermission}
                onChange={(value) => setFormData(prev => ({ ...prev, defaultPermission: value }))}
                placeholder="Select default permission"
                className="w-full"
                size="md"
              />
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
          <h3 className="text-lg font-medium text-gray-900 mb-6">
            {resource ? 'Edit Resource' : 'Add New Resource'}
          </h3>
          
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
                  placeholder="e.g., MacBook Pro, Slack Workspace, AWS EC2"
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
                      description: 'Adobe, Office, development tools'
                    },
                    { 
                      value: 'CLOUD', 
                      label: 'Cloud Service (AWS, Azure, SaaS)',
                      icon: (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                      ),
                      description: 'AWS, Azure, Google Cloud, SaaS'
                    }
                  ]}
                  value={formData.type}
                  onChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="totalQuantity"
                  value={formData.totalQuantity}
                  onChange={handleChange}
                  required
                  min="1"
                  disabled={isFieldDisabled}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldDisabled ? 'bg-gray-100 text-gray-500' : ''}`}
                  placeholder="e.g., 5"
                />
                <p className="mt-1 text-xs text-gray-500">
                  How many units of this resource does the company own?
                </p>
              </div>

              {/* Company Ownership Info */}
              <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Resource Ownership</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">Owner (Company)</label>
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 bg-blue-600 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-white">U</span>
                      </div>
                      <span className="text-sm font-medium text-blue-900">Unisouk</span>
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