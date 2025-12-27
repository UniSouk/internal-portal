import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { logTimelineActivity } from '@/lib/timeline';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromEmployeeId, toEmployeeId, reassignBy = 'system' } = body;

    if (!fromEmployeeId || !toEmployeeId) {
      return NextResponse.json({ 
        error: 'Both fromEmployeeId and toEmployeeId are required' 
      }, { status: 400 });
    }

    if (fromEmployeeId === toEmployeeId) {
      return NextResponse.json({ 
        error: 'Cannot reassign to the same employee' 
      }, { status: 400 });
    }

    // Verify both employees exist
    const [fromEmployee, toEmployee] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: fromEmployeeId },
        select: { name: true, email: true }
      }),
      prisma.employee.findUnique({
        where: { id: toEmployeeId },
        select: { name: true, email: true }
      })
    ]);

    if (!fromEmployee) {
      return NextResponse.json({ error: 'Source employee not found' }, { status: 404 });
    }

    if (!toEmployee) {
      return NextResponse.json({ error: 'Target employee not found' }, { status: 404 });
    }

    // Perform reassignment in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Reassign policies
      const policies = await tx.policy.updateMany({
        where: { ownerId: fromEmployeeId },
        data: { ownerId: toEmployeeId }
      });

      // Reassign documents
      const documents = await tx.document.updateMany({
        where: { ownerId: fromEmployeeId },
        data: { ownerId: toEmployeeId }
      });

      // Reassign resource custodianship
      const resources = await tx.resource.updateMany({
        where: { custodianId: fromEmployeeId },
        data: { custodianId: toEmployeeId }
      });

      // Reassign subordinates (change their manager)
      const subordinates = await tx.employee.updateMany({
        where: { managerId: fromEmployeeId },
        data: { managerId: toEmployeeId }
      });

      return {
        policies: policies.count,
        documents: documents.count,
        resources: resources.count,
        subordinates: subordinates.count
      };
    });

    // Log the reassignment
    await logAudit({
      entityType: 'EMPLOYEE',
      entityId: fromEmployeeId,
      changedById: reassignBy,
      fieldChanged: 'ownership_reassigned',
      oldValue: fromEmployee.name,
      newValue: toEmployee.name
    });

    await logTimelineActivity({
      entityType: 'EMPLOYEE',
      entityId: fromEmployeeId,
      activityType: 'UPDATED',
      title: `Reassigned ownership from ${fromEmployee.name} to ${toEmployee.name}`,
      description: `Transferred ${result.policies} policies, ${result.documents} documents, ${result.resources} resources, and ${result.subordinates} subordinates`,
      metadata: {
        fromEmployee: fromEmployee.name,
        toEmployee: toEmployee.name,
        reassignmentCounts: result
      },
      performedBy: reassignBy
    });

    return NextResponse.json({
      message: 'Ownership reassigned successfully',
      reassigned: result,
      fromEmployee: fromEmployee.name,
      toEmployee: toEmployee.name
    });

  } catch (error: any) {
    console.error('Error reassigning ownership:', error);
    return NextResponse.json({ error: 'Failed to reassign ownership' }, { status: 500 });
  }
}