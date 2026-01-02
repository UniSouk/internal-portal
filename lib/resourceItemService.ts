/**
 * ResourceItem Service
 * 
 * Provides operations for resource item management with dynamic property support:
 * - Creating items with property validation against locked schemas
 * - Editing items while maintaining schema consistency
 * - Deleting items with assignment constraint checks
 * - Backward compatibility with legacy data formats
 * 
 * Requirements: 9.1, 9.2, 15.1, 15.2, 15.6, 15.7, 11.2, 5.4, 5.5
 */

import { prisma } from './prisma';
import { 
  PropertyDefinition,
  EnhancedResourceItem,
  CreateResourceItemRequest,
  UpdateResourceItemRequest,
  SchemaValidationResult,
  PropertyValidationError,
  ItemStatus,
  isValidPropertyValue,
  MandatoryPropertyValidation
} from '../types/resource-structure';
import { lockResourceSchema, getResourcePropertySchema, validatePropertiesAgainstSchema } from './resourceService';
import { logPropertySchemaLocked } from './resourceStructureAudit';
import {
  convertLegacyFieldsToProperties,
  mergePropertiesWithLegacy,
  normalizeResourceItem,
  createBackwardCompatibleItemResponse,
} from './backwardCompatibility';

// ============================================
// Mandatory Property Validation
// Requirements: 1.2, 2.2, 4.4
// ============================================

/**
 * Validates that all mandatory properties are present and non-empty
 * Requirements: 1.2 - Cloud resources require "maxUsers" to be filled
 * Requirements: 2.2 - Hardware resources require "serialNumber" and "warrantyExpiry" to be filled
 * Requirements: 4.4 - Check all mandatory properties are present and non-empty
 * 
 * @param properties - The properties object to validate
 * @param mandatoryKeys - Array of property keys that are mandatory
 * @returns Validation result with isValid flag, missing properties, and error messages
 */
export function validateMandatoryProperties(
  properties: Record<string, unknown>,
  mandatoryKeys: string[]
): MandatoryPropertyValidation {
  const missingProperties: string[] = [];
  const errors: string[] = [];

  for (const key of mandatoryKeys) {
    const value = properties[key];
    
    // Check if property is missing
    if (value === undefined) {
      missingProperties.push(key);
      errors.push(`Missing mandatory property: ${key}`);
      continue;
    }
    
    // Check if property is null
    if (value === null) {
      missingProperties.push(key);
      errors.push(`Mandatory property "${key}" cannot be null`);
      continue;
    }
    
    // Check if property is empty string
    if (typeof value === 'string' && value.trim() === '') {
      missingProperties.push(key);
      errors.push(`Mandatory property "${key}" cannot be empty`);
      continue;
    }
  }

  return {
    isValid: missingProperties.length === 0,
    missingProperties,
    errors,
  };
}

/**
 * Creates a new resource item with dynamic properties
 * Requirements: 9.1 - Treat resources as logical groupings or templates
 * Requirements: 9.2 - Treat resource items as actual instances
 */
