import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/resources/items - List resource items (hardware and software)
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
    const resourceId = searchParams.get('resourceId');
    const status = searchParams.get('status') as 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'LOST' | 'DAMAGED' | null;
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (resourceId) where.resourceId = resourceId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { hostname: { contains: search, mode: 'insensitive' } },
        { licenseKey: { contains: search, mode: 'insensitive' } },
        { softwareVersion: { contains: search, mode: 'insensitive' } },
        { resource: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [items, totalCount] = await Promise.all([
      prisma.resourceItem.findMany({
        where,
        skip,
        take: limit,
        include: {
          resource: {
            select: { id: true, name: true, type: true, category: true }
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
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.resourceItem.count({ where })
    ]);

    return NextResponse.json({
      items,
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
    console.error('Error fetching resource items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resource items' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/resources/items - Create new resource item (hardware and software)
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

    // Check permissions
    if (!['CEO', 'CTO', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      resourceId,
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
      licenseExpiry,
      value,
      metadata,
      // Software-specific fields
      licenseKey,
      softwareVersion,
      licenseType,
      maxUsers,
      activationCode
    } = body;

    // Validate required fields
    if (!resourceId) {
      return NextResponse.json(
        { error: 'Missing required field: resourceId' },
        { status: 400 }
      );
    }

    // Validate resource exists and is PHYSICAL or SOFTWARE type
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId }
    });

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    if (!['PHYSICAL', 'SOFTWARE'].includes(resource.type)) {
      return NextResponse.json(
        { error: 'Items can only be created for PHYSICAL and SOFTWARE resources' },
        { status: 400 }
      );
    }

    // Check for duplicate serial number if provided
    if (serialNumber) {
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

    const item = await prisma.$transaction(async (tx) => {
      // Create resource item
      const newItem = await tx.resourceItem.create({
        data: {
          resourceId,
          // Common fields
          serialNumber,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
          warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
          value: value ? parseFloat(value) : null,
          metadata: metadata || null,
          status: 'AVAILABLE',
          
          // Hardware-specific fields (only for PHYSICAL resources)
          ...(resource.type === 'PHYSICAL' && {
            hostname,
            ipAddress,
            macAddress,
            operatingSystem,
            osVersion,
            processor,
            memory,
            storage
          }),
          
          // Software-specific fields (only for SOFTWARE resources)
          ...(resource.type === 'SOFTWARE' && {
            licenseKey,
            softwareVersion,
            licenseType,
            maxUsers,
            activationCode,
            licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null
          })
        },
        include: {
          resource: {
            select: { id: true, name: true, type: true, category: true }
          }
        }
      });

      // Log audit trail
      await tx.auditLog.create({
        data: {
          entityType: 'RESOURCE',
          entityId: resourceId,
          changedById: user.id,
          fieldChanged: 'item_created',
          newValue: JSON.stringify({
            itemId: newItem.id,
            serialNumber,
            hostname
          }),
          resourceId
        }
      });

      // Log activity timeline
      await tx.activityTimeline.create({
        data: {
          entityType: 'RESOURCE',
          entityId: resourceId,
          activityType: 'CREATED',
          title: `New ${resource.name} item added`,
          description: `Hardware item ${serialNumber || hostname || 'without serial'} added to inventory`,
          performedBy: user.id,
          resourceId,
          metadata: {
            itemId: newItem.id,
            serialNumber,
            hostname,
            customMetadata: metadata,
            specifications: {
              operatingSystem,
              processor,
              memory,
              storage
            }
          }
        }
      });

      return newItem;
    });

    return NextResponse.json(item, { status: 201 });

  } catch (error) {
    console.error('Error creating resource item:', error);
    return NextResponse.json(
      { error: 'Failed to create resource item' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}