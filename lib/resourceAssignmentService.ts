/**
 * Resource Assignment Service
 * 
 * Provides operations for resource assignment management with allocation-type-aware models:
 * - EXCLUSIVE allocation: Each employee gets their own item (one-to-one assignment)
 * - SHARED allocation: Multiple employees can share the same resource (many-to-one)
 * 
 * Also supports type-specific assignment models:
 * - Hardware: Exclusive assignment (one item per user at a time)
 * - Software: Supports both individual and pooled assignment models
 * - Cloud: Shared assignment (multiple users can access the same resource)
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.4, 3.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 11.3
 */

import { PrismaClient, AssignmentStatus } from '@prisma/client';
import { 
  CreateAssignmentRequest,
  UpdateAssignmentRequest,
  ResourceAssignment,
  AssignmentType,
  AllocationType,
} from '../types/resource-structure';

const prisma = new PrismaClient();

/**
 * Assignment validation result
 */
export interface AssignmentValidationResult {
  isValid: boolean;
  error?: string;
  errorCode?: string;
  suggestedAssignmentType?: AssignmentType;
  allocationType?: AllocationType;
  currentAssignments?: number;
  maxCapacity?: number;
}

/**
 * Assignment creation result
 */
export interface AssignmentResult {
  success: boolean;
  assignment?: ResourceAssignment;
  error?: string;
  errorCode?: string;
}

/**
 * Determines the appropriate assignment type based on resource type
 * Requirements: 10.1, 10.2, 10.3
 */
export function determineAssignmentType(
  resourceTypeName: string,
  requestedType?: AssignmentType
): AssignmentType {
  const normalizedType = resourceTypeName.toUpperCase();
  
  switch (normalizedType) {
    case 'HARDWARE':
    case 'PHYSICAL':
      // Hardware always requires individual assignment
      return 'INDIVIDUAL';
    
    case 'SOFTWARE':
      // Software supports both individual and pooled
      return requestedType === 'POOLED' ? 'POOLED' : 'INDIVIDUAL';
    
    case 'CLOUD':
      // Cloud resources are shared by default
      return 'SHARED';
    
    default:
      // Default to individual for unknown types
      return requestedType || 'INDIVIDUAL';
  }
}

/**
 * Validates an assignment request based on resource allocation type and type rules
 * Requirements: 2.1, 2.2, 3.1, 3.4, 3.5, 10.1, 10.3, 10.5
 */
export async function validateAssignmentRequest(
  request: CreateAssignmentRequest
): Promise<AssignmentValidationResult> {
  // Get resource with type information and allocation type
  const resource = await prisma.resource.findUnique({
    where: { id: request.resourceId },
    include: {
      resourceTypeEntity: true,
      items: {
        where: { status: 'AVAILABLE' },
      },
      assignments: {
        where: { status: 'ACTIVE' },
      },
    },
  });

  if (!resource) {
    return { isValid: false, error: 'Resource not found', errorCode: 'RESOURCE_NOT_FOUND' };
  }

  if (resource.status !== 'ACTIVE') {
    return { isValid: false, error: 'Resource is not active', errorCode: 'RESOURCE_INACTIVE' };
  }

  // Validate employee exists
  const employee = await prisma.employee.findUnique({
    where: { id: request.employeeId },
  });

  if (!employee) {
    return { isValid: false, error: 'Employee not found', errorCode: 'EMPLOYEE_NOT_FOUND' };
  }

  // Get resource type name (from new entity or legacy type)
  const resourceTypeName = resource.resourceTypeEntity?.name || resource.type;

  // Determine the appropriate assignment type
  const suggestedAssignmentType = determineAssignmentType(resourceTypeName, request.assignmentType);

  // Get allocation type (default to EXCLUSIVE for backward compatibility)
  const allocationType: AllocationType = (resource.allocationType as AllocationType) || 'EXCLUSIVE';

  // Validate based on allocation type first (new allocation-type-aware validation)
  // Requirements: 2.1, 2.2, 3.1, 3.4, 3.5
  const allocationValidation = validateAllocationTypeConstraints(
    resource,
    request,
    allocationType,
    suggestedAssignmentType
  );

  if (!allocationValidation.isValid) {
    return allocationValidation;
  }

  // Then apply type-specific validation (legacy type-based validation)
  const normalizedType = resourceTypeName.toUpperCase();

  switch (normalizedType) {
    case 'HARDWARE':
    case 'PHYSICAL':
      return validateHardwareAssignment(resource, request, suggestedAssignmentType);
    
    case 'SOFTWARE':
      return validateSoftwareAssignment(resource, request, suggestedAssignmentType);
    
    case 'CLOUD':
      return validateCloudAssignment(resource, request, suggestedAssignmentType);
    
    default:
      // For custom types, use allocation-type-based validation
      return { isValid: true, suggestedAssignmentType, allocationType };
  }
}

