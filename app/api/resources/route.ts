import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { logCreatedActivity, logTimelineActivity } from '@/lib/timeline';
import { getUserFromToken } from '@/lib/auth';
import { trackEntityUpdate } from '@/lib/changeTracker';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get('assignedTo');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const skip = (page - 1) * limit;

    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let whereClause: any = {};
    
    // For regular employees, only show resources assigned to them
    if (currentUser.role !== 'CEO' && currentUser.role !== 'CTO') {
      whereClause.assignments = {
        some: {
          employeeId: currentUser.id,
          status: 'ACTIVE'
        }
      };
    } else {
      // For CEO/CTO, apply employee filter if specified
      if (assignedTo) {
        whereClause.assignments = {
          some: {
            employeeId: assignedTo,
            status: 'ACTIVE'
          }
        };
      }
    }

    // Add type filter if specified (only for CEO/CTO)
    if (type && (currentUser.role === 'CEO' || currentUser.role === 'CTO')) {
      whereClause.type = type;
    }

    // Add search filter if specified
    if (search && search.trim()) {
      const searchConditions = [
        { name: { contains: search.trim(), mode: 'insensitive' as any } },
        { category: { contains: search.trim(), mode: 'insensitive' as any } },
        { description: { contains: search.trim(), mode: 'insensitive' as any } },
        { brand: { contains: search.trim(), mode: 'insensitive' as any } },
        { modelNumber: { contains: search.trim(), mode: 'insensitive' as any } },
        { provider: { contains: search.trim(), mode: 'insensitive' as any } },
        { location: { contains: search.trim(), mode: 'insensitive' as any } }
      ];

      // Combine search with existing filters
      if (whereClause.assignments || whereClause.type) {
        const existingConditions = [];
        if (whereClause.assignments) existingConditions.push({ assignments: whereClause.assignments });
        if (whereClause.type) existingConditions.push({ type: whereClause.type });
        
        whereClause = {
          AND: [
            ...existingConditions,
            { OR: searchConditions }
          ]
        };
      } else {
        whereClause.OR = searchConditions;
      }
    }

    // Get total count first with the exact same where clause
    const totalResources = await prisma.resource.count({ where: whereClause });

    // Get resources with assignments for quantity calculation
    const resources = await prisma.resource.findMany({
      where: whereClause,
      include: {
        custodian: {
          select: { id: true, name: true, role: true }
        },
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            employee: {
              select: { id: true, name: true, email: true, department: true, role: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    // Calculate quantities for each resource
    const resourcesWithQuantities = resources.map((resource: any) => {
      const allocatedQuantity = resource.assignments.reduce((total: number, assignment: any) => {
        return total + assignment.quantityAssigned;
      }, 0);
      
      const availableQuantity = resource.totalQuantity - allocatedQuantity;

      return {
        id: resource.id,
        name: resource.name,
        type: resource.type,
        category: resource.category,
        description: resource.description,
        owner: resource.owner,
        custodian: resource.custodian,
        totalQuantity: resource.totalQuantity,
        allocatedQuantity,
        availableQuantity,
        status: resource.status,
        // Physical asset fields
        serialNumber: resource.serialNumber,
        modelNumber: resource.modelNumber,
        brand: resource.brand,
        location: resource.location,
        purchaseDate: resource.purchaseDate,
        warrantyExpiry: resource.warrantyExpiry,
        value: resource.value,
        // Software/Cloud fields
        provider: resource.provider,
        softwareVersion: resource.softwareVersion,
        monthlyRate: resource.monthlyRate,
        annualRate: resource.annualRate,
        serviceLevel: resource.serviceLevel,
        defaultPermission: resource.defaultPermission,
        // Timestamps
        createdAt: resource.createdAt,
        updatedAt: resource.updatedAt,
        // Current assignments (for display)
        currentAssignments: resource.assignments.map((assignment: any) => ({
          id: assignment.id,
          employee: assignment.employee,
          quantityAssigned: assignment.quantityAssigned,
          assignedAt: assignment.assignedAt
        }))
      };
    });

    return NextResponse.json({
      resources: resourcesWithQuantities,
      pagination: {
        page,
        limit,
        total: totalResources,
        totalPages: Math.ceil(totalResources / limit)
      },
      userRole: currentUser.role, // Include user role for frontend logic
      isRestrictedView: currentUser.role !== 'CEO' && currentUser.role !== 'CTO'
    });

  } catch (error: any) {
    console.error('Error fetching resources:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch resources',
      details: error.message 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('=== RESOURCE CREATION API CALLED ===');
    console.log('Received resource data:', JSON.stringify(body, null, 2));
    
    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Get the CEO for default custodian
    const ceo = await prisma.employee.findFirst({
      where: { role: 'CEO' },
      select: { id: true, name: true }
    });
    
    if (!ceo) {
      return NextResponse.json({ 
        error: 'CEO not found in system. Cannot create resource without default custodian.' 
      }, { status: 500 });
    }
    
    // Validate required fields
    if (!body.name || !body.type) {
      console.log('Validation failed: missing required fields');
      return NextResponse.json({ 
        error: 'Missing required fields: name and type are required' 
      }, { status: 400 });
    }

    // Validate total quantity
    const totalQuantity = parseInt(body.totalQuantity) || 1;
    if (totalQuantity <= 0) {
      return NextResponse.json({ 
        error: 'Total quantity must be greater than 0' 
      }, { status: 400 });
    }

    console.log('Creating resource in database...');
    console.log('Current user creating resource:', currentUser.name, '(', currentUser.role, ')');
    console.log('Resource will be owned by company and custodian will be CEO');

    // Create resource with new structure
    const resource = await prisma.resource.create({
      data: {
        name: body.name,
        type: body.type,
        category: body.category || null,
        description: body.description || null,
        owner: 'Unisouk', // Company owns all resources
        custodianId: ceo.id, // CEO is default custodian
        totalQuantity: totalQuantity,
        status: 'ACTIVE', // Resources start as ACTIVE
        // Physical asset fields
        serialNumber: body.serialNumber || null,
        modelNumber: body.modelNumber || null,
        brand: body.brand || null,
        location: body.location || null,
        value: body.value ? parseFloat(body.value) : null,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
        warrantyExpiry: body.warrantyExpiry ? new Date(body.warrantyExpiry) : null,
        // Software/Cloud fields
        provider: body.provider || null,
        softwareVersion: body.softwareVersion || null,
        monthlyRate: body.monthlyRate ? parseFloat(body.monthlyRate) : null,
        annualRate: body.annualRate ? parseFloat(body.annualRate) : null,
        serviceLevel: body.serviceLevel || null,
        // Other fields
        specifications: body.specifications || null,
        operatingSystem: body.operatingSystem || null,
        osVersion: body.osVersion || null,
        processor: body.processor || null,
        memory: body.memory || null,
        storage: body.storage || null,
        ipAddress: body.ipAddress || null,
        macAddress: body.macAddress || null,
        hostname: body.hostname || null,
        licenseKey: body.licenseKey || null,
        licenseExpiry: body.licenseExpiry ? new Date(body.licenseExpiry) : null,
        subscriptionId: body.subscriptionId || null,
        subscriptionExpiry: body.subscriptionExpiry ? new Date(body.subscriptionExpiry) : null
      },
      include: {
        custodian: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      }
    });

    console.log('Resource created successfully:', resource.id);
    console.log('Resource owned by company, custodian is CEO');

    // Log the creation activity
    await logTimelineActivity({
      entityType: 'RESOURCE',
      entityId: resource.id,
      activityType: 'CREATED',
      title: `Resource created: ${resource.name}`,
      description: `${resource.name} (${resource.type}) was created by ${currentUser.name}. Total quantity: ${resource.totalQuantity}`,
      metadata: {
        resourceName: resource.name,
        resourceType: resource.type,
        resourceCategory: resource.category,
        owner: resource.owner,
        custodian: resource.custodian.name,
        totalQuantity: resource.totalQuantity,
        createdBy: currentUser.name,
        createdById: currentUser.id
      },
      performedBy: currentUser.id,
      resourceId: resource.id
    });

    return NextResponse.json({
      success: true,
      message: `Successfully created ${resource.name}`,
      resource: {
        ...resource,
        allocatedQuantity: 0,
        availableQuantity: resource.totalQuantity,
        currentAssignments: []
      }
    });

  } catch (error: any) {
    console.error('Error creating resource:', error);
    return NextResponse.json({ 
      error: 'Failed to create resource',
      details: error.message 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('id');
    const body = await request.json();

    if (!resourceId) {
      return NextResponse.json({ error: 'Resource ID is required' }, { status: 400 });
    }

    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get existing resource
    const existingResource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        assignments: { where: { status: 'ACTIVE' } }
      }
    });

    if (!existingResource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Calculate current allocated quantity
    const allocatedQuantity = existingResource.assignments.reduce((total: number, assignment: any) => {
      return total + assignment.quantityAssigned;
    }, 0);

    // Validate new total quantity if being updated
    const newTotalQuantity = body.totalQuantity ? parseInt(body.totalQuantity) : existingResource.totalQuantity;
    if (newTotalQuantity < allocatedQuantity) {
      return NextResponse.json({ 
        error: `Cannot reduce total quantity below allocated quantity. Allocated: ${allocatedQuantity}, Requested: ${newTotalQuantity}`,
        details: {
          allocatedQuantity,
          requestedTotalQuantity: newTotalQuantity
        }
      }, { status: 400 });
    }

    // Update resource
    const updatedResource = await prisma.resource.update({
      where: { id: resourceId },
      data: {
        name: body.name || existingResource.name,
        category: body.category !== undefined ? body.category : existingResource.category,
        description: body.description !== undefined ? body.description : existingResource.description,
        totalQuantity: newTotalQuantity,
        // Physical asset fields
        serialNumber: body.serialNumber !== undefined ? body.serialNumber : existingResource.serialNumber,
        modelNumber: body.modelNumber !== undefined ? body.modelNumber : existingResource.modelNumber,
        brand: body.brand !== undefined ? body.brand : existingResource.brand,
        location: body.location !== undefined ? body.location : existingResource.location,
        value: body.value !== undefined ? (body.value ? parseFloat(body.value) : null) : existingResource.value,
        // Software/Cloud fields
        provider: body.provider !== undefined ? body.provider : existingResource.provider,
        softwareVersion: body.softwareVersion !== undefined ? body.softwareVersion : existingResource.softwareVersion,
        monthlyRate: body.monthlyRate !== undefined ? (body.monthlyRate ? parseFloat(body.monthlyRate) : null) : existingResource.monthlyRate,
        annualRate: body.annualRate !== undefined ? (body.annualRate ? parseFloat(body.annualRate) : null) : existingResource.annualRate,
        serviceLevel: body.serviceLevel !== undefined ? body.serviceLevel : existingResource.serviceLevel,
        // Handle dates
        purchaseDate: body.purchaseDate !== undefined ? (body.purchaseDate ? new Date(body.purchaseDate) : null) : existingResource.purchaseDate,
        warrantyExpiry: body.warrantyExpiry !== undefined ? (body.warrantyExpiry ? new Date(body.warrantyExpiry) : null) : existingResource.warrantyExpiry,
        licenseExpiry: body.licenseExpiry !== undefined ? (body.licenseExpiry ? new Date(body.licenseExpiry) : null) : existingResource.licenseExpiry,
        subscriptionExpiry: body.subscriptionExpiry !== undefined ? (body.subscriptionExpiry ? new Date(body.subscriptionExpiry) : null) : existingResource.subscriptionExpiry
      },
      include: {
        custodian: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      }
    });

    // Log the update activity
    await logTimelineActivity({
      entityType: 'RESOURCE',
      entityId: resourceId,
      activityType: 'UPDATED',
      title: `Resource updated: ${updatedResource.name}`,
      description: `${updatedResource.name} was updated by ${currentUser.name}`,
      metadata: {
        resourceName: updatedResource.name,
        resourceType: updatedResource.type,
        updatedBy: currentUser.name,
        updatedById: currentUser.id,
        changes: body
      },
      performedBy: currentUser.id,
      resourceId: resourceId
    });

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updatedResource.name}`,
      resource: {
        ...updatedResource,
        allocatedQuantity,
        availableQuantity: updatedResource.totalQuantity - allocatedQuantity
      }
    });

  } catch (error: any) {
    console.error('Error updating resource:', error);
    return NextResponse.json({ 
      error: 'Failed to update resource',
      details: error.message 
    }, { status: 500 });
  }
}