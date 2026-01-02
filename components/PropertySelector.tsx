'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Check, Info, Loader2, Lock, AlertTriangle } from 'lucide-react';
import ElegantSelect from './ElegantSelect';
import { 
  PropertyDefinition, 
  PropertyCatalog, 
  PropertyDataType,
  PropertyCatalogResponse 
} from '@/types/resource-structure';

interface PropertySelectorProps {
  selectedProperties: PropertyDefinition[];
  onPropertiesChange: (properties: PropertyDefinition[]) => void;
  resourceTypeId?: string;
  resourceTypeName?: string;
  mandatoryProperties?: string[];  // Array of property keys that are mandatory
  disabled?: boolean;
  error?: string;
}

interface CustomPropertyForm {
  key: string;
  label: string;
  dataType: PropertyDataType;
  description: string;
}

const DATA_TYPE_OPTIONS = [
  { value: 'STRING', label: 'Text', description: 'Free-form text input' },
  { value: 'NUMBER', label: 'Number', description: 'Numeric values' },
  { value: 'BOOLEAN', label: 'Yes/No', description: 'True or false values' },
  { value: 'DATE', label: 'Date', description: 'Date picker' },
];

/**
 * PropertySelector Component
 * 
 * A checkbox/multi-select interface for selecting properties from the property catalog.
 * Supports fetching from backend API and adding custom properties.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 12.7
 */