export async function createResourceItem(
  resourceId: string,
  request: CreateResourceItemRequest,
  createdById: string
): Promise<EnhancedResourceItem> {
  // Get the resource with its property schema
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      items: { select: { id: true } },
    },
  });

  if (!resource) {
    throw new Error('Resource not found');
  }

  // Get the property schema
  const propertySchema = (resource.propertySchema as unknown as PropertyDefinition[]) || [];

  // Validate properties against the schema
  const validationResult = validatePropertiesAgainstSchema(request.properties, propertySchema);
  
  if (!validationResult.isValid) {
    const errors: string[] = [];
    
    if (validationResult.missingKeys.length > 0) {
      errors.push(`Missing required properties: ${validationResult.missingKeys.join(', ')}`);
    }
    
    if (validationResult.extraKeys.length > 0) {
      errors.push(`Unknown properties not in schema: ${validationResult.extraKeys.join(', ')}`);
    }
    
    if (validationResult.typeErrors.length > 0) {
      errors.push(...validationResult.typeErrors.map(e => e.message));
    }
    
    throw new Error(`Property validation failed: ${errors.join('; ')}`);
  }

  // Check if this is the first item - if so, lock the schema
  const isFirstItem = resource.items.length === 0;

  // Extract legacy fields from properties for backward compatibility
  const legacyFields = extractLegacyFields(request.properties);

  // Create the item in a transaction
  const item = await prisma.$transaction(async (tx) => {
    // Create the resource item
    const newItem = await tx.resourceItem.create({
      data: {
        resourceId,
        status: request.status || 'AVAILABLE',
        properties: JSON.parse(JSON.stringify(request.properties)),
        // Legacy fields for backward compatibility
        ...legacyFields,
      },
      include: {
        resource: {
          select: { 
            id: true, 
            name: true, 
            type: true, 
            category: true,
            propertySchema: true,
            schemaLocked: true,
          },
        },
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true },
            },
          },
        },
      },
    });

    // Lock the schema if this is the first item
    if (isFirstItem && !resource.schemaLocked) {
      await tx.resource.update({
        where: { id: resourceId },
        data: { schemaLocked: true },
      });

      // Requirement 11.2: Log property schema locking
      await logPropertySchemaLocked({
        resourceId,
        resourceName: resource.name,
        newSchema: propertySchema.map(p => ({
          key: p.key,
          label: p.label,
          dataType: p.dataType,
          isRequired: p.isRequired,
        })),
        schemaLocked: true,
        performedById: createdById,
        performedByName: 'System', // Will be updated with actual user name in the API layer
      });
    }

    // Log audit trail
    await tx.auditLog.create({
      data: {
        entityType: 'RESOURCE',
        entityId: resourceId,
        changedById: createdById,
        fieldChanged: 'item_created',
        newValue: JSON.stringify({
          itemId: newItem.id,
          properties: request.properties,
          isFirstItem,
          schemaLocked: isFirstItem || resource.schemaLocked,
        }),
        resourceId,
      },
    });

    // Log activity timeline
    await tx.activityTimeline.create({
      data: {
        entityType: 'RESOURCE',
        entityId: resourceId,
        activityType: 'CREATED',
        title: `New ${resource.name} item added`,
        description: `Resource item created with ${Object.keys(request.properties).length} properties`,
        performedBy: createdById,
        resourceId,
        metadata: JSON.parse(JSON.stringify({
          itemId: newItem.id,
          properties: request.properties,
          isFirstItem,
          schemaLocked: isFirstItem || resource.schemaLocked,
        })),
      },
    });

    return newItem;
  });

  return mapPrismaToEnhancedResourceItem(item);
}

/**
 * Gets a resource item by ID
 */
export async function getResourceItemById(id: string): Promise<EnhancedResourceItem | null> {
  const item = await prisma.resourceItem.findUnique({
    where: { id },
    include: {
      resource: {
        select: { 
          id: true, 
          name: true, 
          type: true, 
          category: true,
          propertySchema: true,
          schemaLocked: true,
        },
      },
      assignments: {
        include: {
          employee: {
            select: { id: true, name: true, email: true, department: true },
          },
        },
        orderBy: { assignedAt: 'desc' },
      },
    },
  });

  return item ? mapPrismaToEnhancedResourceItem(item) : null;
}

/**
 * Gets all items for a resource
 */
