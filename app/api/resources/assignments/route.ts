import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';
import { 
  createAssignment, 
  validateAssignmentRequest,
  determineAssignmentType 
} from '@/lib/resourceAssignmentService';
import { AssignmentType, AllocationType } from '@/types/resource-structure';
import {
  normalizeAssignment,
  determineAssignmentTypeFromLegacy
} from '@/lib/backwardCompatibility';

const prisma = new PrismaClient();

/**
 * POST /api/resources/assignments - Create a new resource assignment
 * 
 * Supports allocation-type-aware assignment models:
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

    const body = await request.json();
    const { resourceId, employeeId, itemId, notes, assignmentType } = body;

    // Validate required fields
    if (!resourceId || !employeeId) {
      return NextResponse.json({ 
        error: 'Missing required fields: resourceId, employeeId' 
      }, { status: 400 });
    }

    // Get resource to determine type-specific assignment model and allocation type
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        resourceTypeEntity: true,
      },
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Get allocation type (default to EXCLUSIVE for backward compatibility)
    const allocationType: AllocationType = (resource.allocationType as AllocationType) || 'EXCLUSIVE';

    // Determine the appropriate assignment type based on resource type
    const resourceTypeName = resource.resourceTypeEntity?.name || resource.type;
    const resolvedAssignmentType = determineAssignmentType(
      resourceTypeName, 
      assignmentType as AssignmentType | undefined
    );

    // Create assignment using the service (validation is done inside)
    const result = await createAssignment(
      {
        resourceId,
        employeeId,
        itemId: itemId || undefined,
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

    return NextResponse.json({
      success: true,
      message: 'Resource assigned successfully',
      assignment: result.assignment,
      assignmentType: resolvedAssignmentType,
      allocationType,
    });

  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json({ 
      error: 'Failed to create assignment' 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * GET /api/resources/assignments - Get resource assignments with filtering
 * 
 * Query parameters:
 * - resourceId: Filter by resource
 * - employeeId: Filter by employee
 * - status: Filter by status (ACTIVE, RETURNED, LOST, DAMAGED)
 * - assignmentType: Filter by type (INDIVIDUAL, POOLED, SHARED)
 * 
 * Requirements: 10.4, 10.7
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resourceId');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const assignmentType = searchParams.get('assignmentType');

    const where: any = {};
    if (resourceId) where.resourceId = resourceId;
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (assignmentType) where.assignmentType = assignmentType;

    const assignments = await prisma.resourceAssignment.findMany({
      where,
      include: {
        resource: {
          select: { 
            id: true, 
            name: true, 
            type: true, 
            category: true,
            allocationType: true,
            resourceTypeEntity: {
              select: { id: true, name: true }
            }
          }
        },
        employee: {
          select: { id: true, name: true, email: true, department: true }
        },
        item: {
          select: { id: true, serialNumber: true, hostname: true, status: true, licenseKey: true }
        }
      },
      orderBy: { assignedAt: 'desc' }
    });

    return NextResponse.json({ 
      assignments,
      total: assignments.length,
    });

  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch assignments' 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}