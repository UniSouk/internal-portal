import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';
import { logTimelineActivity } from '@/lib/timeline';

const prisma = new PrismaClient();

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') as 'PHYSICAL' | 'SOFTWARE' | 'CLOUD' | null;
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const assignedTo = searchParams.get('assignedTo');
    const forAccessRequest = searchParams.get('forAccessRequest') === 'true';

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {};
    if (type) whereClause.type = type;
    if (category) whereClause.category = category;
    if (status) whereClause.status = status;
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Filter by assigned employee if specified
    if (assignedTo) {
      whereClause.assignments = {
        some: {
          employeeId: assignedTo,
          status: 'ACTIVE'
        }
      };
    }

    // For regular employees, only show resources assigned to them (EXCEPT for access requests)
    if (!['CEO', 'CTO', 'ADMIN'].includes(user.role) && !forAccessRequest) {
      whereClause.assignments = {
        some: {
          employeeId: user.id,
          status: 'ACTIVE'
        }
      };
    }

    const totalResources = await prisma.resource.count({ where: whereClause });

    const resources = await prisma.resource.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        custodian: {
          select: { id: true, name: true, email: true, department: true }
        },
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Add basic availability info
    const resourcesWithInfo = resources.map((resource: any) => ({
      ...resource,
      assignedCount: resource.assignments.length,
      isAssigned: resource.assignments.length > 0
    }));

    return NextResponse.json({
      resources: resourcesWithInfo,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalResources / limit),
        totalItems: totalResources,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalResources / limit),
        hasPreviousPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch resources' 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getUserFromToken(token);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to create resources
    if (!['CEO', 'CTO', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to create resources' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { name, type, category, description, custodianId } = body;

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, type' 
      }, { status: 400 });
    }

    // Get CEO as default custodian if not specified
    let finalCustodianId = custodianId;
    if (!finalCustodianId) {
      const ceo = await prisma.employee.findFirst({
        where: { role: 'CEO' },
        select: { id: true }
      });
      
      if (!ceo) {
        return NextResponse.json({ 
          error: 'No CEO found to assign as custodian' 
        }, { status: 500 });
      }
      
      finalCustodianId = ceo.id;
    }

    // Create resource
    const resource = await prisma.resource.create({
      data: {
        name,
        type,
        category: category || null,
        description: description || null,
        owner: 'Unisouk',
        custodianId: finalCustodianId,
        status: 'ACTIVE'
      },
      include: {
        custodian: {
          select: { id: true, name: true, email: true, department: true }
        }
      }
    });

    // Log resource creation activity
    await logTimelineActivity({
      entityType: 'RESOURCE',
      entityId: resource.id,
      activityType: 'CREATED',
      title: `Resource created: ${resource.name}`,
      description: `${resource.name} (${resource.type}) was created by ${currentUser.name}`,
      performedBy: currentUser.id,
      metadata: {
        resourceName: resource.name,
        resourceType: resource.type,
        category: resource.category,
        owner: resource.owner,
        custodian: resource.custodian.name,
        createdBy: currentUser.name,
        createdById: currentUser.id
      },
      resourceId: resource.id
    });

    return NextResponse.json({
      success: true,
      message: `Resource "${resource.name}" created successfully`,
      resource: {
        ...resource,
        assignedCount: 0,
        isAssigned: false
      }
    });

  } catch (error) {
    console.error('Error creating resource:', error);
    return NextResponse.json({ 
      error: 'Failed to create resource' 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getUserFromToken(token);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to update resources
    if (!['CEO', 'CTO', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to update resources' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, type, category, description, custodianId, status } = body;

    if (!id) {
      return NextResponse.json({ 
        error: 'Missing required field: id' 
      }, { status: 400 });
    }

    // Get existing resource
    const existingResource = await prisma.resource.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    if (!existingResource) {
      return NextResponse.json({ 
        error: 'Resource not found' 
      }, { status: 404 });
    }

    // Update resource
    const updatedResource = await prisma.resource.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(custodianId && { custodianId }),
        ...(status && { status })
      },
      include: {
        custodian: {
          select: { id: true, name: true, email: true, department: true }
        },
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true }
            }
          }
        }
      }
    });

    // Log update activity
    await logTimelineActivity({
      entityType: 'RESOURCE',
      entityId: id,
      activityType: 'UPDATED',
      title: `Resource updated: ${updatedResource.name}`,
      description: `${updatedResource.name} was updated by ${currentUser.name}`,
      performedBy: currentUser.id,
      metadata: {
        resourceName: updatedResource.name,
        resourceType: updatedResource.type,
        updatedBy: currentUser.name,
        updatedById: currentUser.id
      },
      resourceId: id
    });

    return NextResponse.json({
      success: true,
      message: `Resource "${updatedResource.name}" updated successfully`,
      resource: {
        ...updatedResource,
        assignedCount: updatedResource.assignments.length,
        isAssigned: updatedResource.assignments.length > 0
      }
    });

  } catch (error) {
    console.error('Error updating resource:', error);
    return NextResponse.json({ 
      error: 'Failed to update resource' 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}