import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, generateToken } from '@/lib/auth';
import { logTimelineActivity } from '@/lib/timeline';
import { checkEmployeeOnboardingStatus, assignOnboardingResources } from '@/lib/onboardingResources';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await authenticateUser(email, password);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const token = generateToken(user);

    // Log successful login
    try {
      await logTimelineActivity({
        entityType: 'EMPLOYEE',
        entityId: user.id,
        activityType: 'EMPLOYEE_LOGIN',
        title: 'User logged in',
        description: `${user.name} logged into the system`,
        metadata: {
          loginTime: new Date().toISOString(),
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        },
        performedBy: user.id,
        employeeId: user.id
      });
    } catch (logError) {
      console.error('Failed to log login activity:', logError);
    }

    // Check and assign onboarding resources if needed
    let onboardingInfo = null;
    try {
      const onboardingStatus = await checkEmployeeOnboardingStatus(user.id);
      
      if (!onboardingStatus.completed) {
        
        const ceoUser = await prisma.employee.findFirst({
          where: { role: 'CEO' },
          select: { id: true }
        });
        
        const performedBy = ceoUser?.id || user.id; // Fallback to user themselves if CEO not found
        
        const onboardingResults = await assignOnboardingResources(
          user.id,
          user.name,
          user.role,
          user.department,
          performedBy
        );

        onboardingInfo = {
          wasIncomplete: true,
          resourcesAssigned: onboardingResults.assigned,
          resourcesCreated: onboardingResults.created,
          errors: onboardingResults.errors,
          completed: onboardingResults.errors.length === 0
        };

      } else {
        onboardingInfo = {
          wasIncomplete: false,
          alreadyCompleted: true
        };
      }
    } catch (onboardingError) {
      console.error('Failed to check/assign onboarding resources on login:', onboardingError);
      onboardingInfo = {
        wasIncomplete: true,
        error: onboardingError instanceof Error ? onboardingError.message : 'Onboarding check failed'
      };
    }

    // Set HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department
      },
      onboarding: onboardingInfo
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}