/**
 * Validates assignment based on allocation type constraints
 * Requirements: 2.1, 2.2, 3.1, 3.4, 3.5
 */
function validateAllocationTypeConstraints(
  resource: any,
  request: CreateAssignmentRequest,
  allocationType: AllocationType,
  suggestedAssignmentType: AssignmentType
): AssignmentValidationResult {
  const activeAssignments = resource.assignments?.filter((a: any) => a.status === 'ACTIVE') || [];
  const activeAssignmentCount = activeAssignments.length;

  if (allocationType === 'EXCLUSIVE') {
    // EXCLUSIVE allocation: Each employee gets their own item (one-to-one)
    // Requirements: 2.1, 2.2

    // For EXCLUSIVE resources, itemId is required
    if (!request.itemId) {
      // Check if there are available items
      if (resource.items.length === 0) {
        return {
          isValid: false,
          error: 'No available items for this exclusive resource. All items are assigned or unavailable.',
          errorCode: 'NO_AVAILABLE_ITEMS',
          suggestedAssignmentType,
          allocationType,
        };
      }
      return {
        isValid: false,
        error: 'Item selection is required for exclusive resources',
        errorCode: 'ITEM_REQUIRED',
        suggestedAssignmentType,
        allocationType,
      };
    }

    // Check if the specific item is already assigned (prevent double-assignment)
    // Requirements: 2.2
    const existingItemAssignment = activeAssignments.find(
      (a: any) => a.itemId === request.itemId
    );
    if (existingItemAssignment) {
      return {
        isValid: false,
        error: 'This item is already assigned to another employee',
        errorCode: 'ITEM_ALREADY_ASSIGNED',
        suggestedAssignmentType,
        allocationType,
      };
    }

    // Verify the item exists and is available
    const item = resource.items.find((i: any) => i.id === request.itemId);
    if (!item) {
      return {
        isValid: false,
        error: 'The specified item is not available for assignment. It may already be assigned or in maintenance.',
        errorCode: 'ITEM_NOT_AVAILABLE',
        suggestedAssignmentType,
        allocationType,
      };
    }

  } else if (allocationType === 'SHARED') {
    // SHARED allocation: Multiple employees can share the same resource
    // Requirements: 3.1, 3.4, 3.5

    // Check if employee already has access to this shared resource
    const existingEmployeeAssignment = activeAssignments.find(
      (a: any) => a.employeeId === request.employeeId
    );
    if (existingEmployeeAssignment) {
      return {
        isValid: false,
        error: 'Employee already has access to this shared resource',
        errorCode: 'ALREADY_ASSIGNED',
        suggestedAssignmentType,
        allocationType,
      };
    }

    // Check capacity for SHARED resources
    // Requirements: 3.4, 3.5
    const quantity = resource.quantity;
    
    // quantity = -1 means unlimited capacity
    if (quantity !== -1 && quantity !== null && quantity !== undefined) {
      if (activeAssignmentCount >= quantity) {
        return {
          isValid: false,
          error: 'This resource has reached its maximum capacity',
          errorCode: 'CAPACITY_REACHED',
          suggestedAssignmentType,
          allocationType,
          currentAssignments: activeAssignmentCount,
          maxCapacity: quantity,
        };
      }
    }
  }

  return { isValid: true, suggestedAssignmentType, allocationType };
}

/**
 * Validates hardware assignment
 * Requirements: 10.1 - Hardware requires assignment to specific resource items
 * Requirements: 10.5 - Prevent assignment of the same item to another user until returned
 */
