import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';
import { trackEntityUpdate } from '@/lib/changeTracker';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        status: true,
        phone: true,
        joiningDate: true,
        manager: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        createdAt: true,
        updatedAt: true
      }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json(employee);

  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user is updating their own profile or has admin permissions
    if (currentUser.id !== id && !['CEO', 'CTO', 'HR_MANAGER', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Not authorized to update this employee' }, { status: 403 });
    }

    // Get current employee data for change tracking
    const currentEmployee = await prisma.employee.findUnique({
      where: { id },
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