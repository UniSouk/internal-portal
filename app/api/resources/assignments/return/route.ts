import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, ItemStatus } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';

const prisma = new PrismaClient();

// POST /api/resources/assignments/return - Return resource assignment
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
    const { assignmentId, returnNotes, itemCondition } = body;

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'Missing required field: assignmentId' },
        { status: 400 }
      );
    }

    // Get assignment details
    const assignment = await prisma.resourceAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: true }
        },
        resource: {
          select: { id: true, name: true, type: true, category: true }
        },
        item: {
          select: { id: true, serialNumber: true, hostname: true, status: true }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    if (assignment.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Assignment is not active' }, { status: 400 });
    }

    // Check permissions - user must be manager/admin or the assigned employee
    const canReturn = ['CEO', 'CTO', 'ADMIN', 'ENGINEERING_MANAGER', 'HR_MANAGER'].includes(user.role) ||
      user.id === assignment.employeeId;

    if (!canReturn) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Determine item status based on condition
    let newItemStatus: ItemStatus = 'AVAILABLE';
    if (itemCondition) {
      switch (itemCondition) {
        case 'GOOD':
          newItemStatus = 'AVAILABLE';
          break;
        case 'DAMAGED':
          newItemStatus = 'DAMAGED';
          break;
        case 'LOST':
          newItemStatus = 'LOST';
          break;
        case 'MAINTENANCE':
          newItemStatus = 'MAINTENANCE';
          break;
        default:
          newItemStatus = 'AVAILABLE';
      }
    }

    // Process return with transaction
    const returnedAssignment = await prisma.$transaction(async (tx) => {
      // Update assignment status
      const updatedAssignment = await tx.resourceAssignment.update({
        where: { id: assignmentId },
        data: {
          status: newItemStatus === 'LOST' ? 'LOST' : 
                 newItemStatus === 'DAMAGED' ? 'DAMAGED' : 'RETURNED',
          returnedAt: new Date(),
          notes: returnNotes ? `${assignment.notes || ''}\n\nReturn Notes: ${returnNotes}` : assignment.notes
        },
        include: {
          employee: {
            select: { id: true, name: true, email: true, department: true }
          },
          resource: {
            select: { id: true, name: true, type: true, category: true }
          },
          item: {
            select: { id: true, serialNumber: true, hostname: true }
          }
        }
      });

      // Update item status if physical resource
      if (assignment.item) {
        await tx.resourceItem.update({
          where: { id: assignment.item.id },
          data: { status: newItemStatus }
        });
      }

      // Log audit trail
      await tx.auditLog.create({
        data: {
          entityType: 'RESOURCE',
          entityId: assignment.resourceId,
          changedById: user.id,
          fieldChanged: 'returned',
          oldValue: 'ACTIVE',
          newValue: updatedAssignment.status,
          resourceId: assignment.resourceId,
          assignmentId
        }
      });

      // Log activity timeline
      await tx.activityTimeline.create({
        data: {
          entityType: 'RESOURCE',
          entityId: assignment.resourceId,
          activityType: 'UPDATED',
          title: `${assignment.resource.name} returned by ${assignment.employee.name}`,
          description: assignment.item 
            ? `Hardware item ${assignment.item.serialNumber || assignment.item.hostname || assignment.item.id} returned in ${itemCondition || 'good'} condition`
            : `Software/Cloud seat returned`,
          performedBy: user.id,
          resourceId: assignment.resourceId,
          assignmentId,
          employeeId: assignment.employeeId,
          metadata: {
            assignmentId,
            employeeName: assignment.employee.name,
            returnCondition: itemCondition,
            returnNotes,
            itemDetails: assignment.item ? {
              serialNumber: assignment.item.serialNumber,
              hostname: assignment.item.hostname,
              newStatus: newItemStatus
            } : null
          }
        }
      });

      return updatedAssignment;
    });

    return NextResponse.json(returnedAssignment);

  } catch (error) {
    console.error('Error returning resource assignment:', error);
    return NextResponse.json(
      { error: 'Failed to return resource assignment' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}