export async function getResourceItems(
  resourceId: string,
  options: {
    page?: number;
    limit?: number;
    status?: ItemStatus;
    search?: string;
  } = {}
): Promise<{ items: EnhancedResourceItem[]; total: number }> {
  const { page = 1, limit = 20, status, search } = options;
  const skip = (page - 1) * limit;

  const where: any = { resourceId };
  
  if (status) {
    where.status = status;
  }
  
  if (search) {
    where.OR = [
      { serialNumber: { contains: search, mode: 'insensitive' } },
      { hostname: { contains: search, mode: 'insensitive' } },
      { licenseKey: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.resourceItem.findMany({
      where,
      skip,
      take: limit,
      include: {
        resource: {
          select: { 
            id: true, 
            name: true, 
            type: true, 
            category: true,
            propertySchema: true,
            schemaLocked: true,
          },
        },
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.resourceItem.count({ where }),
  ]);

  return {
    items: items.map(mapPrismaToEnhancedResourceItem),
    total,
  };
}

/**
 * Updates a resource item's properties
 * Requirements: 15.1 - Allow editing of resource item properties while maintaining locked schema
 * Requirements: 15.2 - Enforce the same property keys defined when first item was created
 * Requirements: 15.6 - Validate data types and constraints defined in property schema
 */
export async function updateResourceItem(
  id: string,
  request: UpdateResourceItemRequest,
  updatedById: string
): Promise<EnhancedResourceItem> {
  // Get current item with resource schema
  const currentItem = await prisma.resourceItem.findUnique({
    where: { id },
    include: {
      resource: {
        select: { 
          id: true, 
          name: true, 
          propertySchema: true, 
          schemaLocked: true,
        },
      },
    },
  });

  if (!currentItem) {
    throw new Error('Resource item not found');
  }

  // If updating properties, validate against schema
  if (request.properties) {
    const propertySchema = (currentItem.resource.propertySchema as unknown as PropertyDefinition[]) || [];
    
    // Validate properties against the locked schema
    const validationResult = validatePropertiesAgainstSchema(request.properties, propertySchema);
    
    if (!validationResult.isValid) {
      const errors: string[] = [];
      
      if (validationResult.missingKeys.length > 0) {
        errors.push(`Missing required properties: ${validationResult.missingKeys.join(', ')}`);
      }
      
      if (validationResult.extraKeys.length > 0) {
        errors.push(`Unknown properties not in schema: ${validationResult.extraKeys.join(', ')}`);
      }
      
      if (validationResult.typeErrors.length > 0) {
        errors.push(...validationResult.typeErrors.map(e => e.message));
      }
      
      throw new Error(`Property validation failed: ${errors.join('; ')}`);
    }
  }

  // Extract legacy fields from properties for backward compatibility
  const legacyFields = request.properties ? extractLegacyFields(request.properties) : {};

  // Update the item in a transaction
  const updatedItem = await prisma.$transaction(async (tx) => {
    const item = await tx.resourceItem.update({
      where: { id },
      data: {
        ...(request.properties && { 
          properties: JSON.parse(JSON.stringify(request.properties)),
          ...legacyFields,
        }),
        ...(request.status && { status: request.status }),
      },
      include: {
        resource: {
          select: { 
            id: true, 
            name: true, 
            type: true, 
            category: true,
            propertySchema: true,
            schemaLocked: true,
          },
        },
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true },
            },
          },
        },
      },
    });

    // Build change log
    const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
    
    if (request.properties) {
      const oldProperties = (currentItem.properties as Record<string, unknown>) || {};
      const newProperties = request.properties;
      
      // Track property changes
      const allKeys = new Set([...Object.keys(oldProperties), ...Object.keys(newProperties)]);
      for (const key of allKeys) {
        if (JSON.stringify(oldProperties[key]) !== JSON.stringify(newProperties[key])) {
          changes.push({
            field: `property_${key}`,
            oldValue: oldProperties[key],
            newValue: newProperties[key],
          });
        }
      }
    }
    
    if (request.status && request.status !== currentItem.status) {
      changes.push({
        field: 'status',
        oldValue: currentItem.status,
        newValue: request.status,
      });
    }

    // Log audit trail for each change
    // Requirements: 15.7 - Log all item edits in the audit trail
    for (const change of changes) {
      await tx.auditLog.create({
        data: {
          entityType: 'RESOURCE',
          entityId: currentItem.resource.id,
          changedById: updatedById,
          fieldChanged: `item_${change.field}`,
          oldValue: change.oldValue !== undefined ? String(change.oldValue) : null,
          newValue: change.newValue !== undefined ? String(change.newValue) : null,
          resourceId: currentItem.resource.id,
        },
      });
    }

    // Log activity timeline if there were changes
    if (changes.length > 0) {
      await tx.activityTimeline.create({
        data: {
          entityType: 'RESOURCE',
          entityId: currentItem.resource.id,
          activityType: 'UPDATED',
          title: `${currentItem.resource.name} item updated`,
          description: `Resource item updated with ${changes.length} change(s)`,
          performedBy: updatedById,
          resourceId: currentItem.resource.id,
          metadata: JSON.parse(JSON.stringify({
            itemId: id,
            changes,
          })),
        },
      });
    }

    return item;
  });

  return mapPrismaToEnhancedResourceItem(updatedItem);
}

