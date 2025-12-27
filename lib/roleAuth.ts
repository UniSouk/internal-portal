// lib/roleAuth.ts
import { prisma } from './prisma';

export interface UserContext {
  id: string;
  role: string;
  name: string;
  email: string;
  department: string;
}

// Define operational approval hierarchy
export const EXECUTIVE_ROLES = ['CEO', 'CTO', 'CFO', 'COO'];
export const DEPARTMENT_HEAD_ROLES = ['ENGINEERING_MANAGER', 'PRODUCT_MANAGER', 'SALES_MANAGER', 'HR_MANAGER', 'MARKETING_MANAGER'];
export const OPERATIONAL_MANAGER_ROLES = ['SYSTEM_ADMINISTRATOR', 'SECURITY_ENGINEER'];
export const ALL_MANAGER_ROLES = [...EXECUTIVE_ROLES, ...DEPARTMENT_HEAD_ROLES, ...OPERATIONAL_MANAGER_ROLES];

// Operational approval functions
export function canApproveExecutiveLevel(role: string): boolean {
  return EXECUTIVE_ROLES.includes(role);
}

export function canApproveDepartmentLevel(role: string): boolean {
  return [...EXECUTIVE_ROLES, ...DEPARTMENT_HEAD_ROLES].includes(role);
}

export function canApproveOperationalLevel(role: string): boolean {
  return ALL_MANAGER_ROLES.includes(role);
}

export function canApproveITRequests(role: string): boolean {
  return ['CTO', 'SYSTEM_ADMINISTRATOR', 'ENGINEERING_MANAGER'].includes(role);
}

export function canApproveFinancialRequests(role: string): boolean {
  return ['CEO', 'CFO'].includes(role);
}

export function canApproveHRRequests(role: string): boolean {
  return ['CEO', 'HR_MANAGER'].includes(role);
}

export function canApproveSecurityRequests(role: string): boolean {
  return ['CTO', 'SECURITY_ENGINEER'].includes(role);
}

// Get appropriate approver based on operational workflow type and amount
export async function getOperationalApprover(workflowType: string, amount: number = 0, requesterId: string): Promise<string | null> {
  try {
    let approverRoles: string[] = [];

    // Determine approver roles based on workflow type and amount
    switch (workflowType) {
      case 'IT_EQUIPMENT_REQUEST':
      case 'SOFTWARE_LICENSE_REQUEST':
      case 'CLOUD_SERVICE_REQUEST':
        if (amount > 2000) {
          approverRoles = ['CTO']; // High-value IT purchases
        } else if (amount > 500) {
          approverRoles = ['ENGINEERING_MANAGER', 'CTO']; // Medium-value purchases
        } else {
          approverRoles = ['SYSTEM_ADMINISTRATOR', 'ENGINEERING_MANAGER', 'CTO']; // Low-value purchases
        }
        break;

      case 'ACCESS_REQUEST':
        approverRoles = ['ENGINEERING_MANAGER', 'SYSTEM_ADMINISTRATOR', 'CTO', 'CEO'];
        break;

      case 'ELEVATED_ACCESS_REQUEST':
      case 'SYSTEM_ADMIN_REQUEST':
        approverRoles = ['CTO', 'SECURITY_ENGINEER'];
        break;

      case 'POLICY_UPDATE_REQUEST':
      case 'PROCEDURE_CHANGE_REQUEST':
        approverRoles = ['HR_MANAGER', 'CEO', 'CTO', 'ADMIN']; // Added CTO and ADMIN as fallbacks
        break;

      case 'EXPENSE_APPROVAL_REQUEST':
      case 'BUDGET_REQUEST':
        if (amount > 5000) {
          approverRoles = ['CFO', 'CEO']; // High-value expenses
        } else if (amount > 1000) {
          approverRoles = ['ENGINEERING_MANAGER', 'SALES_MANAGER', 'MARKETING_MANAGER', 'CTO', 'CEO']; // Department heads
        } else {
          approverRoles = [...ALL_MANAGER_ROLES, 'CTO', 'CEO']; // Any manager
        }
        break;

      case 'HIRING_REQUEST':
      case 'ROLE_CHANGE_REQUEST':
        approverRoles = ['HR_MANAGER', 'CEO'];
        break;

      case 'VENDOR_CONTRACT_REQUEST':
        if (amount > 10000) {
          approverRoles = ['CEO']; // Major contracts
        } else {
          approverRoles = ['CFO', 'CEO']; // Standard contracts
        }
        break;

      default:
        approverRoles = [...DEPARTMENT_HEAD_ROLES, 'CTO', 'CEO']; // Default to department heads + executives
    }

    // Find available approver (excluding requester)
    let approvers = await prisma.employee.findMany({
      where: {
        role: { in: approverRoles as any },
        status: 'ACTIVE',
        id: { not: requesterId }
      },
      orderBy: [
        { role: 'asc' }, // Prefer higher roles
        { createdAt: 'asc' }
      ],
      take: 1
    });

    // If no approver found (excluding requester), allow self-approval for policy workflows
    if (approvers.length === 0 && workflowType === 'POLICY_UPDATE_REQUEST') {
      console.log('No external approver found for policy workflow, allowing self-approval');
      approvers = await prisma.employee.findMany({
        where: {
          role: { in: approverRoles as any },
          status: 'ACTIVE',
          id: requesterId // Allow the requester to approve their own policy
        },
        take: 1
      });
    }

    return approvers.length > 0 ? approvers[0].id : null;
  } catch (error) {
    console.error('Error finding operational approver:', error);
    return null;
  }
}

