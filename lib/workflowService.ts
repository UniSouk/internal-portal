// lib/workflowService.ts
import { prisma } from './prisma';
import { getOperationalApprover } from './roleAuth';
import { logCreatedActivity, logTimelineActivity } from './timeline';
import { logAudit } from './audit';

export interface OperationalWorkflowRequest {
  type: string;
  requesterId: string;
  data: any;
  title: string;
  description: string;
  amount?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  relatedEntityId?: string;
}

export async function createOperationalWorkflow(request: OperationalWorkflowRequest) {
  try {

    // Get appropriate approver based on operational rules
    const approverId = await getOperationalApprover(request.type, request.amount || 0, request.requesterId);
    
    if (!approverId) {
      throw new Error('No suitable approver found for this operational workflow');
    }

    // Get requester details
    const requester = await prisma.employee.findUnique({
      where: { id: request.requesterId },
      select: { name: true, role: true, department: true }
    });

    if (!requester) {
      throw new Error('Requester not found');
    }

    // Create the workflow
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        type: request.type as any,
        requesterId: request.requesterId,
        approverId: approverId,
        status: 'PENDING',
        data: {
          ...request.data,
          title: request.title,
          description: request.description,
          amount: request.amount || 0,
          priority: request.priority || getOperationalPriority(request.type, request.amount),
          autoCreated: true,
          operationalCategory: getOperationalCategory(request.type),
          createdAt: new Date().toISOString()
        },
        comments: `Operational workflow created for ${request.type.replace('_', ' ').toLowerCase()}`,
        ...(request.relatedEntityId && getEntityRelation(request.type, request.relatedEntityId))
      },
      include: {
        requester: { select: { name: true, role: true, department: true } },
        approver: { select: { name: true, role: true, department: true } }
      }
    });

    // Log audit trail
    await logAudit({
      entityType: 'APPROVAL_WORKFLOW',
      entityId: workflow.id,
      changedById: request.requesterId,
      fieldChanged: 'created',
      oldValue: null,
      newValue: JSON.stringify({
        type: workflow.type,
        status: workflow.status,
        operationalWorkflow: true,
        amount: request.amount
      })
    });

    // Log timeline activity
    await logCreatedActivity(
      'APPROVAL_WORKFLOW',
      workflow.id,
      `${workflow.type.replace('_', ' ')} workflow`,
      request.requesterId,
      {
        type: workflow.type,
        status: workflow.status,
        requesterName: workflow.requester.name,
        requesterDepartment: workflow.requester.department,
        approverName: workflow.approver?.name,
        operationalWorkflow: true,
        amount: request.amount,
        priority: request.priority,
        title: request.title
      }
    );

    // Log workflow start with operational context
    await logTimelineActivity({
      entityType: 'APPROVAL_WORKFLOW',
      entityId: workflow.id,
      activityType: 'WORKFLOW_STARTED',
      title: `${request.title} - Operational Approval Required`,
      description: `${getOperationalDescription(workflow.type)} workflow created by ${workflow.requester.name} (${workflow.requester.department}) and assigned to ${workflow.approver?.name}`,
      metadata: {
        workflowType: workflow.type,
        operationalCategory: getOperationalCategory(workflow.type),
        requesterName: workflow.requester.name,
        requesterRole: workflow.requester.role,
        requesterDepartment: workflow.requester.department,
        approverName: workflow.approver?.name,
        amount: request.amount,
        priority: request.priority,
        businessJustification: request.data.justification,
        operationalWorkflow: true
      },
      performedBy: request.requesterId,
      workflowId: workflow.id
    });

    return workflow;

  } catch (error) {
    console.error('Error creating operational workflow:', error);
    throw error;
  }
}

