import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { name: true, email: true }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Fetch all dependencies
    const [
      policies,
      documents,
      resources,
      assignedResources,
      subordinates,
      accessRequests,
      approvals,
      workflows
    ] = await Promise.all([
      // Policies owned by this employee
      prisma.policy.findMany({
        where: { ownerId: id },
        select: { id: true, title: true, category: true, status: true }
      }),
      
      // Documents owned by this employee
      prisma.document.findMany({
        where: { ownerId: id },
        select: { id: true, title: true, category: true, status: true }
      }),
      
      // Resources managed by this employee (as custodian)
      prisma.resource.findMany({
        where: { custodianId: id },
        select: { id: true, name: true, type: true, status: true }
      }),
      
      // Resources assigned to this employee
      prisma.resourceAssignment.findMany({
        where: { 
          employeeId: id,
          status: 'ACTIVE'
        },
        select: { 
          id: true,
          assignedAt: true,
          notes: true,
          resource: {
            select: { 
              id: true, 
              name: true, 
              type: true, 
              category: true,
              status: true 
            }
          },
          item: {
            select: {
              id: true,
              serialNumber: true,
              hostname: true,
              licenseKey: true
            }
          }
        },
        orderBy: { assignedAt: 'desc' }
      }),
      
      // Employees managed by this employee
      prisma.employee.findMany({
        where: { managerId: id },
        select: { id: true, name: true, email: true, department: true, role: true }
      }),
      
      // Access requests made by this employee
      prisma.access.findMany({
        where: { employeeId: id },
        select: { 
          id: true, 
          status: true,
          resource: {
            select: { name: true, type: true }
          }
        }
      }),
      
      // Access requests approved by this employee
      prisma.access.findMany({
        where: { approverId: id },
        select: { 
          id: true, 
          status: true,
          employee: {
            select: { name: true, email: true }
          },
          resource: {
            select: { name: true, type: true }
          }
        }
      }),
      
      // Approval workflows involving this employee
      prisma.approvalWorkflow.findMany({
        where: {
          OR: [
            { requesterId: id },
            { approverId: id }
          ]
        },
        select: { 
          id: true, 
          type: true, 
          status: true,
          requester: {
            select: { name: true, email: true }
          },
          approver: {
            select: { name: true, email: true }
          }
        }
      })
    ]);

    const dependencies = {
      policies: policies.length > 0 ? policies : null,
      documents: documents.length > 0 ? documents : null,
      resources: resources.length > 0 ? resources : null,
      assignedResources: assignedResources.length > 0 ? assignedResources : null,
      subordinates: subordinates.length > 0 ? subordinates : null,
      accessRequests: accessRequests.length > 0 ? accessRequests : null,
      approvals: approvals.length > 0 ? approvals : null,
      workflows: workflows.length > 0 ? workflows : null,
      employee: employee
    };

    return NextResponse.json(dependencies);
  } catch (error) {
    console.error('Error fetching employee dependencies:', error);
    return NextResponse.json({ error: 'Failed to fetch employee dependencies' }, { status: 500 });
  }
}