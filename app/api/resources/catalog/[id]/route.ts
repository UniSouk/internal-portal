import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/resources/catalog/[id] - Get specific resource with full details
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

    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        custodian: {
          select: { id: true, name: true, email: true, department: true }
        },
        items: {
          include: {
            assignments: {
              where: { status: 'ACTIVE' },
              include: {
                employee: {
                  select: { id: true, name: true, email: true, department: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true }
            },
            assignedByUser: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { assignedAt: 'desc' }
        },
        auditLogs: {
          include: {
            changedBy: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { timestamp: 'desc' },
          take: 50
        },
        timeline: {
          include: {
            performer: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { timestamp: 'desc' },
          take: 50
        }
      }
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Calculate availability metrics
    let availability = {
      total: 0,
      assigned: 0,
      available: 0,
      maintenance: 0,
      lost: 0,
      damaged: 0
    };

    if (resource.type === 'PHYSICAL') {
      availability.total = resource.items.length;
      availability.assigned = resource.items.filter(item => item.status === 'ASSIGNED').length;
      availability.available = resource.items.filter(item => item.status === 'AVAILABLE').length;
      availability.maintenance = resource.items.filter(item => item.status === 'MAINTENANCE').length;
      availability.lost = resource.items.filter(item => item.status === 'LOST').length;
      availability.damaged = resource.items.filter(item => item.status === 'DAMAGED').length;
    } else {
      // Software/Cloud - count active assignments as seats
      availability.assigned = resource.assignments.length;
      availability.total = 999; // Unlimited
      availability.available = 999 - availability.assigned;
    }

    return NextResponse.json({
      ...resource,
      availability
    });

  } catch (error) {
    console.error('Error fetching resource details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resource details' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/resources/catalog/[id] - Update resource catalog entry
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
    const { name, category, description, custodianId, status, quantity, metadata } = body;

    // Get current resource for audit trail
    const currentResource = await prisma.resource.findUnique({
      where: { id }
    });

    if (!currentResource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const updatedResource = await prisma.$transaction(async (tx) => {
      // Update resource
      const resource = await tx.resource.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(category && { category }),
          ...(description !== undefined && { description }),
          ...(custodianId && { custodianId }),
          ...(status && { status }),
          ...(quantity !== undefined && { quantity }),
          ...(metadata !== undefined && { metadata })
        },
        include: {
          custodian: {
            select: { id: true, name: true, email: true, department: true }
          }
        }
      });

      // Log changes in audit trail
      const changes = [];
      if (name && name !== currentResource.name) {
        changes.push({ field: 'name', oldValue: currentResource.name, newValue: name });
      }
      if (category && category !== currentResource.category) {
        changes.push({ field: 'category', oldValue: currentResource.category, newValue: category });
      }
      if (description !== undefined && description !== currentResource.description) {
        changes.push({ field: 'description', oldValue: currentResource.description, newValue: description });
      }
      if (custodianId && custodianId !== currentResource.custodianId) {
        changes.push({ field: 'custodianId', oldValue: currentResource.custodianId, newValue: custodianId });
      }
      if (status && status !== currentResource.status) {
        changes.push({ field: 'status', oldValue: currentResource.status, newValue: status });
      }
      if (quantity !== undefined && quantity !== currentResource.quantity) {
        changes.push({ field: 'quantity', oldValue: String(currentResource.quantity), newValue: String(quantity) });
      }
      if (metadata !== undefined && JSON.stringify(metadata) !== JSON.stringify(currentResource.metadata)) {
        changes.push({ field: 'metadata', oldValue: JSON.stringify(currentResource.metadata), newValue: JSON.stringify(metadata) });
      }

      // Create audit logs for each change
      for (const change of changes) {
        await tx.auditLog.create({
          data: {
            entityType: 'RESOURCE',
            entityId: id,
            changedById: user.id,
            fieldChanged: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
            resourceId: id
          }
        });
      }

      // Log activity timeline if there were changes
      if (changes.length > 0) {
        await tx.activityTimeline.create({
          data: {
            entityType: 'RESOURCE',
            entityId: id,
            activityType: 'UPDATED',
            title: `Resource "${resource.name}" updated`,
            description: `Updated ${changes.map(c => c.field).join(', ')}`,
            performedBy: user.id,
            resourceId: id,
            metadata: {
              changes: changes
            }
          }
        });
      }

      return resource;
    });

    return NextResponse.json(updatedResource);

  } catch (error) {
    console.error('Error updating resource:', error);
    return NextResponse.json(
      { error: 'Failed to update resource' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/resources/catalog/[id] - Delete resource (only if no active assignments)
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

    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        assignments: { 
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true }
            }
          }
        },
        items: {
          include: {
            assignments: { where: { status: 'ACTIVE' } }
          }
        }
      }
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Check if resource has active assignments
    const hasActiveAssignments = resource.assignments.length > 0 || 
      resource.items.some(item => item.assignments.length > 0);

    // For Cloud resources, automatically unallocate all assignments before deletion
    // For Physical/Software resources, prevent deletion if there are active assignments
    if (hasActiveAssignments && resource.type !== 'CLOUD') {
      return NextResponse.json(
        { error: 'Cannot delete resource with active assignments. Please return all assignments first.' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // For Cloud resources, unallocate all active assignments first
      if (resource.type === 'CLOUD' && hasActiveAssignments) {
        // Update all active assignments to RETURNED status
        await tx.resourceAssignment.updateMany({
          where: { 
            resourceId: id,
            status: 'ACTIVE'
          },
          data: {
            status: 'RETURNED',
            returnedAt: new Date(),
            notes: 'Automatically unallocated due to resource deletion'
          }
        });

        // Log unallocation activities
        for (const assignment of resource.assignments) {
          await tx.activityTimeline.create({
            data: {
              entityType: 'RESOURCE',
              entityId: id,
              activityType: 'UPDATED',
              title: `Cloud resource unallocated from ${assignment.employee.name}`,
              description: `Cloud seat automatically unallocated due to resource deletion`,
              performedBy: user.id,
              resourceId: id,
              assignmentId: assignment.id,
              employeeId: assignment.employeeId,
              metadata: {
                reason: 'resource_deletion',
                employeeName: assignment.employee.name,
                unallocatedBy: user.name
              }
            }
          });
        }
      }

      // Delete all related records in the correct order to avoid foreign key constraints
      
      // 1. Delete resource assignments (including audit logs and timeline for assignments)
      const assignmentIds = await tx.resourceAssignment.findMany({
        where: { resourceId: id },
        select: { id: true }
      });
      
      for (const assignment of assignmentIds) {
        await tx.auditLog.deleteMany({
          where: { assignmentId: assignment.id }
        });
        await tx.activityTimeline.deleteMany({
          where: { assignmentId: assignment.id }
        });
      }
      
      await tx.resourceAssignment.deleteMany({
        where: { resourceId: id }
      });

      // 2. Delete resource items (and their assignments)
      const itemIds = await tx.resourceItem.findMany({
        where: { resourceId: id },
        select: { id: true }
      });
      
      for (const item of itemIds) {
        await tx.resourceAssignment.deleteMany({
          where: { itemId: item.id }
        });
      }
      
      await tx.resourceItem.deleteMany({
        where: { resourceId: id }
      });

      // 3. Delete resource maintenance records
      await tx.resourceMaintenance.deleteMany({
        where: { resourceId: id }
      });

      // 4. Delete access requests related to this resource
      await tx.access.deleteMany({
        where: { resourceId: id }
      });

      // 5. Delete software updates
      await tx.softwareUpdate.deleteMany({
        where: { resourceId: id }
      });

      // 6. Delete approval workflows
      await tx.approvalWorkflow.deleteMany({
        where: { resourceId: id }
      });

      // 7. Delete audit logs related to this resource
      await tx.auditLog.deleteMany({
        where: { resourceId: id }
      });

      // 8. Delete activity timeline related to this resource
      await tx.activityTimeline.deleteMany({
        where: { resourceId: id }
      });

      // 9. Finally, delete the resource itself
      await tx.resource.delete({
        where: { id }
      });

      // 10. Log final audit trail (create new audit log after deletion)
      await tx.auditLog.create({
        data: {
          entityType: 'RESOURCE',
          entityId: id,
          changedById: user.id,
          fieldChanged: 'deleted',
          oldValue: JSON.stringify({
            name: resource.name,
            type: resource.type,
            category: resource.category,
            hadActiveAssignments: hasActiveAssignments
          })
        }
      });

      // 11. Log final activity timeline
      await tx.activityTimeline.create({
        data: {
          entityType: 'RESOURCE',
          entityId: id,
          activityType: 'DELETED',
          title: `Resource "${resource.name}" deleted`,
          description: resource.type === 'CLOUD' && hasActiveAssignments 
            ? `${resource.type} resource permanently removed from catalog (${resource.assignments.length} allocations automatically unallocated)`
            : `${resource.type} resource permanently removed from catalog`,
          performedBy: user.id,
          metadata: {
            resourceType: resource.type,
            category: resource.category,
            unallocatedAssignments: resource.type === 'CLOUD' ? resource.assignments.length : 0
          }
        }
      });
    });

    return NextResponse.json({ 
      message: resource.type === 'CLOUD' && hasActiveAssignments 
        ? `Cloud resource deleted successfully. ${resource.assignments.length} allocation(s) were automatically unallocated.`
        : 'Resource deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting resource:', error);
    return NextResponse.json(
      { error: 'Failed to delete resource' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}