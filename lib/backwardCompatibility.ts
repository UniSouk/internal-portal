/**
 * Backward Compatibility Layer
 * 
 * Provides utilities for maintaining backward compatibility with existing data:
 * - Handle legacy property access patterns
 * - Ensure existing assignments continue working
 * - Maintain existing API compatibility where possible
 * 
 * Requirements: 4.4, 5.4, 5.5
 */

import { PropertyDefinition, PropertyDataType, EnhancedResource, EnhancedResourceItem } from '../types/resource-structure';

/**
 * Legacy resource type enum values
 */
export type LegacyResourceType = 'PHYSICAL' | 'SOFTWARE' | 'CLOUD';

/**
 * Maps new resource type names to legacy enum values
 * Requirements: 5.4 - Handle null or missing category values gracefully
 */
export function mapToLegacyType(typeName: string | null | undefined): LegacyResourceType {
  if (!typeName) {
    return 'PHYSICAL'; // Default fallback
  }

  const mapping: Record<string, LegacyResourceType> = {
    'PHYSICAL': 'PHYSICAL',
    'Hardware': 'PHYSICAL',
    'SOFTWARE': 'SOFTWARE',
    'Software': 'SOFTWARE',
    'CLOUD': 'CLOUD',
    'Cloud': 'CLOUD',
  };

  return mapping[typeName] || 'PHYSICAL';
}

/**
 * Maps legacy type enum to new type name
 */
export function mapFromLegacyType(legacyType: LegacyResourceType): string {
  const mapping: Record<LegacyResourceType, string> = {
    'PHYSICAL': 'PHYSICAL',
    'SOFTWARE': 'SOFTWARE',
    'CLOUD': 'CLOUD',
  };

  return mapping[legacyType] || 'PHYSICAL';
}

/**
 * Extracts legacy fields from a resource item's properties
 * Requirements: 5.4 - Handle legacy property access patterns
 */
export function extractLegacyFieldsFromProperties(
  properties: Record<string, unknown>
): Record<string, unknown> {
  const legacyFields: Record<string, unknown> = {};

  const legacyFieldMapping: Record<string, string> = {
    serialNumber: 'serialNumber',
    hostname: 'hostname',
    ipAddress: 'ipAddress',
    macAddress: 'macAddress',
    operatingSystem: 'operatingSystem',
    osVersion: 'osVersion',
    processor: 'processor',
    memory: 'memory',
    storage: 'storage',
    licenseKey: 'licenseKey',
    softwareVersion: 'softwareVersion',
    licenseType: 'licenseType',
    maxUsers: 'maxUsers',
    activationCode: 'activationCode',
    licenseExpiry: 'licenseExpiry',
    purchaseDate: 'purchaseDate',
    warrantyExpiry: 'warrantyExpiry',
    value: 'value',
  };

  for (const [propKey, dbField] of Object.entries(legacyFieldMapping)) {
    if (properties[propKey] !== undefined && properties[propKey] !== null) {
      legacyFields[dbField] = properties[propKey];
    }
  }

  return legacyFields;
}

/**
 * Converts legacy item fields to properties format
 * Requirements: 5.4 - Handle legacy property access patterns
 */
export function convertLegacyFieldsToProperties(item: any): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  const legacyFields = [
    'serialNumber',
    'hostname',
    'ipAddress',
    'macAddress',
    'operatingSystem',
    'osVersion',
    'processor',
    'memory',
    'storage',
    'licenseKey',
    'softwareVersion',
    'licenseType',
    'maxUsers',
    'activationCode',
    'licenseExpiry',
    'purchaseDate',
    'warrantyExpiry',
    'value',
  ];

  for (const field of legacyFields) {
    if (item[field] !== undefined && item[field] !== null) {
      // Handle date fields
      if (item[field] instanceof Date) {
        properties[field] = item[field].toISOString();
      } else {
        properties[field] = item[field];
      }
    }
  }

  return properties;
}

/**
 * Merges legacy fields with new properties, preferring new properties
 * Requirements: 5.4 - Handle legacy property access patterns
 */
export function mergePropertiesWithLegacy(
  newProperties: Record<string, unknown>,
  legacyItem: any
): Record<string, unknown> {
  const legacyProperties = convertLegacyFieldsToProperties(legacyItem);
  
  // New properties take precedence over legacy
  return {
    ...legacyProperties,
    ...newProperties,
  };
}

/**
 * Normalizes a resource to include both legacy and new fields
 * Requirements: 4.4 - Maintain backward compatibility with existing resource data
 */
