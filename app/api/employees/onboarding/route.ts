import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';
import { assignOnboardingResources, checkEmployeeOnboardingStatus } from '@/lib/onboardingResources';

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check onboarding status for the current user
    const onboardingStatus = await checkEmployeeOnboardingStatus(currentUser.id);

    return NextResponse.json({
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      ...onboardingStatus
    });
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return NextResponse.json({ error: 'Failed to check onboarding status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { employeeId, force = false } = body;

    // If no employeeId provided, use current user
    const targetEmployeeId = employeeId || currentUser.id;

    // Only allow CEO/CTO to assign onboarding resources to other employees
    if (targetEmployeeId !== currentUser.id && currentUser.role !== 'CEO' && currentUser.role !== 'CTO') {
      return NextResponse.json({ 
        error: 'Insufficient permissions to assign onboarding resources to other employees' 
      }, { status: 403 });
    }

    // Get target employee details
    const targetEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: { 
        id: true, 
        name: true, 
        role: true, 
        department: true,
        createdAt: true
      }
    });

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check if onboarding is already completed (unless force is true)
    if (!force) {
      const onboardingStatus = await checkEmployeeOnboardingStatus(targetEmployeeId);
      if (onboardingStatus.completed) {
        return NextResponse.json({
          message: 'Onboarding already completed',
          employeeName: targetEmployee.name,
          ...onboardingStatus
        });
      }
    }

    // Assign onboarding resources
    const performedBy = currentUser.id;
    
    const onboardingResults = await assignOnboardingResources(
      targetEmployee.id,
      targetEmployee.name,
      targetEmployee.role,
      targetEmployee.department,
      performedBy
    );

    return NextResponse.json({
      message: 'Onboarding resources assigned successfully',
      employeeId: targetEmployee.id,
      employeeName: targetEmployee.name,
      resourcesAssigned: onboardingResults.assigned,
      resourcesCreated: onboardingResults.created,
      errors: onboardingResults.errors,
      completed: onboardingResults.errors.length === 0,
      requestedBy: currentUser.name,
      force: force
    });

  } catch (error) {
    console.error('Error assigning onboarding resources:', error);
    return NextResponse.json({ 
      error: 'Failed to assign onboarding resources',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}