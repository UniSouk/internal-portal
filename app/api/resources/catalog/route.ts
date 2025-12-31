import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/resources/catalog - List all resource catalog entries
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
    const status = searchParams.get('status') as 'ACTIVE' | 'RETURNED' | 'LOST' | 'DAMAGED' | null;
    const search = searchParams.get('search');
    const assignedTo = searchParams.get('assignedTo'); // Employee filter

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (type) where.type = type;
    if (category) where.category = category;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Employee filter - only for CEO/CTO users
    if (assignedTo && ['CEO', 'CTO'].includes(user.role)) {
      where.assignments = {
        some: {
          employeeId: assignedTo,
          status: 'ACTIVE'
        }
      };
    }
    // For regular employees, only show resources assigned to them (unless CEO/CTO is filtering by employee)
    else if (!['CEO', 'CTO', 'ADMIN'].includes(user.role)) {
      where.assignments = {
        some: {
          employeeId: user.id,
          status: 'ACTIVE'
        }
      };
    }

    const [resources, totalCount] = await Promise.all([
      prisma.resource.findMany({
        where,
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
      }),
      prisma.resource.count({ where })
    ]);

    // Calculate availability for each resource
    const resourcesWithAvailability = resources.map(resource => ({
      ...resource,
      availability: {
        total: resource.type === 'CLOUD' ? (resource.quantity || 1) : 1,
        assigned: resource.assignments.length,
        available: resource.type === 'CLOUD' ? Math.max(0, (resource.quantity || 1) - resource.assignments.length) : (resource.assignments.length > 0 ? 0 : 1)
      }
    }));

    return NextResponse.json({
      resources: resourcesWithAvailability,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching resource catalog:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resource catalog' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/resources/catalog - Create new resource catalog entry
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

    // Check if user has permission to create resources (CEO, CTO, or Admin)
    if (!['CEO', 'CTO', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { name, type, category, description, custodianId, quantity, metadata } = body;

    // Validate required fields
    if (!name || !type || !custodianId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, custodianId' },
        { status: 400 }
      );
    }

    // Validate quantity for Cloud resources
    if (type === 'CLOUD' && (!quantity || quantity < 1)) {
      return NextResponse.json(
        { error: 'Quantity is required for Cloud resources and must be at least 1' },
        { status: 400 }
      );
    }

    // Validate custodian exists
    const custodian = await prisma.employee.findUnique({
      where: { id: custodianId }
    });

    if (!custodian) {
      return NextResponse.json({ error: 'Invalid custodian ID' }, { status: 400 });
    }

    const resource = await prisma.$transaction(async (tx) => {
      // Create resource
      const newResource = await tx.resource.create({
        data: {
          name,
          type,
          category,
          description,
          custodianId,
          status: 'ACTIVE',
          quantity: type === 'CLOUD' ? quantity : null,
          metadata: (type === 'SOFTWARE' || type === 'CLOUD') && metadata ? metadata : null
        },
        include: {
          custodian: {
            select: { id: true, name: true, email: true, department: true }
          }
        }
      });

      // Log audit trail
      await tx.auditLog.create({
        data: {
          entityType: 'RESOURCE',
          entityId: newResource.id,
          changedById: user.id,
          fieldChanged: 'created',
          newValue: JSON.stringify({
            name,
            type,
            category,
            description,
            custodianId,
            quantity: type === 'CLOUD' ? quantity : null,
            metadata: (type === 'SOFTWARE' || type === 'CLOUD') && metadata ? metadata : null
          }),
          resourceId: newResource.id
        }
      });

      // Log activity timeline
      await tx.activityTimeline.create({
        data: {
          entityType: 'RESOURCE',
          entityId: newResource.id,
          activityType: 'CREATED',
          title: `Resource "${name}" created`,
          description: `New ${type.toLowerCase()} resource created in ${category || 'general'} category`,
          performedBy: user.id,
          resourceId: newResource.id,
          metadata: {
            resourceType: type,
            category,
            custodian: custodian.name,
            quantity: type === 'CLOUD' ? quantity : null,
            hasMetadata: (type === 'SOFTWARE' || type === 'CLOUD') && metadata ? Object.keys(metadata).length : 0
          }
        }
      });

      return newResource;
    });

    return NextResponse.json(resource, { status: 201 });

  } catch (error) {
    console.error('Error creating resource:', error);
    return NextResponse.json(
      { error: 'Failed to create resource' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}