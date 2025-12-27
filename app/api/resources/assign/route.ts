import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logTimelineActivity } from '@/lib/timeline';
import { getUserFromToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resourceId, employeeId, quantityRequested = 1, notes } = body;

    console.log('=== RESOURCE ASSIGNMENT API CALLED ===');
    console.log('Request body:', JSON.stringify(body, null, 2));

    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      console.log('Authentication failed - no current user');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('Current user:', currentUser.name, '(', currentUser.role, ')');

    // Validate required fields
    if (!resourceId || !employeeId) {
      console.log('Validation failed - missing required fields');
      return NextResponse.json({ 
        error: 'resourceId and employeeId are required',
        details: {
          resourceId: resourceId || 'missing',
          employeeId: employeeId || 'missing'
        }
      }, { status: 400 });
    }

    // Validate quantity
    if (quantityRequested <= 0) {
      return NextResponse.json({ 
        error: 'Quantity must be greater than 0',
        details: { quantityRequested }
      }, { status: 400 });
    }

    // Get resource details with current assignments
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          include: { employee: true }
        },
        custodian: true
      }
    });

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, email: true, department: true, role: true }
    });

    console.log('Resource found:', resource ? `${resource.name} (${resource.type})` : 'NOT FOUND');
    console.log('Employee found:', employee ? `${employee.name} (${employee.email})` : 'NOT FOUND');

    if (!resource || !employee) {
      console.log('Resource or employee not found in database');
      return NextResponse.json({ 
        error: 'Resource or employee not found',
        details: {
          resourceFound: !!resource,
          employeeFound: !!employee,
          resourceId,
          employeeId
        }
      }, { status: 404 });
    }

    // Calculate current allocated quantity
    const allocatedQuantity = resource.assignments.reduce((total, assignment) => {
      return total + assignment.quantityAssigned;
    }, 0);

    const availableQuantity = resource.totalQuantity - allocatedQuantity;

    console.log('Quantity Analysis:');
    console.log(`  Total Quantity: ${resource.totalQuantity}`);
    console.log(`  Allocated Quantity: ${allocatedQuantity}`);
    console.log(`  Available Quantity: ${availableQuantity}`);
    console.log(`  Requested Quantity: ${quantityRequested}`);

    // Check if requested quantity is available
    if (quantityRequested > availableQuantity) {
      console.log('Insufficient quantity available');
      return NextResponse.json({ 
        error: `Insufficient quantity available. Requested: ${quantityRequested}, Available: ${availableQuantity}`,
        details: {
          totalQuantity: resource.totalQuantity,
          allocatedQuantity,
          availableQuantity,
          quantityRequested,
          currentAssignments: resource.assignments.map(a => ({
            employee: a.employee.name,
            quantity: a.quantityAssigned
          }))
        }
      }, { status: 400 });
    }

    // Check if employee already has an active assignment for this resource
    const existingAssignment = resource.assignments.find(a => a.employeeId === employeeId);
    
    if (existingAssignment) {
      console.log('Employee already has an active assignment for this resource');
      return NextResponse.json({
        success: true,
        message: `${employee.name} already has ${existingAssignment.quantityAssigned} unit(s) of ${resource.name} assigned`,
        assignment: {
          id: existingAssignment.id,
          quantityAssigned: existingAssignment.quantityAssigned,
          assignedAt: existingAssignment.assignedAt,
          status: existingAssignment.status
        },
        resource: {
          name: resource.name,
          totalQuantity: resource.totalQuantity,
          allocatedQuantity,
          availableQuantity
        }
      });
    }

    // Create new assignment
    console.log(`Creating new assignment: ${quantityRequested} unit(s) of ${resource.name} to ${employee.name}`);
    
    const newAssignment = await prisma.resourceAssignment.create({
      data: {
        resourceId,
        employeeId,
        quantityAssigned: quantityRequested,
        assignedBy: currentUser.id,
        status: 'ACTIVE',
        notes: notes || null
      },
      include: {
        resource: true,
        employee: true,
        assignedByUser: true
      }
    });

    console.log('Assignment created successfully:', newAssignment.id);

    // Log the assignment activity for the resource
    await logTimelineActivity({
      entityType: 'RESOURCE',
      entityId: resource.id,
      activityType: 'ASSIGNED',
      title: `${quantityRequested} unit(s) assigned to ${employee.name}`,
      description: `${quantityRequested} unit(s) of ${resource.name} assigned to ${employee.name} by ${currentUser.name}`,
      metadata: {
        resourceName: resource.name,
        resourceType: resource.type,
        employeeName: employee.name,
        employeeId: employeeId,
        employeeDepartment: employee.department,
        quantityAssigned: quantityRequested,
        assignmentMethod: 'manual_assignment',
        assignedBy: currentUser.name,
        assignedById: currentUser.id,
        totalQuantity: resource.totalQuantity,
        newAllocatedQuantity: allocatedQuantity + quantityRequested,
        newAvailableQuantity: availableQuantity - quantityRequested,
        assignmentId: newAssignment.id
      },
      performedBy: currentUser.id,
      resourceId: resource.id
    });

    // Log activity for the employee
    await logTimelineActivity({
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      activityType: 'ASSET_ASSIGNED',
      title: `Assigned ${quantityRequested} unit(s) of ${resource.name}`,
      description: `${quantityRequested} unit(s) of ${resource.name} assigned to ${employee.name} by ${currentUser.name}`,
      metadata: {
        resourceName: resource.name,
        resourceType: resource.type,
        resourceId: resource.id,
        quantityAssigned: quantityRequested,
        assignedBy: currentUser.name,
        assignedById: currentUser.id,
        assignmentMethod: 'manual_assignment',
        assignmentId: newAssignment.id
      },
      performedBy: currentUser.id,
      employeeId: employeeId
    });

    // Calculate new quantities after assignment
    const newAllocatedQuantity = allocatedQuantity + quantityRequested;
    const newAvailableQuantity = availableQuantity - quantityRequested;

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${quantityRequested} unit(s) of ${resource.name} to ${employee.name}`,
      assignment: {
        id: newAssignment.id,
        quantityAssigned: quantityRequested,
        assignedAt: newAssignment.assignedAt,
        assignedBy: currentUser.name,
        status: newAssignment.status,
        notes: newAssignment.notes
      },
      resource: {
        id: resource.id,
        name: resource.name,
        type: resource.type,
        owner: resource.owner,
        custodian: resource.custodian.name,
        totalQuantity: resource.totalQuantity,
        allocatedQuantity: newAllocatedQuantity,
        availableQuantity: newAvailableQuantity
      },
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        role: employee.role
      }
    });

  } catch (error: any) {
    console.error('Error assigning resource:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return NextResponse.json({ 
      error: 'Failed to assign resource',
      details: {
        message: error.message || 'Unknown error occurred',
        type: error.name || 'UnknownError'
      }
    }, { status: 500 });
  }
}

// GET endpoint to retrieve assignment information
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resourceId');
    const employeeId = searchParams.get('employeeId');

    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (resourceId) {
      // Get resource with all assignments
      const resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        include: {
          assignments: {
            where: { status: 'ACTIVE' },
            include: { 
              employee: { select: { id: true, name: true, email: true, department: true, role: true } },
              assignedByUser: { select: { id: true, name: true } }
            },
            orderBy: { assignedAt: 'desc' }
          },
          custodian: { select: { id: true, name: true } }
        }
      });

      if (!resource) {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
      }

      const allocatedQuantity = resource.assignments.reduce((total, assignment) => {
        return total + assignment.quantityAssigned;
      }, 0);

      return NextResponse.json({
        resource: {
          id: resource.id,
          name: resource.name,
          type: resource.type,
          owner: resource.owner,
          custodian: resource.custodian,
          totalQuantity: resource.totalQuantity,
          allocatedQuantity,
          availableQuantity: resource.totalQuantity - allocatedQuantity,
          status: resource.status
        },
        assignments: resource.assignments.map(assignment => ({
          id: assignment.id,
          employee: assignment.employee,
          quantityAssigned: assignment.quantityAssigned,
          assignedAt: assignment.assignedAt,
          assignedBy: assignment.assignedByUser,
          status: assignment.status,
          notes: assignment.notes
        }))
      });
    }

    if (employeeId) {
      // Get all assignments for an employee
      const assignments = await prisma.resourceAssignment.findMany({
        where: { 
          employeeId,
          status: 'ACTIVE'
        },
        include: {
          resource: { select: { id: true, name: true, type: true, category: true } },
          assignedByUser: { select: { id: true, name: true } }
        },
        orderBy: { assignedAt: 'desc' }
      });

      return NextResponse.json({
        employeeId,
        assignments: assignments.map(assignment => ({
          id: assignment.id,
          resource: assignment.resource,
          quantityAssigned: assignment.quantityAssigned,
          assignedAt: assignment.assignedAt,
          assignedBy: assignment.assignedByUser,
          status: assignment.status,
          notes: assignment.notes
        }))
      });
    }

    return NextResponse.json({ error: 'resourceId or employeeId parameter required' }, { status: 400 });

  } catch (error: any) {
    console.error('Error retrieving assignment information:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve assignment information',
      details: error.message 
    }, { status: 500 });
  }
}