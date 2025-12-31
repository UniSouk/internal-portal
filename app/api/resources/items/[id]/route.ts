import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/resources/items/[id] - Get specific resource item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const item = await prisma.resourceItem.findUnique({
      where: { id },
      include: {
        resource: {
          select: { id: true, name: true, type: true, category: true, description: true }
        },
        assignments: {
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true }
            },
            assignedByUser: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { assignedAt: 'desc' }
        }
      }
    });

    if (!item) {
      return NextResponse.json({ error: 'Resource item not found' }, { status: 404 });
    }

    return NextResponse.json(item);

  } catch (error) {
    console.error('Error fetching resource item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resource item' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/resources/items/[id] - Update resource item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (!['CEO', 'CTO', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      serialNumber,
      hostname,
      ipAddress,
      macAddress,
      operatingSystem,
      osVersion,
      processor,
      memory,
      storage,
      purchaseDate,
      warrantyExpiry,
      value,
      status
    } = body;

    // Get current item for audit trail
    const currentItem = await prisma.resourceItem.findUnique({
      where: { id },
      include: { resource: true }
    });

    if (!currentItem) {
      return NextResponse.json({ error: 'Resource item not found' }, { status: 404 });
    }

    // Check for duplicate serial number if changing
    if (serialNumber && serialNumber !== currentItem.serialNumber) {
      const existingItem = await prisma.resourceItem.findUnique({
        where: { serialNumber }
      });

      if (existingItem) {
        return NextResponse.json(
          { error: 'Serial number already exists' },
          { status: 400 }
        );
      }
    }

    const updatedItem = await prisma.$transaction(async (tx) => {
      // Update item
      const item = await tx.resourceItem.update({
        where: { id },
        data: {
          ...(serialNumber !== undefined && { serialNumber }),
          ...(hostname !== undefined && { hostname }),
          ...(ipAddress !== undefined && { ipAddress }),
          ...(macAddress !== undefined && { macAddress }),
          ...(operatingSystem !== undefined && { operatingSystem }),
          ...(osVersion !== undefined && { osVersion }),
          ...(processor !== undefined && { processor }),
          ...(memory !== undefined && { memory }),
          ...(storage !== undefined && { storage }),
          ...(purchaseDate !== undefined && { purchaseDate: purchaseDate ? new Date(purchaseDate) : null }),
          ...(warrantyExpiry !== undefined && { warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null }),
          ...(value !== undefined && { value: value ? parseFloat(value) : null }),
          ...(status && { status })
        },
        include: {
          resource: {
            select: { id: true, name: true, type: true, category: true }
          }
        }
      });

      // Log changes in audit trail
      const changes = [];
      if (serialNumber !== undefined && serialNumber !== currentItem.serialNumber) {
        changes.push({ field: 'serialNumber', oldValue: currentItem.serialNumber, newValue: serialNumber });
      }
      if (hostname !== undefined && hostname !== currentItem.hostname) {
        changes.push({ field: 'hostname', oldValue: currentItem.hostname, newValue: hostname });
      }
      if (status && status !== currentItem.status) {
        changes.push({ field: 'status', oldValue: currentItem.status, newValue: status });
      }
      // Add other field comparisons as needed...

      // Create audit logs for each change
      for (const change of changes) {
        await tx.auditLog.create({
          data: {
            entityType: 'RESOURCE',
            entityId: currentItem.resourceId,
            changedById: user.id,
            fieldChanged: `item_${change.field}`,
            oldValue: change.oldValue,
            newValue: change.newValue,
            resourceId: currentItem.resourceId
          }
        });
      }

      // Log activity timeline if there were changes
      if (changes.length > 0) {
        await tx.activityTimeline.create({
          data: {
            entityType: 'RESOURCE',
            entityId: currentItem.resourceId,
            activityType: 'UPDATED',
            title: `${currentItem.resource.name} item updated`,
            description: `Hardware item ${currentItem.serialNumber || currentItem.hostname || id} updated`,
            performedBy: user.id,
            resourceId: currentItem.resourceId,
            metadata: {
              itemId: id,
              changes: changes
            }
          }
        });
      }

      return item;
    });

    return NextResponse.json(updatedItem);

  } catch (error) {
    console.error('Error updating resource item:', error);
    return NextResponse.json(
      { error: 'Failed to update resource item' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/resources/items/[id] - Delete resource item (only if not assigned)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (!['CEO', 'CTO'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const item = await prisma.resourceItem.findUnique({
      where: { id },
      include: {
        resource: true,
        assignments: { where: { status: 'ACTIVE' } }
      }
    });

    if (!item) {
      return NextResponse.json({ error: 'Resource item not found' }, { status: 404 });
    }

    // Check if item has active assignments
    if (item.assignments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete item with active assignments' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Delete the item
      await tx.resourceItem.delete({
        where: { id }
      });

      // Log audit trail
      await tx.auditLog.create({
        data: {
          entityType: 'RESOURCE',
          entityId: item.resourceId,
          changedById: user.id,
          fieldChanged: 'item_deleted',
          oldValue: JSON.stringify({
            itemId: id,
            serialNumber: item.serialNumber,
            hostname: item.hostname
          }),
          resourceId: item.resourceId
        }
      });

      // Log activity timeline
      await tx.activityTimeline.create({
        data: {
          entityType: 'RESOURCE',
          entityId: item.resourceId,
          activityType: 'DELETED',
          title: `${item.resource.name} item removed`,
          description: `Hardware item ${item.serialNumber || item.hostname || id} removed from inventory`,
          performedBy: user.id,
          resourceId: item.resourceId,
          metadata: {
            itemId: id,
            serialNumber: item.serialNumber,
            hostname: item.hostname
          }
        }
      });
    });

    return NextResponse.json({ message: 'Resource item deleted successfully' });

  } catch (error) {
    console.error('Error deleting resource item:', error);
    return NextResponse.json(
      { error: 'Failed to delete resource item' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}