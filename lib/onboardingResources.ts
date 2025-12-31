// lib/onboardingResources.ts
import { prisma } from './prisma';
import { logTimelineActivity } from './timeline';
import { getCompanyName } from './config/company';

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

  try {
    // Get available resources from database instead of static templates
    const availableResources = await prisma.resource.findMany({
      where: {
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        type: true,
        category: true,
        description: true
      }
    });

    if (availableResources.length === 0) {
      results.errors.push('No resources available for onboarding. Please create resources first.');
      return results;
    }

    // For now, assign basic resources that are commonly needed
    // This can be made more sophisticated with role-based logic later
    const basicResourceTypes = ['PHYSICAL', 'SOFTWARE']; // Prioritize physical and software resources
    const resourcesToAssign = availableResources.filter(resource => 
      basicResourceTypes.includes(resource.type)
    ).slice(0, 3); // Limit to first 3 resources to avoid overwhelming new employees

    if (resourcesToAssign.length === 0) {
      results.errors.push('No suitable resources found for onboarding. Please ensure you have Physical or Software resources available.');
      return results;
    }

    for (const resource of resourcesToAssign) {
      try {
        // Check if assignment already exists
        const existingAssignment = await prisma.resourceAssignment.findFirst({
          where: {
            resourceId: resource.id,
            employeeId: employeeId,
            status: 'ACTIVE'
          }
        });

        if (!existingAssignment) {
          // Create new assignment
          await prisma.resourceAssignment.create({
            data: {
              resourceId: resource.id,
              employeeId: employeeId,
              assignedBy: performedBy,
              status: 'ACTIVE',
              notes: `Automatically assigned during onboarding process`
            }
          });

          results.assigned++;
        } else {
          console.log(`${resource.name} already assigned to ${employeeName}`);
        }

        // Log the assignment
        await logTimelineActivity({
          entityType: 'RESOURCE',
          entityId: resource.id,
          activityType: 'ASSIGNED',
          title: `Onboarding resource assigned to ${employeeName}`,
          description: `${resource.name} (${resource.type}) was automatically assigned to ${employeeName} during onboarding`,
          metadata: {
            resourceName: resource.name,
            resourceType: resource.type,
            resourceCategory: resource.category,
            employeeName: employeeName,
            employeeId: employeeId,
            assignmentMethod: 'automatic_onboarding',
            permissionLevel: 'read', // Default permission level
            required: true
          },
          performedBy: performedBy,
          resourceId: resource.id,
          employeeId: employeeId
        });

      } catch (assignmentError) {
        console.error(`Failed to assign ${resource.name} to ${employeeName}:`, assignmentError);
        results.errors.push(`Failed to assign ${resource.name}: ${assignmentError}`);
      }
    }

    // Log overall onboarding completion
    await logTimelineActivity({
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      activityType: 'ONBOARDING_COMPLETED',
      title: `Onboarding resources assigned to ${employeeName}`,
      description: `Automatic onboarding process completed for ${employeeName}. ${results.assigned} resources assigned from available inventory.`,
      metadata: {
        employeeName: employeeName,
        role: role,
        department: department,
        resourcesAssigned: results.assigned,
        resourcesCreated: results.created,
        errors: results.errors,
        onboardingMethod: 'automatic_from_inventory',
        completedAt: new Date().toISOString(),
        availableResourcesCount: availableResources.length
      },
      performedBy: performedBy,
      employeeId: employeeId
    });

  } catch (error) {
    const errorMessage = `Failed to complete onboarding for ${employeeName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    results.errors.push(errorMessage);
    console.error(errorMessage, error);
  }

  return results;
}

export async function getOnboardingResourcesForEmployee(role: string, department: string): Promise<any[]> {
  // Return empty array since we're now using dynamic resources from database
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

    // Get total available resources to determine if onboarding is reasonable
    const totalAvailableResources = await prisma.resource.count({
      where: {
        status: 'ACTIVE'
      }
    });

    // Simple heuristic: if employee has at least 1 resource and there are resources available, consider onboarding complete
    // This can be made more sophisticated later with role-based requirements
    const hasBasicResources = assignedResources.length > 0;
    const resourcesAvailable = totalAvailableResources > 0;

    return {
      completed: hasBasicResources && resourcesAvailable,
      assignedResources: assignedResources.length,
      expectedResources: Math.min(3, totalAvailableResources), // Expect up to 3 basic resources
      missingResources: hasBasicResources ? [] : ['Basic resources needed for onboarding']
    };

  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return {
      completed: false,
      assignedResources: 0,
      expectedResources: 0,
      missingResources: ['Error checking onboarding status']
    };
  }
}