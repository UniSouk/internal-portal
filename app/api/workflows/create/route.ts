import { NextRequest, NextResponse } from 'next/server';
import { 
  createITEquipmentRequest, 
  createSoftwareLicenseRequest, 
  createExpenseApprovalRequest, 
  createHiringRequest 
} from '@/lib/workflowService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, requesterId, data } = body;

    if (!type || !requesterId || !data) {
      return NextResponse.json({ 
        error: 'Missing required fields: type, requesterId, data' 
      }, { status: 400 });
    }

    let workflow;

    switch (type) {
      case 'IT_EQUIPMENT_REQUEST':
        workflow = await createITEquipmentRequest(data, requesterId);
        break;
      
      case 'SOFTWARE_LICENSE_REQUEST':
        workflow = await createSoftwareLicenseRequest(data, requesterId);
        break;
      
      case 'EXPENSE_APPROVAL_REQUEST':
        workflow = await createExpenseApprovalRequest(data, requesterId);
        break;
      
      case 'HIRING_REQUEST':
        workflow = await createHiringRequest(data, requesterId);
        break;
      
      default:
        return NextResponse.json({ 
          error: `Unsupported workflow type: ${type}` 
        }, { status: 400 });
    }

    return NextResponse.json(workflow, { status: 201 });

  } catch (error) {
    console.error('Error creating operational workflow:', error);
    return NextResponse.json(
      { error: 'Failed to create operational workflow' },
      { status: 500 }
    );
  }
}