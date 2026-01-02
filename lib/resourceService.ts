/**
 * Resource Service
 * 
 * Provides operations for resource management with property schema support:
 * - Creating resources with property selection
 * - Schema locking after first item creation
 * - Property schema validation
 * - Backward compatibility with legacy data
 * 
 * Requirements: 8.1, 8.4, 8.5, 8.6, 8.7, 8.8, 4.4, 5.4, 5.5
 */

import { prisma } from './prisma';
import { 
  PropertyDefinition,
  PropertyDataType,
  EnhancedResource,
  CreateResourceRequest,
  UpdateResourceRequest,
  SchemaValidationResult,
  PropertyValidationError,
  isValidPropertyValue
} from '../types/resource-structure';
import {
  mapToLegacyType,
  normalizeResource,
  createBackwardCompatibleResourceResponse,
} from './backwardCompatibility';

/**
 * Creates a new resource with property schema
 * Requirements: 8.1 - Allow users to select which properties apply to that resource type
 * Requirements: 8.4 - Store the selected property list as part of the resource definition
 */
export async function createResourceWithSchema(
  request: CreateResourceRequest,
  createdById: string
): Promise<EnhancedResource> {
  // Validate resource type exists
  const resourceType = await prisma.resourceTypeEntity.findUnique({
    where: { id: request.resourceTypeId },
  });

  if (!resourceType) {
    throw new Error('Invalid resource type ID');
  }

  // Category is now MANDATORY
  if (!request.resourceCategoryId) {
    throw new Error('Resource category is required');
  }

  // Validate category exists and belongs to the selected type
  const category = await prisma.resourceCategoryEntity.findUnique({
    where: { id: request.resourceCategoryId },
  });

  if (!category) {
    throw new Error('Invalid resource category ID');
  }

  // Validate category belongs to the selected type
  if (category.resourceTypeId !== request.resourceTypeId) {
    throw new Error('Category does not belong to the selected resource type');
  }

  // Validate custodian exists
  const custodian = await prisma.employee.findUnique({
    where: { id: request.custodianId },
  });

  if (!custodian) {
    throw new Error('Invalid custodian ID');
  }

  // Validate property schema
  if (!request.selectedProperties || request.selectedProperties.length === 0) {
    throw new Error('At least one property must be selected for the resource');
  }

  // Validate each property definition
  const validationErrors = validatePropertyDefinitions(request.selectedProperties);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid property definitions: ${validationErrors.map(e => e.message).join(', ')}`);
  }

  // Map resource type name to legacy type enum
  const legacyType = mapResourceTypeToLegacy(resourceType.name);

  // Create the resource
  const resource = await prisma.resource.create({
    data: {
      name: request.name,
      type: legacyType,
      category: null, // Legacy field, use resourceCategoryId instead
      description: request.description || null,
      owner: 'Unisouk',
      custodianId: request.custodianId,
      status: 'ACTIVE',
      quantity: request.quantity || 1,
      metadata: request.metadata ? JSON.parse(JSON.stringify(request.metadata)) : null,
      resourceTypeId: request.resourceTypeId,
      resourceCategoryId: request.resourceCategoryId || null,
      propertySchema: JSON.parse(JSON.stringify(request.selectedProperties)),
      schemaLocked: false, // Schema is not locked until first item is created
    },
    include: {
      custodian: {
        select: { id: true, name: true, email: true, department: true },
      },
      resourceTypeEntity: true,
      resourceCategory: true,
      items: true,
      assignments: {
        where: { status: 'ACTIVE' },
      },
    },
  });

  return mapPrismaToEnhancedResource(resource);
}


/**
 * Gets a resource by ID with full schema information
 */
export async function getResourceById(id: string): Promise<EnhancedResource | null> {
  const resource = await prisma.resource.findUnique({
    where: { id },
    include: {
      custodian: {
        select: { id: true, name: true, email: true, department: true },
      },
      resourceTypeEntity: true,
      resourceCategory: true,
      items: true,
      assignments: {
        where: { status: 'ACTIVE' },
      },
    },
  });

  return resource ? mapPrismaToEnhancedResource(resource) : null;
}

/**
 * Gets all resources with optional filtering
 */
export async function getResources(options: {
  page?: number;
  limit?: number;
  resourceTypeId?: string;
  resourceCategoryId?: string;
  status?: string;
  search?: string;
}): Promise<{ resources: EnhancedResource[]; total: number }> {
  const { page = 1, limit = 20, resourceTypeId, resourceCategoryId, status, search } = options;
  const skip = (page - 1) * limit;

  const where: any = {};
  
  if (resourceTypeId) {
    where.resourceTypeId = resourceTypeId;
  }
  
  if (resourceCategoryId) {
    where.resourceCategoryId = resourceCategoryId;
  }
  
  if (status) {
    where.status = status;
  }
  
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [resources, total] = await Promise.all([
    prisma.resource.findMany({
      where,
      skip,
      take: limit,
      include: {
        custodian: {
          select: { id: true, name: true, email: true, department: true },
        },
        resourceTypeEntity: true,
        resourceCategory: true,
        items: true,
        assignments: {
          where: { status: 'ACTIVE' },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.resource.count({ where }),
  ]);

  return {
    resources: resources.map(mapPrismaToEnhancedResource),
    total,
  };
}

/**
 * Updates a resource
 * Note: resourceTypeId and propertySchema cannot be changed after creation
 * Requirements: 8.7 - Prevent modification of the property schema once any items exist
 */
export async function updateResource(
  id: string,
  updates: UpdateResourceRequest
): Promise<EnhancedResource> {
  const existing = await prisma.resource.findUnique({
    where: { id },
    include: {
      items: { select: { id: true } },
    },
  });

  if (!existing) {
    throw new Error('Resource not found');
  }

  // Validate category if changing
  if (updates.resourceCategoryId !== undefined) {
    if (updates.resourceCategoryId) {
      const category = await prisma.resourceCategoryEntity.findUnique({
        where: { id: updates.resourceCategoryId },
      });

      if (!category) {
        throw new Error('Invalid resource category ID');
      }

      // Validate category belongs to the resource's type
      if (existing.resourceTypeId && category.resourceTypeId !== existing.resourceTypeId) {
        throw new Error('Category does not belong to the resource type');
      }
    }
  }

  const resource = await prisma.resource.update({
    where: { id },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.resourceCategoryId !== undefined && { resourceCategoryId: updates.resourceCategoryId }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.status && { status: updates.status }),
      ...(updates.quantity !== undefined && { quantity: updates.quantity }),
      ...(updates.metadata !== undefined && { metadata: JSON.parse(JSON.stringify(updates.metadata)) }),
    },
    include: {
      custodian: {
        select: { id: true, name: true, email: true, department: true },
      },
      resourceTypeEntity: true,
      resourceCategory: true,
      items: true,
      assignments: {
        where: { status: 'ACTIVE' },
      },
    },
  });

  return mapPrismaToEnhancedResource(resource);
}


/**
 * Locks the property schema for a resource
 * Requirements: 8.5 - Lock the property schema when the first resource item is created
 */
export async function lockResourceSchema(resourceId: string): Promise<void> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
  });

  if (!resource) {
    throw new Error('Resource not found');
  }

  if (resource.schemaLocked) {
    // Already locked, no action needed
    return;
  }

  await prisma.resource.update({
    where: { id: resourceId },
    data: { schemaLocked: true },
  });
}

/**
 * Checks if a resource's schema is locked
 */
export async function isSchemaLocked(resourceId: string): Promise<boolean> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { schemaLocked: true },
  });

  return resource?.schemaLocked ?? false;
}

/**
 * Gets the property schema for a resource
 */
export async function getResourcePropertySchema(resourceId: string): Promise<PropertyDefinition[]> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { propertySchema: true },
  });

  if (!resource) {
    throw new Error('Resource not found');
  }

  return (resource.propertySchema as unknown as PropertyDefinition[]) || [];
}

/**
 * Validates item properties against the resource's property schema
 * Requirements: 8.6 - Enforce the same property keys as the first item
 */
export async function validateItemProperties(
  resourceId: string,
  properties: Record<string, unknown>
): Promise<SchemaValidationResult> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { propertySchema: true, schemaLocked: true },
  });

  if (!resource) {
    throw new Error('Resource not found');
  }

  const schema = (resource.propertySchema as unknown as PropertyDefinition[]) || [];
  
  return validatePropertiesAgainstSchema(properties, schema);
}

/**
 * Validates properties against a schema
 */
export function validatePropertiesAgainstSchema(
  properties: Record<string, unknown>,
  schema: PropertyDefinition[]
): SchemaValidationResult {
  const schemaKeys = new Set(schema.map(p => p.key));
  const propertyKeys = new Set(Object.keys(properties));

  // Find missing keys (keys in schema but not in properties)
  const missingKeys = schema
    .filter(p => p.isRequired && !propertyKeys.has(p.key))
    .map(p => p.key);

  // Find extra keys (keys in properties but not in schema)
  const extraKeys = Array.from(propertyKeys).filter(k => !schemaKeys.has(k));

  // Validate types for provided properties
  const typeErrors: PropertyValidationError[] = [];
  
  for (const prop of schema) {
    const value = properties[prop.key];
    
    // Skip validation for undefined/null values (unless required)
    if (value === undefined || value === null) {
      continue;
    }

    if (!isValidPropertyValue(value, prop.dataType)) {
      typeErrors.push({
        key: prop.key,
        message: `Property "${prop.key}" has invalid type. Expected ${prop.dataType}, got ${typeof value}`,
        expectedType: prop.dataType,
        actualValue: value,
      });
    }
  }

  return {
    isValid: missingKeys.length === 0 && extraKeys.length === 0 && typeErrors.length === 0,
    missingKeys,
    extraKeys,
    typeErrors,
  };
}

/**
 * Validates property definitions
 */
export function validatePropertyDefinitions(properties: PropertyDefinition[]): PropertyValidationError[] {
  const errors: PropertyValidationError[] = [];
  const seenKeys = new Set<string>();

  const validDataTypes: PropertyDataType[] = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE'];

  for (const prop of properties) {
    // Check for duplicate keys
    if (seenKeys.has(prop.key)) {
      errors.push({
        key: prop.key,
        message: `Duplicate property key: "${prop.key}"`,
      });
    }
    seenKeys.add(prop.key);

    // Validate key format
    if (!prop.key || prop.key.trim().length === 0) {
      errors.push({
        key: prop.key || '(empty)',
        message: 'Property key cannot be empty',
      });
    }

    // Validate label
    if (!prop.label || prop.label.trim().length === 0) {
      errors.push({
        key: prop.key,
        message: `Property "${prop.key}" must have a label`,
      });
    }

    // Validate data type
    if (!validDataTypes.includes(prop.dataType)) {
      errors.push({
        key: prop.key,
        message: `Property "${prop.key}" has invalid data type: "${prop.dataType}"`,
        expectedType: prop.dataType,
      });
    }
  }

  return errors;
}


/**
 * Updates the property schema for a resource
 * Requirements: 8.7 - Prevent modification of the property schema once any items exist
 */
export async function updatePropertySchema(
  resourceId: string,
  newSchema: PropertyDefinition[]
): Promise<void> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      items: { select: { id: true } },
    },
  });

  if (!resource) {
    throw new Error('Resource not found');
  }

  // Check if schema is locked
  if (resource.schemaLocked) {
    throw new Error('Cannot modify property schema: schema is locked after first item creation');
  }

  // Check if any items exist
  if (resource.items.length > 0) {
    throw new Error('Cannot modify property schema: resource already has items');
  }

  // Validate the new schema
  const validationErrors = validatePropertyDefinitions(newSchema);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid property definitions: ${validationErrors.map(e => e.message).join(', ')}`);
  }

  await prisma.resource.update({
    where: { id: resourceId },
    data: {
      propertySchema: JSON.parse(JSON.stringify(newSchema)),
    },
  });
}

