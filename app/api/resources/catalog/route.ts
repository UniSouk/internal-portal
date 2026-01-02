import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth';

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
          },
          resourceTypeEntity: {
            select: { id: true, name: true }
          },
          resourceCategory: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.resource.count({ where })
    ]);

    // Calculate availability for each resource
    const resourcesWithAvailability = resources.map(resource => {
      // For SHARED allocation, use quantity (-1 means unlimited)
      // For EXCLUSIVE allocation, availability is based on items
      const isShared = resource.allocationType === 'SHARED';
      const quantity = resource.quantity ?? -1;
      const isUnlimited = quantity === -1 || quantity === null;
      
      return {
        ...resource,
        availability: {
          total: isShared ? (isUnlimited ? -1 : quantity) : 1,
          assigned: resource.assignments.length,
          available: isShared 
            ? (isUnlimited ? -1 : Math.max(0, quantity - resource.assignments.length))
            : (resource.assignments.length > 0 ? 0 : 1),
          isUnlimited: isShared && isUnlimited
        }
      };
    });

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
    const { 
      name, 
      type, 
      category, 
      description, 
      custodianId, 
      quantity, 
      metadata,
      allocationType,
      // New fields for enhanced resource structure
      resourceTypeId,
      resourceCategoryId,
      selectedProperties
    } = body;

    // Determine if this is a new-style request (with resourceTypeId) or legacy request
    const isEnhancedRequest = !!resourceTypeId;

    if (isEnhancedRequest) {
      // Enhanced resource creation with property schema
      if (!name) {
        return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
      }

      if (!custodianId) {
        return NextResponse.json({ error: 'Missing required field: custodianId' }, { status: 400 });
      }

      // Validate resource type exists
      const resourceType = await prisma.resourceTypeEntity.findUnique({
        where: { id: resourceTypeId }
      });

      if (!resourceType) {
        return NextResponse.json({ error: 'Invalid resource type ID' }, { status: 400 });
      }

      // Category is mandatory for EXCLUSIVE allocation, optional for SHARED
      const isSharedAllocation = allocationType === 'SHARED';
      
      if (!isSharedAllocation && !resourceCategoryId) {
        return NextResponse.json({ error: 'Resource category is required for exclusive allocation resources' }, { status: 400 });
      }

      // Validate category exists and belongs to the selected type (if provided)
      let resourceCategory = null;
      if (resourceCategoryId) {
        resourceCategory = await prisma.resourceCategoryEntity.findUnique({
          where: { id: resourceCategoryId }
        });

        if (!resourceCategory) {
          return NextResponse.json({ error: 'Invalid resource category ID' }, { status: 400 });
        }

        if (resourceCategory.resourceTypeId !== resourceTypeId) {
          return NextResponse.json({ error: 'Category does not belong to the selected resource type' }, { status: 400 });
        }
      }

      // Validate custodian exists
      const custodian = await prisma.employee.findUnique({
        where: { id: custodianId }
      });

      if (!custodian) {
        return NextResponse.json({ error: 'Invalid custodian ID' }, { status: 400 });
      }

      // Validate property schema
      if (!selectedProperties || selectedProperties.length === 0) {
        return NextResponse.json({ error: 'At least one property must be selected for the resource' }, { status: 400 });
      }

      // Map resource type name to legacy type enum
      const legacyTypeMap: Record<string, 'PHYSICAL' | 'SOFTWARE' | 'CLOUD'> = {
        'Hardware': 'PHYSICAL',
        'Software': 'SOFTWARE',
        'Cloud': 'CLOUD',
      };
      const legacyType = legacyTypeMap[resourceType.name] || 'PHYSICAL';

      const resource = await prisma.$transaction(async (tx: any) => {
        // Create resource with property schema
        const newResource = await tx.resource.create({
          data: {
            name,
            type: legacyType,
            category: null, // Legacy field, use resourceCategoryId instead
            description: description || null,
            owner: 'Unisouk',
            custodianId,
            status: 'ACTIVE',
            quantity: allocationType === 'SHARED' ? (quantity ?? -1) : null,
            allocationType: allocationType || 'EXCLUSIVE',
            metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
            resourceTypeId,
            resourceCategoryId: resourceCategoryId || null,
            propertySchema: JSON.parse(JSON.stringify(selectedProperties)),
            schemaLocked: false
          },
          include: {
            custodian: {
              select: { id: true, name: true, email: true, department: true }
            },
            resourceTypeEntity: true,
            resourceCategory: true
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
              type: legacyType,
              resourceTypeId,
              resourceCategoryId: resourceCategoryId || null,
              allocationType: allocationType || 'EXCLUSIVE',
              quantity: allocationType === 'SHARED' ? (quantity ?? -1) : null,
              propertySchemaCount: selectedProperties.length
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
            description: `New ${resourceType.name} resource created${resourceCategory ? ` in ${resourceCategory.name} category` : ''} with ${selectedProperties.length} properties (${allocationType || 'EXCLUSIVE'} allocation)`,
            performedBy: user.id,
            resourceId: newResource.id,
            metadata: {
              resourceType: resourceType.name,
              resourceTypeId,
              resourceCategoryId: resourceCategoryId || null,
              categoryName: resourceCategory?.name || null,
              custodian: custodian.name,
              allocationType: allocationType || 'EXCLUSIVE',
              quantity: allocationType === 'SHARED' ? (quantity ?? -1) : null,
              propertyCount: selectedProperties.length,
              propertyKeys: selectedProperties.map((p: any) => p.key)
            }
          }
        });

        return newResource;
      });

      return NextResponse.json({
        ...resource,
        propertySchema: selectedProperties,
        resourceTypeName: resourceType.name,
        resourceCategoryName: resourceCategory?.name || null,
        allocationType: allocationType || 'EXCLUSIVE'
      }, { status: 201 });

    } else {
      // Legacy resource creation (backward compatibility)
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

      const resource = await prisma.$transaction(async (tx: any) => {
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
            metadata: (type === 'SOFTWARE' || type === 'CLOUD') && metadata ? metadata : null,
            propertySchema: [],
            schemaLocked: false
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
    }

  } catch (error) {
    console.error('Error creating resource:', error);
    return NextResponse.json(
      { error: 'Failed to create resource' },
      { status: 500 }
    );
  }
}