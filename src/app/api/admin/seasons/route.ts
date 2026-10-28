import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuthServer';
import {
  migrateSeason1,
  startNewSeason,
  endSeason,
  updateSeasonSettings,
  getAllSeasons,
  getActiveSeason,
  getFixtureStats,
} from '@/lib/seasonDb';

function getAuth(req: NextRequest, body: Record<string, any>): string | null {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
  const headerToken = req.headers.get('x-admin-token');
  return authHeader || headerToken || body.token || body.pin || null;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '');
    const headerToken = req.headers.get('x-admin-token');
    const candidateAuth = authHeader || headerToken;
    if (!verifyAdminRequest(candidateAuth)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const seasons = await getAllSeasons();
    const active = await getActiveSeason();
    return NextResponse.json({ success: true, seasons, activeSeason: active });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      playerIds,
      seasonId,
      handicapPlayerId,
      handicapPlayerName,
      handicapBonus,
      minMatchesRequired,
      rankingSystem,
    } = body;

    const candidateAuth = getAuth(req, body);
    if (!verifyAdminRequest(candidateAuth)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Valid Admin PIN or token required' }, { status: 401 });
    }

    if (action === 'migrate-season-1') {
      const s1Id = await migrateSeason1();
      return NextResponse.json({ success: true, seasonId: s1Id, message: 'Season 1 migrated successfully' });
    }

    if (action === 'start') {
      if (!playerIds || !Array.isArray(playerIds) || playerIds.length < 2) {
        return NextResponse.json({ success: false, error: 'playerIds array with at least 2 players is required' }, { status: 400 });
      }
      const newSeasonId = await startNewSeason({
        playerIds,
        handicapPlayerId,
        handicapPlayerName,
        handicapBonus: typeof handicapBonus === 'number' ? handicapBonus : (handicapBonus ? parseFloat(handicapBonus) : 0.75),
        minMatchesRequired: typeof minMatchesRequired === 'number' ? minMatchesRequired : (minMatchesRequired ? parseInt(minMatchesRequired, 10) : 35),
      });
      return NextResponse.json({
        success: true,
        seasonId: newSeasonId,
        message: 'New season launched with HPS ranking system!',
      });
    }

    if (action === 'update-settings') {
      if (!seasonId) {
        return NextResponse.json({ success: false, error: 'seasonId is required' }, { status: 400 });
      }
      await updateSeasonSettings(seasonId, {
        handicapPlayerId,
        handicapPlayerName,
        handicapBonus: handicapBonus !== undefined ? parseFloat(handicapBonus) : undefined,
        minMatchesRequired: minMatchesRequired !== undefined ? parseInt(minMatchesRequired, 10) : undefined,
        rankingSystem,
      });
      return NextResponse.json({
        success: true,
        message: 'Special powers and season settings updated successfully!',
      });
    }

    if (action === 'end') {
      if (!seasonId) {
        return NextResponse.json({ success: false, error: 'seasonId is required to end a season' }, { status: 400 });
      }
      await endSeason(seasonId);
      return NextResponse.json({ success: true, message: 'Season ended successfully. Final leaderboard has been preserved.' });
    }

    if (action === 'fixture-stats') {
      if (!seasonId) {
        return NextResponse.json({ success: false, error: 'seasonId is required' }, { status: 400 });
      }
      const active = await getActiveSeason();
      if (!active || active.id !== seasonId) {
        return NextResponse.json({ success: false, error: 'Season not found or not active' }, { status: 404 });
      }
      const stats = await getFixtureStats(seasonId, active.playerIds);
      return NextResponse.json({ success: true, stats });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Season API error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
