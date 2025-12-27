import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { logCreatedActivity, logFileUploadedActivity, logTimelineActivity, logUpdatedActivity, logStatusChangedActivity } from '@/lib/timeline';
import { getSystemUserId } from '@/lib/systemUser';
import { getUserFromToken } from '@/lib/auth';
import { createPolicyPublishWorkflow } from '@/lib/workflowService';
import { trackEntityUpdate } from '@/lib/changeTracker';

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search'); // Add search parameter
    const category = searchParams.get('category'); // Add category filter
    const status = searchParams.get('status'); // Add status filter
    const skip = (page - 1) * limit;

    // Build where clause based on user role
    let whereClause: any = {};
    
    // CEO and CTO can see all policies
    if (currentUser.role === 'CEO' || currentUser.role === 'CTO') {
      // No additional filtering - they can see all policies
      whereClause = {};
    } else {
      // Other employees can only see policies they created
      whereClause = {
        ownerId: currentUser.id
      };
    }

    // Add search filter if specified
    if (search && search.trim()) {
      const searchConditions = {
        OR: [
          { title: { contains: search.trim(), mode: 'insensitive' as any } },
          { content: { contains: search.trim(), mode: 'insensitive' as any } },
          { fileName: { contains: search.trim(), mode: 'insensitive' as any } }
        ]
      };

      // Combine search with existing conditions
      const existingConditions = [];
      
      // Add role-based conditions
      if (currentUser.role !== 'CEO' && currentUser.role !== 'CTO') {
        existingConditions.push({ ownerId: currentUser.id });
      }
      
      // Add category filter
      if (category) {
        existingConditions.push({ category: category });
      }
      
      // Add status filter
      if (status) {
        existingConditions.push({ status: status });
      }
      
      // Combine all conditions
      if (existingConditions.length > 0) {
        whereClause = {
          AND: [
            ...existingConditions,
            searchConditions
          ]
        };
      } else {
        whereClause = searchConditions;
      }
    } else {
      // No search, just apply other filters
      const conditions = [];
      
      // Add role-based conditions
      if (currentUser.role !== 'CEO' && currentUser.role !== 'CTO') {
        conditions.push({ ownerId: currentUser.id });
      }
      
      // Add category filter
      if (category) {
        conditions.push({ category: category });
      }
      
      // Add status filter
      if (status) {
        conditions.push({ status: status });
      }
      
      if (conditions.length > 1) {
        whereClause = { AND: conditions };
      } else if (conditions.length === 1) {
        whereClause = conditions[0];
      } else {
        whereClause = {};
      }
    }

    // Get total count with role-based filtering
    const total = await prisma.policy.count({
      where: whereClause
    });

    // Get paginated policies with role-based filtering
    const policies = await prisma.policy.findMany({
      where: whereClause,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    return NextResponse.json({
      policies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching policies:', error);
    return NextResponse.json({ error: 'Failed to fetch policies' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      title, 
      category, 
      content, 
      ownerId, 
      status,
      filePath,
      fileName,
      fileSize,
      mimeType,
      effectiveDate,
      expiryDate,
      reviewDate,
      lastReviewDate
    } = body;

    // Prevent creating policies with protected statuses
    const protectedStatuses = ['APPROVED', 'REJECTED', 'PUBLISHED'];
    if (protectedStatuses.includes(status)) {
      return NextResponse.json({ 
        error: `Cannot create policy with status ${status}. Policies must start as DRAFT, IN_PROGRESS, or REVIEW.`,
        allowedStatuses: ['DRAFT', 'IN_PROGRESS', 'REVIEW']
      }, { status: 400 });
    }

    // Use current user as owner if no owner is specified
    const finalOwnerId = ownerId || currentUser.id;

    const policy = await prisma.policy.create({
      data: {
        title,
        category,
        content,
        ownerId: finalOwnerId,
        status: status || 'DRAFT',
        version: 1,
        filePath,
        fileName,
        fileSize,
        mimeType,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        reviewDate: reviewDate ? new Date(reviewDate) : null,
        lastReviewDate: lastReviewDate ? new Date(lastReviewDate) : null
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      }
    });

    // Log audit trail
    try {
      await logAudit({
        entityType: 'POLICY',
        entityId: policy.id,
        changedById: finalOwnerId,
        fieldChanged: 'created',
        oldValue: null,
        newValue: JSON.stringify(policy)
      });
    } catch (auditError) {
      console.error('Failed to log audit for policy creation:', auditError);
    }

    // Log timeline activity
    try {
      await logCreatedActivity(
        'POLICY',
        policy.id,
        policy.title,
        currentUser.id,
        {
          category: policy.category,
          status: policy.status,
          hasFile: !!policy.filePath
        }
      );
    } catch (timelineError) {
      console.error('Failed to log timeline activity for policy creation:', timelineError);
    }

    // Log file upload activity if file was uploaded
    if (fileName && fileSize) {
      try {
        await logFileUploadedActivity(
          'POLICY',
          policy.id,
          policy.title,
          currentUser.id,
          fileName,
          fileSize
        );
      } catch (fileTimelineError) {
        console.error('Failed to log file upload activity:', fileTimelineError);
      }
    }

    // Automatically create publish workflow if policy is ready for review
    if (policy.status === 'REVIEW' && (policy.content || policy.filePath)) {
      try {
        console.log(`Policy "${policy.title}" created with REVIEW status - creating approval workflow`);
        console.log(`Policy has content: ${!!policy.content}, has file: ${!!policy.filePath}`);
        
        const workflow = await createPolicyPublishWorkflow(policy.id, finalOwnerId);
        console.log(`✅ Automatic publish workflow created for new policy: ${workflow.id}`);
        
        // Log workflow creation in timeline
        await logTimelineActivity({
          entityType: 'POLICY',
          entityId: policy.id,
          activityType: 'WORKFLOW_STARTED',
          title: `Policy review workflow created`,
          description: `Approval workflow automatically created for new policy "${policy.title}" with REVIEW status`,
          metadata: {
            workflowId: workflow.id,
            policyTitle: policy.title,
            workflowType: 'POLICY_UPDATE_REQUEST',
            autoCreated: true
          },
          performedBy: finalOwnerId,
          policyId: policy.id,
          workflowId: workflow.id
        });
        
      } catch (workflowError) {
        console.error('❌ Failed to create automatic publish workflow for new policy:', workflowError);
        console.error('Policy ID:', policy.id);
        console.error('Policy Title:', policy.title);
        console.error('Requester ID:', finalOwnerId);
        console.error('Full error:', workflowError);
        // Don't fail the policy creation if workflow creation fails
      }
    } else {
      console.log(`Policy "${policy.title}" created but workflow not needed:`);
      console.log(`- Status: ${policy.status} (needs REVIEW)`);
      console.log(`- Has content: ${!!policy.content}`);
      console.log(`- Has file: ${!!policy.filePath}`);
    }

    return NextResponse.json(policy, { status: 201 });
  } catch (error) {
    console.error('Error creating policy:', error);
    return NextResponse.json({ error: 'Failed to create policy' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 });
    }

    const body = await request.json();

    // Get current policy data for change tracking
    const currentPolicy = await prisma.policy.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      }
    });

    if (!currentPolicy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    // Prevent manual status changes to protected statuses
    const protectedStatuses = ['APPROVED', 'REJECTED', 'PUBLISHED'];
    const allowedStatuses = ['DRAFT', 'IN_PROGRESS', 'REVIEW'];
    
    if (protectedStatuses.includes(body.status)) {
      return NextResponse.json({ 
        error: `Cannot manually set status to ${body.status}. This status is set automatically through the approval workflow.`,
        allowedStatuses: allowedStatuses
      }, { status: 400 });
    }

    // Prevent editing of rejected policies
    if (currentPolicy.status === 'REJECTED') {
      return NextResponse.json({ 
        error: 'Rejected policies cannot be edited. Create a new version instead.',
      }, { status: 400 });
    }

    // Prevent editing of published policies (except for admin operations)
    if (currentPolicy.status === 'PUBLISHED' && body.status !== 'PUBLISHED') {
      return NextResponse.json({ 
        error: 'Published policies cannot be modified.',
      }, { status: 400 });
    }

    // Increment version if content or file changes
    const shouldIncrementVersion = 
      body.content !== currentPolicy.content || 
      body.filePath !== currentPolicy.filePath ||
      body.title !== currentPolicy.title;

    // Update policy
    const updatedPolicy = await prisma.policy.update({
      where: { id },
      data: {
        title: body.title,
        category: body.category,
        content: body.content || null,
        status: body.status,
        filePath: body.filePath || null,
        fileName: body.fileName || null,
        fileSize: body.fileSize || null,
        mimeType: body.mimeType || null,
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        reviewDate: body.reviewDate ? new Date(body.reviewDate) : null,
        lastReviewDate: body.lastReviewDate ? new Date(body.lastReviewDate) : null,
        version: shouldIncrementVersion ? currentPolicy.version + 1 : currentPolicy.version
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      }
    });

    // Check if status changed to REVIEW - create approval workflow
    if (currentPolicy.status !== 'REVIEW' && body.status === 'REVIEW') {
      try {
        console.log(`Policy "${updatedPolicy.title}" moved to REVIEW status - creating approval workflow`);
        console.log(`Policy has content: ${!!updatedPolicy.content}, has file: ${!!updatedPolicy.filePath}`);
        
        const systemUserId = await getSystemUserId();
        const workflowRequesterId = updatedPolicy.ownerId || currentPolicy.ownerId || systemUserId;
        
        const workflow = await createPolicyPublishWorkflow(updatedPolicy.id, workflowRequesterId);
        
        // Log workflow creation
        await logTimelineActivity({
          entityType: 'POLICY',
          entityId: updatedPolicy.id,
          activityType: 'WORKFLOW_STARTED',
          title: `Policy review workflow created`,
          description: `Approval workflow automatically created for policy "${updatedPolicy.title}" when status changed to REVIEW`,
          metadata: {
            workflowId: workflow.id,
            policyTitle: updatedPolicy.title,
            statusChange: `${currentPolicy.status} → REVIEW`,
            workflowType: 'POLICY_UPDATE_REQUEST'
          },
          performedBy: workflowRequesterId,
          policyId: updatedPolicy.id,
          workflowId: workflow.id
        });

        console.log(`✅ Policy approval workflow created: ${workflow.id}`);
      } catch (workflowError) {
        const systemUserId = await getSystemUserId();
        const workflowRequesterId = updatedPolicy.ownerId || currentPolicy.ownerId || systemUserId;
        
        console.error('❌ Failed to create policy approval workflow:', workflowError);
        console.error('Policy ID:', updatedPolicy.id);
        console.error('Policy Title:', updatedPolicy.title);
        console.error('Requester ID:', workflowRequesterId);
        console.error('Full error:', workflowError);
        // Don't fail the policy update if workflow creation fails
      }
    }

    // Track all changes comprehensively
    await trackEntityUpdate(
      'POLICY',
      id,
      updatedPolicy.title,
      currentPolicy,
      updatedPolicy,
      request
    );

    return NextResponse.json(updatedPolicy);
  } catch (error) {
    console.error('Error updating policy:', error);
    return NextResponse.json({ error: 'Failed to update policy' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get the authenticated user
    const token = request.cookies.get('auth-token')?.value;
    const currentUser = token ? await getUserFromToken(token) : null;
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const deletedBy = searchParams.get('deletedBy') || 'system';

    if (!id) {
      return NextResponse.json({ error: 'Policy ID is required' }, { status: 400 });
    }

    // Use current user for deletion
    const finalDeletedBy = currentUser.id;

    // Get policy details before deletion for logging
    const policy = await prisma.policy.findUnique({
      where: { id },
      select: { title: true, category: true, status: true, filePath: true }
    });

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    // Delete the policy
    await prisma.policy.delete({
      where: { id }
    });

    // Log audit trail
    try {
      await logAudit({
        entityType: 'POLICY',
        entityId: id,
        changedById: finalDeletedBy,
        fieldChanged: 'deleted',
        oldValue: JSON.stringify(policy),
        newValue: null
      });
    } catch (auditError) {
      console.error('Failed to log audit for policy deletion:', auditError);
    }

    // Log timeline activity
    try {
      await logTimelineActivity({
        entityType: 'POLICY',
        entityId: id,
        activityType: 'DELETED',
        title: `Deleted policy: ${policy.title}`,
        description: `Policy "${policy.title}" (${policy.category}) was removed from the system`,
        metadata: {
          policyTitle: policy.title,
          category: policy.category,
          status: policy.status,
          hadFile: !!policy.filePath
        },
        performedBy: finalDeletedBy,
        policyId: id
      });
    } catch (timelineError) {
      console.error('Failed to log timeline activity for policy deletion:', timelineError);
    }

    return NextResponse.json({ message: 'Policy deleted successfully' });
  } catch (error) {
    console.error('Error deleting policy:', error);
    return NextResponse.json({ error: 'Failed to delete policy' }, { status: 500 });
  }
}