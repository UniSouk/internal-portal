import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { logTimelineActivity } from '@/lib/timeline';
import { getUserFromToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resourceId, employeeId, quantityAssigned, notes } = body;

    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user has permission to assign resources (CEO/CTO only)
    if (currentUser.role !== 'CEO' && currentUser.role !== 'CTO') {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only CEO and CTO can assign resources.' 
      }, { status: 403 });
    }

    // Validate required fields
    if (!resourceId || !employeeId || !quantityAssigned || quantityAssigned <= 0) {
      return NextResponse.json({ 
        error: 'Missing required fields: resourceId, employeeId, and quantityAssigned are required' 
      }, { status: 400 });
    }

    // Get resource details
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        assignments: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Get employee details
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, email: true, department: true, role: true }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Calculate current allocated quantity
    const currentAllocated = resource.assignments.reduce((total, assignment) => {
      return total + assignment.quantityAssigned;
    }, 0);

    const availableQuantity = resource.totalQuantity - currentAllocated;

    // Check if enough quantity is available
    if (quantityAssigned > availableQuantity) {
      return NextResponse.json({ 
        error: `Insufficient quantity available. Requested: ${quantityAssigned}, Available: ${availableQuantity}`,
        details: {
          totalQuantity: resource.totalQuantity,
          allocatedQuantity: currentAllocated,
          availableQuantity: availableQuantity,
          requestedQuantity: quantityAssigned
        }
      }, { status: 400 });
    }

    // Check if employee already has an active assignment for this resource
    const existingAssignment = resource.assignments.find(
      assignment => assignment.employeeId === employeeId && assignment.status === 'ACTIVE'
    );

    if (existingAssignment) {
      return NextResponse.json({ 
        error: `Employee ${employee.name} already has an active assignment for this resource`,
        details: {
          existingQuantity: existingAssignment.quantityAssigned,
          assignedAt: existingAssignment.assignedAt
        }
      }, { status: 400 });
    }

    // Create the assignment
    const assignment = await prisma.resourceAssignment.create({
      data: {
        resourceId,
        employeeId,
        quantityAssigned: parseInt(quantityAssigned),
        assignedBy: currentUser.id,
        status: 'ACTIVE',
        notes: notes || null
      },
      include: {
        employee: {
          select: { id: true, name: true, email: true, department: true, role: true }
        },
        resource: {
          select: { id: true, name: true, type: true }
        },
        assignedByUser: {
          select: { id: true, name: true }
        }
      }
    });

    // Log audit trail
    await logAudit({
      entityType: 'RESOURCE',
      entityId: resourceId,
      changedById: currentUser.id,
      fieldChanged: 'assignment_created',
      oldValue: null,
      newValue: JSON.stringify({
        assignmentId: assignment.id,
        employeeId,
        employeeName: employee.name,
        quantityAssigned,
        assignedBy: currentUser.name
      })
    });

    // Log timeline activity
    await logTimelineActivity({
      entityType: 'RESOURCE',
      entityId: resourceId,
      activityType: 'ASSIGNED',
      title: `Resource assigned to ${employee.name}`,
      description: `${quantityAssigned} unit(s) of ${resource.name} assigned to ${employee.name} by ${currentUser.name}`,
      metadata: {
        resourceName: resource.name,
        resourceType: resource.type,
        employeeName: employee.name,
        employeeDepartment: employee.department,
        quantityAssigned,
        assignedBy: currentUser.name,
        assignedById: currentUser.id,
        notes: notes || null
      },
      performedBy: currentUser.id,
      resourceId: resourceId,
      employeeId: employeeId
    });

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${quantityAssigned} unit(s) of ${resource.name} to ${employee.name}`,
      assignment: {
        id: assignment.id,
        resource: assignment.resource,
        employee: assignment.employee,
        quantityAssigned: assignment.quantityAssigned,
        assignedAt: assignment.assignedAt,
        assignedBy: assignment.assignedByUser,
        status: assignment.status,
        notes: assignment.notes
      }
    });

  } catch (error: any) {
    console.error('Error creating resource assignment:', error);
    return NextResponse.json({ 
      error: 'Failed to create resource assignment',
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resourceId');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status') || 'ACTIVE';

    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let whereClause: any = { status };

    if (resourceId) {
      whereClause.resourceId = resourceId;
    }

    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    // For regular employees, only show their own assignments
    if (currentUser.role !== 'CEO' && currentUser.role !== 'CTO') {
      whereClause.employeeId = currentUser.id;
    }

    const assignments = await prisma.resourceAssignment.findMany({
      where: whereClause,
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
      },
      orderBy: { assignedAt: 'desc' }
    });

    return NextResponse.json({
      assignments,
      total: assignments.length
    });

  } catch (error: any) {
    console.error('Error fetching resource assignments:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch resource assignments',
      details: error.message 
    }, { status: 500 });
  }
}