import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { logStatusChangedActivity, logTimelineActivity } from '@/lib/timeline';
import { getSystemUserId } from '@/lib/systemUser';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, approverId, comments } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Use system user if no approverId provided or if it's invalid
    const systemUserId = await getSystemUserId();
    let finalApproverId = approverId || systemUserId;

    // Validate that the approverId exists in the database
    if (finalApproverId) {
      const approverExists = await prisma.employee.findUnique({
        where: { id: finalApproverId },
        select: { id: true, name: true }
      });

      if (!approverExists) {
        console.error(`Approver with ID ${finalApproverId} not found, falling back to system user or CEO`);
        
        // Try to find a CEO or CTO as fallback approver
        const fallbackApprover = await prisma.employee.findFirst({
          where: {
            role: { in: ['CEO', 'CTO', 'ADMIN'] },
            status: 'ACTIVE'
          },
          select: { id: true, name: true }
        });

        if (fallbackApprover) {
          finalApproverId = fallbackApprover.id;
          console.log(`Using fallback approver: ${fallbackApprover.name} (${fallbackApprover.id})`);
        } else {
          // If no fallback found, use system user
          finalApproverId = systemUserId;
          console.log(`Using system user as approver: ${systemUserId}`);
        }
      }
    }

    // Get the current workflow
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { id },
      include: {
        requester: { select: { name: true } }
      }
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (workflow.status !== 'PENDING') {
      return NextResponse.json({ error: 'Workflow is not pending' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    // Update the workflow
    const updatedWorkflow = await prisma.approvalWorkflow.update({
      where: { id },
      data: {
        status: newStatus as any,
        approverId: finalApproverId,
        comments: comments || `${action === 'approve' ? 'Approved' : 'Rejected'} via web interface`
      },
      include: {
        requester: {
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
        }
      }
    });

    // If this is an access request workflow, update the related access request
    if (workflow.type === 'ACCESS_REQUEST' && workflow.data && typeof workflow.data === 'object') {
      try {
        const workflowData = workflow.data as any;
        if (workflowData.accessRequestId) {
          const accessStatus = action === 'approve' ? 'APPROVED' : 'REVOKED';
          
          // Get the access request details
          const accessRequest = await prisma.access.findUnique({
            where: { id: workflowData.accessRequestId },
            include: {
              resource: true,
              employee: { select: { id: true, name: true } }
            }
          });

          if (!accessRequest) {
            throw new Error('Access request not found');
          }

          // Update the access request status
          await prisma.access.update({
            where: { id: workflowData.accessRequestId },
            data: {
              status: accessStatus as any,
              approverId: finalApproverId,
              approvedAt: action === 'approve' ? new Date() : null,
              revokedAt: action === 'reject' ? new Date() : null
            }
          });

          // If approved, handle resource assignment or creation
          if (action === 'approve') {
            // Handle existing resource assignment
            if (accessRequest.resource && accessRequest.employee) {
              try {
                const resource = accessRequest.resource;
                const employeeId = accessRequest.employee.id;

                // Create a new resource assignment using the new system
                await prisma.resourceAssignment.create({
                  data: {
                    resourceId: resource.id,
                    employeeId: employeeId,
                    quantityAssigned: 1,
                    assignedBy: finalApproverId,
                    status: 'ACTIVE',
                    notes: `Assigned via access request approval - ${accessRequest.permissionLevel} access`
                  }
                });

                // Log resource assignment activity
                await logTimelineActivity({
                  entityType: 'RESOURCE',
                  entityId: resource.id,
                  activityType: 'ASSIGNED',
                  title: `Resource assigned to ${accessRequest.employee.name}`,
                  description: `${resource.name} (${resource.type}) was assigned to ${accessRequest.employee.name} via approved access request`,
                  metadata: {
                    resourceName: resource.name,
                    resourceType: resource.type,
                    employeeName: accessRequest.employee.name,
                    employeeId: employeeId,
                    assignmentMethod: 'access_request_approval',
                    accessRequestId: workflowData.accessRequestId,
                    workflowId: id,
                    permissionLevel: accessRequest.permissionLevel
                  },
                  performedBy: finalApproverId,
                  resourceId: resource.id
                });

                console.log(`Resource ${resource.name} assigned to ${accessRequest.employee.name} via access request approval`);
              } catch (resourceAssignmentError) {
                console.error('Failed to assign resource to employee:', resourceAssignmentError);
                // Don't fail the entire approval process if resource assignment fails
              }
            }
            
            // Handle hardware request - create new physical resource
            else if (accessRequest.hardwareRequest && accessRequest.employee) {
              try {
                const employeeId = accessRequest.employee.id;
                
                // Get system user as owner of the new resource
                const systemUserId = await getSystemUserId();
                
                // Get CEO for custodian assignment
                const ceo = await prisma.employee.findFirst({ where: { role: 'CEO' } });
                
                // Create new physical resource for the hardware request
                const newResource = await prisma.resource.create({
                  data: {
                    name: accessRequest.hardwareRequest,
                    type: 'PHYSICAL',
                    category: 'Hardware',
                    description: `Hardware requested via access request by ${accessRequest.employee.name}`,
                    owner: 'Unisouk', // Company owns all resources
                    custodianId: ceo?.id || systemUserId, // CEO is custodian, fallback to system user
                    totalQuantity: 1,
                    status: 'ACTIVE'
                  }
                });

                // Create assignment for the requesting employee
                await prisma.resourceAssignment.create({
                  data: {
                    resourceId: newResource.id,
                    employeeId: employeeId,
                    quantityAssigned: 1,
                    assignedBy: systemUserId,
                    status: 'ACTIVE',
                    notes: 'Assigned via access request approval'
                  }
                });

                // Update the access request to link to the newly created resource
                await prisma.access.update({
                  where: { id: workflowData.accessRequestId },
                  data: {
                    resourceId: newResource.id
                  }
                });

                // Log resource creation and assignment activity
                await logTimelineActivity({
                  entityType: 'RESOURCE',
                  entityId: newResource.id,
                  activityType: 'CREATED',
                  title: `Hardware resource created and assigned`,
                  description: `${newResource.name} was created and assigned to ${accessRequest.employee.name} via approved hardware request`,
                  metadata: {
                    resourceName: newResource.name,
                    resourceType: newResource.type,
                    employeeName: accessRequest.employee.name,
                    employeeId: employeeId,
                    creationMethod: 'hardware_request_approval',
                    accessRequestId: workflowData.accessRequestId,
                    workflowId: id,
                    originalHardwareRequest: accessRequest.hardwareRequest
                  },
                  performedBy: finalApproverId,
                  resourceId: newResource.id
                });

                console.log(`Hardware resource ${newResource.name} created and assigned to ${accessRequest.employee.name} via hardware request approval`);
              } catch (hardwareCreationError) {
                console.error('Failed to create hardware resource:', hardwareCreationError);
                // Don't fail the entire approval process if hardware creation fails
              }
            }
          }

          // If rejected and resource was previously assigned, we could optionally remove assignment
          // (This depends on business logic - for now, we'll leave existing assignments intact)

          // Log timeline activity for access request
          try {
            await logTimelineActivity({
              entityType: 'ACCESS',
              entityId: workflowData.accessRequestId,
              activityType: action === 'approve' ? 'APPROVED' : 'REJECTED',
              title: `Access request ${action === 'approve' ? 'approved' : 'rejected'}`,
              description: `Access request for ${workflowData.resourceName || 'resource'} was ${action === 'approve' ? 'approved' : 'rejected'} by approver${action === 'approve' ? ' and resource assigned' : ''}`,
              metadata: {
                resourceName: workflowData.resourceName,
                approverComments: comments,
                workflowId: id,
                resourceAssigned: action === 'approve'
              },
              performedBy: finalApproverId
            });
          } catch (timelineError) {
            console.error('Failed to log timeline activity for access request:', timelineError);
          }
        }
      } catch (accessUpdateError: any) {
        console.error('Failed to update access request:', accessUpdateError);
        return NextResponse.json({ 
          error: 'Failed to update access request',
          details: accessUpdateError.message 
        }, { status: 500 });
      }
    }

    // If this is a policy workflow, update the related policy status
    if (workflow.type === 'POLICY_UPDATE_REQUEST' && workflow.policyId) {
      try {
        const policyStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
        
        const updatedPolicy = await prisma.policy.update({
          where: { id: workflow.policyId },
          data: {
            status: policyStatus as any,
            lastReviewDate: new Date() // Update last review date
          },
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                department: true
              }
            }
          }
        });

        // Log timeline activity for policy
        try {
          await logTimelineActivity({
            entityType: 'POLICY',
            entityId: workflow.policyId,
            activityType: action === 'approve' ? 'APPROVED' : 'REJECTED',
            title: `Policy ${action === 'approve' ? 'approved' : 'rejected'}`,
            description: `Policy "${updatedPolicy.title}" was ${action === 'approve' ? 'approved' : 'rejected'} by ${updatedWorkflow.approver?.name || 'approver'}`,
            metadata: {
              policyTitle: updatedPolicy.title,
              previousStatus: 'REVIEW',
              newStatus: policyStatus,
              approverComments: comments,
              workflowId: id,
              approverName: updatedWorkflow.approver?.name
            },
            performedBy: finalApproverId,
            policyId: workflow.policyId
          });
        } catch (timelineError) {
          console.error('Failed to log timeline activity for policy:', timelineError);
        }

        console.log(`Policy ${updatedPolicy.title} status updated to ${policyStatus} after workflow ${action}`);
      } catch (policyUpdateError: any) {
        console.error('Failed to update policy status:', policyUpdateError);
        return NextResponse.json({ 
          error: 'Failed to update policy status',
          details: policyUpdateError.message 
        }, { status: 500 });
      }
    }

    // Log audit trail
    try {
      await logAudit({
        entityType: 'APPROVAL_WORKFLOW',
        entityId: id,
        changedById: finalApproverId,
        fieldChanged: 'status',
        oldValue: workflow.status,
        newValue: newStatus
      });
    } catch (auditError) {
      console.error('Failed to log audit for workflow update:', auditError);
    }

    // Log timeline activity for workflow
    try {
      await logStatusChangedActivity(
        'APPROVAL_WORKFLOW',
        id,
        `${workflow.type} workflow`,
        finalApproverId,
        workflow.status,
        newStatus,
        {
          workflowType: workflow.type,
          requesterName: workflow.requester.name,
          comments: comments,
          action: action
        }
      );
    } catch (timelineError) {
      console.error('Failed to log status change activity:', timelineError);
    }

    // Log workflow completion
    try {
      await logTimelineActivity({
        entityType: 'APPROVAL_WORKFLOW',
        entityId: id,
        activityType: 'WORKFLOW_COMPLETED',
        title: `Workflow ${action === 'approve' ? 'approved' : 'rejected'}`,
        description: `${workflow.type} workflow requested by ${workflow.requester.name} was ${action === 'approve' ? 'approved' : 'rejected'}`,
        metadata: {
          workflowType: workflow.type,
          finalStatus: newStatus,
          requesterName: workflow.requester.name,
          approverComments: comments
        },
        performedBy: finalApproverId,
        workflowId: id
      });
    } catch (timelineError) {
      console.error('Failed to log workflow completion activity:', timelineError);
    }

    return NextResponse.json(updatedWorkflow);
  } catch (error: any) {
    console.error('Error updating workflow:', error);
    return NextResponse.json({ 
      error: 'Failed to update workflow',
      details: error.message 
    }, { status: 500 });
  }
}