// Helper function to get operational category
function getOperationalCategory(workflowType: string): string {
  if (workflowType.includes('IT_') || workflowType.includes('SOFTWARE_') || workflowType.includes('CLOUD_')) {
    return 'IT_OPERATIONS';
  }
  if (workflowType.includes('ACCESS_') || workflowType.includes('SECURITY_')) {
    return 'SECURITY_ACCESS';
  }
  if (workflowType.includes('POLICY_') || workflowType.includes('COMPLIANCE_')) {
    return 'COMPLIANCE';
  }
  if (workflowType.includes('EXPENSE_') || workflowType.includes('BUDGET_') || workflowType.includes('VENDOR_')) {
    return 'FINANCIAL';
  }
  if (workflowType.includes('HIRING_') || workflowType.includes('ROLE_') || workflowType.includes('TRAINING_')) {
    return 'HUMAN_RESOURCES';
  }
  return 'GENERAL_OPERATIONS';
}

// Helper function to get operational description
function getOperationalDescription(workflowType: string): string {
  const descriptions: Record<string, string> = {
    'IT_EQUIPMENT_REQUEST': 'IT equipment procurement',
    'SOFTWARE_LICENSE_REQUEST': 'Software license acquisition',
    'CLOUD_SERVICE_REQUEST': 'Cloud service subscription',
    'ACCESS_REQUEST': 'System access permission',
    'ELEVATED_ACCESS_REQUEST': 'Elevated system privileges',
    'POLICY_UPDATE_REQUEST': 'Company policy update',
    'EXPENSE_APPROVAL_REQUEST': 'Expense reimbursement',
    'BUDGET_REQUEST': 'Budget allocation',
    'HIRING_REQUEST': 'New employee hiring',
    'ROLE_CHANGE_REQUEST': 'Employee role modification',
    'VENDOR_CONTRACT_REQUEST': 'Vendor contract approval',
    'TRAINING_REQUEST': 'Employee training approval'
  };
  return descriptions[workflowType] || 'Operational request';
}

// Helper function to get operational priority
function getOperationalPriority(workflowType: string, amount: number = 0): string {
  // High priority for security and high-value items
  if (workflowType.includes('SECURITY_') || workflowType.includes('ELEVATED_ACCESS') || amount > 5000) {
    return 'HIGH';
  }
  
  // Medium priority for IT and policy changes
  if (workflowType.includes('IT_') || workflowType.includes('POLICY_') || amount > 1000) {
    return 'MEDIUM';
  }
  
  // Urgent for compliance and hiring
  if (workflowType.includes('COMPLIANCE_') || workflowType.includes('HIRING_')) {
    return 'URGENT';
  }
  
  return 'LOW';
}

// Helper function to get entity relation based on workflow type
function getEntityRelation(workflowType: string, entityId: string) {
  switch (workflowType) {
    case 'POLICY_UPDATE_REQUEST':
      return { policyId: entityId };
    case 'IT_EQUIPMENT_REQUEST':
      return { resourceId: entityId };
    default:
      return {};
  }
}

// Specific operational workflow creation functions
export async function createITEquipmentRequest(equipmentData: any, requesterId: string) {
  return createOperationalWorkflow({
    type: 'IT_EQUIPMENT_REQUEST',
    requesterId,
    data: {
      equipmentData,
      businessJustification: equipmentData.justification,
      requestType: 'it_equipment'
    },
    title: `IT Equipment Request: ${equipmentData.name}`,
    description: `Request for ${equipmentData.type}: ${equipmentData.name} - ${equipmentData.justification}`,
    amount: equipmentData.cost || 0,
    priority: equipmentData.cost > 2000 ? 'HIGH' : 'MEDIUM'
  });
}

export async function createSoftwareLicenseRequest(softwareData: any, requesterId: string) {
  return createOperationalWorkflow({
    type: 'SOFTWARE_LICENSE_REQUEST',
    requesterId,
    data: {
      softwareData,
      businessJustification: softwareData.justification,
      requestType: 'software_license'
    },
    title: `Software License Request: ${softwareData.name}`,
    description: `Request for software license: ${softwareData.name} - ${softwareData.justification}`,
    amount: softwareData.cost || 0
  });
}