function validateHardwareAssignment(
  resource: any,
  request: CreateAssignmentRequest,
  suggestedType: AssignmentType
): AssignmentValidationResult {
  // Hardware requires a specific item ID
  if (!request.itemId) {
    // Check if there are available items
    if (resource.items.length === 0) {
      return { 
        isValid: false, 
        error: 'No available items for this hardware resource. All items are assigned or unavailable.',
        suggestedAssignmentType: suggestedType,
      };
    }
    return { 
      isValid: false, 
      error: 'Hardware resources require assignment to a specific item. Please provide an itemId.',
      suggestedAssignmentType: suggestedType,
    };
  }

  // Verify the item exists and belongs to this resource
  const item = resource.items.find((i: any) => i.id === request.itemId);
  if (!item) {
    // Check if item exists but is not available
    return { 
      isValid: false, 
      error: 'The specified item is not available for assignment. It may already be assigned or in maintenance.',
      suggestedAssignmentType: suggestedType,
    };
  }

  // Check if item is already assigned (double-check)
  const existingItemAssignment = resource.assignments.find(
    (a: any) => a.itemId === request.itemId && a.status === 'ACTIVE'
  );
  if (existingItemAssignment) {
    return { 
      isValid: false, 
      error: 'This hardware item is already assigned to another user. It must be returned before reassignment.',
      suggestedAssignmentType: suggestedType,
    };
  }

  // Check if employee already has this specific item assigned
  const existingEmployeeAssignment = resource.assignments.find(
    (a: any) => a.employeeId === request.employeeId && a.itemId === request.itemId && a.status === 'ACTIVE'
  );
  if (existingEmployeeAssignment) {
    return { 
      isValid: false, 
      error: 'Employee already has this hardware item assigned.',
      suggestedAssignmentType: suggestedType,
    };
  }

  return { isValid: true, suggestedAssignmentType: suggestedType };
}

/**
 * Validates software assignment
 * Requirements: 10.2 - Software supports both item-level and pooled assignment models
 */
function validateSoftwareAssignment(
  resource: any,
  request: CreateAssignmentRequest,
  suggestedType: AssignmentType
): AssignmentValidationResult {
  // For pooled assignment, no specific item is required
  if (suggestedType === 'POOLED') {
    // Check license pool availability (using quantity)
    const activeAssignments = resource.assignments.filter((a: any) => a.status === 'ACTIVE').length;
    const maxLicenses = resource.quantity || 1;
    
    if (activeAssignments >= maxLicenses) {
      return { 
        isValid: false, 
        error: `No available licenses in the pool. ${activeAssignments}/${maxLicenses} licenses are in use.`,
        suggestedAssignmentType: suggestedType,
      };
    }

    // Check if employee already has a pooled assignment for this resource
    const existingPooledAssignment = resource.assignments.find(
      (a: any) => a.employeeId === request.employeeId && a.assignmentType === 'POOLED' && a.status === 'ACTIVE'
    );
    if (existingPooledAssignment) {
      return { 
        isValid: false, 
        error: 'Employee already has a pooled license for this software.',
        suggestedAssignmentType: suggestedType,
      };
    }

    return { isValid: true, suggestedAssignmentType: suggestedType };
  }

  // For individual assignment, validate item if provided
  if (request.itemId) {
    const item = resource.items.find((i: any) => i.id === request.itemId);
    if (!item) {
      return { 
        isValid: false, 
        error: 'The specified software license is not available.',
        suggestedAssignmentType: suggestedType,
      };
    }

    // Check if item is already assigned
    const existingItemAssignment = resource.assignments.find(
      (a: any) => a.itemId === request.itemId && a.status === 'ACTIVE'
    );
    if (existingItemAssignment) {
      return { 
        isValid: false, 
        error: 'This software license is already assigned.',
        suggestedAssignmentType: suggestedType,
      };
    }
  }

  // Check if employee already has this software assigned
  const existingAssignment = resource.assignments.find(
    (a: any) => a.employeeId === request.employeeId && a.status === 'ACTIVE'
  );
  if (existingAssignment) {
    return { 
      isValid: false, 
      error: 'Employee already has this software assigned.',
      suggestedAssignmentType: suggestedType,
    };
  }

  return { isValid: true, suggestedAssignmentType: suggestedType };
}