export default function PropertySelector({
  selectedProperties,
  onPropertiesChange,
  resourceTypeId,
  resourceTypeName,
  mandatoryProperties = [],
  disabled = false,
  error,
}: PropertySelectorProps) {
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [systemProperties, setSystemProperties] = useState<PropertyCatalog[]>([]);
  const [customProperties, setCustomProperties] = useState<PropertyCatalog[]>([]);
  const [typeSpecificSuggestions, setTypeSpecificSuggestions] = useState<PropertyCatalog[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState<CustomPropertyForm>({
    key: '',
    label: '',
    dataType: 'STRING',
    description: '',
  });
  const [customFormError, setCustomFormError] = useState<string | null>(null);
  const [savingCustom, setSavingCustom] = useState(false);

  // Fetch property catalog from backend API
  // Requirement 12.1: Fetch property catalog from backend API
  const fetchPropertyCatalog = useCallback(async () => {
    setLoading(true);
    setCatalogError(null);
    
    try {
      const response = await fetch('/api/property-catalog');
      
      if (!response.ok) {
        throw new Error('Failed to fetch property catalog');
      }
      
      const data: PropertyCatalogResponse = await response.json();
      
      setSystemProperties(data.systemProperties || []);
      setCustomProperties(data.customProperties || []);
      
      // Set type-specific suggestions if resource type is selected
      if (resourceTypeName && data.typeSpecificSuggestions) {
        setTypeSpecificSuggestions(data.typeSpecificSuggestions[resourceTypeName] || []);
      }
    } catch (err) {
      console.error('Error fetching property catalog:', err);
      setCatalogError('Failed to load property catalog. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [resourceTypeName]);

  useEffect(() => {
    fetchPropertyCatalog();
  }, [fetchPropertyCatalog]);

  // Update type-specific suggestions when resource type changes
  useEffect(() => {
    if (resourceTypeName && systemProperties.length > 0) {
      // Re-fetch to get updated suggestions for the new type
      fetchPropertyCatalog();
    }
  }, [resourceTypeId, resourceTypeName]);

  // Auto-select mandatory properties when they change or when catalog loads
  useEffect(() => {
    if (mandatoryProperties.length > 0 && (systemProperties.length > 0 || customProperties.length > 0)) {
      const allProperties = [...systemProperties, ...customProperties];
      
      // Find mandatory properties that are not yet selected
      const missingMandatory = mandatoryProperties.filter(
        key => !selectedProperties.some(p => p.key === key)
      );
      
      if (missingMandatory.length > 0) {
        // Get property details for missing mandatory properties
        const mandatoryToAdd = allProperties
          .filter(p => missingMandatory.includes(p.key))
          .map(p => ({
            key: p.key,
            label: p.label,
            dataType: p.dataType,
            description: p.description,
            defaultValue: p.defaultValue as PropertyDefinition['defaultValue'],
          }));
        
        if (mandatoryToAdd.length > 0) {
          onPropertiesChange([...selectedProperties, ...mandatoryToAdd]);
        }
      }
    }
  }, [mandatoryProperties, systemProperties, customProperties]);

  // Check if a property is selected
  const isPropertySelected = (key: string): boolean => {
    return selectedProperties.some(p => p.key === key);
  };

  // Check if a property is mandatory
  const isMandatoryProperty = (key: string): boolean => {
    return mandatoryProperties.includes(key);
  };

  // Sort properties with mandatory ones first
  // Requirement 4.3: Display mandatory properties at the top of the property list
  const sortPropertiesWithMandatoryFirst = (properties: PropertyCatalog[]): PropertyCatalog[] => {
    return [...properties].sort((a, b) => {
      const aIsMandatory = isMandatoryProperty(a.key);
      const bIsMandatory = isMandatoryProperty(b.key);
      
      if (aIsMandatory && !bIsMandatory) return -1;
      if (!aIsMandatory && bIsMandatory) return 1;
      return a.label.localeCompare(b.label);
    });
  };

  // Toggle property selection
  // Requirement 12.3: Allow selection of multiple applicable properties
  // Requirement 4.3: Prevent deselection of mandatory properties
  const toggleProperty = (property: PropertyCatalog) => {
    if (disabled) return;
    
    const isSelected = isPropertySelected(property.key);
    const isMandatory = isMandatoryProperty(property.key);
    
    if (isSelected && isMandatory) {
      // Prevent deselection of mandatory properties
      return;
    }
    
    if (isSelected) {
      // Remove property
      onPropertiesChange(selectedProperties.filter(p => p.key !== property.key));
    } else {
      // Add property
      const newProperty: PropertyDefinition = {
        key: property.key,
        label: property.label,
        dataType: property.dataType,
        description: property.description,
        defaultValue: property.defaultValue as PropertyDefinition['defaultValue'],
      };
      onPropertiesChange([...selectedProperties, newProperty]);
    }
  };

  // Handle custom property form changes
  const handleCustomFormChange = (field: keyof CustomPropertyForm, value: string) => {
    setCustomFormError(null);
    
    if (field === 'label' && !customForm.key) {
      // Auto-generate key from label (camelCase)
      const generatedKey = value
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(' ')
        .map((word, index) => 
          index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join('');
      
      setCustomForm(prev => ({
        ...prev,
        [field]: value,
        key: generatedKey,
      }));
    } else {
      setCustomForm(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  // Validate custom property form
  const validateCustomForm = (): boolean => {
    if (!customForm.key.trim()) {
      setCustomFormError('Property key is required');
      return false;
    }
    
    if (!customForm.label.trim()) {
      setCustomFormError('Property label is required');
      return false;
    }
    
    // Check for duplicate keys
    const allProperties = [...systemProperties, ...customProperties];
    if (allProperties.some(p => p.key === customForm.key)) {
      setCustomFormError('A property with this key already exists');
      return false;
    }
    
    // Validate key format (camelCase)
    if (!/^[a-z][a-zA-Z0-9]*$/.test(customForm.key)) {
      setCustomFormError('Key must be in camelCase format (start with lowercase, alphanumeric only)');
      return false;
    }
    
    return true;
  };

  // Add custom property
  // Requirement 12.4: Allow adding custom properties beyond predefined catalog
  const handleAddCustomProperty = async () => {
    if (!validateCustomForm()) return;
    
    setSavingCustom(true);
    setCustomFormError(null);
    
    try {
      // Try to save to backend
      const response = await fetch('/api/property-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: customForm.key,
          label: customForm.label,
          dataType: customForm.dataType,
          description: customForm.description || undefined,
          resourceTypeId: resourceTypeId || undefined,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create custom property');
      }
      
      // Refresh catalog to include new property
      await fetchPropertyCatalog();
      
      // Add to selected properties
      const newProperty: PropertyDefinition = {
        key: customForm.key,
        label: customForm.label,
        dataType: customForm.dataType,
        description: customForm.description || undefined,
      };
      onPropertiesChange([...selectedProperties, newProperty]);
      
      // Reset form
      setCustomForm({
        key: '',
        label: '',
        dataType: 'STRING',
        description: '',
      });
      setShowCustomForm(false);
    } catch (err) {
      console.error('Error creating custom property:', err);
      
      // If backend fails, still allow adding locally for this session
      if (err instanceof Error && err.message.includes('permissions')) {
        setCustomFormError(err.message);
      } else {
        // Add locally without saving to catalog
        const newProperty: PropertyDefinition = {
          key: customForm.key,
          label: customForm.label,
          dataType: customForm.dataType,
          description: customForm.description || undefined,
        };
        onPropertiesChange([...selectedProperties, newProperty]);
        
        // Reset form
        setCustomForm({
          key: '',
          label: '',
          dataType: 'STRING',
          description: '',
        });
        setShowCustomForm(false);
      }
    } finally {
      setSavingCustom(false);
    }
  };

  // Remove a selected property
  // Requirement 4.3: Prevent removal of mandatory properties
  const removeProperty = (key: string) => {
    if (disabled) return;
    if (isMandatoryProperty(key)) return; // Prevent removal of mandatory properties
    onPropertiesChange(selectedProperties.filter(p => p.key !== key));
  };

  // Render property checkbox item
  // Requirement 4.1: Visually distinguish mandatory properties
  // Requirement 4.3: Display mandatory properties at top with required indicator
  const renderPropertyItem = (property: PropertyCatalog, isSuggested: boolean = false) => {
    const isSelected = isPropertySelected(property.key);
    const isMandatory = isMandatoryProperty(property.key);
    
    return (
      <label
        key={property.key}
        className={`
          flex items-start p-3 rounded-lg border cursor-pointer transition-all duration-200
          ${isSelected 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }
          ${isMandatory ? 'border-amber-400 bg-amber-50' : ''}
          ${disabled || (isSelected && isMandatory) ? 'cursor-not-allowed' : ''}
        `}
        title={isSelected && isMandatory ? 'This is a mandatory property and cannot be removed' : undefined}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleProperty(property)}
          disabled={disabled || (isSelected && isMandatory)}
          className="sr-only"
        />
        <div className={`
          flex-shrink-0 w-5 h-5 rounded border-2 mr-3 mt-0.5
          flex items-center justify-center transition-colors duration-200
          ${isSelected 
            ? isMandatory ? 'bg-amber-500 border-amber-500' : 'bg-blue-500 border-blue-500' 
            : 'border-gray-300 bg-white'
          }
          ${isSelected && isMandatory ? 'cursor-not-allowed' : ''}
        `}>
          {isSelected && (isMandatory ? <Lock className="w-3 h-3 text-white" /> : <Check className="w-3 h-3 text-white" />)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${isSelected ? (isMandatory ? 'text-amber-900' : 'text-blue-900') : 'text-gray-900'}`}>
              {property.label}
              {isMandatory && <span className="text-red-500 ml-1">*</span>}
            </span>
            <span className={`
              text-xs px-2 py-0.5 rounded-full
              ${property.dataType === 'STRING' ? 'bg-green-100 text-green-700' : ''}
              ${property.dataType === 'NUMBER' ? 'bg-purple-100 text-purple-700' : ''}
              ${property.dataType === 'BOOLEAN' ? 'bg-yellow-100 text-yellow-700' : ''}
              ${property.dataType === 'DATE' ? 'bg-blue-100 text-blue-700' : ''}
            `}>
              {property.dataType.toLowerCase()}
            </span>
            {isMandatory && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                required
              </span>
            )}
            {isSuggested && !isMandatory && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                suggested
              </span>
            )}
            {property.isSystem && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                system
              </span>
            )}
          </div>
          {property.description && (
            <p className="text-sm text-gray-500 mt-1">{property.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-1 font-mono">{property.key}</p>
        </div>
      </label>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading property catalog...</span>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{catalogError}</p>
        <button
          onClick={fetchPropertyCatalog}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selected Properties Summary */}
      {selectedProperties.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Selected Properties ({selectedProperties.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedProperties.map(prop => {
              const isMandatory = isMandatoryProperty(prop.key);
              return (
                <span
                  key={prop.key}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                    isMandatory 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}
                  title={isMandatory ? 'This is a mandatory property and cannot be removed' : undefined}
                >
                  {isMandatory && <Lock className="w-3 h-3 mr-1" />}
                  {prop.label}
                  {isMandatory && <span className="text-red-500 ml-1">*</span>}
                  {!disabled && !isMandatory && (
                    <button
                      onClick={() => removeProperty(prop.key)}
                      className="ml-2 hover:text-blue-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          {mandatoryProperties.length > 0 && (
            <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Properties marked with * are mandatory and cannot be removed.
            </p>
          )}
        </div>
      )}

      {/* Validation Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Type-Specific Suggestions */}
      {typeSpecificSuggestions.length > 0 && resourceTypeName && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-orange-500" />
            Suggested for {resourceTypeName}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortPropertiesWithMandatoryFirst(typeSpecificSuggestions).map(prop => renderPropertyItem(prop, true))}
          </div>
        </div>
      )}

      {/* System Properties */}
      {systemProperties.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Available Properties
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortPropertiesWithMandatoryFirst(
              systemProperties.filter(prop => !typeSpecificSuggestions.some(s => s.key === prop.key))
            ).map(prop => renderPropertyItem(prop))}
          </div>
        </div>
      )}

      {/* Custom Properties */}
      {customProperties.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Custom Properties
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortPropertiesWithMandatoryFirst(customProperties).map(prop => renderPropertyItem(prop))}
          </div>
        </div>
      )}

      {/* Add Custom Property Section */}
      {/* Requirement 12.4: Allow adding custom properties */}
      <div className="border-t pt-4">
        {!showCustomForm ? (
          <button
            type="button"
            onClick={() => setShowCustomForm(true)}
            disabled={disabled}
            className={`
              flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
              border border-dashed border-gray-300 text-gray-600
              hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50
              transition-colors duration-200
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <Plus className="w-4 h-4" />
            Add Custom Property
          </button>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900">Add Custom Property</h4>
              <button
                type="button"
                onClick={() => {
                  setShowCustomForm(false);
                  setCustomFormError(null);
                  setCustomForm({
                    key: '',
                    label: '',
                    dataType: 'STRING',
                    description: '',
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {customFormError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{customFormError}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customForm.label}
                  onChange={(e) => handleCustomFormChange('label', e.target.value)}
                  placeholder="e.g., Asset Tag"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customForm.key}
                  onChange={(e) => handleCustomFormChange('key', e.target.value)}
                  placeholder="e.g., assetTag"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">camelCase format</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Type <span className="text-red-500">*</span>
                </label>
                <ElegantSelect
                  options={DATA_TYPE_OPTIONS}
                  value={customForm.dataType}
                  onChange={(value) => handleCustomFormChange('dataType', value)}
                  placeholder="Select data type"
                  className="w-full"
                  size="md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={customForm.description}
                  onChange={(e) => handleCustomFormChange('description', e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCustomForm(false);
                  setCustomFormError(null);
                  setCustomForm({
                    key: '',
                    label: '',
                    dataType: 'STRING',
                    description: '',
                  });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomProperty}
                disabled={savingCustom}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingCustom && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Property
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Help Text */}
      {/* Requirement 12.6: Show property names, types, and descriptions */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
        <p className="flex items-center gap-1">
          <Info className="w-3 h-3" />
          Select the properties that will be tracked for items of this resource. 
          Once the first item is created, the property schema will be locked.
        </p>
      </div>
    </div>
  );
}
