import { NextRequest, NextResponse } from 'next/server';
import { getPendingOperationalWorkflows } from '@/lib/workflowService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const approverId = searchParams.get('approverId');

    if (!approverId) {
      return NextResponse.json({ error: 'Approver ID is required' }, { status: 400 });
    }
    
    const workflows = await getPendingOperationalWorkflows(approverId);
    
    return NextResponse.json(workflows);

  } catch (error) {
    console.error('Error fetching pending workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending workflows' },
      { status: 500 }
    );
  }
}