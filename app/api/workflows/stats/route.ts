import { NextRequest, NextResponse } from 'next/server';
import { getOperationalWorkflowStats } from '@/lib/workflowService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    const stats = await getOperationalWorkflowStats(userId);
    
    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching workflow stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow stats' },
      { status: 500 }
    );
  }
}