/**
 * Deletes a resource item
 * Requirements: 15.3 - Allow deletion when not currently assigned
 * Requirements: 15.4 - Prevent deletion if item has active assignments
 * Requirements: 15.7 - Log deletions in the audit trail
 */
export async function deleteResourceItem(
  id: string,
  deletedById: string
): Promise<void> {
  // Get item with assignments
  const item = await prisma.resourceItem.findUnique({
    where: { id },
    include: {
      resource: {
        select: { id: true, name: true },
      },
      assignments: {
        where: { status: 'ACTIVE' },
        select: { id: true, employeeId: true },
      },
    },
  });

  if (!item) {
    throw new Error('Resource item not found');
  }

  // Check for active assignments
  // Requirements: 15.4 - Prevent deletion if item has active assignments
  if (item.assignments.length > 0) {
    throw new Error(
      `Cannot delete item: it has ${item.assignments.length} active assignment(s). ` +
      'Please return or revoke all assignments before deleting.'
    );
  }

  // Delete in transaction
  await prisma.$transaction(async (tx) => {
    // Delete the item
    await tx.resourceItem.delete({
      where: { id },
    });

    // Log audit trail
    // Requirements: 15.7 - Log deletions in the audit trail
    await tx.auditLog.create({
      data: {
        entityType: 'RESOURCE',
        entityId: item.resource.id,
        changedById: deletedById,
        fieldChanged: 'item_deleted',
        oldValue: JSON.stringify({
          itemId: id,
          properties: item.properties,
          serialNumber: item.serialNumber,
          hostname: item.hostname,
        }),
        resourceId: item.resource.id,
      },
    });

    // Log activity timeline
    await tx.activityTimeline.create({
      data: {
        entityType: 'RESOURCE',
        entityId: item.resource.id,
        activityType: 'DELETED',
        title: `${item.resource.name} item removed`,
        description: `Resource item ${item.serialNumber || item.hostname || id} removed from inventory`,
        performedBy: deletedById,
        resourceId: item.resource.id,
        metadata: {
          itemId: id,
          properties: item.properties,
          serialNumber: item.serialNumber,
          hostname: item.hostname,
        },
      },
    });
  });
}

/**
 * Updates item status (e.g., marking as lost, damaged, or decommissioned)
 * Requirements: 15.8 - Update item status appropriately
 */
export async function updateItemStatus(
  id: string,
  status: ItemStatus,
  updatedById: string,
  notes?: string
): Promise<EnhancedResourceItem> {
  const currentItem = await prisma.resourceItem.findUnique({
    where: { id },
    include: {
      resource: {
        select: { id: true, name: true },
      },
    },
  });

  if (!currentItem) {
    throw new Error('Resource item not found');
  }

  const updatedItem = await prisma.$transaction(async (tx) => {
    const item = await tx.resourceItem.update({
      where: { id },
      data: { status },
      include: {
        resource: {
          select: { 
            id: true, 
            name: true, 
            type: true, 
            category: true,
            propertySchema: true,
            schemaLocked: true,
          },
        },
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true },
            },
          },
        },
      },
    });

    // Log audit trail
    await tx.auditLog.create({
      data: {
        entityType: 'RESOURCE',
        entityId: currentItem.resource.id,
        changedById: updatedById,
        fieldChanged: 'item_status',
        oldValue: currentItem.status,
        newValue: status,
        resourceId: currentItem.resource.id,
      },
    });

    // Log activity timeline
    await tx.activityTimeline.create({
      data: {
        entityType: 'RESOURCE',
        entityId: currentItem.resource.id,
        activityType: 'STATUS_CHANGED',
        title: `${currentItem.resource.name} item status changed`,
        description: `Item status changed from ${currentItem.status} to ${status}${notes ? `: ${notes}` : ''}`,
        performedBy: updatedById,
        resourceId: currentItem.resource.id,
        metadata: {
          itemId: id,
          oldStatus: currentItem.status,
          newStatus: status,
          notes,
        },
      },
    });

    return item;
  });

  return mapPrismaToEnhancedResourceItem(updatedItem);
}