export async function createExpenseApprovalRequest(expenseData: any, requesterId: string) {
  return createOperationalWorkflow({
    type: 'EXPENSE_APPROVAL_REQUEST',
    requesterId,
    data: {
      expenseData,
      businessJustification: expenseData.justification,
      requestType: 'expense_approval'
    },
    title: `Expense Approval: ${expenseData.category}`,
    description: `Expense approval request for ${expenseData.category} - $${expenseData.amount}`,
    amount: expenseData.amount,
    priority: expenseData.amount > 1000 ? 'HIGH' : 'MEDIUM'
  });
}

export async function createHiringRequest(hiringData: any, requesterId: string) {
  return createOperationalWorkflow({
    type: 'HIRING_REQUEST',
    requesterId,
    data: {
      hiringData,
      businessJustification: hiringData.justification,
      requestType: 'hiring'
    },
    title: `Hiring Request: ${hiringData.position}`,
    description: `New hire request for ${hiringData.position} in ${hiringData.department}`,
    priority: 'URGENT'
  });
}

export async function createPolicyPublishWorkflow(policyId: string, requesterId: string) {
  return createOperationalWorkflow({
    type: 'POLICY_UPDATE_REQUEST',
    requesterId,
    data: {
      policyId,
      businessJustification: 'Policy ready for review and publication',
      requestType: 'policy_publish'
    },
    title: `Policy Publication Request`,
    description: `Request to review and publish policy`,
    priority: 'MEDIUM',
    relatedEntityId: policyId
  });
}

// Get pending operational workflows for approver with operational context
export async function getPendingOperationalWorkflows(approverId: string) {
  try {
    const workflows = await prisma.approvalWorkflow.findMany({
      where: {
        approverId: approverId,
        status: 'PENDING'
      },
      include: {
        requester: { select: { name: true, role: true, department: true } },
        policy: { select: { title: true, category: true } },
        resource: { select: { name: true, type: true } }
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    });

    return workflows.map((workflow: any) => ({
      ...workflow,
      priority: workflow.data?.priority || getOperationalPriority(workflow.type, workflow.data?.amount),
      operationalCategory: getOperationalCategory(workflow.type),
      displayTitle: workflow.data?.title || `${workflow.type.replace('_', ' ')} Request`,
      displayDescription: workflow.data?.description || workflow.comments,
      amount: workflow.data?.amount || 0,
      businessJustification: workflow.data?.businessJustification || 'No justification provided'
    }));
  } catch (error) {
    console.error('Error fetching pending operational workflows:', error);
    return [];
  }
}

// Get operational workflow statistics
export async function getOperationalWorkflowStats(userId: string) {
  try {
    const [pending, approved, rejected, myRequests, byCategory] = await Promise.all([
      prisma.approvalWorkflow.count({
        where: { approverId: userId, status: 'PENDING' }
      }),
      prisma.approvalWorkflow.count({
        where: { approverId: userId, status: 'APPROVED' }
      }),
      prisma.approvalWorkflow.count({
        where: { approverId: userId, status: 'REJECTED' }
      }),
      prisma.approvalWorkflow.count({
        where: { requesterId: userId }
      }),
      prisma.approvalWorkflow.groupBy({
        by: ['type'],
        where: { approverId: userId },
        _count: { type: true }
      })
    ]);

    const categoryStats = byCategory.reduce((acc: Record<string, number>, item: any) => {
      const category = getOperationalCategory(item.type);
      acc[category] = (acc[category] || 0) + item._count.type;
      return acc;
    }, {} as Record<string, number>);

    return {
      pendingApprovals: pending,
      approvedRequests: approved,
      rejectedRequests: rejected,
      myRequests: myRequests,
      totalProcessed: approved + rejected,
      categoryBreakdown: categoryStats
    };
  } catch (error) {
    console.error('Error fetching operational workflow stats:', error);
    return {
      pendingApprovals: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
      myRequests: 0,
      totalProcessed: 0,
      categoryBreakdown: {}
    };
  }
}