/**
 * Validates cloud assignment
 * Requirements: 10.3 - Cloud resources allow multiple users to be assigned simultaneously
 * Requirements: 10.7 - Maintain a list of all users with access to the shared resource
 */
function validateCloudAssignment(
  resource: any,
  request: CreateAssignmentRequest,
  suggestedType: AssignmentType
): AssignmentValidationResult {
  // Cloud resources are shared - check if employee already has access
  const existingAssignment = resource.assignments.find(
    (a: any) => a.employeeId === request.employeeId && a.status === 'ACTIVE'
  );
  
  if (existingAssignment) {
    return { 
      isValid: false, 
      error: 'Employee already has access to this cloud resource.',
      suggestedAssignmentType: suggestedType,
    };
  }

  // Cloud resources typically don't require specific items
  // but if one is provided, validate it
  if (request.itemId) {
    const item = resource.items.find((i: any) => i.id === request.itemId);
    if (!item) {
      return { 
        isValid: false, 
        error: 'The specified cloud resource item is not available.',
        suggestedAssignmentType: suggestedType,
      };
    }
  }

  return { isValid: true, suggestedAssignmentType: suggestedType };
}

/**
 * Creates a new resource assignment with allocation-type-aware logic
 * Requirements: 2.1, 2.2, 3.1, 3.4, 3.5, 10.1, 10.2, 10.3, 10.4
 */
export async function createAssignment(
  request: CreateAssignmentRequest,
  assignedById: string
): Promise<AssignmentResult> {
  // Validate the assignment request
  const validation = await validateAssignmentRequest(request);
  
  if (!validation.isValid) {
    return { 
      success: false, 
      error: validation.error,
      errorCode: validation.errorCode,
    };
  }

  const assignmentType = validation.suggestedAssignmentType || request.assignmentType || 'INDIVIDUAL';

  try {
    // Create assignment with transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the assignment
      const assignment = await tx.resourceAssignment.create({
        data: {
          employeeId: request.employeeId,
          resourceId: request.resourceId,
          itemId: request.itemId || null,
          assignedBy: assignedById,
          status: 'ACTIVE',
          assignmentType: assignmentType,
          notes: request.notes || null,
        },
        include: {
          employee: {
            select: { id: true, name: true, email: true, department: true },
          },
          resource: {
            select: { id: true, name: true, type: true, category: true, allocationType: true },
          },
          item: {
            select: { id: true, serialNumber: true, hostname: true, licenseKey: true },
          },
        },
      });

      // Update item status if a specific item was assigned
      if (request.itemId) {
        await tx.resourceItem.update({
          where: { id: request.itemId },
          data: { status: 'ASSIGNED' },
        });
      }

      return assignment;
    });

    return {
      success: true,
      assignment: mapPrismaToAssignment(result),
    };
  } catch (error) {
    console.error('Error creating assignment:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create assignment',
      errorCode: 'ASSIGNMENT_CREATION_FAILED',
    };
  }
}

/**
 * Updates an assignment status
 * Requirements: 10.4 - Track assignment status with values: ACTIVE, RETURNED, REVOKED
 * Requirements: 10.8 - Allow administrators to revoke assignments
 */
