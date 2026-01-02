/**
 * Resource Structure Enhancement Types
 * 
 * This module defines TypeScript interfaces for the enhanced resource management system
 * including flexible resource types, categories, property catalogs, and assignment models.
 * 
 * Requirements: 1.1, 2.1, 8.1, 8.2, 8.3
 */

// ============================================
// Property Data Types
// ============================================

/**
 * Supported data types for resource properties
 */
export type PropertyDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE';

/**
 * Definition of a single property that can be associated with resources
 */
export interface PropertyDefinition {
  key: string;            // Unique identifier (e.g., "serialNumber", "licenseKey")
  label: string;          // Human-readable label (e.g., "Serial Number", "License Key")
  dataType: PropertyDataType;
  description?: string;
  defaultValue?: string | number | boolean | Date | null;
  isRequired?: boolean;
}

// ============================================
// Resource Type Models
// ============================================

/**
 * Resource Type - Top-level classification (Hardware, Software, Cloud, or user-created)
 * Replaces the ResourceType enum with a flexible table-based approach
 */
export interface ResourceTypeEntity {
  id: string;
  name: string;           // "Hardware", "Software", "Cloud", or custom
  description?: string;
  isSystem: boolean;      // true for predefined types (Hardware, Software, Cloud)
  mandatoryProperties: string[];  // Array of property keys that are mandatory for this type
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resource Category - Sub-classification within a type (Laptop, Phone, SaaS, etc.)
 */
export interface ResourceCategoryEntity {
  id: string;
  name: string;           // "Laptop", "Phone", "SaaS", "Cloud Account", etc.
  description?: string;
  resourceTypeId: string;
  isSystem: boolean;      // true for predefined categories
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resource Category with its parent type included
 */
export interface ResourceCategoryWithType extends ResourceCategoryEntity {
  resourceType: ResourceTypeEntity;
}

// ============================================
// Property Catalog Models
// ============================================

/**
 * Property Catalog entry - predefined and custom properties for resources
 */
export interface PropertyCatalog {
  id: string;
  key: string;            // Unique property key
  label: string;          // Display label
  dataType: PropertyDataType;
  description?: string;
  defaultValue?: unknown;
  isSystem: boolean;      // true for predefined properties
  resourceTypeId?: string; // Optional: type-specific property suggestions
  createdAt: Date;
}

/**
 * Property Catalog with optional type association
 */
export interface PropertyCatalogWithType extends PropertyCatalog {
  resourceType?: ResourceTypeEntity;
}

// ============================================
// Enhanced Resource Models
// ============================================

/**
 * Assignment type for different resource models
 */
export type AssignmentType = 'INDIVIDUAL' | 'POOLED' | 'SHARED';

/**
 * Allocation type for resources
 * EXCLUSIVE: Each employee gets their own item (one-to-one)
 * SHARED: Multiple employees can share the same resource (one-to-many)
 */
export type AllocationType = 'EXCLUSIVE' | 'SHARED';

/**
 * Assignment status values
 */
export type AssignmentStatus = 'ACTIVE' | 'RETURNED' | 'LOST' | 'DAMAGED';

/**
 * Resource status values
 */
export type ResourceStatus = 'ACTIVE' | 'RETURNED' | 'LOST' | 'DAMAGED';

/**
 * Item status values
 */
export type ItemStatus = 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'LOST' | 'DAMAGED';

/**
 * Legacy resource type enum (for backward compatibility)
 */
export type LegacyResourceType = 'PHYSICAL' | 'SOFTWARE' | 'CLOUD';

/**
 * Enhanced Resource model with flexible type/category and property schema
 */
export interface EnhancedResource {
  id: string;
  name: string;
  
  // Legacy type field (for backward compatibility)
  type: LegacyResourceType;
  category?: string;
  
  // New flexible type/category system
  resourceTypeId?: string;
  resourceTypeEntity?: ResourceTypeEntity;
  resourceCategoryId?: string;
  resourceCategory?: ResourceCategoryEntity;
  
  description?: string;
  owner: string;
  custodianId: string;
  status: ResourceStatus;
  quantity?: number;
  
  // Allocation type: EXCLUSIVE (one per employee) or SHARED (multiple employees)
  allocationType: AllocationType;
  
