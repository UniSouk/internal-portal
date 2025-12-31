import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';
import { logTimelineActivity } from '@/lib/timeline';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resourceId, employeeId, itemId, notes } = body;

    // Get current user from cookie
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getUserFromToken(token);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!resourceId || !employeeId) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: { resourceId, employeeId }
      }, { status: 400 });
    }

    // Get resource details
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    if (!resource) {
      return NextResponse.json({ 
        error: 'Resource not found',
        details: { resourceId }
      }, { status: 404 });
    }

    // Get employee details
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, email: true, department: true }
    });

    if (!employee) {
      return NextResponse.json({ 
        error: 'Employee not found',
        details: { employeeId }
      }, { status: 404 });
    }

    // Check if resource is active
    if (resource.status !== 'ACTIVE') {
      return NextResponse.json({ 
        error: 'Resource is not available for assignment',
        details: `Resource status: ${resource.status}`
      }, { status: 400 });
    }

    // Check if employee already has this resource assigned
    const existingAssignment = resource.assignments.find(a => a.employeeId === employeeId);
    if (existingAssignment) {
      return NextResponse.json({
        success: true,
        message: `${employee.name} already has ${resource.name} assigned`,
        assignment: {
          id: existingAssignment.id,
          assignedAt: existingAssignment.assignedAt,
          status: existingAssignment.status
        }
      });
    }

    // Create new assignment
    
    const newAssignment = await prisma.resourceAssignment.create({
      data: {
        resourceId,
        employeeId,
        ...(itemId && { itemId }),
        assignedBy: currentUser.id,
        status: 'ACTIVE',
        notes: notes || `Assigned by ${currentUser.name}`
      }
    });

    // If assigning a physical item, update its status
    if (itemId) {
      await prisma.resourceItem.update({
        where: { id: itemId },
        data: { status: 'ASSIGNED' }
      });
    }

    // Log resource assignment activity
    await logTimelineActivity({
      entityType: 'RESOURCE',
      entityId: resource.id,
      activityType: 'ASSIGNED',
      title: `${resource.name} assigned to ${employee.name}`,
      description: `${resource.name} assigned to ${employee.name} by ${currentUser.name}`,
      performedBy: currentUser.id,
      metadata: {
        resourceName: resource.name,
        resourceType: resource.type,
        resourceId: resource.id,
        employeeName: employee.name,
        employeeId: employeeId,
        employeeDepartment: employee.department,
        assignmentMethod: 'manual_assignment',
        assignedBy: currentUser.name,
        assignedById: currentUser.id,
        itemId: itemId || null,
        assignmentId: newAssignment.id
      },
      resourceId: resource.id
    });

    // Log employee assignment activity
    await logTimelineActivity({
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      activityType: 'ASSET_ASSIGNED',
      title: `Assigned ${resource.name}`,
      description: `${resource.name} assigned to ${employee.name} by ${currentUser.name}`,
      performedBy: currentUser.id,
      metadata: {
        resourceName: resource.name,
        resourceType: resource.type,
        resourceId: resource.id,
        assignedBy: currentUser.name,
        assignedById: currentUser.id,
        itemId: itemId || null
      },
      employeeId: employeeId
    });

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${resource.name} to ${employee.name}`,
      assignment: newAssignment,
      resource: {
        id: resource.id,
        name: resource.name,
        type: resource.type
      },
      employee: {
        id: employee.id,
        name: employee.name,
        department: employee.department
      }
    });

  } catch (error) {
    console.error('Error in resource assignment:', error);
    return NextResponse.json({ 
      error: 'Failed to assign resource',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}