// Check operational permissions
export async function checkOperationalPermission(userId: string, action: string, context?: any): Promise<boolean> {
  try {
    const user = await prisma.employee.findUnique({
      where: { id: userId },
      select: { role: true, status: true, department: true }
    });

    if (!user || user.status !== 'ACTIVE') {
      return false;
    }

    const amount = context?.amount || 0;

    switch (action) {
      case 'approve_it_requests':
        return canApproveITRequests(user.role);
      case 'approve_financial_requests':
        return canApproveFinancialRequests(user.role) && amount <= getFinancialApprovalLimit(user.role);
      case 'approve_hr_requests':
        return canApproveHRRequests(user.role);
      case 'approve_security_requests':
        return canApproveSecurityRequests(user.role);
      case 'approve_executive_requests':
        return canApproveExecutiveLevel(user.role);
      case 'submit_requests':
        return true; // All active employees can submit requests
      default:
        return false;
    }
  } catch (error) {
    console.error('Error checking operational permission:', error);
    return false;
  }
}

// Get financial approval limits by role
function getFinancialApprovalLimit(role: string): number {
  switch (role) {
    case 'CEO': return Infinity;
    case 'CFO': return 50000;
    case 'CTO': return 25000;
    case 'ENGINEERING_MANAGER': return 10000;
    case 'SALES_MANAGER': return 10000;
    case 'MARKETING_MANAGER': return 10000;
    case 'HR_MANAGER': return 5000;
    default: return 1000;
  }
}

// Get operational user context with department info
export async function getOperationalUserContext(userId: string): Promise<UserContext | null> {
  try {
    const user = await prisma.employee.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
        department: true,
        status: true
      }
    });

    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    return {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      department: user.department
    };
  } catch (error) {
    console.error('Error getting operational user context:', error);
    return null;
  }
}

// Get approval chain for complex workflows
export async function getApprovalChain(workflowType: string, amount: number = 0): Promise<string[]> {
  const chain: string[] = [];

  switch (workflowType) {
    case 'IT_EQUIPMENT_REQUEST':
      if (amount > 2000) {
        chain.push('SYSTEM_ADMINISTRATOR', 'ENGINEERING_MANAGER', 'CTO');
      } else if (amount > 500) {
        chain.push('SYSTEM_ADMINISTRATOR', 'ENGINEERING_MANAGER');
      } else {
        chain.push('SYSTEM_ADMINISTRATOR');
      }
      break;

    case 'HIRING_REQUEST':
      chain.push('ENGINEERING_MANAGER', 'HR_MANAGER', 'CEO');
      break;

    case 'VENDOR_CONTRACT_REQUEST':
      if (amount > 10000) {
        chain.push('CFO', 'CEO');
      } else {
        chain.push('CFO');
      }
      break;

    default:
      // Single approver for most workflows
      const approver = await getOperationalApprover(workflowType, amount, '');
      if (approver) chain.push(approver);
  }

  return chain;
}