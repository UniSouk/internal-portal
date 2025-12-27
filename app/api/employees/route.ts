import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { logCreatedActivity, logTimelineActivity, logUpdatedActivity } from '@/lib/timeline';
import { getSystemUserId } from '@/lib/systemUser';
import { getUserFromToken } from '@/lib/auth';
import { formatMultipleChanges } from '@/lib/changeFormatter';
import { trackEntityUpdate } from '@/lib/changeTracker';
import { assignOnboardingResources } from '@/lib/onboardingResources';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    // If ID is provided, fetch single employee
    if (id) {
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true
            }
          },
          subordinates: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true
            }
          }
        }
      });

      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      return NextResponse.json(employee);
    }

    // Otherwise, fetch paginated employees
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const skip = (page - 1) * limit;

    // Get total count
    const total = await prisma.employee.count();

    // Get paginated employees
    const employees = await prisma.employee.findMany({
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        },
        subordinates: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    return NextResponse.json({
      employees,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      email, 
      role, 
      department, 
      managerId, 
      status, 
      joiningDate,
      phone
    } = body;

    // Get the authenticated user for logging
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    const systemUserId = await getSystemUserId();
    const createdBy = currentUser?.id || systemUserId;

    const employee = await prisma.employee.create({
      data: {
        name,
        email,
        role,
        department,
        managerId,
        status: 'INACTIVE', // Always create employees as INACTIVE initially
        joiningDate: new Date(joiningDate),
        phone,
        password: null // No password set initially - will be set during signup/activation
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      }
    });

    // Log audit trail
    await logAudit({
      entityType: 'EMPLOYEE',
      entityId: employee.id,
      changedById: createdBy,
      fieldChanged: 'created',
      oldValue: null,
      newValue: JSON.stringify(employee)
    });

    // Log timeline activity
    await logCreatedActivity(
      'EMPLOYEE',
      employee.id,
      employee.name,
      createdBy,
      {
        role: employee.role,
        department: employee.department,
        status: employee.status,
        joiningDate: employee.joiningDate
      }
    );

    // Automatically assign onboarding resources
    try {
      console.log(`Starting automatic onboarding resource assignment for ${employee.name}`);
      
      const onboardingResults = await assignOnboardingResources(
        employee.id,
        employee.name,
        employee.role,
        employee.department,
        createdBy
      );

      console.log(`Onboarding completed for ${employee.name}:`, onboardingResults);

      // Add onboarding results to the response
      return NextResponse.json({
        ...employee,
        onboarding: {
          resourcesAssigned: onboardingResults.assigned,
          resourcesCreated: onboardingResults.created,
          errors: onboardingResults.errors,
          completed: onboardingResults.errors.length === 0
        }
      }, { status: 201 });

    } catch (onboardingError) {
      console.error('Onboarding resource assignment failed:', onboardingError);
      
      // Log the onboarding failure but don't fail the employee creation
      try {
        await logTimelineActivity({
          entityType: 'EMPLOYEE',
          entityId: employee.id,
          activityType: 'ONBOARDING_FAILED',
          title: `Onboarding resource assignment failed for ${employee.name}`,
          description: `Automatic onboarding process failed: ${onboardingError instanceof Error ? onboardingError.message : 'Unknown error'}`,
          metadata: {
            employeeName: employee.name,
            role: employee.role,
            department: employee.department,
            errorMessage: onboardingError instanceof Error ? onboardingError.message : 'Unknown error',
            onboardingMethod: 'automatic'
          },
          performedBy: createdBy,
          employeeId: employee.id
        });
      } catch (logError) {
        console.error('Failed to log onboarding failure:', logError);
      }

      // Return employee data with onboarding error info
      return NextResponse.json({
        ...employee,
        onboarding: {
          resourcesAssigned: 0,
          resourcesCreated: 0,
          errors: [onboardingError instanceof Error ? onboardingError.message : 'Onboarding failed'],
          completed: false
        }
      }, { status: 201 });
    }
  } catch (error: any) {
    console.error('Error creating employee:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      // Unique constraint violation
      if (error.meta?.target?.includes('email')) {
        return NextResponse.json(
          { 
            error: 'Email address already exists', 
            message: 'An employee with this email address already exists. Please use a different email address.',
            field: 'email',
            code: 'DUPLICATE_EMAIL'
          }, 
          { status: 400 }
        );
      }
      // Handle other unique constraints if any
      return NextResponse.json(
        { 
          error: 'Duplicate entry', 
          message: 'This information already exists in the system.',
          code: 'DUPLICATE_ENTRY'
        }, 
        { status: 400 }
      );
    }
    
    // Handle other Prisma errors
    if (error.code?.startsWith('P')) {
      return NextResponse.json(
        { 
          error: 'Database error', 
          message: 'There was an issue with the database operation. Please try again.',
          code: error.code
        }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      error: 'Failed to create employee',
      message: 'An unexpected error occurred while creating the employee. Please try again.'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    const body = await request.json();

    // Get current employee data for change tracking
    const currentEmployee = await prisma.employee.findUnique({
      where: { id }
    });

    if (!currentEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Update employee
    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        name: body.name,
        email: body.email,
        role: body.role,
        department: body.department,
        managerId: body.managerId || null,
        status: body.status,
        joiningDate: body.joiningDate ? new Date(body.joiningDate) : undefined,
        phone: body.phone || null
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      }
    });

    // Track all changes comprehensively
    await trackEntityUpdate(
      'EMPLOYEE',
      id,
      updatedEmployee.name,
      currentEmployee,
      updatedEmployee,
      request
    );

    return NextResponse.json(updatedEmployee);
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const deletedBy = searchParams.get('deletedBy') || 'system';

    console.log('DELETE request for employee ID:', id);
    console.log('Deletion requested by:', currentUser.name, '(', currentUser.id, ')');

    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    // Get system user ID for fallback operations
    const systemUserId = await getSystemUserId();
    
    // Use the authenticated user for logging
    const deletionPerformedBy = currentUser.id;

    // Get employee details before deletion for logging
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { 
        name: true, 
        email: true, 
        department: true,
        role: true
      }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    console.log('Found employee:', employee);

    // Log the deletion attempt
    try {
      await logAudit({
        entityType: 'EMPLOYEE',
        entityId: id,
        changedById: deletionPerformedBy, // Use authenticated user
        fieldChanged: 'deletion_attempted',
        oldValue: JSON.stringify(employee),
        newValue: null
      });

      await logTimelineActivity({
        entityType: 'EMPLOYEE',
        entityId: id,
        activityType: 'WORKFLOW_STARTED',
        title: `Deletion attempted for employee: ${employee.name}`,
        description: `${currentUser.name} attempted to delete employee ${employee.name} (${employee.email})`,
        metadata: {
          employeeName: employee.name,
          employeeEmail: employee.email,
          department: employee.department,
          role: employee.role,
          deletedBy: id, // Store the original ID in metadata
          deletionRequestedBy: currentUser.name
        },
        performedBy: deletionPerformedBy // Use authenticated user
      });
    } catch (logError) {
      console.error('Failed to log deletion attempt:', logError);
    }

    // Handle foreign key dependencies before deletion
    try {
      console.log('Handling employee dependencies before deletion...');
      
      // 1. Update access requests where this employee is the requester
      const accessRequestsAsRequester = await prisma.access.updateMany({
        where: { employeeId: id },
        data: { employeeId: systemUserId } // Transfer to system user
      });
      console.log(`Updated ${accessRequestsAsRequester.count} access requests where employee was requester`);

      // 2. Update access requests where this employee is the approver
      const accessRequestsAsApprover = await prisma.access.updateMany({
        where: { approverId: id },
        data: { approverId: systemUserId } // Transfer to system user
      });
      console.log(`Updated ${accessRequestsAsApprover.count} access requests where employee was approver`);

      // 3. Update approval workflows where this employee is the requester
      const workflowsAsRequester = await prisma.approvalWorkflow.updateMany({
        where: { requesterId: id },
        data: { requesterId: systemUserId }
      });
      console.log(`Updated ${workflowsAsRequester.count} workflows where employee was requester`);

      // 4. Update approval workflows where this employee is the approver
      const workflowsAsApprover = await prisma.approvalWorkflow.updateMany({
        where: { approverId: id },
        data: { approverId: systemUserId }
      });
      console.log(`Updated ${workflowsAsApprover.count} workflows where employee was approver`);

      // 5. Update policies owned by this employee
      const policiesUpdated = await prisma.policy.updateMany({
        where: { ownerId: id },
        data: { ownerId: systemUserId }
      });
      console.log(`Updated ${policiesUpdated.count} policies owned by employee`);

      // 6. Update documents owned by this employee
      const documentsUpdated = await prisma.document.updateMany({
        where: { ownerId: id },
        data: { ownerId: systemUserId }
      });
      console.log(`Updated ${documentsUpdated.count} documents owned by employee`);

      // 7. Update resources managed by this employee (transfer custodianship)
      const resourcesUpdated = await prisma.resource.updateMany({
        where: { custodianId: id },
        data: { custodianId: systemUserId }
      });
      console.log(`Updated ${resourcesUpdated.count} resources managed by employee`);

      // 8. Update subordinates' manager reference
      const subordinatesUpdated = await prisma.employee.updateMany({
        where: { managerId: id },
        data: { managerId: null }
      });
      console.log(`Updated ${subordinatesUpdated.count} subordinates' manager reference`);

      // Now delete the employee
      await prisma.employee.delete({
        where: { id }
      });

      console.log('Employee deleted successfully after handling dependencies');
      
      // Log successful deletion using authenticated user
      try {
        await logAudit({
          entityType: 'EMPLOYEE',
          entityId: id,
          changedById: deletionPerformedBy,
          fieldChanged: 'deleted',
          oldValue: JSON.stringify({
            name: employee.name,
            email: employee.email,
            department: employee.department,
            role: employee.role,
            dependenciesTransferred: {
              accessRequests: accessRequestsAsRequester.count + accessRequestsAsApprover.count,
              workflows: workflowsAsRequester.count + workflowsAsApprover.count,
              policies: policiesUpdated.count,
              documents: documentsUpdated.count,
              resources: resourcesUpdated.count,
              subordinates: subordinatesUpdated.count
            }
          }),
          newValue: null
        });

        await logTimelineActivity({
          entityType: 'EMPLOYEE',
          entityId: id,
          activityType: 'DELETED',
          title: `Successfully deleted employee: ${employee.name}`,
          description: `${currentUser.name} successfully removed employee ${employee.name} (${employee.email}) from the system`,
          metadata: {
            employeeName: employee.name,
            employeeEmail: employee.email,
            department: employee.department,
            role: employee.role,
            deletedBy: id,
            deletionPerformedBy: currentUser.name
          },
          performedBy: deletionPerformedBy
        });
      } catch (logError) {
        console.error('Failed to log successful deletion:', logError);
      }

      return NextResponse.json({ message: 'Employee deleted successfully' });

    } catch (deleteError: any) {
      console.error('Direct deletion failed:', deleteError);
      
      // Log the failed deletion
      try {
        await logAudit({
          entityType: 'EMPLOYEE',
          entityId: id,
          changedById: deletionPerformedBy, // Use authenticated user
          fieldChanged: 'deletion_failed',
          oldValue: JSON.stringify(employee),
          newValue: deleteError.message || 'Unknown error'
        });

        await logTimelineActivity({
          entityType: 'EMPLOYEE',
          entityId: id,
          activityType: 'WORKFLOW_CANCELLED',
          title: `Failed to delete employee: ${employee.name}`,
          description: `${currentUser.name} attempted to delete ${employee.name} but it failed: ${deleteError.message || 'Unknown error'}`,
          metadata: {
            employeeName: employee.name,
            employeeEmail: employee.email,
            department: employee.department,
            role: employee.role,
            errorCode: deleteError.code,
            errorMessage: deleteError.message,
            deletedBy: id, // Store the original ID in metadata
            deletionRequestedBy: currentUser.name
          },
          performedBy: deletionPerformedBy // Use authenticated user
        });
      } catch (logError) {
        console.error('Failed to log deletion failure:', logError);
      }
      
      // If direct deletion fails, let's handle the constraints manually
      if (deleteError.code === 'P2003') {
        console.log('Foreign key constraint error, handling dependencies...');
        
        try {
          // CRITICAL CHANGE: Do NOT delete audit logs and timeline activities
          // Instead, update references to use system user
          await prisma.$transaction(async (tx: any) => {
            // 1. Update timeline activities to reference system user instead of deleting them
            await tx.activityTimeline.updateMany({
              where: { performedBy: id },
              data: { performedBy: systemUserId }
            });

            // 2. Update audit logs to reference system user instead of deleting them
            await tx.auditLog.updateMany({
              where: { changedById: id },
              data: { changedById: systemUserId }
            });

            // 3. Update any employees who have this employee as manager (set to null)
            await tx.employee.updateMany({
              where: { managerId: id },
              data: { managerId: null }
            });

            // 4. Update any resources managed by this employee (transfer custodianship to CEO)
            const ceo = await tx.employee.findFirst({ where: { role: 'CEO' } });
            if (ceo) {
              await tx.resource.updateMany({
                where: { custodianId: id },
                data: { custodianId: ceo.id }
              });
            }

            // 5. Delete access requests made by this employee
            await tx.access.deleteMany({
              where: { employeeId: id }
            });

            // 6. Update access requests approved by this employee (set approver to null)
            await tx.access.updateMany({
              where: { approverId: id },
              data: { approverId: null }
            });

            // 7. Delete approval workflows requested by this employee
            await tx.approvalWorkflow.deleteMany({
              where: { requesterId: id }
            });

            // 8. Update approval workflows approved by this employee (set approver to null)
            await tx.approvalWorkflow.updateMany({
              where: { approverId: id },
              data: { approverId: null }
            });

            // 9. Update policies and documents owned by this employee (set owner to null)
            await tx.policy.updateMany({
              where: { ownerId: id },
              data: { ownerId: null }
            });

            await tx.document.updateMany({
              where: { ownerId: id },
              data: { ownerId: null }
            });

            // 11. Finally, delete the employee
            await tx.employee.delete({
              where: { id }
            });
          });

          console.log('Employee deleted successfully after handling constraints');
          
          // Log successful deletion after constraint handling using authenticated user
          try {
            await logAudit({
              entityType: 'EMPLOYEE',
              entityId: id,
              changedById: deletionPerformedBy,
              fieldChanged: 'deleted_with_constraints',
              oldValue: JSON.stringify(employee),
              newValue: 'Successfully handled foreign key constraints'
            });

            await logTimelineActivity({
              entityType: 'EMPLOYEE',
              entityId: id,
              activityType: 'DELETED',
              title: `Successfully deleted employee after constraint handling: ${employee.name}`,
              description: `${currentUser.name} successfully removed employee ${employee.name} (${employee.email}) from the system after resolving dependencies. All historical records preserved.`,
              metadata: {
                employeeName: employee.name,
                employeeEmail: employee.email,
                department: employee.department,
                role: employee.role,
                method: 'constraint_handling',
                deletedBy: id,
                deletionPerformedBy: currentUser.name,
                historicalRecordsPreserved: true
              },
              performedBy: deletionPerformedBy
            });
          } catch (logError) {
            console.error('Failed to log successful deletion after constraints:', logError);
          }
          
          return NextResponse.json({ message: 'Employee deleted successfully' });
        } catch (constraintError: any) {
          console.error('Failed to handle constraints:', constraintError);
          
          // Log the constraint handling failure
          try {
            await logTimelineActivity({
              entityType: 'EMPLOYEE',
              entityId: id,
              activityType: 'WORKFLOW_CANCELLED',
              title: `Failed to delete employee after constraint handling: ${employee.name}`,
              description: `${currentUser.name} attempted to delete ${employee.name} but constraint handling failed: ${constraintError.message || 'Unknown error'}`,
              metadata: {
                employeeName: employee.name,
                employeeEmail: employee.email,
                department: employee.department,
                role: employee.role,
                errorCode: constraintError.code,
                errorMessage: constraintError.message,
                method: 'constraint_handling',
                deletedBy: id, // Store the original ID in metadata
                deletionRequestedBy: currentUser.name
              },
              performedBy: deletionPerformedBy // Use authenticated user
            });
          } catch (logError) {
            console.error('Failed to log constraint handling failure:', logError);
          }
          
          throw constraintError;
        }
      } else {
        throw deleteError;
      }
    }

  } catch (error: any) {
    console.error('Error deleting employee:', error);
    
    return NextResponse.json({ 
      error: error.message || 'Failed to delete employee',
      details: error.message,
      errorCode: error.code
    }, { status: 500 });
  }
}