export async function updateAssignmentStatus(
  assignmentId: string,
  update: UpdateAssignmentRequest,
  updatedById: string
): Promise<AssignmentResult> {
  try {
    const existing = await prisma.resourceAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        item: true,
        resource: {
          select: { id: true, name: true, type: true },
        },
        employee: {
          select: { id: true, name: true },
        },
      },
    });

    if (!existing) {
      return { success: false, error: 'Assignment not found', errorCode: 'ASSIGNMENT_NOT_FOUND' };
    }

    // Validate status transition
    const validTransitions: Record<string, AssignmentStatus[]> = {
      'ACTIVE': ['RETURNED', 'LOST', 'DAMAGED'],
      'RETURNED': [], // Terminal state
      'LOST': [], // Terminal state
      'DAMAGED': ['RETURNED'], // Can be returned after repair
    };

    const currentStatus = existing.status;
    const newStatus = update.status;

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return { 
        success: false, 
        error: `Cannot transition from ${currentStatus} to ${newStatus}`,
        errorCode: 'INVALID_STATUS_TRANSITION',
      };
    }

    // Update assignment with transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedAssignment = await tx.resourceAssignment.update({
        where: { id: assignmentId },
        data: {
          status: newStatus,
          returnedAt: ['RETURNED', 'LOST', 'DAMAGED'].includes(newStatus) 
            ? (update.returnedAt || new Date()) 
            : null,
          notes: update.notes 
            ? `${existing.notes || ''}\n\n${update.notes}`.trim() 
            : existing.notes,
        },
        include: {
          employee: {
            select: { id: true, name: true, email: true, department: true },
          },
          resource: {
            select: { id: true, name: true, type: true, category: true },
          },
          item: {
            select: { id: true, serialNumber: true, hostname: true, licenseKey: true },
          },
        },
      });

      // Update item status based on assignment status
      if (existing.itemId) {
        let newItemStatus: 'AVAILABLE' | 'LOST' | 'DAMAGED' | 'MAINTENANCE' = 'AVAILABLE';
        
        switch (newStatus) {
          case 'RETURNED':
            newItemStatus = 'AVAILABLE';
            break;
          case 'LOST':
            newItemStatus = 'LOST';
            break;
          case 'DAMAGED':
            newItemStatus = 'DAMAGED';
            break;
        }

        await tx.resourceItem.update({
          where: { id: existing.itemId },
          data: { status: newItemStatus },
        });
      }

      // Log audit trail
      await tx.auditLog.create({
        data: {
          entityType: 'RESOURCE',
          entityId: existing.resourceId,
          changedById: updatedById,
          fieldChanged: 'assignmentStatus',
          oldValue: currentStatus,
          newValue: newStatus,
          resourceId: existing.resourceId,
          assignmentId: assignmentId,
        },
      });

      // Log activity timeline
      await tx.activityTimeline.create({
        data: {
          entityType: 'RESOURCE',
          entityId: existing.resourceId,
          activityType: 'STATUS_CHANGED',
          title: `Assignment status changed to ${newStatus}`,
          description: `${existing.resource.name} assignment for ${existing.employee.name} changed from ${currentStatus} to ${newStatus}`,
          performedBy: updatedById,
          resourceId: existing.resourceId,
          assignmentId: assignmentId,
          employeeId: existing.employeeId,
          metadata: {
            previousStatus: currentStatus,
            newStatus: newStatus,
            notes: update.notes,
          },
        },
      });

      return updatedAssignment;
    });

    return {
      success: true,
      assignment: mapPrismaToAssignment(result),
    };
  } catch (error) {
    console.error('Error updating assignment status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update assignment',
      errorCode: 'UPDATE_FAILED',
    };
  }
}

/**
 * Revokes an assignment (admin action)
 * Requirements: 10.8 - Allow administrators to revoke assignments
 */
export async function revokeAssignment(
  assignmentId: string,
  revokedById: string,
  reason?: string
): Promise<AssignmentResult> {
  return updateAssignmentStatus(
    assignmentId,
    {
      status: 'RETURNED',
      notes: reason ? `Revoked: ${reason}` : 'Assignment revoked by administrator',
      returnedAt: new Date(),
    },
    revokedById
  );
}

/**
 * Gets all users assigned to a shared cloud resource
 * Requirements: 10.7 - Maintain a list of all users with access to the shared resource
 */
export async function getSharedResourceUsers(resourceId: string): Promise<any[]> {
  const assignments = await prisma.resourceAssignment.findMany({
    where: {
      resourceId,
      status: 'ACTIVE',
      assignmentType: 'SHARED',
    },
    include: {
      employee: {
        select: { id: true, name: true, email: true, department: true, role: true },
      },
    },
    orderBy: { assignedAt: 'asc' },
  });

  return assignments.map(a => ({
    ...a.employee,
    assignedAt: a.assignedAt,
    assignmentId: a.id,
  }));
}

/**
 * Gets assignment by ID
 */
