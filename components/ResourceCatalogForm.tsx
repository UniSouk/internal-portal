'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ElegantSelect from '@/components/ElegantSelect';
import PropertySelector from '@/components/PropertySelector';
import { Plus, X, Loader2 } from 'lucide-react';
import { 
  PropertyDefinition, 
  ResourceTypeEntity, 
  ResourceCategoryEntity,
  AllocationType
} from '@/types/resource-structure';

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
  // New fields for enhanced resource structure
  resourceTypeId?: string;
  resourceCategoryId?: string;
  propertySchema?: PropertyDefinition[];
  schemaLocked?: boolean;
  items?: any[]; // Items array to check if schema can be edited
  allocationType?: AllocationType;
  quantity?: number;
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

  // Resource types and categories from API
  const [resourceTypes, setResourceTypes] = useState<ResourceTypeEntity[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<ResourceCategoryEntity[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // New category creation state
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Property selection state
  const [selectedProperties, setSelectedProperties] = useState<PropertyDefinition[]>([]);
  const [showPropertySelector, setShowPropertySelector] = useState(false);
  const [propertyError, setPropertyError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'PHYSICAL' as 'PHYSICAL' | 'SOFTWARE' | 'CLOUD',
    category: '',
    description: '',
    custodianId: user?.id || '',
    status: 'ACTIVE',
    quantity: -1, // Default to unlimited for SHARED allocation
    allocationType: 'EXCLUSIVE' as AllocationType,
    metadata: {} as Record<string, string>,
    // New fields for enhanced resource structure
    resourceTypeId: '',
    resourceCategoryId: '',
  });

  // Metadata state for Cloud resources
  const [metadataFields, setMetadataFields] = useState<Array<{key: string, value: string}>>([
    { key: '', value: '' }
  ]);

  // Get selected resource type name for PropertySelector
  const selectedTypeName = resourceTypes.find(t => t.id === formData.resourceTypeId)?.name;
  
  // Get mandatory properties for the selected type
  const selectedTypeMandatoryProperties = resourceTypes.find(t => t.id === formData.resourceTypeId)?.mandatoryProperties || [];

  // Fetch resource types from API
  // Requirement 6.1: Provide dropdown menus for type and category selection
  useEffect(() => {
    const fetchResourceTypes = async () => {
      setLoadingTypes(true);
      try {
        const response = await fetch('/api/resource-types');
        if (response.ok) {
          const data = await response.json();
          setResourceTypes(data.types || []);
        }
      } catch (error) {
        console.error('Error fetching resource types:', error);
      } finally {
        setLoadingTypes(false);
      }
    };
    fetchResourceTypes();
  }, []);

  // Fetch categories when type changes
  // Requirement 6.2: Filter categories to show only those belonging to the selected type
  useEffect(() => {
    const fetchCategories = async () => {
      if (!formData.resourceTypeId) {
        setFilteredCategories([]);
        return;
      }
      
      setLoadingCategories(true);
      try {
        const response = await fetch(`/api/resource-categories?resourceTypeId=${formData.resourceTypeId}`);
        if (response.ok) {
          const data = await response.json();
          setFilteredCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [formData.resourceTypeId]);

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

  // Map type name to legacy enum
  const mapTypeNameToLegacy = (typeName: string): 'PHYSICAL' | 'SOFTWARE' | 'CLOUD' => {
    const mapping: Record<string, 'PHYSICAL' | 'SOFTWARE' | 'CLOUD'> = {
      'Hardware': 'PHYSICAL',
      'Software': 'SOFTWARE',
      'Cloud': 'CLOUD',
    };
    return mapping[typeName] || 'PHYSICAL';
  };

  // Handle resource type change
  const handleTypeChange = (typeId: string) => {
    const selectedType = resourceTypes.find(t => t.id === typeId);
    const legacyType = mapTypeNameToLegacy(selectedType?.name || '');
    
    setFormData(prev => ({
      ...prev,
      resourceTypeId: typeId,
      resourceCategoryId: '', // Clear category when type changes
      type: legacyType,
    }));
    
    // Show property selector when type is selected
    if (typeId) {
      setShowPropertySelector(true);
    }
    
    // Clear selected properties when type changes
    setSelectedProperties([]);
    setPropertyError(null);

    // Reset metadata fields when resource type changes to Cloud
    if (selectedType?.name === 'Cloud') {
      setMetadataFields([{ key: '', value: '' }]);
    }
  };

  // Handle category change
  const handleCategoryChange = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      resourceCategoryId: categoryId,
    }));
    setCategoryError(null);
  };

  // Create new category inline
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setCategoryError('Category name is required');
      return;
    }

    if (!formData.resourceTypeId) {
      setCategoryError('Please select a resource type first');
      return;
    }

    setCreatingCategory(true);
    setCategoryError(null);

    try {
      const response = await fetch('/api/resource-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim() || undefined,
          resourceTypeId: formData.resourceTypeId,
        }),
      });

      if (response.ok) {
        const newCategory = await response.json();
        // Add to filtered categories
        setFilteredCategories(prev => [...prev, newCategory]);
        // Select the new category
        setFormData(prev => ({
          ...prev,
          resourceCategoryId: newCategory.id,
        }));
        // Reset form
        setNewCategoryName('');
        setNewCategoryDescription('');
        setShowNewCategoryForm(false);
      } else {
        const errorData = await response.json();
        setCategoryError(errorData.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      setCategoryError('An error occurred while creating the category');
    } finally {
      setCreatingCategory(false);
    }
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
        quantity: resource.quantity ?? -1,
        allocationType: resource.allocationType || 'EXCLUSIVE',
        metadata: (resource as any).metadata || {},
        resourceTypeId: resource.resourceTypeId || '',
        resourceCategoryId: resource.resourceCategoryId || '',
      });

      // Load existing property schema if editing
      if (resource.propertySchema && Array.isArray(resource.propertySchema)) {
        setSelectedProperties(resource.propertySchema);
        setShowPropertySelector(true);
      }

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
    setPropertyError(null);
    
    try {
      // Validate property selection for new resources
      // Requirement 12.7: Validate that at least one property is selected
      if (formData.resourceTypeId && selectedProperties.length === 0 && !resource) {
        setPropertyError('Please select at least one property for this resource');
        setLoading(false);
        return;
      }

      // Build metadata object from key-value pairs for Cloud resources only
      const metadata: Record<string, string> = {};
      if (selectedTypeName === 'Cloud') {
        metadataFields.forEach(field => {
          if (field.key.trim() && field.value.trim()) {
            metadata[field.key.trim()] = field.value.trim();
          }
        });
      }

      const submitData = {
        ...formData,
        // Include selected properties for new resource structure
        selectedProperties: selectedProperties,
        quantity: formData.allocationType === 'SHARED' ? formData.quantity : null,
        allocationType: formData.allocationType,
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
  };

  // Build type options for dropdown from API data
  const typeOptions = loadingTypes 
    ? [{ value: '', label: 'Loading types...', disabled: true }]
    : [
        { value: '', label: 'Select resource type', disabled: true },
        ...resourceTypes.map(type => ({
          value: type.id,
          label: type.name,
          description: type.description || getTypeDescription(type.name),
          icon: getTypeIcon(type.name),
        })),
      ];

  // Build category options for dropdown - Category is now MANDATORY
  const categoryOptions = loadingCategories
    ? [{ value: '', label: 'Loading categories...', disabled: true }]
    : [
        { value: '', label: 'Select category *', disabled: true },
        ...filteredCategories.map(cat => ({
          value: cat.id,
          label: cat.name,
          description: cat.description || undefined,
        })),
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

  // Get description for resource type
  function getTypeDescription(typeName: string): string {
    switch (typeName) {
      case 'Hardware': return 'Laptops, desktops, monitors, etc.';
      case 'Software': return 'Applications, tools, subscriptions';
      case 'Cloud': return 'SaaS, PaaS, cloud platforms';
      default: return '';
    }
  }

  // Get icon for resource type
  function getTypeIcon(typeName: string) {
    switch (typeName) {
      case 'Hardware':
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'Software':
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'Cloud':
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        );
      default:
        return null;
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
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

            {/* Resource Type Selection - Requirement 6.1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resource Type *
              </label>
              <ElegantSelect
                value={formData.resourceTypeId}
                onChange={handleTypeChange}
                options={typeOptions}
                placeholder="Select resource type"
                disabled={loadingTypes}
              />
            </div>

            {/* Resource Category Selection - MANDATORY with inline creation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              
              {!showNewCategoryForm ? (
                <div className="space-y-2">
                  <ElegantSelect
                    value={formData.resourceCategoryId}
                    onChange={handleCategoryChange}
                    options={categoryOptions}
                    placeholder={formData.resourceTypeId ? "Select category *" : "Select a type first"}
                    disabled={!formData.resourceTypeId || loadingCategories}
                  />
                  
                  {/* Create New Category Button */}
                  {formData.resourceTypeId && (
                    <button
                      type="button"
                      onClick={() => setShowNewCategoryForm(true)}
                      className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create new category
                    </button>
                  )}
                  
                  {!formData.resourceTypeId && (
                    <p className="text-xs text-gray-500">Select a resource type to see available categories</p>
                  )}
                  
                  {formData.resourceTypeId && filteredCategories.length === 0 && !loadingCategories && (
                    <p className="text-xs text-amber-600">No categories available for this type. Please create one.</p>
                  )}
                </div>
              ) : (
                /* Inline New Category Form */
                <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-indigo-900">Create New Category</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCategoryForm(false);
                        setNewCategoryName('');
                        setNewCategoryDescription('');
                        setCategoryError(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Category Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g., Laptop, Desktop, SaaS Tool"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={newCategoryDescription}
                      onChange={(e) => setNewCategoryDescription(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Brief description of this category"
                    />
                  </div>
                  
                  {categoryError && (
                    <p className="text-xs text-red-600">{categoryError}</p>
                  )}
                  
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCategoryForm(false);
                        setNewCategoryName('');
                        setNewCategoryDescription('');
                        setCategoryError(null);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={creatingCategory || !newCategoryName.trim()}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center"
                    >
                      {creatingCategory && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      {creatingCategory ? 'Creating...' : 'Create Category'}
                    </button>
                  </div>
                </div>
              )}
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

            {/* Allocation Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Allocation Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('allocationType', 'EXCLUSIVE')}
                  className={`p-3 rounded-lg border-2 text-left transition-all duration-200 ${
                    formData.allocationType === 'EXCLUSIVE'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                      formData.allocationType === 'EXCLUSIVE' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className={`text-sm font-medium ${formData.allocationType === 'EXCLUSIVE' ? 'text-indigo-900' : 'text-gray-900'}`}>
                        Exclusive
                      </h4>
                      <p className="text-xs text-gray-500">One item per employee</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleChange('allocationType', 'SHARED')}
                  className={`p-3 rounded-lg border-2 text-left transition-all duration-200 ${
                    formData.allocationType === 'SHARED'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                      formData.allocationType === 'SHARED' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className={`text-sm font-medium ${formData.allocationType === 'SHARED' ? 'text-indigo-900' : 'text-gray-900'}`}>
                        Shared
                      </h4>
                      <p className="text-xs text-gray-500">Multiple employees can share</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Quantity field for SHARED allocation */}
            {formData.allocationType === 'SHARED' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity / Seats
                </label>
                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={formData.quantity === -1 ? '' : formData.quantity}
                      onChange={(e) => {
                        const val = e.target.value === '' ? -1 : parseInt(e.target.value);
                        handleChange('quantity', val);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Leave empty for unlimited"
                      min="1"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChange('quantity', -1)}
                    className={`px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                      formData.quantity === -1
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    ∞ Unlimited
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.quantity === -1 
                    ? 'Unlimited: No restriction on number of assignments'
                    : `Limited to ${formData.quantity} concurrent assignments`
                  }
                </p>
              </div>
            )}
          </div>

          {/* Property Selection Section - Requirements 12.1, 12.2, 12.3 */}
          {showPropertySelector && formData.resourceTypeId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Property Schema
                </h3>
                <span className="text-sm text-gray-500">
                  Select properties to track for items
                </span>
              </div>
              
              <PropertySelector
                selectedProperties={selectedProperties}
                onPropertiesChange={setSelectedProperties}
                resourceTypeId={formData.resourceTypeId}
                resourceTypeName={selectedTypeName}
                mandatoryProperties={selectedTypeMandatoryProperties}
                disabled={!!resource && (resource?.items?.length ?? 0) > 0}
                error={propertyError || undefined}
              />
              
              {resource && (resource?.items?.length ?? 0) > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Schema Locked:</strong> The property schema cannot be modified because this resource already has items.
                  </p>
                </div>
              )}
              
              {resource && (resource?.items?.length ?? 0) === 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>Schema Editable:</strong> You can modify the property schema since no items have been added yet.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Prompt to select type if not selected */}
          {!formData.resourceTypeId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-blue-800 font-medium">Select a resource type to configure property schema</p>
            </div>
          )}

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
          </div>

          {/* Cloud Metadata Section */}
          {selectedTypeName === 'Cloud' && (
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
                  The property schema you select will define what information is tracked for each item.
                  Once the first item is created, the property schema will be locked.
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
              disabled={loading || !formData.name || !formData.custodianId || !formData.resourceTypeId || !formData.resourceCategoryId}
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