export function normalizeResource(resource: any): EnhancedResource {
  const propertySchema = (resource.propertySchema as PropertyDefinition[]) || [];
  
  return {
    id: resource.id,
    name: resource.name,
    type: resource.type,
    category: resource.category ?? undefined,
    resourceTypeId: resource.resourceTypeId ?? undefined,
    resourceTypeEntity: resource.resourceTypeEntity ? {
      id: resource.resourceTypeEntity.id,
      name: resource.resourceTypeEntity.name,
      description: resource.resourceTypeEntity.description ?? undefined,
      isSystem: resource.resourceTypeEntity.isSystem,
      mandatoryProperties: (resource.resourceTypeEntity.mandatoryProperties as string[]) || [],
      createdAt: resource.resourceTypeEntity.createdAt,
      updatedAt: resource.resourceTypeEntity.updatedAt,
    } : undefined,
    resourceCategoryId: resource.resourceCategoryId ?? undefined,
    resourceCategory: resource.resourceCategory ? {
      id: resource.resourceCategory.id,
      name: resource.resourceCategory.name,
      description: resource.resourceCategory.description ?? undefined,
      resourceTypeId: resource.resourceCategory.resourceTypeId,
      isSystem: resource.resourceCategory.isSystem,
      createdAt: resource.resourceCategory.createdAt,
      updatedAt: resource.resourceCategory.updatedAt,
    } : undefined,
    description: resource.description ?? undefined,
    owner: resource.owner || 'Unisouk',
    custodianId: resource.custodianId,
    status: resource.status,
    quantity: resource.quantity ?? undefined,
    allocationType: resource.allocationType || 'EXCLUSIVE',
    metadata: resource.metadata ?? undefined,
    propertySchema,
    schemaLocked: resource.schemaLocked ?? false,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
    items: resource.items?.map(normalizeResourceItem),
    assignments: resource.assignments?.map(normalizeAssignment),
  };
}

/**
 * Normalizes a resource item to include both legacy and new fields
 * Requirements: 5.4 - Handle legacy property access patterns
 */
export function normalizeResourceItem(item: any): EnhancedResourceItem {
  // Get properties from the new properties field
  const newProperties = (item.properties as Record<string, unknown>) || {};
  
  // Merge with legacy fields
  const mergedProperties = mergePropertiesWithLegacy(newProperties, item);

  return {
    id: item.id,
    resourceId: item.resourceId,
    status: item.status,
    properties: mergedProperties,
    
    // Legacy fields (for backward compatibility)
    serialNumber: item.serialNumber ?? mergedProperties.serialNumber as string ?? undefined,
    hostname: item.hostname ?? mergedProperties.hostname as string ?? undefined,
    ipAddress: item.ipAddress ?? mergedProperties.ipAddress as string ?? undefined,
    macAddress: item.macAddress ?? mergedProperties.macAddress as string ?? undefined,
    operatingSystem: item.operatingSystem ?? mergedProperties.operatingSystem as string ?? undefined,
    osVersion: item.osVersion ?? mergedProperties.osVersion as string ?? undefined,
    processor: item.processor ?? mergedProperties.processor as string ?? undefined,
    memory: item.memory ?? mergedProperties.memory as string ?? undefined,
    storage: item.storage ?? mergedProperties.storage as string ?? undefined,
    licenseKey: item.licenseKey ?? mergedProperties.licenseKey as string ?? undefined,
    softwareVersion: item.softwareVersion ?? mergedProperties.softwareVersion as string ?? undefined,
    licenseType: item.licenseType ?? mergedProperties.licenseType as string ?? undefined,
    maxUsers: item.maxUsers ?? mergedProperties.maxUsers as string ?? undefined,
    activationCode: item.activationCode ?? mergedProperties.activationCode as string ?? undefined,
    licenseExpiry: item.licenseExpiry ?? (mergedProperties.licenseExpiry ? new Date(mergedProperties.licenseExpiry as string) : undefined),
    purchaseDate: item.purchaseDate ?? (mergedProperties.purchaseDate ? new Date(mergedProperties.purchaseDate as string) : undefined),
    warrantyExpiry: item.warrantyExpiry ?? (mergedProperties.warrantyExpiry ? new Date(mergedProperties.warrantyExpiry as string) : undefined),
    value: item.value ?? mergedProperties.value as number ?? undefined,
    metadata: item.metadata ?? undefined,
    
    createdAt: item.createdAt,
    
    // Related entities
    resource: item.resource ? normalizeResource(item.resource) : undefined,
    assignments: item.assignments?.map(normalizeAssignment),
  };
}

/**
 * Normalizes an assignment
 * Requirements: 5.5 - Maintain all existing resource relationships and assignments
 */
export function normalizeAssignment(assignment: any): any {
  return {
    id: assignment.id,
    employeeId: assignment.employeeId,
    resourceId: assignment.resourceId,
    itemId: assignment.itemId ?? undefined,
    assignedBy: assignment.assignedBy,
    status: assignment.status,
    assignmentType: assignment.assignmentType || 'INDIVIDUAL',
    assignedAt: assignment.assignedAt,
    returnedAt: assignment.returnedAt ?? undefined,
    notes: assignment.notes ?? undefined,
    employee: assignment.employee,
    resource: assignment.resource,
    item: assignment.item,
  };
}

/**
 * Validates that a property value matches its expected type
 * Handles both new and legacy data formats
 */
