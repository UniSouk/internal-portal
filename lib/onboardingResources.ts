// lib/onboardingResources.ts
import { prisma } from './prisma';
import { logTimelineActivity } from './timeline';

interface OnboardingResourceTemplate {
  name: string;
  type: 'PHYSICAL' | 'SOFTWARE' | 'CLOUD';
  category: string;
  description?: string;
  permissionLevel?: 'READ' | 'WRITE' | 'EDIT' | 'ADMIN';
  required: boolean;
  roleSpecific?: string[]; // Specific roles that get this resource
  departmentSpecific?: string[]; // Specific departments that get this resource
}

export async function assignOnboardingResources(
  employeeId: string,
  employeeName: string,
  role: string,
  department: string,
  performedBy: string
): Promise<{ assigned: number; created: number; errors: string[] }> {
  const results = {
    assigned: 0,
    created: 0,
    errors: [] as string[]
  };

  // DISABLED: Automatic resource allocation during onboarding
  // Resources should be manually assigned by administrators through the assign-resources page
  // This prevents unintended resource allocation and ensures proper allocation type validation
  
  try {
    // Log that onboarding was triggered but no automatic assignments were made
    await logTimelineActivity({
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      activityType: 'ONBOARDING_COMPLETED',
      title: `Onboarding initiated for ${employeeName}`,
      description: `Onboarding process initiated for ${employeeName}. Resources should be manually assigned through the resource assignment page.`,
      metadata: {
        employeeName: employeeName,
        role: role,
        department: department,
        resourcesAssigned: 0,
        resourcesCreated: 0,
        onboardingMethod: 'manual_assignment_required',
        completedAt: new Date().toISOString(),
        note: 'Automatic resource allocation is disabled. Please assign resources manually.'
      },
      performedBy: performedBy,
      employeeId: employeeId
    });

  } catch (error) {
    const errorMessage = `Failed to log onboarding for ${employeeName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    results.errors.push(errorMessage);
    console.error(errorMessage, error);
  }

  return results;
}

export async function getOnboardingResourcesForEmployee(role: string, department: string): Promise<any[]> {
  // Return empty array - automatic resource allocation is disabled
  // Resources should be manually assigned through the assign-resources page
  return [];
}

export async function checkEmployeeOnboardingStatus(employeeId: string): Promise<{
  completed: boolean;
  assignedResources: number;
  expectedResources: number;
  missingResources: string[];
}> {
  try {
    // Get employee details
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { role: true, department: true, name: true }
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    // Get actually assigned resources using the new assignment system
    const assignedResources = await prisma.resourceAssignment.findMany({
      where: {
        employeeId: employeeId,
        status: 'ACTIVE'
      },
      include: {
        resource: {
          select: { name: true, type: true }
        }
      }
    });

    // Onboarding is considered complete regardless of resource count
    // since automatic allocation is disabled and resources are manually assigned
    return {
      completed: true, // Always true since manual assignment is the process
      assignedResources: assignedResources.length,
      expectedResources: 0, // No automatic expectations
      missingResources: [] // No automatic requirements
    };

  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return {
      completed: true, // Default to true to not block workflows
      assignedResources: 0,
      expectedResources: 0,
      missingResources: []
    };
  }
}