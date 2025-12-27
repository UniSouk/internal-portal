import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { logTimelineActivity } from '@/lib/timeline';
import { getUserFromToken } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    const body = await request.json();
    const { action, quantityReturned, returnReason, notes } = body;

    console.log('=== ASSIGNMENT UPDATE DEBUG ===');
    console.log('Assignment ID:', assignmentId);
    console.log('Request body:', JSON.stringify(body, null, 2));

    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      console.log('ERROR: Not authenticated');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('Current user:', currentUser.name, '(', currentUser.role, ')');

    // Check if user has permission to manage assignments (CEO/CTO only)
    if (currentUser.role !== 'CEO' && currentUser.role !== 'CTO') {
      console.log('ERROR: Insufficient permissions');
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only CEO and CTO can manage resource assignments.' 
      }, { status: 403 });
    }

    // Get the assignment
    const assignment = await prisma.resourceAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: true, role: true }
        },
        resource: {
          select: { id: true, name: true, type: true, category: true }
        },
        assignedByUser: {
          select: { id: true, name: true }
        }
      }
    });

    if (!assignment) {
      console.log('ERROR: Assignment not found');
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    console.log('Assignment found:', assignment.resource.name, 'assigned to', assignment.employee.name);
    console.log('Assignment status:', assignment.status);
    console.log('Quantity assigned:', assignment.quantityAssigned);

    if (assignment.status !== 'ACTIVE') {
      console.log('ERROR: Assignment status is not ACTIVE:', assignment.status);
      return NextResponse.json({ 
        error: `Cannot modify assignment with status: ${assignment.status}` 
      }, { status: 400 });
    }

    if (action === 'return') {
      console.log('Processing return action...');
      console.log('Quantity to return:', quantityReturned);
      console.log('Return reason:', returnReason);

      // Validate return data
      if (!quantityReturned || quantityReturned <= 0) {
        console.log('ERROR: Invalid quantity to return:', quantityReturned);
        return NextResponse.json({ 
          error: 'Invalid quantity to return' 
        }, { status: 400 });
      }

      if (quantityReturned > assignment.quantityAssigned) {
        console.log('ERROR: Cannot return more than assigned');
        console.log('- Assigned:', assignment.quantityAssigned);
        console.log('- Requested:', quantityReturned);
        return NextResponse.json({ 
          error: `Cannot return more than assigned. Assigned: ${assignment.quantityAssigned}, Requested: ${quantityReturned}` 
        }, { status: 400 });
      }

      if (!returnReason) {
        console.log('ERROR: Return reason is required');
        return NextResponse.json({ 
          error: 'Return reason is required' 
        }, { status: 400 });
      }

      console.log('All validations passed, processing return...');

      let updatedAssignment;

      if (quantityReturned === assignment.quantityAssigned) {
        // Full return - mark assignment as RETURNED
        updatedAssignment = await prisma.resourceAssignment.update({
          where: { id: assignmentId },
          data: {
            status: 'RETURNED',
            returnedAt: new Date(),
            returnReason,
            notes: notes || assignment.notes
          },
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true, role: true }
            },
            resource: {
              select: { id: true, name: true, type: true, category: true }
            },
            assignedByUser: {
              select: { id: true, name: true }
            }
          }
        });

        // Log timeline activity
        await logTimelineActivity({
          entityType: 'RESOURCE',
          entityId: assignment.resourceId,
          activityType: 'UPDATED',
          title: `Resource fully returned by ${assignment.employee.name}`,
          description: `${assignment.employee.name} returned all ${assignment.quantityAssigned} unit(s) of ${assignment.resource.name}. Reason: ${returnReason}`,
          metadata: {
            resourceName: assignment.resource.name,
            resourceType: assignment.resource.type,
            employeeName: assignment.employee.name,
            employeeDepartment: assignment.employee.department,
            quantityReturned: assignment.quantityAssigned,
            returnReason,
            returnType: 'full_return',
            processedBy: currentUser.name,
            processedById: currentUser.id,
            notes: notes || null
          },
          performedBy: currentUser.id,
          resourceId: assignment.resourceId,
          employeeId: assignment.employeeId
        });

      } else {
        // Partial return - reduce quantity and create a new returned assignment record
        const remainingQuantity = assignment.quantityAssigned - quantityReturned;

        // Update current assignment with reduced quantity
        updatedAssignment = await prisma.resourceAssignment.update({
          where: { id: assignmentId },
          data: {
            quantityAssigned: remainingQuantity,
            notes: notes || assignment.notes
          },
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true, role: true }
            },
            resource: {
              select: { id: true, name: true, type: true, category: true }
            },
            assignedByUser: {
              select: { id: true, name: true }
            }
          }
        });

        // Create a separate record for the returned portion
        await prisma.resourceAssignment.create({
          data: {
            resourceId: assignment.resourceId,
            employeeId: assignment.employeeId,
            quantityAssigned: quantityReturned,
            assignedBy: assignment.assignedBy,
            status: 'RETURNED',
            assignedAt: assignment.assignedAt,
            returnedAt: new Date(),
            returnReason,
            notes: `Partial return from assignment ${assignmentId}. ${notes || ''}`
          }
        });

        // Log partial return
        await logTimelineActivity({
          entityType: 'RESOURCE',
          entityId: assignment.resourceId,
          activityType: 'UPDATED',
          title: `Partial resource return by ${assignment.employee.name}`,
          description: `${assignment.employee.name} returned ${quantityReturned} unit(s) of ${assignment.resource.name}. ${remainingQuantity} unit(s) still assigned. Reason: ${returnReason}`,
          metadata: {
            resourceName: assignment.resource.name,
            resourceType: assignment.resource.type,
            employeeName: assignment.employee.name,
            employeeDepartment: assignment.employee.department,
            quantityReturned,
            quantityRemaining: remainingQuantity,
            returnReason,
            returnType: 'partial_return',
            processedBy: currentUser.name,
            processedById: currentUser.id,
            notes: notes || null
          },
          performedBy: currentUser.id,
          resourceId: assignment.resourceId,
          employeeId: assignment.employeeId
        });
      }

      // Log audit trail
      await logAudit({
        entityType: 'RESOURCE',
        entityId: assignment.resourceId,
        changedById: currentUser.id,
        fieldChanged: 'assignment_returned',
        oldValue: JSON.stringify({
          assignmentId: assignment.id,
          originalQuantity: assignment.quantityAssigned,
          status: assignment.status
        }),
        newValue: JSON.stringify({
          assignmentId: assignment.id,
          quantityReturned,
          returnReason,
          newStatus: updatedAssignment.status,
          processedBy: currentUser.name
        })
      });

      return NextResponse.json({
        success: true,
        message: `Successfully processed return of ${quantityReturned} unit(s) from ${assignment.employee.name}`,
        assignment: updatedAssignment,
        returnDetails: {
          quantityReturned,
          returnReason,
          returnType: quantityReturned === assignment.quantityAssigned ? 'full_return' : 'partial_return',
          processedBy: currentUser.name,
          processedAt: new Date()
        }
      });

    } else {
      console.log('ERROR: Unsupported action:', action);
      return NextResponse.json({ 
        error: `Unsupported action: ${action}` 
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('=== ASSIGNMENT UPDATE ERROR ===');
    console.error('Error updating resource assignment:', error);
    console.error('Stack trace:', error.stack);
    return NextResponse.json({ 
      error: 'Failed to update resource assignment',
      details: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;

    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user has permission to delete assignments (CEO/CTO only)
    if (currentUser.role !== 'CEO' && currentUser.role !== 'CTO') {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only CEO and CTO can delete resource assignments.' 
      }, { status: 403 });
    }

    // Get the assignment before deletion
    const assignment = await prisma.resourceAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: true, role: true }
        },
        resource: {
          select: { id: true, name: true, type: true, category: true }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Delete the assignment
    await prisma.resourceAssignment.delete({
      where: { id: assignmentId }
    });

    // Log audit trail
    await logAudit({
      entityType: 'RESOURCE',
      entityId: assignment.resourceId,
      changedById: currentUser.id,
      fieldChanged: 'assignment_deleted',
      oldValue: JSON.stringify({
        assignmentId: assignment.id,
        employeeName: assignment.employee.name,
        quantityAssigned: assignment.quantityAssigned,
        status: assignment.status
      }),
      newValue: null
    });

    // Log timeline activity
    await logTimelineActivity({
      entityType: 'RESOURCE',
      entityId: assignment.resourceId,
      activityType: 'DELETED',
      title: `Resource assignment deleted`,
      description: `Assignment of ${assignment.quantityAssigned} unit(s) of ${assignment.resource.name} to ${assignment.employee.name} was deleted by ${currentUser.name}`,
      metadata: {
        assignmentId: assignment.id,
        resourceName: assignment.resource.name,
        resourceType: assignment.resource.type,
        employeeName: assignment.employee.name,
        employeeDepartment: assignment.employee.department,
        quantityAssigned: assignment.quantityAssigned,
        originalStatus: assignment.status,
        deletedBy: currentUser.name,
        deletedById: currentUser.id
      },
      performedBy: currentUser.id,
      resourceId: assignment.resourceId,
      employeeId: assignment.employeeId
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted assignment of ${assignment.resource.name} to ${assignment.employee.name}`,
      deletedAssignment: {
        id: assignment.id,
        resourceName: assignment.resource.name,
        employeeName: assignment.employee.name,
        quantityAssigned: assignment.quantityAssigned
      }
    });

  } catch (error: any) {
    console.error('Error deleting resource assignment:', error);
    return NextResponse.json({ 
      error: 'Failed to delete resource assignment',
      details: error.message 
    }, { status: 500 });
  }
}