import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';
import { logTimelineActivity } from '@/lib/timeline';

const prisma = new PrismaClient();

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, returnReason, notes } = body;

    // Get current user from cookie
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getUserFromToken(token);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get assignment details
    const assignment = await prisma.resourceAssignment.findUnique({
      where: { id },
      include: {
        resource: {
          select: { id: true, name: true, type: true, category: true }
        },
        employee: {
          select: { id: true, name: true, email: true, role: true, department: true }
        },
        assignedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json({ 
        error: 'Assignment not found' 
      }, { status: 404 });
    }

    if (assignment.status !== 'ACTIVE') {
      return NextResponse.json({ 
        error: 'Assignment is not active' 
      }, { status: 400 });
    }

    if (action === 'return') {
      if (!returnReason) {
        return NextResponse.json({ 
          error: 'Return reason is required' 
        }, { status: 400 });
      }


      // Update assignment status to RETURNED
      const updatedAssignment = await prisma.resourceAssignment.update({
        where: { id },
        data: {
          status: 'RETURNED',
          returnedAt: new Date(),
          notes: notes ? `${assignment.notes || ''}\n\nReturn Notes: ${notes}` : assignment.notes
        }
      });

      // If this was a physical item assignment, update the item status back to AVAILABLE
      if (assignment.itemId) {
        await prisma.resourceItem.update({
          where: { id: assignment.itemId },
          data: { status: 'AVAILABLE' }
        });
      }

      // Log return activity
      await logTimelineActivity({
        entityType: 'RESOURCE',
        entityId: assignment.resource.id,
        activityType: 'UPDATED',
        title: `${assignment.resource.name} returned by ${assignment.employee.name}`,
        description: `${assignment.resource.name} returned by ${assignment.employee.name}. Reason: ${returnReason}`,
        performedBy: currentUser.id,
        metadata: {
          resourceName: assignment.resource.name,
          resourceType: assignment.resource.type,
          employeeName: assignment.employee.name,
          employeeId: assignment.employee.id,
          returnReason,
          returnedBy: currentUser.name,
          returnedById: currentUser.id,
          assignmentId: id
        },
        resourceId: assignment.resource.id
      });

      // Log employee activity
      await logTimelineActivity({
        entityType: 'EMPLOYEE',
        entityId: assignment.employee.id,
        activityType: 'UPDATED',
        title: `Returned ${assignment.resource.name}`,
        description: `${assignment.employee.name} returned ${assignment.resource.name}. Reason: ${returnReason}`,
        performedBy: currentUser.id,
        metadata: {
          resourceName: assignment.resource.name,
          resourceType: assignment.resource.type,
          resourceId: assignment.resource.id,
          returnReason,
          returnedBy: currentUser.name,
          returnedById: currentUser.id
        },
        employeeId: assignment.employee.id
      });

      return NextResponse.json({
        success: true,
        message: `Successfully processed return from ${assignment.employee.name}`,
        assignment: updatedAssignment,
        returnType: 'full_return',
        returnReason
      });

    } else {
      return NextResponse.json({ 
        error: 'Invalid action. Only "return" is supported.' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in assignment update:', error);
    return NextResponse.json({ 
      error: 'Failed to update assignment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get current user from cookie
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getUserFromToken(token);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to delete assignments
    if (!['CEO', 'CTO', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to delete assignments' 
      }, { status: 403 });
    }

    // Get assignment details before deletion
    const assignment = await prisma.resourceAssignment.findUnique({
      where: { id },
      include: {
        resource: {
          select: { id: true, name: true, type: true, category: true }
        },
        employee: {
          select: { id: true, name: true, email: true, role: true, department: true }
        },
        assignedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json({ 
        error: 'Assignment not found' 
      }, { status: 404 });
    }

    // Delete the assignment
    await prisma.resourceAssignment.delete({
      where: { id }
    });

    // If this was a physical item assignment, update the item status back to AVAILABLE
    if (assignment.itemId) {
      await prisma.resourceItem.update({
        where: { id: assignment.itemId },
        data: { status: 'AVAILABLE' }
      });
    }

    // Log deletion activity
    await logTimelineActivity({
      entityType: 'RESOURCE',
      entityId: assignment.resource.id,
      activityType: 'UPDATED',
      title: `Assignment deleted`,
      description: `Assignment of ${assignment.resource.name} to ${assignment.employee.name} was deleted by ${currentUser.name}`,
      performedBy: currentUser.id,
      metadata: {
        resourceName: assignment.resource.name,
        resourceType: assignment.resource.type,
        employeeName: assignment.employee.name,
        employeeId: assignment.employee.id,
        deletedBy: currentUser.name,
        deletedById: currentUser.id,
        originalAssignmentId: id
      },
      resourceId: assignment.resource.id
    });

    // Log employee activity
    await logTimelineActivity({
      entityType: 'EMPLOYEE',
      entityId: assignment.employee.id,
      activityType: 'UPDATED',
      title: `Assignment removed`,
      description: `Assignment of ${assignment.resource.name} was removed by ${currentUser.name}`,
      performedBy: currentUser.id,
      metadata: {
        resourceName: assignment.resource.name,
        resourceType: assignment.resource.type,
        resourceId: assignment.resource.id,
        deletedBy: currentUser.name,
        deletedById: currentUser.id
      },
      employeeId: assignment.employee.id
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted assignment of ${assignment.resource.name} from ${assignment.employee.name}`,
      deletedAssignment: {
        id: assignment.id,
        resourceName: assignment.resource.name,
        employeeName: assignment.employee.name
      }
    });

  } catch (error) {
    console.error('Error in assignment deletion:', error);
    return NextResponse.json({ 
      error: 'Failed to delete assignment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}