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

// Standard onboarding resources for all employees
const STANDARD_ONBOARDING_RESOURCES: OnboardingResourceTemplate[] = [
  {
    name: 'Company Laptop',
    type: 'PHYSICAL',
    category: 'Hardware',
    description: 'Standard company laptop for daily work',
    permissionLevel: 'ADMIN',
    required: true
  },
  {
    name: 'Office 365 License',
    type: 'SOFTWARE',
    category: 'Productivity',
    description: 'Microsoft Office 365 suite access',
    permissionLevel: 'WRITE',
    required: true
  },
  {
    name: 'Company Email Account',
    type: 'CLOUD',
    category: 'Communication',
    description: 'Corporate email account and calendar access',
    permissionLevel: 'ADMIN',
    required: true
  },
  {
    name: 'Company Handbook Access',
    type: 'CLOUD',
    category: 'Documentation',
    description: 'Access to company policies and procedures',
    permissionLevel: 'READ',
    required: true
  }
];

// Role-specific resources
const ROLE_SPECIFIC_RESOURCES: OnboardingResourceTemplate[] = [
  {
    name: 'Development Environment',
    type: 'SOFTWARE',
    category: 'Development',
    description: 'IDE and development tools access',
    permissionLevel: 'ADMIN',
    required: true,
    roleSpecific: ['EMPLOYEE', 'MANAGER'],
    departmentSpecific: ['Engineering', 'Technology', 'IT']
  },
  {
    name: 'Database Access',
    type: 'CLOUD',
    category: 'Database',
    description: 'Read access to company databases',
    permissionLevel: 'READ',
    required: false,
    roleSpecific: ['EMPLOYEE', 'MANAGER'],
    departmentSpecific: ['Engineering', 'Technology', 'Data Science']
  },
  {
    name: 'Admin Dashboard',
    type: 'CLOUD',
    category: 'Administration',
    description: 'Administrative dashboard access',
    permissionLevel: 'ADMIN',
    required: true,
    roleSpecific: ['CEO', 'CTO', 'MANAGER']
  },
  {
    name: 'HR Management System',
    type: 'SOFTWARE',
    category: 'HR',
    description: 'Human resources management tools',
    permissionLevel: 'WRITE',
    required: true,
    departmentSpecific: ['Human Resources', 'Executive']
  },
  {
    name: 'Financial Systems',
    type: 'CLOUD',
    category: 'Finance',
    description: 'Access to financial reporting and accounting systems',
    permissionLevel: 'WRITE',
    required: true,
    departmentSpecific: ['Finance', 'Accounting', 'Executive'],
    roleSpecific: ['CEO', 'CFO', 'MANAGER']
  }
];

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
    // Combine standard and role-specific resources
    const allResourceTemplates = [
      ...STANDARD_ONBOARDING_RESOURCES,
      ...ROLE_SPECIFIC_RESOURCES.filter(resource => 
        (!resource.roleSpecific || resource.roleSpecific.includes(role)) &&
        (!resource.departmentSpecific || resource.departmentSpecific.includes(department))
      )
    ];

    console.log(`Assigning ${allResourceTemplates.length} onboarding resources to ${employeeName}`);

    for (const template of allResourceTemplates) {
      try {
        // Check if a resource with this name already exists
        let existingResource = await prisma.resource.findFirst({
          where: {
            name: template.name,
            type: template.type
          }
        });

        // If resource doesn't exist, create it
        if (!existingResource) {
          // Get CEO for custodian assignment
          const ceo = await prisma.employee.findFirst({ 
            where: { role: 'CEO' },
            select: { id: true }
          });
          
          existingResource = await prisma.resource.create({
            data: {
              name: template.name,
              type: template.type,
              category: template.category,
              description: template.description,
              defaultPermission: template.permissionLevel || 'READ',
              status: 'ACTIVE',
              owner: 'Unisouk', // Company owns all resources
              custodianId: ceo?.id || performedBy, // CEO is custodian, fallback to system user
              totalQuantity: 10 // Default quantity for onboarding resources
            }
          });

          results.created++;
          console.log(`Created new onboarding resource: ${template.name}`);
        }

        // Assign the resource to the employee using the new assignment system
        try {
          // Check if assignment already exists
          const existingAssignment = await prisma.resourceAssignment.findFirst({
            where: {
              resourceId: existingResource.id,
              employeeId: employeeId,
              status: 'ACTIVE'
            }
          });

          if (!existingAssignment) {
            // Create new assignment
            await prisma.resourceAssignment.create({
              data: {
                resourceId: existingResource.id,
                employeeId: employeeId,
                quantityAssigned: 1,
                assignedBy: performedBy,
                status: 'ACTIVE',
                notes: `Automatically assigned during onboarding process`
              }
            });

            results.assigned++;
            console.log(`Assigned ${template.name} to ${employeeName} during onboarding`);
          } else {
            console.log(`${template.name} already assigned to ${employeeName}`);
          }
        } catch (assignmentError) {
          console.error(`Failed to assign ${template.name} to ${employeeName}:`, assignmentError);
          results.errors.push(`Failed to assign ${template.name}: ${assignmentError}`);
        }

        // Log the assignment
        await logTimelineActivity({
          entityType: 'RESOURCE',
          entityId: existingResource.id,
          activityType: 'ASSIGNED',
          title: `Onboarding resource assigned to ${employeeName}`,
          description: `${template.name} (${template.type}) was automatically assigned to ${employeeName} during onboarding`,
          metadata: {
            resourceName: template.name,
            resourceType: template.type,
            resourceCategory: template.category,
            employeeName: employeeName,
            employeeId: employeeId,
            assignmentMethod: 'automatic_onboarding',
            permissionLevel: template.permissionLevel,
            required: template.required,
            roleSpecific: template.roleSpecific || null,
            departmentSpecific: template.departmentSpecific || null
          },
          performedBy: performedBy,
          resourceId: existingResource.id,
          employeeId: employeeId
        });

        console.log(`Assigned ${template.name} to ${employeeName}`);

      } catch (resourceError) {
        const errorMessage = `Failed to assign ${template.name}: ${resourceError instanceof Error ? resourceError.message : 'Unknown error'}`;
        results.errors.push(errorMessage);
        console.error(errorMessage, resourceError);
      }
    }

    // Log overall onboarding completion
    await logTimelineActivity({
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      activityType: 'ONBOARDING_COMPLETED',
      title: `Onboarding resources assigned to ${employeeName}`,
      description: `Automatic onboarding process completed for ${employeeName}. ${results.assigned} resources assigned, ${results.created} resources created.`,
      metadata: {
        employeeName: employeeName,
        role: role,
        department: department,
        resourcesAssigned: results.assigned,
        resourcesCreated: results.created,
        errors: results.errors,
        onboardingMethod: 'automatic',
        completedAt: new Date().toISOString()
      },
      performedBy: performedBy,
      employeeId: employeeId
    });

    console.log(`Onboarding completed for ${employeeName}: ${results.assigned} assigned, ${results.created} created, ${results.errors.length} errors`);

  } catch (error) {
    const errorMessage = `Failed to complete onboarding for ${employeeName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    results.errors.push(errorMessage);
    console.error(errorMessage, error);
  }

  return results;
}

export async function getOnboardingResourcesForRole(role: string, department: string): Promise<OnboardingResourceTemplate[]> {
  return [
    ...STANDARD_ONBOARDING_RESOURCES,
    ...ROLE_SPECIFIC_RESOURCES.filter(resource => 
      (!resource.roleSpecific || resource.roleSpecific.includes(role)) &&
      (!resource.departmentSpecific || resource.departmentSpecific.includes(department))
    )
  ];
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

    // Get expected resources for this employee
    const expectedResources = await getOnboardingResourcesForRole(employee.role, employee.department);

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

    // Check which resources are missing
    const assignedResourceNames = assignedResources.map(assignment => assignment.resource.name);
    const missingResources = expectedResources
      .filter(expected => !assignedResourceNames.includes(expected.name))
      .map(missing => missing.name);

    return {
      completed: missingResources.length === 0,
      assignedResources: assignedResources.length,
      expectedResources: expectedResources.length,
      missingResources
    };

  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return {
      completed: false,
      assignedResources: 0,
      expectedResources: 0,
      missingResources: []
    };
  }
}