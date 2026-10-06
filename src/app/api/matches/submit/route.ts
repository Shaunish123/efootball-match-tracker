import { NextRequest, NextResponse } from 'next/server';
import { logMatch } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/adminAuthServer';
import { MatchStatus } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      player1Id,
      player2Id,
      player1Name,
      player2Name,
      player1Score,
      player2Score,
      matchType = 'dream',
      isDraw = false,
      isPenalty = false,
      penaltyScore1,
      penaltyScore2,
      tournamentId,
      tournamentRound,
      adminToken,
      adminPin,
    } = body;

    if (!player1Id || !player2Id) {
      return NextResponse.json({ success: false, error: 'Both players are required' }, { status: 400 });
    }
    if (player1Id === player2Id) {
      return NextResponse.json({ success: false, error: 'Players must be different' }, { status: 400 });
    }
    if (typeof player1Score !== 'number' || typeof player2Score !== 'number') {
      return NextResponse.json({ success: false, error: 'Valid numeric scores are required' }, { status: 400 });
    }

    // Check authorization: header or body
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const candidateAuth = authHeader || adminToken || adminPin;
    const isAdmin = verifyAdminRequest(candidateAuth);

    // Determine status: Admin submissions or tournament matches are approved immediately; standard casual submissions are pending
    const status: MatchStatus = (isAdmin || tournamentId) ? 'approved' : 'pending';

    const matchId = await logMatch({
      player1Id,
      player2Id,
      player1Name: player1Name || 'Player 1',
      player2Name: player2Name || 'Player 2',
      player1Score,
      player2Score,
      matchType,
      isDraw,
      isPenalty,
      penaltyScore1,
      penaltyScore2,
      tournamentId,
      tournamentRound,
      status,
    });

    return NextResponse.json({
      success: true,
      matchId,
      status,
      message: status === 'pending'
        ? 'Match submitted for admin approval'
        : 'Match approved and logged successfully',
    });
  } catch (error: any) {
    console.error('Error submitting match:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
