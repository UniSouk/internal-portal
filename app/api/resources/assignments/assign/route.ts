import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';

const prisma = new PrismaClient();

// POST /api/resources/assignments/assign - Create resource assignment (after approval)
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

    // Check permissions - only managers and above can assign resources
    if (!['CEO', 'CTO', 'ADMIN', 'ENGINEERING_MANAGER', 'HR_MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, resourceId, itemId, notes, approvalWorkflowId } = body;

    // Validate required fields
    if (!employeeId || !resourceId) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeId, resourceId' },
        { status: 400 }
      );
    }

    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, email: true, department: true }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Validate resource exists
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        items: {
          where: { status: 'AVAILABLE' },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    if (resource.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Resource is not active' }, { status: 400 });
    }

    // For PHYSICAL and SOFTWARE resources, validate item availability
    let selectedItem = null;
    if (resource.type === 'PHYSICAL' || resource.type === 'SOFTWARE') {
      if (itemId) {
        // Specific item requested
        selectedItem = await prisma.resourceItem.findFirst({
          where: {
            id: itemId,
            resourceId,
            status: 'AVAILABLE'
          }
        });

        if (!selectedItem) {
          return NextResponse.json(
            { error: `Requested ${resource.type === 'SOFTWARE' ? 'license' : 'item'} is not available` },
            { status: 400 }
          );
        }
      } else {
        // Auto-select first available item
        selectedItem = resource.items[0];
        if (!selectedItem) {
          return NextResponse.json(
            { error: `No available ${resource.type === 'SOFTWARE' ? 'licenses' : 'items'} for this resource` },
            { status: 400 }
          );
        }
      }
    }

    // Check for existing active assignment
    const existingAssignment = await prisma.resourceAssignment.findFirst({
      where: {
        employeeId,
        resourceId,
        status: 'ACTIVE',
        ...(selectedItem && { itemId: selectedItem.id })
      }
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Employee already has an active assignment for this resource' },
        { status: 400 }
      );
    }

    // Create assignment with transaction
    const assignment = await prisma.$transaction(async (tx) => {
      // Create the assignment
      const newAssignment = await tx.resourceAssignment.create({
        data: {
          employeeId,
          resourceId,
          itemId: selectedItem?.id,
          assignedBy: user.id,
          status: 'ACTIVE',
          notes
        },
        include: {
          employee: {
            select: { id: true, name: true, email: true, department: true }
          },
          resource: {
            select: { id: true, name: true, type: true, category: true }
          },
          item: {
            select: { 
              id: true, 
              serialNumber: true, 
              hostname: true,
              licenseKey: true,
              softwareVersion: true,
              licenseType: true
            }
          },
          assignedByUser: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Update item status if physical or software resource
      if (selectedItem) {
        await tx.resourceItem.update({
          where: { id: selectedItem.id },
          data: { status: 'ASSIGNED' }
        });
      }

      // Update approval workflow status if provided
      if (approvalWorkflowId) {
        await tx.approvalWorkflow.update({
          where: { id: approvalWorkflowId },
          data: { 
            status: 'APPROVED',
            comments: `Assignment created for ${employee.name}`
          }
        });
      }

      // Log audit trail
      await tx.auditLog.create({
        data: {
          entityType: 'RESOURCE',
          entityId: resourceId,
          changedById: user.id,
          fieldChanged: 'assigned',
          newValue: JSON.stringify({
            assignmentId: newAssignment.id,
            employeeId,
            employeeName: employee.name,
            itemId: selectedItem?.id,
            serialNumber: selectedItem?.serialNumber,
            licenseKey: selectedItem?.licenseKey,
            softwareVersion: selectedItem?.softwareVersion
          }),
          resourceId,
          assignmentId: newAssignment.id
        }
      });

      // Log activity timeline
      await tx.activityTimeline.create({
        data: {
          entityType: 'RESOURCE',
          entityId: resourceId,
          activityType: 'ASSIGNED',
          title: `${resource.name} assigned to ${employee.name}`,
          description: selectedItem 
            ? `${resource.type === 'SOFTWARE' ? 'License' : 'Hardware item'} ${selectedItem.licenseKey || selectedItem.serialNumber || selectedItem.hostname || selectedItem.id} assigned`
            : `${resource.type === 'CLOUD' ? 'Cloud' : 'Software'} seat assigned`,
          performedBy: user.id,
          resourceId,
          assignmentId: newAssignment.id,
          employeeId,
          metadata: {
            assignmentId: newAssignment.id,
            employeeName: employee.name,
            employeeDepartment: employee.department,
            itemDetails: selectedItem ? {
              serialNumber: selectedItem.serialNumber,
              hostname: selectedItem.hostname
            } : null,
            notes
          }
        }
      });

      return newAssignment;
    });

    return NextResponse.json(assignment, { status: 201 });

  } catch (error) {
    console.error('Error creating resource assignment:', error);
    return NextResponse.json(
      { error: 'Failed to create resource assignment' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}