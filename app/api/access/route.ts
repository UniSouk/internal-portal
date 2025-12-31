import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { logCreatedActivity, logStatusChangedActivity, logTimelineActivity } from '@/lib/timeline';
import { getUserFromToken } from '@/lib/auth';
import { createOperationalWorkflow } from '@/lib/workflowService';
import { trackEntityUpdate } from '@/lib/changeTracker';

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Role-based filtering
    let whereClause = {};
    
    // CEO and CTO can see all access requests
    if (currentUser.role === 'CEO' || currentUser.role === 'CTO') {
      // No filtering - show all requests
      whereClause = {};
    } else {
      // Regular employees can only see their own requests
      whereClause = {
        employeeId: currentUser.id
      };
    }

    const accessRequests = await prisma.access.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        resource: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      },
      orderBy: {
        requestedAt: 'desc'
      }
    });

    return NextResponse.json(accessRequests);
  } catch (error) {
    console.error('Error fetching access requests:', error);
    return NextResponse.json({ error: 'Failed to fetch access requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      employeeId, 
      resourceId, 
      hardwareRequest, // New field for hardware requests
      approverId,
      justification
    } = body;

    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Validate that at least one request type is provided
    if (!resourceId && !hardwareRequest) {
      return NextResponse.json({ 
        error: 'Either resourceId or hardwareRequest must be provided' 
      }, { status: 400 });
    }

    // Get employee details
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { name: true, department: true, managerId: true }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    let resource = null;
    let resourceName = '';
    let resourceType = '';

    // Handle software/cloud resource request
    if (resourceId) {
      resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        select: { name: true, type: true }
      });

      if (!resource) {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
      }

      resourceName = resource.name;
      resourceType = resource.type;
    }

    // Handle hardware request
    if (hardwareRequest) {
      resourceName = hardwareRequest;
      resourceType = 'PHYSICAL';
    }

    // If both are provided, combine them
    if (resourceId && hardwareRequest && resource) {
      resourceName = `${resource.name} + ${hardwareRequest}`;
      resourceType = 'MIXED';
    }

    // Determine approver - use provided approverId, employee's manager, or fallback hierarchy
    let finalApproverId = approverId || employee.managerId;

    // If no approver found, use fallback hierarchy: CTO -> CEO -> ADMIN
    if (!finalApproverId) {      
      // Try CTO first
      const cto = await prisma.employee.findFirst({
        where: { role: 'CTO', status: 'ACTIVE' },
        select: { id: true, name: true }
      });
      
      if (cto) {
        finalApproverId = cto.id;
      } else {
        // Try CEO if no CTO
        const ceo = await prisma.employee.findFirst({
          where: { role: 'CEO', status: 'ACTIVE' },
          select: { id: true, name: true }
        });
        
        if (ceo) {
          finalApproverId = ceo.id;
        } else {
          // Try ADMIN as last resort
          const admin = await prisma.employee.findFirst({
            where: { role: 'ADMIN', status: 'ACTIVE' },
            select: { id: true, name: true }
          });
          
          if (admin) {
            finalApproverId = admin.id;
          } else {
            return NextResponse.json({ 
              error: 'No approver available: Employee has no manager and no active CTO, CEO, or ADMIN found' 
            }, { status: 400 });
          }
        }
      }
    }

    // Create the access request
    const accessRequest = await prisma.access.create({
      data: {
        employeeId,
        resourceId: resourceId || null, // Can be null for hardware-only requests
        hardwareRequest: hardwareRequest || null, // Store hardware request name
        approverId: finalApproverId,
        justification: justification || null,
        status: 'REQUESTED'
      }
    });

    // Fetch the created access request with relations
    const accessRequestWithRelations = await prisma.access.findUnique({
      where: { id: accessRequest.id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        resource: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    // Create operational approval workflow automatically
    const approvalWorkflow = await createOperationalWorkflow({
      type: 'ACCESS_REQUEST',
      requesterId: employeeId,
      data: {
        accessRequestId: accessRequest.id,
        resourceName: resourceName,
        resourceType: resourceType,
        justification: justification || '',
        hardwareRequest: hardwareRequest || null, // Include hardware request in workflow data
        isHardwareRequest: !!hardwareRequest,
        isMixedRequest: !!(resourceId && hardwareRequest),
        requestType: 'access_request'
      },
      title: `Access Request: ${resourceName}`,
      description: `${employee.name} is requesting ${hardwareRequest ? 'hardware: ' + hardwareRequest : 'access to ' + resourceName + (resource ? ' (' + resource.type + ')' : '')}. ${justification ? 'Justification: ' + justification : ''}`,
      relatedEntityId: accessRequest.id
    });

    // Log audit trail for access request
    await logAudit({
      entityType: 'ACCESS',
      entityId: accessRequest.id,
      changedById: currentUser.id,
      fieldChanged: 'created',
      oldValue: null,
      newValue: JSON.stringify(accessRequestWithRelations)
    });

    // Log audit trail for approval workflow
    await logAudit({
      entityType: 'APPROVAL_WORKFLOW',
      entityId: approvalWorkflow.id,
      changedById: currentUser.id,
      fieldChanged: 'created',
      oldValue: null,
      newValue: JSON.stringify({
        type: approvalWorkflow.type,
        status: approvalWorkflow.status,
        operationalWorkflow: true
      })
    });

    // Log timeline activity for access request
    await logCreatedActivity(
      'ACCESS',
      accessRequest.id,
      `Access request for ${resourceName}`,
      currentUser.id,
      {
        resourceName: resourceName,
        resourceType: resourceType,
        employeeName: accessRequestWithRelations?.employee.name || employee.name,
        status: accessRequest.status,
        justification,
        approverName: accessRequestWithRelations?.approver?.name,
        workflowId: approvalWorkflow.id,
        hardwareRequest: hardwareRequest || null,
        isHardwareRequest: !!hardwareRequest
      }
    );

    // Log timeline activity for approval workflow
    try {
      await logTimelineActivity({
        entityType: 'APPROVAL_WORKFLOW',
        entityId: approvalWorkflow.id,
        activityType: 'WORKFLOW_STARTED',
        title: `Approval workflow started for ${resourceName} access`,
        description: `Approval workflow automatically created for ${employee.name}'s request to access ${resourceName}`,
        metadata: {
          workflowType: 'ACCESS_REQUEST',
          resourceName: resourceName,
          resourceType: resourceType,
          requesterName: employee.name,
          accessRequestId: accessRequest.id,
          hardwareRequest: hardwareRequest || null,
          isHardwareRequest: !!hardwareRequest
        },
        performedBy: currentUser.id,
        workflowId: approvalWorkflow.id
      });
    } catch (timelineError) {
      console.error('Failed to log timeline activity for approval workflow:', timelineError);
    }

    return NextResponse.json({
      accessRequest: accessRequestWithRelations,
      approvalWorkflow
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating access request:', error);
    return NextResponse.json({ error: 'Failed to create access request' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id, 
      status, 
      approverId,
      workflowId 
    } = body;

    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;

    // Use CEO user if no authenticated user (for automated processes)
    const ceoUser = await prisma.employee.findFirst({
      where: { role: 'CEO' },
      select: { id: true }
    });
    
    if (!ceoUser) {
      return NextResponse.json({ error: 'CEO user not found' }, { status: 404 });
    }
    
    const finalApproverId = currentUser?.id || approverId || ceoUser.id;

    // Validate that the approverId exists in the database
    if (finalApproverId) {
      const approverExists = await prisma.employee.findUnique({
        where: { id: finalApproverId },
        select: { id: true }
      });

      if (!approverExists) {
        console.error(`Approver with ID ${finalApproverId} not found`);
        return NextResponse.json({ 
          error: 'Invalid approver ID',
          details: `Approver with ID ${finalApproverId} does not exist`
        }, { status: 400 });
      }
    }

    // Get the current access request
    const currentAccess = await prisma.access.findUnique({
      where: { id },
      include: {
        employee: { select: { name: true } },
        resource: { select: { name: true } }
      }
    });

    if (!currentAccess) {
      return NextResponse.json({ error: 'Access request not found' }, { status: 404 });
    }

    // Store original data for change tracking
    const originalData = { ...currentAccess };

    const updatedAccess = await prisma.access.update({
      where: { id },
      data: {
        status,
        approverId: finalApproverId,
        approvedAt: status === 'APPROVED' ? new Date() : null,
        grantedAt: status === 'GRANTED' ? new Date() : null,
        revokedAt: status === 'REVOKED' ? new Date() : null
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        resource: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    // Track all changes comprehensively
    await trackEntityUpdate(
      'ACCESS',
      id,
      `Access request for ${updatedAccess.resource?.name || 'hardware request'}`,
      originalData,
      updatedAccess,
      request
    );

    // Update the related approval workflow if provided
    if (workflowId) {
      try {
        const workflowStatus = status === 'APPROVED' ? 'APPROVED' : 
                             status === 'REJECTED' ? 'REJECTED' : 'PENDING';
        
        await prisma.approvalWorkflow.update({
          where: { id: workflowId },
          data: {
            status: workflowStatus as any,
            comments: `Access request ${status.toLowerCase()} - workflow completed`
          }
        });
      } catch (workflowError) {
        console.error('Failed to update approval workflow:', workflowError);
      }
    }

    return NextResponse.json(updatedAccess);
  } catch (error: any) {
    console.error('Error updating access request:', error);
    return NextResponse.json({ 
      error: 'Failed to update access request',
      details: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const deletedByParam = searchParams.get('deletedBy');

    if (!id) {
      return NextResponse.json({ error: 'Access request ID is required' }, { status: 400 });
    }

    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    // Use authenticated user if available, otherwise fall back to CEO
    const ceoUser = await prisma.employee.findFirst({
      where: { role: 'CEO' },
      select: { id: true }
    });
    
    if (!currentUser && !ceoUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const deletedBy = currentUser?.id || ceoUser?.id;
    
    if (!deletedBy) {
      return NextResponse.json({ error: 'Unable to determine user for deletion' }, { status: 500 });
    }

    // Get access request details before deletion for logging
    const accessRequest = await prisma.access.findUnique({
      where: { id },
      include: {
        employee: { select: { name: true, department: true } },
        resource: { select: { name: true, type: true } },
        approver: { select: { name: true, department: true } }
      }
    });

    if (!accessRequest) {
      return NextResponse.json({ error: 'Access request not found' }, { status: 404 });
    }

    // Log deletion attempt first
    try {
      await logTimelineActivity({
        entityType: 'ACCESS',
        entityId: id,
        activityType: 'DELETION_ATTEMPTED',
        title: `Deletion attempted for access request`,
        description: `Attempting to delete access request for ${accessRequest.resource?.name || 'hardware request'} by ${accessRequest.employee.name}`,
        metadata: {
          resourceName: accessRequest.resource?.name || 'Hardware Request',
          resourceType: accessRequest.resource?.type || 'PHYSICAL',
          employeeName: accessRequest.employee.name,
          status: accessRequest.status,
          deletionReason: 'Manual deletion via web interface'
        },
        performedBy: deletedBy
      });
    } catch (timelineError) {
      console.error('Failed to log deletion attempt:', timelineError);
    }

    // Find and delete related approval workflows
    const relatedWorkflows = await prisma.approvalWorkflow.findMany({
      where: {
        type: 'ACCESS_REQUEST',
        data: {
          path: ['accessRequestId'],
          equals: id
        }
      }
    });

    // Delete related workflows first
    for (const workflow of relatedWorkflows) {
      try {
        await prisma.approvalWorkflow.delete({
          where: { id: workflow.id }
        });

        // Log workflow deletion
        await logTimelineActivity({
          entityType: 'APPROVAL_WORKFLOW',
          entityId: workflow.id,
          activityType: 'DELETED',
          title: `Deleted related approval workflow`,
          description: `Approval workflow deleted due to access request removal`,
          metadata: {
            parentAccessRequestId: id,
            workflowType: workflow.type,
            cascadeDelete: true,
            originalWorkflowId: workflow.id
          },
          performedBy: deletedBy
          // Don't set workflowId since the workflow is being deleted
        });
      } catch (workflowError) {
        console.error(`Failed to delete related workflow ${workflow.id}:`, workflowError);
      }
    }

    // Delete the access request
    await prisma.access.delete({
      where: { id }
    });

    // Log audit trail for successful deletion
    try {
      await logAudit({
        entityType: 'ACCESS',
        entityId: id,
        changedById: deletedBy,
        fieldChanged: 'deleted',
        oldValue: JSON.stringify({
          resourceName: accessRequest.resource?.name || 'Hardware Request',
          employeeName: accessRequest.employee.name,
          status: accessRequest.status,
          requestedAt: accessRequest.requestedAt
        }),
        newValue: null
      });
    } catch (auditError) {
      console.error('Failed to log audit for access request deletion:', auditError);
    }

    // Log timeline activity for successful deletion
    try {
      await logTimelineActivity({
        entityType: 'ACCESS',
        entityId: id,
        activityType: 'DELETED',
        title: `Deleted access request`,
        description: `Access request for ${accessRequest.resource?.name || 'hardware request'} by ${accessRequest.employee.name} was successfully removed from the system`,
        metadata: {
          resourceName: accessRequest.resource?.name || 'Hardware Request',
          resourceType: accessRequest.resource?.type || 'PHYSICAL',
          employeeName: accessRequest.employee.name,
          originalStatus: accessRequest.status,
          deletedAt: new Date().toISOString(),
          deletionMethod: 'Manual deletion',
          relatedWorkflowsDeleted: relatedWorkflows.length
        },
        performedBy: deletedBy
      });
    } catch (timelineError) {
      console.error('Failed to log timeline activity for access request deletion:', timelineError);
    }

    return NextResponse.json({ 
      message: 'Access request deleted successfully',
      deletedAccessRequest: {
        id: accessRequest.id,
        resourceName: accessRequest.resource?.name || 'Hardware Request',
        employeeName: accessRequest.employee.name
      },
      relatedWorkflowsDeleted: relatedWorkflows.length
    });
  } catch (error: any) {
    console.error('Error deleting access request:', error);
    
    // Log failed deletion attempt
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      
      // Get the authenticated user for error logging
      const token = request.cookies.get('auth-token')?.value;
      const currentUser = token ? await getUserFromToken(token) : null;
      
      const ceoUser = await prisma.employee.findFirst({
        where: { role: 'CEO' },
        select: { id: true }
      });
      
      const errorLoggedBy = currentUser?.id || ceoUser?.id;
      
      if (errorLoggedBy && id) {
        await logTimelineActivity({
          entityType: 'ACCESS',
          entityId: id,
          activityType: 'DELETION_FAILED',
          title: `Failed to delete access request`,
          description: `Deletion attempt failed: ${error.message}`,
          metadata: {
            errorMessage: error.message,
            errorCode: error.code,
            attemptedAt: new Date().toISOString()
          },
          performedBy: errorLoggedBy
        });
      }
    } catch (logError) {
      console.error('Failed to log deletion failure:', logError);
    }

    return NextResponse.json({ 
      error: 'Failed to delete access request',
      details: error.message 
    }, { status: 500 });
  }
}