/**
 * Checks if an item can be deleted
 */
export async function canDeleteItem(id: string): Promise<{ canDelete: boolean; reason?: string }> {
  const item = await prisma.resourceItem.findUnique({
    where: { id },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        select: { id: true },
      },
    },
  });

  if (!item) {
    return { canDelete: false, reason: 'Item not found' };
  }

  if (item.assignments.length > 0) {
    return { 
      canDelete: false, 
      reason: `Item has ${item.assignments.length} active assignment(s)` 
    };
  }

  return { canDelete: true };
}

/**
 * Extracts legacy fields from properties for backward compatibility
 */
function extractLegacyFields(properties: Record<string, unknown>): Record<string, unknown> {
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

  const legacyFields: Record<string, unknown> = {};

  for (const [propKey, dbField] of Object.entries(legacyFieldMapping)) {
    if (properties[propKey] !== undefined) {
      let value = properties[propKey];
      
      // Handle date fields
      if (['licenseExpiry', 'purchaseDate', 'warrantyExpiry'].includes(propKey) && value) {
        value = new Date(value as string);
      }
      
      // Handle numeric fields
      if (propKey === 'value' && value !== null) {
        value = typeof value === 'number' ? value : parseFloat(value as string);
      }
      
      legacyFields[dbField] = value;
    }
  }

  return legacyFields;
}

/**
 * Maps Prisma ResourceItem to EnhancedResourceItem interface
 */
function mapPrismaToEnhancedResourceItem(item: any): EnhancedResourceItem {
  return {
    id: item.id,
    resourceId: item.resourceId,
    status: item.status,
    properties: (item.properties as Record<string, unknown>) || {},
    
    // Legacy fields
    serialNumber: item.serialNumber ?? undefined,
    hostname: item.hostname ?? undefined,
    ipAddress: item.ipAddress ?? undefined,
    macAddress: item.macAddress ?? undefined,
    operatingSystem: item.operatingSystem ?? undefined,
    osVersion: item.osVersion ?? undefined,
    processor: item.processor ?? undefined,
    memory: item.memory ?? undefined,
    storage: item.storage ?? undefined,
    licenseKey: item.licenseKey ?? undefined,
    softwareVersion: item.softwareVersion ?? undefined,
    licenseType: item.licenseType ?? undefined,
    maxUsers: item.maxUsers ?? undefined,
    activationCode: item.activationCode ?? undefined,
    licenseExpiry: item.licenseExpiry ?? undefined,
    purchaseDate: item.purchaseDate ?? undefined,
    warrantyExpiry: item.warrantyExpiry ?? undefined,
    value: item.value ?? undefined,
    metadata: item.metadata ?? undefined,
    
    createdAt: item.createdAt,
    
    // Related entities
    resource: item.resource ? {
      id: item.resource.id,
      name: item.resource.name,
      type: item.resource.type,
      category: item.resource.category ?? undefined,
      resourceTypeId: item.resource.resourceTypeId ?? undefined,
      resourceCategoryId: item.resource.resourceCategoryId ?? undefined,
      description: item.resource.description ?? undefined,
      owner: item.resource.owner ?? 'Unisouk',
      custodianId: item.resource.custodianId ?? '',
      status: item.resource.status ?? 'ACTIVE',
      allocationType: item.resource.allocationType ?? 'EXCLUSIVE',
      propertySchema: (item.resource.propertySchema as any[]) || [],
      schemaLocked: item.resource.schemaLocked ?? false,
      createdAt: item.resource.createdAt ?? new Date(),
      updatedAt: item.resource.updatedAt ?? new Date(),
    } : undefined,
    
    assignments: item.assignments?.map((assignment: any) => ({
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