export async function getAssignmentById(id: string): Promise<ResourceAssignment | null> {
  const assignment = await prisma.resourceAssignment.findUnique({
    where: { id },
    include: {
      employee: {
        select: { id: true, name: true, email: true, department: true },
      },
      resource: {
        select: { id: true, name: true, type: true, category: true, allocationType: true },
      },
      item: {
        select: { id: true, serialNumber: true, hostname: true, licenseKey: true },
      },
    },
  });

  return assignment ? mapPrismaToAssignment(assignment) : null;
}

/**
 * Gets assignments with filtering
 */
export async function getAssignments(options: {
  resourceId?: string;
  employeeId?: string;
  status?: AssignmentStatus;
  assignmentType?: AssignmentType;
  page?: number;
  limit?: number;
}): Promise<{ assignments: ResourceAssignment[]; total: number }> {
  const { resourceId, employeeId, status, assignmentType, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (resourceId) where.resourceId = resourceId;
  if (employeeId) where.employeeId = employeeId;
  if (status) where.status = status;
  if (assignmentType) where.assignmentType = assignmentType;

  const [assignments, total] = await Promise.all([
    prisma.resourceAssignment.findMany({
      where,
      skip,
      take: limit,
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: true },
        },
        resource: {
          select: { id: true, name: true, type: true, category: true, allocationType: true },
        },
        item: {
          select: { id: true, serialNumber: true, hostname: true, licenseKey: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.resourceAssignment.count({ where }),
  ]);

  return {
    assignments: assignments.map(mapPrismaToAssignment),
    total,
  };
}

/**
 * Checks if a hardware item can be assigned (not already assigned)
 * Requirements: 2.2, 10.5 - Prevent assignment of the same item to another user until returned
 */
export async function canAssignHardwareItem(itemId: string): Promise<{ canAssign: boolean; reason?: string }> {
  const item = await prisma.resourceItem.findUnique({
    where: { id: itemId },
    include: {
      resource: {
        include: {
          resourceTypeEntity: true,
        },
      },
      assignments: {
        where: { status: 'ACTIVE' },
      },
    },
  });

  if (!item) {
    return { canAssign: false, reason: 'Item not found' };
  }

  if (item.status !== 'AVAILABLE') {
    return { canAssign: false, reason: `Item is not available (status: ${item.status})` };
  }

  if (item.assignments.length > 0) {
    return { canAssign: false, reason: 'Item is already assigned to another user' };
  }

  return { canAssign: true };
}

/**
 * Gets available license count for pooled software or shared resources
 * Requirements: 3.4, 3.5, 10.6 - Track license usage without requiring specific item assignment
 */
export async function getAvailableLicenseCount(resourceId: string): Promise<{ available: number; total: number; used: number; unlimited: boolean }> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      assignments: {
        where: { 
          status: 'ACTIVE',
        },
      },
    },
  });

  if (!resource) {
    throw new Error('Resource not found');
  }

  const total = resource.quantity ?? 1;
  const used = resource.assignments.length;
  
  // quantity = -1 means unlimited
  if (total === -1) {
    return { available: Number.MAX_SAFE_INTEGER, total: -1, used, unlimited: true };
  }
  
  const available = Math.max(0, total - used);

  return { available, total, used, unlimited: false };
}

/**
 * Gets the remaining capacity for a shared resource
 * Requirements: 3.4, 3.5
 */
export async function getSharedResourceCapacity(resourceId: string): Promise<{
  currentAssignments: number;
  maxCapacity: number;
  remainingCapacity: number;
  isUnlimited: boolean;
}> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
      },
    },
  });

  if (!resource) {
    throw new Error('Resource not found');
  }

  const currentAssignments = resource.assignments.length;
  const maxCapacity = resource.quantity ?? 1;
  const isUnlimited = maxCapacity === -1;
  const remainingCapacity = isUnlimited ? Number.MAX_SAFE_INTEGER : Math.max(0, maxCapacity - currentAssignments);

  return {
    currentAssignments,
    maxCapacity,
    remainingCapacity,
    isUnlimited,
  };
}

/**
 * Maps Prisma assignment to ResourceAssignment interface
 */
function mapPrismaToAssignment(assignment: any): ResourceAssignment {
  return {
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
  };
}
