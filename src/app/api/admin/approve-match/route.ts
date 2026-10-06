import { NextRequest, NextResponse } from 'next/server';
import { approveMatch } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuthServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { matchId, token, pin } = body;

    if (!matchId) {
      return NextResponse.json({ success: false, error: 'matchId is required' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const headerToken = req.headers.get('x-admin-token');
    const candidateAuth = authHeader || headerToken || token || pin;

    const isAuthorized = verifyAdminRequest(candidateAuth);
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Valid Admin PIN or token required' }, { status: 401 });
    }

    await approveMatch(matchId);

    return NextResponse.json({
      success: true,
      message: 'Match approved and global user stats recalculated successfully',
    });
  } catch (error: any) {
    console.error('Error approving match:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error approving match' },
      { status: 500 }
    );
  }
}
