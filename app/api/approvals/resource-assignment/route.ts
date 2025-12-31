import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';

const prisma = new PrismaClient();

// POST /api/approvals/resource-assignment - Create approval workflow for resource assignment
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
    const { employeeId, resourceId, itemId, justification, urgency } = body;

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
      include: {
        manager: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Validate resource exists
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        custodian: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Determine approver (manager or custodian)
    let approverId = employee.managerId;
    if (!approverId) {
      // If no manager, use resource custodian
      approverId = resource.custodianId;
    }

    // For high-value or sensitive resources, escalate to CEO/CTO
    const requiresExecutiveApproval = urgency === 'HIGH' || 
      ['SECURITY', 'EXECUTIVE'].includes(resource.category?.toUpperCase() || '');

    if (requiresExecutiveApproval) {
      // Find CEO or CTO for approval
      const executive = await prisma.employee.findFirst({
        where: {
          role: { in: ['CEO', 'CTO'] },
          status: 'ACTIVE'
        },
        orderBy: { role: 'asc' } // CEO first, then CTO
      });

      if (executive) {
        approverId = executive.id;
      }
    }

    // Create approval workflow
    const workflow = await prisma.$transaction(async (tx) => {
      const newWorkflow = await tx.approvalWorkflow.create({
        data: {
          type: 'IT_EQUIPMENT_REQUEST',
          requesterId: user.id,
          approverId,
          status: 'PENDING',
          resourceId,
          data: {
            employeeId,
            resourceId,
            itemId,
            justification,
            urgency,
            resourceName: resource.name,
            resourceType: resource.type,
            employeeName: employee.name,
            employeeDepartment: employee.department,
            requestedBy: user.id,
            requestedAt: new Date().toISOString()
          }
        },
        include: {
          requester: {
            select: { id: true, name: true, email: true }
          },
          approver: {
            select: { id: true, name: true, email: true }
          },
          resource: {
            select: { id: true, name: true, type: true, category: true }
          }
        }
      });

      // Log audit trail
      await tx.auditLog.create({
        data: {
          entityType: 'APPROVAL_WORKFLOW',
          entityId: newWorkflow.id,
          changedById: user.id,
          fieldChanged: 'created',
          newValue: JSON.stringify({
            type: 'IT_EQUIPMENT_REQUEST',
            resourceId,
            employeeId,
            approverId
          })
        }
      });

      // Log activity timeline
      await tx.activityTimeline.create({
        data: {
          entityType: 'APPROVAL_WORKFLOW',
          entityId: newWorkflow.id,
          activityType: 'WORKFLOW_STARTED',
          title: `Resource assignment approval requested`,
          description: `Approval requested for assigning ${resource.name} to ${employee.name}`,
          performedBy: user.id,
          workflowId: newWorkflow.id,
          resourceId,
          employeeId,
          metadata: {
            workflowType: 'IT_EQUIPMENT_REQUEST',
            resourceName: resource.name,
            employeeName: employee.name,
            justification,
            urgency
          }
        }
      });

      return newWorkflow;
    });

    return NextResponse.json(workflow, { status: 201 });

  } catch (error) {
    console.error('Error creating resource assignment approval:', error);
    return NextResponse.json(
      { error: 'Failed to create approval workflow' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/approvals/resource-assignment/[id] - Approve/Reject resource assignment
export async function PUT(request: NextRequest) {
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
    const { workflowId, action, comments } = body;

    if (!workflowId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: workflowId, action (approve/reject)' },
        { status: 400 }
      );
    }

    // Get workflow details
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: {
        requester: {
          select: { id: true, name: true, email: true }
        },
        resource: {
          select: { id: true, name: true, type: true }
        }
      }
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (workflow.status !== 'PENDING') {
      return NextResponse.json({ error: 'Workflow is not pending' }, { status: 400 });
    }

    // Check if user is the approver
    if (workflow.approverId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to approve this workflow' }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update workflow status
      const updatedWorkflow = await tx.approvalWorkflow.update({
        where: { id: workflowId },
        data: {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          comments
        }
      });

      // If approved, create the resource assignment
      let assignment = null;
      if (action === 'approve') {
        const workflowData = workflow.data as any;
        
        // Create assignment using the assign endpoint logic
        assignment = await tx.resourceAssignment.create({
          data: {
            employeeId: workflowData.employeeId,
            resourceId: workflowData.resourceId,
            ...(workflowData.itemId && { itemId: workflowData.itemId }),
            assignedBy: user.id,
            status: 'ACTIVE',
            notes: `Approved via workflow ${workflowId}. ${comments || ''}`
          }
        });

        // Update item status if physical resource and itemId provided
        if (workflowData.itemId) {
          await tx.resourceItem.update({
            where: { id: workflowData.itemId },
            data: { status: 'ASSIGNED' }
          });
        }
      }

      // Log audit trail
      await tx.auditLog.create({
        data: {
          entityType: 'APPROVAL_WORKFLOW',
          entityId: workflowId,
          changedById: user.id,
          fieldChanged: 'status',
          oldValue: 'PENDING',
          newValue: action === 'approve' ? 'APPROVED' : 'REJECTED'
        }
      });

      // Log activity timeline
      await tx.activityTimeline.create({
        data: {
          entityType: 'APPROVAL_WORKFLOW',
          entityId: workflowId,
          activityType: action === 'approve' ? 'APPROVED' : 'REJECTED',
          title: `Resource assignment ${action}d`,
          description: `${workflow.resource?.name} assignment ${action}d for ${workflow.data ? (workflow.data as any).employeeName : 'employee'}`,
          performedBy: user.id,
          workflowId,
          resourceId: workflow.resourceId,
          metadata: {
            action,
            comments,
            assignmentId: assignment?.id
          }
        }
      });

      return { workflow: updatedWorkflow, assignment };
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error processing resource assignment approval:', error);
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}