import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';
import { 
  createAssignment, 
  determineAssignmentType,
  canAssignHardwareItem,
  getAvailableLicenseCount,
  getSharedResourceCapacity
} from '@/lib/resourceAssignmentService';
import { AssignmentType, AllocationType } from '@/types/resource-structure';

const prisma = new PrismaClient();

/**
 * POST /api/resources/assignments/assign - Create resource assignment (after approval)
 * 
 * This endpoint is used for creating assignments after approval workflows.
 * It supports allocation-type-aware assignment models:
 * - EXCLUSIVE allocation: Each employee gets their own item (one-to-one)
 * - SHARED allocation: Multiple employees can share the same resource
 * 
 * Also supports type-specific assignment models:
 * - Hardware (PHYSICAL): Requires itemId, exclusive assignment
 * - Software: Supports INDIVIDUAL or POOLED assignment types
 * - Cloud: SHARED assignment, multiple users can access
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.4, 3.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions - only managers and above can assign resources
    if (!['CEO', 'CTO', 'ADMIN', 'ENGINEERING_MANAGER', 'HR_MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, resourceId, itemId, notes, approvalWorkflowId, assignmentType } = body;

    // Validate required fields
    if (!employeeId || !resourceId) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeId, resourceId' },
        { status: 400 }
      );
    }

    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, email: true, department: true }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Validate resource exists and get type information
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        resourceTypeEntity: true,
        items: {
          where: { status: 'AVAILABLE' },
          orderBy: { createdAt: 'asc' }
        },
        assignments: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    if (resource.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Resource is not active' }, { status: 400 });
    }

    // Get allocation type (default to EXCLUSIVE for backward compatibility)
    const allocationType: AllocationType = (resource.allocationType as AllocationType) || 'EXCLUSIVE';

    // For EXCLUSIVE resources, check if resource has any items
    if (allocationType === 'EXCLUSIVE') {
      const totalItems = await prisma.resourceItem.count({
        where: { resourceId }
      });

      if (totalItems === 0) {
        return NextResponse.json(
          { error: 'Cannot assign resource: No items have been added to this resource yet. Please add items first.' },
          { status: 400 }
        );
      }
    }

    // For SHARED resources, check capacity
    // Requirements: 3.4, 3.5
    if (allocationType === 'SHARED') {
      const capacityInfo = await getSharedResourceCapacity(resourceId);
      
      if (!capacityInfo.isUnlimited && capacityInfo.remainingCapacity <= 0) {
        return NextResponse.json(
          { 
            error: 'This resource has reached its maximum capacity',
            code: 'CAPACITY_REACHED',
            allocationType,
            currentAssignments: capacityInfo.currentAssignments,
            maxCapacity: capacityInfo.maxCapacity
          },
          { status: 400 }
        );
      }

      // Check if employee already has access to this shared resource
      const existingAssignment = resource.assignments.find(
        (a: any) => a.employeeId === employeeId && a.status === 'ACTIVE'
      );
      if (existingAssignment) {
        return NextResponse.json(
          { 
            error: 'Employee already has access to this shared resource',
            code: 'ALREADY_ASSIGNED',
            allocationType
          },
          { status: 400 }
        );
      }
    }

    // Determine the appropriate assignment type based on resource type
    const resourceTypeName = resource.resourceTypeEntity?.name || resource.type;
    const resolvedAssignmentType = determineAssignmentType(
      resourceTypeName, 
      assignmentType as AssignmentType | undefined
    );

    // For EXCLUSIVE allocation, validate or auto-select item
    // Requirements: 2.1, 2.2
    let selectedItemId = itemId;
    const normalizedType = resourceTypeName.toUpperCase();
    
    if (allocationType === 'EXCLUSIVE') {
      // EXCLUSIVE resources require item selection
      if (normalizedType === 'HARDWARE' || normalizedType === 'PHYSICAL') {
        if (itemId) {
          // Validate the specific item can be assigned
          const canAssign = await canAssignHardwareItem(itemId);
          if (!canAssign.canAssign) {
            return NextResponse.json({ 
              error: canAssign.reason,
              code: 'ITEM_ALREADY_ASSIGNED',
              allocationType
            }, { status: 400 });
          }
        } else {
          // Auto-select first available item for hardware
          if (resource.items.length === 0) {
            return NextResponse.json(
              { 
                error: 'No available items for this hardware resource',
                code: 'NO_AVAILABLE_ITEMS',
                allocationType
              },
              { status: 400 }
            );
          }
          selectedItemId = resource.items[0].id;
        }
      } else if (normalizedType === 'SOFTWARE' && resolvedAssignmentType === 'INDIVIDUAL') {
        // For individual software assignment, auto-select item if not provided
        if (!itemId && resource.items.length > 0) {
          selectedItemId = resource.items[0].id;
        }
      } else if (normalizedType === 'SOFTWARE' && resolvedAssignmentType === 'POOLED') {
        // For pooled software, check license availability
        const licenseInfo = await getAvailableLicenseCount(resourceId);
        if (licenseInfo.available <= 0 && !licenseInfo.unlimited) {
          return NextResponse.json(
            { 
              error: `No available licenses. ${licenseInfo.used}/${licenseInfo.total} licenses in use.`,
              code: 'CAPACITY_REACHED',
              allocationType
            },
            { status: 400 }
          );
        }
      }
    } else if (allocationType === 'SHARED') {
      // SHARED resources don't require item selection
      // Requirements: 3.1
      selectedItemId = undefined;
    }

    // Create assignment using the service
    const result = await createAssignment(
      {
        resourceId,
        employeeId,
        itemId: selectedItemId || undefined,
        assignmentType: resolvedAssignmentType,
        notes: notes || `Assigned by ${user.name}`,
      },
      user.id
    );

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error,
        code: result.errorCode,
        allocationType
      }, { status: 400 });
    }

    // Update approval workflow status if provided
    if (approvalWorkflowId) {
      await prisma.approvalWorkflow.update({
        where: { id: approvalWorkflowId },
        data: { 
          status: 'APPROVED',
          comments: `Assignment created for ${employee.name}`
        }
      });
    }

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        entityType: 'RESOURCE',
        entityId: resourceId,
        changedById: user.id,
        fieldChanged: 'assigned',
        newValue: JSON.stringify({
          assignmentId: result.assignment?.id,
          employeeId,
          employeeName: employee.name,
          itemId: selectedItemId,
          assignmentType: resolvedAssignmentType,
        }),
        resourceId,
        assignmentId: result.assignment?.id
      }
    });

    // Log activity timeline
    await prisma.activityTimeline.create({
      data: {
        entityType: 'RESOURCE',
        entityId: resourceId,
        activityType: 'ASSIGNED',
        title: `${resource.name} assigned to ${employee.name}`,
        description: getAssignmentDescription(resourceTypeName, resolvedAssignmentType, selectedItemId),
        performedBy: user.id,
        resourceId,
        assignmentId: result.assignment?.id,
        employeeId,
        metadata: {
          assignmentId: result.assignment?.id,
          employeeName: employee.name,
          employeeDepartment: employee.department,
          assignmentType: resolvedAssignmentType,
          itemId: selectedItemId,
          notes
        }
      }
    });

    return NextResponse.json({
      ...result.assignment,
      assignmentType: resolvedAssignmentType,
      allocationType,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating resource assignment:', error);
    return NextResponse.json(
      { error: 'Failed to create resource assignment' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Helper function to generate assignment description based on type
 */
function getAssignmentDescription(
  resourceType: string, 
  assignmentType: AssignmentType, 
  itemId?: string
): string {
  const normalizedType = resourceType.toUpperCase();
  
  switch (normalizedType) {
    case 'HARDWARE':
    case 'PHYSICAL':
      return `Hardware item ${itemId || 'auto-selected'} assigned (exclusive)`;
    case 'SOFTWARE':
      if (assignmentType === 'POOLED') {
        return 'Software license assigned from pool';
      }
      return `Software license ${itemId || 'auto-selected'} assigned (individual)`;
    case 'CLOUD':
      return 'Cloud resource access granted (shared)';
    default:
      return `Resource assigned (${assignmentType.toLowerCase()})`;
  }
}
