'use client';

import { useState } from 'react';

interface MetadataField {
  key: string;
  value: string;
}

interface ResourceItemFormProps {
  resourceId: string;
  resourceType: 'PHYSICAL' | 'SOFTWARE' | 'CLOUD';
  resourceName: string;
  onItemCreated?: () => void;
  onClose?: () => void;
}

export default function ResourceItemForm({ 
  resourceId, 
  resourceType,
  resourceName,
  onItemCreated, 
  onClose 
}: ResourceItemFormProps) {
  const [formData, setFormData] = useState({
    // Common fields
    serialNumber: '',
    hostname: '',
    purchaseDate: '',
    warrantyExpiry: '',
    value: '',
    
    // Software-specific fields
    licenseKey: '',
    softwareVersion: '',
    licenseType: '',
    maxUsers: '',
    licenseExpiry: '',
    activationCode: ''
  });
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>([
    { key: '', value: '' }
  ]);
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build metadata object from key-value pairs
      const metadata: Record<string, string> = {};
      metadataFields.forEach(field => {
        if (field.key.trim() && field.value.trim()) {
          metadata[field.key.trim()] = field.value.trim();
        }
      });

      const submitData = {
        resourceId,
        ...formData,
        purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate).toISOString() : null,
        warrantyExpiry: formData.warrantyExpiry ? new Date(formData.warrantyExpiry).toISOString() : null,
        licenseExpiry: formData.licenseExpiry ? new Date(formData.licenseExpiry).toISOString() : null,
        value: formData.value ? parseFloat(formData.value) : null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        
        // For software items, use licenseKey as the unique identifier instead of serialNumber
        serialNumber: resourceType === 'SOFTWARE' ? formData.licenseKey : formData.serialNumber
      };

      const response = await fetch('/api/resources/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        onItemCreated?.();
        onClose?.();
      } else {
        console.error('Failed to create item');
      }
    } catch (error) {
      console.error('Error creating item:', error);
    } finally {
      setLoading(false);
    }
  };

  // Common hardware specification suggestions
  const commonHardwareSpecs = [
    // Core Hardware
    'Processor', 'CPU', 'CPU Cores', 'CPU Speed', 'Memory (RAM)', 'RAM', 'Storage Type', 
    'Storage Capacity', 'Hard Drive', 'SSD', 'Graphics Card', 'GPU', 'Motherboard',
    
    // System & Software
    'Operating System', 'OS Version', 'BIOS Version', 'Firmware Version',
    
    // Network & Connectivity
    'Network Interface', 'WiFi', 'Bluetooth', 'Ethernet', 'IP Address', 'MAC Address',
    'USB Ports', 'HDMI Ports', 'Display Ports',
    
    // Physical Attributes
    'Model Number', 'Brand', 'Manufacturer', 'Serial Number', 'Asset Tag', 'Barcode', 
    'RFID Tag', 'Screen Size', 'Resolution', 'Display Type', 'Dimensions', 'Weight', 
    'Color', 'Form Factor',
    
    // Power & Performance
    'Power Supply', 'Power Consumption', 'Battery Life', 'Battery Type', 'Cooling System',
    'Fan Speed', 'Temperature Rating',
    
    // Location & Status
    'Location', 'Department', 'Building', 'Room Number', 'Rack Position', 'Condition',
    'Warranty Status', 'Service Tag',
    
    // Custom Fields
    'Purchase Price', 'Vendor', 'Support Contact', 'Configuration',
    'Special Features', 'Accessories Included', 'Notes'
  ];

  // Software-specific specification suggestions
  const commonSoftwareSpecs = [
    // License Information
    'License Type', 'License Model', 'Licensing Terms', 'License Duration', 'Renewal Date',
    'License Agreement', 'License Restrictions', 'Concurrent Users', 'Named Users',
    
    // Version & Compatibility
    'Software Version', 'Build Number', 'Release Date', 'Supported OS', 'System Requirements',
    'Minimum RAM', 'Minimum Storage', 'Compatible Versions', 'Dependencies',
    
    // Features & Modules
    'Included Features', 'Available Modules', 'Add-ons', 'Plugins', 'Extensions',
    'Premium Features', 'Enterprise Features', 'API Access', 'Integration Support',
    
    // Support & Maintenance
    'Support Level', 'Support Expiry', 'Maintenance Plan', 'Update Policy', 'Vendor Contact',
    'Support Portal', 'Documentation', 'Training Included', 'Implementation Support',
    
    // Usage & Deployment
    'Installation Method', 'Deployment Type', 'Cloud/On-Premise', 'Multi-tenant', 'Single Sign-On',
    'User Management', 'Role-based Access', 'Audit Logging', 'Backup Support',
    
    // Business Information
    'Vendor', 'Reseller', 'Purchase Order', 'Contract Number', 'Billing Frequency',
    'Cost per User', 'Total Cost', 'Renewal Cost', 'Upgrade Path', 'Migration Support'
  ];

  const getSpecSuggestions = () => {
    return resourceType === 'SOFTWARE' ? commonSoftwareSpecs : commonHardwareSpecs;
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-6 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Add {resourceType === 'SOFTWARE' ? 'Software License' : 'Hardware Item'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {resourceType === 'SOFTWARE' 
                ? `Add a new license/instance for ${resourceName}`
                : `Add a new hardware item for ${resourceName}`
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Essential Fields - Different for Physical vs Software */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-4">
              {resourceType === 'SOFTWARE' ? 'License Information' : 'Essential Information'}
            </h4>
            
            {resourceType === 'SOFTWARE' ? (
              // Software License Fields
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.licenseKey}
                    onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., XXXXX-XXXXX-XXXXX-XXXXX"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Software Version</label>
                  <input
                    type="text"
                    value={formData.softwareVersion}
                    onChange={(e) => setFormData({ ...formData, softwareVersion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., 2024.1, v16.2.1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Type</label>
                  <input
                    type="text"
                    value={formData.licenseType}
                    onChange={(e) => setFormData({ ...formData, licenseType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Per-seat, Concurrent, Site License"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Users</label>
                  <input
                    type="text"
                    value={formData.maxUsers}
                    onChange={(e) => setFormData({ ...formData, maxUsers: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., 1, 5, Unlimited"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry</label>
                  <input
                    type="date"
                    value={formData.licenseExpiry}
                    onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Activation Code</label>
                  <input
                    type="text"
                    value={formData.activationCode}
                    onChange={(e) => setFormData({ ...formData, activationCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Additional activation code if needed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., 299.99"
                  />
                </div>
              </div>
            ) : (
              // Physical Hardware Fields
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serial Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., ABC123456789"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hostname</label>
                  <input
                    type="text"
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., LAPTOP-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Expiry</label>
                  <input
                    type="date"
                    value={formData.warrantyExpiry}
                    onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., 1299.99"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Flexible Metadata Fields */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-medium text-gray-900">
                  {resourceType === 'SOFTWARE' ? 'Software Specifications' : 'Hardware Specifications'}
                </h4>
                <p className="text-sm text-gray-600">
                  {resourceType === 'SOFTWARE' 
                    ? 'Add any software specifications as key-value pairs. You can enter any specification name you want.'
                    : 'Add any hardware specifications as key-value pairs. You can enter any specification name you want.'
                  }
                </p>
              </div>
              <button
                type="button"
                onClick={addMetadataField}
                className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
              >
                + Add Field
              </button>
            </div>

            <div className="space-y-3">
              {metadataFields.map((field, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={field.key}
                      onChange={(e) => updateMetadataField(index, 'key', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder={resourceType === 'SOFTWARE' 
                        ? "Enter any specification name (e.g., License Type, Max Users, etc.)"
                        : "Enter any specification name (e.g., Graphics Card, Screen Size, etc.)"
                      }
                      list={`specs-${index}`}
                    />
                    <datalist id={`specs-${index}`}>
                      {getSpecSuggestions().map(spec => (
                        <option key={spec} value={spec} />
                      ))}
                    </datalist>
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => updateMetadataField(index, 'value', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter the specification value"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMetadataField(index)}
                    disabled={metadataFields.length === 1}
                    className="p-2 text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Common Specs Quick Add */}
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Quick Add Common Specs (Optional Suggestions):</p>
              <p className="text-xs text-gray-500 mb-3">Click any suggestion below to add it, or type your own custom specifications above.</p>
              <div className="flex flex-wrap gap-2">
                {['Processor', 'Memory (RAM)', 'Storage Capacity', 'Operating System', 'Graphics Card', 'Network Interface'].map(spec => (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => {
                      const emptyIndex = metadataFields.findIndex(f => !f.key.trim());
                      if (emptyIndex !== -1) {
                        updateMetadataField(emptyIndex, 'key', spec);
                      } else {
                        setMetadataFields([...metadataFields, { key: spec, value: '' }]);
                      }
                    }}
                    className="px-2 py-1 text-xs bg-white border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-50 transition-colors"
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Create Hardware Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}