/**
 * Checks if a resource can have its schema modified
 */
export async function canModifySchema(resourceId: string): Promise<{ canModify: boolean; reason?: string }> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      items: { select: { id: true } },
    },
  });

  if (!resource) {
    return { canModify: false, reason: 'Resource not found' };
  }

  if (resource.schemaLocked) {
    return { canModify: false, reason: 'Schema is locked' };
  }

  if (resource.items.length > 0) {
    return { canModify: false, reason: 'Resource has existing items' };
  }

  return { canModify: true };
}

/**
 * Maps legacy resource type name to enum value
 * Uses the backward compatibility layer for consistent mapping
 * Requirements: 5.4 - Handle legacy property access patterns
 */
function mapResourceTypeToLegacy(typeName: string): 'PHYSICAL' | 'SOFTWARE' | 'CLOUD' {
  // Use the backward compatibility layer for consistent mapping
  return mapToLegacyType(typeName);
}

/**
 * Maps Prisma Resource model to EnhancedResource interface
 */
function mapPrismaToEnhancedResource(resource: any): EnhancedResource {
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
    owner: resource.owner,
    custodianId: resource.custodianId,
    status: resource.status,
    quantity: resource.quantity ?? undefined,
    allocationType: resource.allocationType || 'EXCLUSIVE',
    metadata: resource.metadata ?? undefined,
    propertySchema: (resource.propertySchema as PropertyDefinition[]) || [],
    schemaLocked: resource.schemaLocked,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
    items: resource.items?.map((item: any) => ({
      id: item.id,
      resourceId: item.resourceId,
      status: item.status,
      properties: item.properties || {},
      serialNumber: item.serialNumber ?? undefined,
      hostname: item.hostname ?? undefined,
      createdAt: item.createdAt,
    })),
    assignments: resource.assignments?.map((assignment: any) => ({
      id: assignment.id,
      employeeId: assignment.employeeId,
      resourceId: assignment.resourceId,
      itemId: assignment.itemId ?? undefined,
      assignedBy: assignment.assignedBy,
      status: assignment.status,
      assignmentType: assignment.assignmentType,
      assignedAt: assignment.assignedAt,
      returnedAt: assignment.returnedAt ?? undefined,
      notes: assignment.notes ?? undefined,
    })),
  };
}

/**
 * Deletes a resource
 * Only allowed if no items or assignments exist
 */
export async function deleteResource(id: string): Promise<void> {
  const resource = await prisma.resource.findUnique({
    where: { id },
    include: {
      items: { select: { id: true } },
      assignments: { where: { status: 'ACTIVE' }, select: { id: true } },
    },
  });

  if (!resource) {
    throw new Error('Resource not found');
  }

  if (resource.items.length > 0) {
    throw new Error(`Cannot delete resource: it has ${resource.items.length} item(s)`);
  }

  if (resource.assignments.length > 0) {
    throw new Error(`Cannot delete resource: it has ${resource.assignments.length} active assignment(s)`);
  }

  await prisma.resource.delete({
    where: { id },
  });
}
