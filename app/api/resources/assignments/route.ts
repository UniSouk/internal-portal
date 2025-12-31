import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resourceId, employeeId, itemId, notes } = body;

    // Validate required fields
    if (!resourceId || !employeeId) {
      return NextResponse.json({ 
        error: 'Missing required fields: resourceId, employeeId' 
      }, { status: 400 });
    }

    // Get resource details
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        assignments: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Get employee details
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check if resource is active
    if (resource.status !== 'ACTIVE') {
      return NextResponse.json({ 
        error: 'Resource is not available for assignment' 
      }, { status: 400 });
    }

    // Check if employee already has this resource assigned
    const existingAssignment = resource.assignments.find(a => a.employeeId === employeeId);
    if (existingAssignment) {
      return NextResponse.json({ 
        error: 'Employee already has this resource assigned' 
      }, { status: 400 });
    }

    // Create new assignment
    const assignment = await prisma.resourceAssignment.create({
      data: {
        resourceId,
        employeeId,
        ...(itemId && { itemId }),
        assignedBy: user.id,
        status: 'ACTIVE',
        notes: notes || `Assigned by ${user.name}`
      }
    });

    // If assigning a physical item, update its status
    if (itemId) {
      await prisma.resourceItem.update({
        where: { id: itemId },
        data: { status: 'ASSIGNED' }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Resource assigned successfully',
      assignment
    });

  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json({ 
      error: 'Failed to create assignment' 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resourceId');
    const employeeId = searchParams.get('employeeId');

    const where: any = {};
    if (resourceId) where.resourceId = resourceId;
    if (employeeId) where.employeeId = employeeId;

    const assignments = await prisma.resourceAssignment.findMany({
      where,
      include: {
        resource: {
          select: { id: true, name: true, type: true, category: true }
        },
        employee: {
          select: { id: true, name: true, email: true, department: true }
        },
        item: {
          select: { id: true, serialNumber: true, hostname: true, status: true }
        }
      },
      orderBy: { assignedAt: 'desc' }
    });

    return NextResponse.json({ assignments });

  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch assignments' 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}