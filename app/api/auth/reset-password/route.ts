import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only CEO and CTO can reset passwords
    if (currentUser.role !== 'CEO' && currentUser.role !== 'CTO') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only CEO and CTO can reset passwords.' },
        { status: 403 }
      );
    }

    const { employeeId, newPassword } = await request.json();

    if (!employeeId || !newPassword) {
      return NextResponse.json(
        { error: 'Employee ID and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, email: true }
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update the employee's password
    await prisma.employee.update({
      where: { id: employeeId },
      data: { password: hashedPassword }
    });

    // Log the password reset for audit purposes
    await prisma.auditLog.create({
      data: {
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        fieldChanged: 'password_reset_by_admin',
        oldValue: null,
        newValue: JSON.stringify({ 
          resetBy: currentUser.name,
          resetByRole: currentUser.role,
          resetAt: new Date().toISOString(),
          message: 'Password reset by administrator'
        }),
        changedById: currentUser.id
      }
    });

    return NextResponse.json({
      message: 'Password reset successfully',
      employeeName: employee.name
    });

  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}