export function validatePropertyValue(
  value: unknown,
  dataType: PropertyDataType
): { isValid: boolean; normalizedValue: unknown } {
  if (value === null || value === undefined) {
    return { isValid: true, normalizedValue: value };
  }

  switch (dataType) {
    case 'STRING':
      if (typeof value === 'string') {
        return { isValid: true, normalizedValue: value };
      }
      // Try to convert to string
      return { isValid: true, normalizedValue: String(value) };

    case 'NUMBER':
      if (typeof value === 'number' && !isNaN(value)) {
        return { isValid: true, normalizedValue: value };
      }
      // Try to parse as number
      const numValue = parseFloat(String(value));
      if (!isNaN(numValue)) {
        return { isValid: true, normalizedValue: numValue };
      }
      return { isValid: false, normalizedValue: value };

    case 'BOOLEAN':
      if (typeof value === 'boolean') {
        return { isValid: true, normalizedValue: value };
      }
      // Handle string booleans
      if (value === 'true' || value === '1') {
        return { isValid: true, normalizedValue: true };
      }
      if (value === 'false' || value === '0') {
        return { isValid: true, normalizedValue: false };
      }
      return { isValid: false, normalizedValue: value };

    case 'DATE':
      if (value instanceof Date) {
        return { isValid: true, normalizedValue: value };
      }
      // Try to parse as date
      const dateValue = new Date(value as string);
      if (!isNaN(dateValue.getTime())) {
        return { isValid: true, normalizedValue: dateValue };
      }
      return { isValid: false, normalizedValue: value };

    default:
      return { isValid: true, normalizedValue: value };
  }
}

/**
 * Normalizes properties according to their schema
 * Handles type coercion for backward compatibility
 */
export function normalizePropertiesWithSchema(
  properties: Record<string, unknown>,
  schema: PropertyDefinition[]
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const prop of schema) {
    const value = properties[prop.key];
    const { normalizedValue } = validatePropertyValue(value, prop.dataType);
    
    if (normalizedValue !== undefined && normalizedValue !== null) {
      normalized[prop.key] = normalizedValue;
    } else if (prop.defaultValue !== undefined) {
      normalized[prop.key] = prop.defaultValue;
    }
  }

  // Include any extra properties not in schema (for flexibility)
  for (const [key, value] of Object.entries(properties)) {
    if (!(key in normalized) && value !== undefined && value !== null) {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Creates a backward-compatible API response for resources
 * Requirements: 4.4 - Maintain backward compatibility with existing resource data
 */
export function createBackwardCompatibleResourceResponse(resource: any): any {
  const normalized = normalizeResource(resource);
  
  return {
    ...normalized,
    // Include legacy fields at top level for backward compatibility
    type: resource.type,
    category: resource.category,
    // Include new fields
    resourceTypeId: normalized.resourceTypeId,
    resourceTypeName: normalized.resourceTypeEntity?.name,
    resourceCategoryId: normalized.resourceCategoryId,
    resourceCategoryName: normalized.resourceCategory?.name,
    propertySchema: normalized.propertySchema,
    schemaLocked: normalized.schemaLocked,
  };
}

/**
 * Creates a backward-compatible API response for resource items
 * Requirements: 5.4 - Handle legacy property access patterns
 */
export function createBackwardCompatibleItemResponse(item: any): any {
  const normalized = normalizeResourceItem(item);
  
  return {
    ...normalized,
    // Include legacy fields at top level for backward compatibility
    serialNumber: normalized.serialNumber,
    hostname: normalized.hostname,
    ipAddress: normalized.ipAddress,
    macAddress: normalized.macAddress,
    operatingSystem: normalized.operatingSystem,
    osVersion: normalized.osVersion,
    processor: normalized.processor,
    memory: normalized.memory,
    storage: normalized.storage,
    licenseKey: normalized.licenseKey,
    softwareVersion: normalized.softwareVersion,
    licenseType: normalized.licenseType,
    maxUsers: normalized.maxUsers,
    activationCode: normalized.activationCode,
    licenseExpiry: normalized.licenseExpiry,
    purchaseDate: normalized.purchaseDate,
    warrantyExpiry: normalized.warrantyExpiry,
    value: normalized.value,
    // Include new properties field
    properties: normalized.properties,
  };
}

/**
 * Determines the assignment type based on resource type for backward compatibility
 * Requirements: 5.5 - Ensure existing assignments continue working
 */
export function determineAssignmentTypeFromLegacy(
  resourceType: LegacyResourceType | string
): 'INDIVIDUAL' | 'POOLED' | 'SHARED' {
  const normalizedType = resourceType.toUpperCase();
  
  switch (normalizedType) {
    case 'PHYSICAL':
    case 'HARDWARE':
      return 'INDIVIDUAL';
    case 'SOFTWARE':
      return 'INDIVIDUAL'; // Default to individual, can be changed to POOLED
    case 'CLOUD':
      return 'SHARED';
    default:
      return 'INDIVIDUAL';
  }
}

/**
 * Checks if a resource uses the new structure or legacy structure
 */
export function isNewStructureResource(resource: any): boolean {
  return !!resource.resourceTypeId;
}

/**
 * Checks if a resource item uses the new properties format
 */
export function isNewPropertiesFormat(item: any): boolean {
  const properties = item.properties as Record<string, unknown>;
  return properties && Object.keys(properties).length > 0;
}