  metadata?: Record<string, unknown>;
  
  // Property schema (locked after first item)
  propertySchema: PropertyDefinition[];
  schemaLocked: boolean;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Related entities
  items?: EnhancedResourceItem[];
  assignments?: ResourceAssignment[];
}

/**
 * Enhanced ResourceItem model with dynamic properties
 */
export interface EnhancedResourceItem {
  id: string;
  resourceId: string;
  status: ItemStatus;
  
  // Dynamic properties based on resource schema
  properties: Record<string, unknown>;
  
  // Legacy fields (maintained for backward compatibility)
  serialNumber?: string;
  hostname?: string;
  ipAddress?: string;
  macAddress?: string;
  operatingSystem?: string;
  osVersion?: string;
  processor?: string;
  memory?: string;
  storage?: string;
  licenseKey?: string;
  softwareVersion?: string;
  licenseType?: string;
  maxUsers?: string;
  activationCode?: string;
  licenseExpiry?: Date;
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  value?: number;
  metadata?: Record<string, unknown>;
  
  createdAt: Date;
  
  // Related entities
  resource?: EnhancedResource;
  assignments?: ResourceAssignment[];
}

/**
 * Resource Assignment model
 */
export interface ResourceAssignment {
  id: string;
  employeeId: string;
  resourceId: string;
  itemId?: string;        // Required for Hardware, optional for Software/Cloud
  assignedBy: string;
  status: AssignmentStatus;
  assignmentType: AssignmentType;
  assignedAt: Date;
  returnedAt?: Date;
  notes?: string;
}

// ============================================
// API Request Types
// ============================================

/**
 * Request to create a new resource type
 */
export interface CreateResourceTypeRequest {
  name: string;
  description?: string;
  mandatoryProperties?: string[];
}

/**
 * Request to update a resource type
 */
export interface UpdateResourceTypeRequest {
  name?: string;
  description?: string;
  mandatoryProperties?: string[];
}

/**
 * Request to create a new resource category
 */
export interface CreateResourceCategoryRequest {
  name: string;
  description?: string;
  resourceTypeId: string;
}

/**
 * Request to update a resource category
 */
export interface UpdateResourceCategoryRequest {
  name?: string;
  description?: string;
}

/**
 * Request to create a new property in the catalog
 */
export interface CreatePropertyCatalogRequest {
  key: string;
  label: string;
  dataType: PropertyDataType;
  description?: string;
  defaultValue?: unknown;
  resourceTypeId?: string;
}

/**
 * Request to create a new resource with property schema
 * Note: resourceCategoryId is MANDATORY
 */
export interface CreateResourceRequest {
  name: string;
  resourceTypeId: string;
  resourceCategoryId: string;  // MANDATORY - category selection is required
  description?: string;
  selectedProperties: PropertyDefinition[];
  custodianId: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Request to update a resource
 */
export interface UpdateResourceRequest {
  name?: string;
  resourceCategoryId?: string;
  description?: string;
  status?: ResourceStatus;
  quantity?: number;
  metadata?: Record<string, unknown>;
  // Note: resourceTypeId and propertySchema cannot be changed after creation
}

/**
 * Request to create a new resource item
 */
export interface CreateResourceItemRequest {
  properties: Record<string, unknown>;
  status?: ItemStatus;
}

/**
 * Request to update a resource item
 */
export interface UpdateResourceItemRequest {
  properties?: Record<string, unknown>;
  status?: ItemStatus;
}

/**
 * Request to create a resource assignment
 */
export interface CreateAssignmentRequest {
  employeeId: string;
  resourceId: string;
  itemId?: string;        // Required for Hardware, optional for Software/Cloud
  assignmentType: AssignmentType;
  notes?: string;
}

/**
 * Request to update an assignment status
 */
export interface UpdateAssignmentRequest {
  status: AssignmentStatus;
  notes?: string;
  returnedAt?: Date;
}

// ============================================
// API Response Types
// ============================================

/**
 * Response for property catalog fetch
 */
export interface PropertyCatalogResponse {
  systemProperties: PropertyCatalog[];
  customProperties: PropertyCatalog[];
  typeSpecificSuggestions: Record<string, PropertyCatalog[]>;
}

/**
 * Response for resource type list
 */
export interface ResourceTypeListResponse {
  types: ResourceTypeEntity[];
  total: number;
}

/**
 * Response for resource category list
 */
export interface ResourceCategoryListResponse {
  categories: ResourceCategoryWithType[];
  total: number;
}

/**
 * Response for resource list with enhanced data
 */
export interface ResourceListResponse {
  resources: EnhancedResource[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Response for resource item list
 */
export interface ResourceItemListResponse {
  items: EnhancedResourceItem[];
  total: number;
}

/**
 * Response for assignment operations
 */
export interface AssignmentResponse {
  id: string;
  status: AssignmentStatus;
  assignedAt: Date;
  returnedAt?: Date;
  assignmentType: AssignmentType;
}

/**
 * Generic API error response
 */
export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// ============================================
// Validation Types
// ============================================

/**
 * Result of property validation
 */
export interface PropertyValidationResult {
  isValid: boolean;
  errors: PropertyValidationError[];
}

/**
 * Result of mandatory property validation
 * Requirements: 1.2, 2.2, 4.4
 */
export interface MandatoryPropertyValidation {
  isValid: boolean;
  missingProperties: string[];
  errors: string[];
}

/**
 * Individual property validation error
 */
export interface PropertyValidationError {
  key: string;
  message: string;
  expectedType?: PropertyDataType;
  actualValue?: unknown;
}

/**
 * Result of schema validation
 */
export interface SchemaValidationResult {
  isValid: boolean;
  missingKeys: string[];
  extraKeys: string[];
  typeErrors: PropertyValidationError[];
}

// ============================================
// Utility Types
// ============================================

/**
 * Type guard to check if a resource has a locked schema
 */
export function isSchemaLocked(resource: EnhancedResource): boolean {
  return resource.schemaLocked === true;
}

/**
 * Type guard to check if a property value matches its expected type
 */
export function isValidPropertyValue(
  value: unknown,
  dataType: PropertyDataType
): boolean {
  switch (dataType) {
    case 'STRING':
      return typeof value === 'string';
    case 'NUMBER':
      return typeof value === 'number' && !isNaN(value);
    case 'BOOLEAN':
      return typeof value === 'boolean';
    case 'DATE':
      return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
    default:
      return false;
  }
}

/**
 * Predefined system resource types
 */
export const SYSTEM_RESOURCE_TYPES = ['Hardware', 'Software', 'Cloud'] as const;
export type SystemResourceType = typeof SYSTEM_RESOURCE_TYPES[number];

/**
 * Default mandatory properties by resource type
 * These properties are automatically required for resources of the specified type
 * Requirements: 1.1, 2.1
 */
export const DEFAULT_MANDATORY_PROPERTIES: Record<string, string[]> = {
  'Cloud': ['maxUsers'],
  'Hardware': ['serialNumber', 'warrantyExpiry'],
  'Physical': ['serialNumber', 'warrantyExpiry'],  // Alias for Hardware
};

/**
 * Predefined system categories by type
 */
export const SYSTEM_CATEGORIES: Record<SystemResourceType, string[]> = {
  Hardware: ['Laptop', 'Desktop', 'Phone', 'Tablet', 'Monitor', 'Peripheral'],
  Software: ['SaaS', 'Desktop Application', 'Development Tool', 'Operating System'],
  Cloud: ['Cloud Account', 'Cloud Storage', 'Cloud Compute', 'Cloud Database'],
};

/**
 * Predefined system properties
 */
export const SYSTEM_PROPERTIES: PropertyDefinition[] = [
  { key: 'serialNumber', label: 'Serial Number', dataType: 'STRING', description: 'Unique serial number for hardware' },
  { key: 'hostname', label: 'Hostname', dataType: 'STRING', description: 'Network hostname' },
  { key: 'ipAddress', label: 'IP Address', dataType: 'STRING', description: 'Network IP address' },
  { key: 'macAddress', label: 'MAC Address', dataType: 'STRING', description: 'Network MAC address' },
  { key: 'operatingSystem', label: 'Operating System', dataType: 'STRING', description: 'OS name' },
  { key: 'osVersion', label: 'OS Version', dataType: 'STRING', description: 'Operating system version' },
  { key: 'processor', label: 'Processor', dataType: 'STRING', description: 'CPU model' },
  { key: 'memory', label: 'Memory', dataType: 'STRING', description: 'RAM specification' },
  { key: 'storage', label: 'Storage', dataType: 'STRING', description: 'Storage capacity' },
  { key: 'licenseKey', label: 'License Key', dataType: 'STRING', description: 'Software license key' },
  { key: 'softwareVersion', label: 'Software Version', dataType: 'STRING', description: 'Software version number' },
  { key: 'licenseType', label: 'License Type', dataType: 'STRING', description: 'Type of license (perpetual, subscription, etc.)' },
  { key: 'maxUsers', label: 'Max Users', dataType: 'STRING', description: 'Maximum number of users' },
  { key: 'activationCode', label: 'Activation Code', dataType: 'STRING', description: 'Software activation code' },
  { key: 'licenseExpiry', label: 'License Expiry', dataType: 'DATE', description: 'License expiration date' },
  { key: 'purchaseDate', label: 'Purchase Date', dataType: 'DATE', description: 'Date of purchase' },
  { key: 'warrantyExpiry', label: 'Warranty Expiry', dataType: 'DATE', description: 'Warranty expiration date' },
  { key: 'value', label: 'Value', dataType: 'NUMBER', description: 'Monetary value' },
  { key: 'accountId', label: 'Account ID', dataType: 'STRING', description: 'Cloud account identifier' },
  { key: 'region', label: 'Region', dataType: 'STRING', description: 'Cloud region' },
  { key: 'subscriptionTier', label: 'Subscription Tier', dataType: 'STRING', description: 'Subscription level' },
];

// ============================================
// Backward Compatibility Types
// Requirements: 4.4, 5.4, 5.5
// ============================================

/**
 * Legacy resource type enum values (for backward compatibility)
 */
export const LEGACY_RESOURCE_TYPES = ['PHYSICAL', 'SOFTWARE', 'CLOUD'] as const;
export type LegacyResourceTypeEnum = typeof LEGACY_RESOURCE_TYPES[number];

/**
 * Mapping between legacy enum values and new type names
 */
export const LEGACY_TO_NEW_TYPE_MAPPING: Record<LegacyResourceTypeEnum, string> = {
  'PHYSICAL': 'PHYSICAL',
  'SOFTWARE': 'SOFTWARE',
  'CLOUD': 'CLOUD',
};

/**
 * Mapping between new type names and legacy enum values
 */
export const NEW_TO_LEGACY_TYPE_MAPPING: Record<string, LegacyResourceTypeEnum> = {
  'PHYSICAL': 'PHYSICAL',
  'Hardware': 'PHYSICAL',
  'SOFTWARE': 'SOFTWARE',
  'Software': 'SOFTWARE',
  'CLOUD': 'CLOUD',
  'Cloud': 'CLOUD',
};

/**
 * Legacy resource item fields that are stored in dedicated columns
 */
export const LEGACY_ITEM_FIELDS = [
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
] as const;

export type LegacyItemField = typeof LEGACY_ITEM_FIELDS[number];

/**
 * Interface for backward-compatible resource response
 * Includes both legacy fields and new structure fields
 */
export interface BackwardCompatibleResource extends EnhancedResource {
  // Legacy fields at top level for backward compatibility
  type: LegacyResourceType;
  category?: string;
  // New structure fields
  resourceTypeName?: string;
  resourceCategoryName?: string;
}

/**
 * Interface for backward-compatible resource item response
 * Includes both legacy fields and new properties format
 */
export interface BackwardCompatibleResourceItem extends EnhancedResourceItem {
  // Legacy fields are already included in EnhancedResourceItem
  // This interface ensures they're always present
}

/**
 * Migration status interface
 */
export interface MigrationStatus {
  totalResources: number;
  migratedResources: number;
  pendingResources: number;
  totalItems: number;
  migratedItems: number;
  pendingItems: number;
  migrationComplete: boolean;
}

/**
 * Migration result interface
 */
export interface MigrationResult {
  success: boolean;
  migratedResources: number;
  migratedItems: number;
  migratedAssignments: number;
  errors: string[];
  warnings: string[];
}
