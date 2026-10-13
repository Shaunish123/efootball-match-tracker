/**
 * seasonDb.ts
 * All Firebase RTDB operations for the Season Management and Fixture system.
 * Works alongside the existing db.ts without replacing it.
 */
import { db } from './firebase';
import {
  ref,
  push,
  set,
  get,
  update,
  onValue,
  off,
  DataSnapshot,
  runTransaction,
} from 'firebase/database';
import {
  Season,
  SeasonFixture,
  SeasonPlayerSnapshot,
  ModeStats,
} from './types';

// ==================== HELPERS ====================

function createEmptyModeStats(): ModeStats {
  return {
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
  };
}

/**
 * Returns the canonical pair key for two player IDs (always sorted ascending).
 */
export function getPairKey(p1Id: string, p2Id: string): string {
  return [p1Id, p2Id].sort().join('_');
}

// ==================== SEASON SUBSCRIPTIONS ====================

export function subscribeToSeasons(callback: (seasons: Season[]) => void) {
  const seasonsRef = ref(db, 'seasons');
  onValue(
    seasonsRef,
    (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      const seasons: Season[] = Object.keys(data)
        .map((key) => ({ ...data[key], id: key }))
        .sort((a, b) => a.seasonNumber - b.seasonNumber);
      callback(seasons);
    },
    (error) => {
      console.warn('Firebase subscribeToSeasons error:', error);
      callback([]);
    }
  );
  return () => off(seasonsRef);
}

export async function getActiveSeason(): Promise<Season | null> {
  const snap = await get(ref(db, 'seasons'));
  if (!snap.exists()) return null;
  const data = snap.val();
  for (const key of Object.keys(data)) {
    if (data[key].status === 'active') {
      return { ...data[key], id: key };
    }
  }
  return null;
}

export async function getAllSeasons(): Promise<Season[]> {
  const snap = await get(ref(db, 'seasons'));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.keys(data)
    .map((key) => ({ ...data[key], id: key }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

export async function getSeasonById(seasonId: string): Promise<Season | null> {
  const snap = await get(ref(db, `seasons/${seasonId}`));
  if (!snap.exists()) return null;
  return { ...snap.val(), id: seasonId };
}

// ==================== FIXTURE SUBSCRIPTIONS ====================

export function subscribeToSeasonFixtures(
  seasonId: string,
  callback: (fixtures: SeasonFixture[]) => void
) {
  const fixturesRef = ref(db, `fixtures/${seasonId}`);
  onValue(
    fixturesRef,
    (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      const fixtures: SeasonFixture[] = [];
      for (const pairKey of Object.keys(data)) {
        const pairFixtures = data[pairKey];
        for (const fixtureId of Object.keys(pairFixtures)) {
          fixtures.push({ ...pairFixtures[fixtureId], id: fixtureId, pairKey });
        }
      }
      callback(fixtures);
    },
    (error) => {
      console.warn('Firebase subscribeToSeasonFixtures error:', error);
      callback([]);
    }
  );
  return () => off(fixturesRef);
}

export async function getFixturesForSeason(seasonId: string): Promise<SeasonFixture[]> {
  const snap = await get(ref(db, `fixtures/${seasonId}`));
  if (!snap.exists()) return [];
  const data = snap.val();
  const fixtures: SeasonFixture[] = [];
  for (const pairKey of Object.keys(data)) {
    const pairFixtures = data[pairKey];
    for (const fixtureId of Object.keys(pairFixtures)) {
      fixtures.push({ ...pairFixtures[fixtureId], id: fixtureId, pairKey });
    }
  }
  return fixtures;
}

// ==================== SEASON 1 MIGRATION ====================

/**
 * Idempotent: Creates Season 1 as a completed historical season from existing data.
 * Associates all non-tournament approved matches with Season 1.
 */
export async function migrateSeason1(): Promise<string> {
  const seasonsSnap = await get(ref(db, 'seasons'));
  if (seasonsSnap.exists()) {
    const data = seasonsSnap.val();
    for (const key of Object.keys(data)) {
      if (data[key].seasonNumber === 1) {
        return key;
      }
    }
  }

  const [matchesSnap, usersSnap] = await Promise.all([
    get(ref(db, 'matches')),
    get(ref(db, 'users')),
  ]);

  const usersData = usersSnap.exists() ? usersSnap.val() : {};
  const userIds = Object.keys(usersData);
  const now = Date.now();

  const s1Stats: Record<string, SeasonPlayerSnapshot> = {};
  for (const uid of userIds) {
    const u = usersData[uid];
    s1Stats[uid] = {
      userId: uid,
      displayName: u.displayName || 'Unknown',
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      stats: {
        dream: createEmptyModeStats(),
        auth: createEmptyModeStats(),
      },
    };
  }

  let matchCount = 0;
  const matchBatch: Record<string, any> = {};

  if (matchesSnap.exists()) {
    const matchesData = matchesSnap.val();
    for (const mk of Object.keys(matchesData)) {
      const m = matchesData[mk];
      const isApproved = (m.status || 'approved') === 'approved';
      const isTournament = !!(m.tournamentId || m.isTournament);
      if (!isApproved || isTournament || m.seasonId) continue;

      matchCount++;

      const p1 = m.player1Id;
      const p2 = m.player2Id;
      const mType: 'dream' | 'auth' = m.matchType || 'dream';
      const s1 = Number(m.player1Score) || 0;
      const s2 = Number(m.player2Score) || 0;
      const isDraw = !!m.isDraw;
      let p1Win = false;
      let p2Win = false;
      if (!isDraw) {
        if (m.winnerId) {
          p1Win = m.winnerId === p1;
          p2Win = m.winnerId === p2;
        } else {
          p1Win = s1 > s2;
          p2Win = s2 > s1;
        }
      }

      const applyStats = (uid: string, gf: number, ga: number, isWin: boolean, isDrawMatch: boolean) => {
        if (!s1Stats[uid]) return;
        const u = s1Stats[uid];
        u.matchesPlayed += 1;
        u.goalsFor += gf;
        u.goalsAgainst += ga;
        u.goalDifference = u.goalsFor - u.goalsAgainst;
        if (isDrawMatch) u.draws += 1;
        else if (isWin) u.wins += 1;
        else u.losses += 1;
        u.points = u.wins * 3 + u.draws - u.losses;
        const ms = u.stats[mType] || createEmptyModeStats();
        ms.matchesPlayed += 1;
        ms.goalsFor += gf;
        ms.goalsAgainst += ga;
        ms.goalDifference = ms.goalsFor - ms.goalsAgainst;
        if (isDrawMatch) ms.draws += 1;
        else if (isWin) ms.wins += 1;
        else ms.losses += 1;
        ms.points = ms.wins * 3 + ms.draws - ms.losses;
        u.stats[mType] = ms;
      };

      if (s1Stats[p1]) applyStats(p1, s1, s2, p1Win, isDraw);
      if (s1Stats[p2]) applyStats(p2, s2, s1, p2Win, isDraw);

      // We'll fill in seasonId after we have the season ID
      matchBatch[mk] = true;
    }
  }

  const sorted = Object.values(s1Stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return b.wins - a.wins;
  });

  const winner = sorted[0];

  const s1Ref = push(ref(db, 'seasons'));
  const s1Id = s1Ref.key!;

  const season1 = {
    seasonNumber: 1,
    name: 'Season 1',
    status: 'completed',
    startedAt: 0,
    endedAt: now,
    winnerId: winner?.userId || null,
    winnerName: winner?.displayName || null,
    playerIds: userIds,
    totalFixtures: matchCount,
    completedFixtures: matchCount,
    isUnstructured: false,
    endedManually: true,
    snapshot: s1Stats,
  };

  await set(s1Ref, season1);

  // Tag matches with season ID and generate completed fixtures for Season 1
  const batchUpdates: Record<string, any> = {};
  if (matchesSnap.exists()) {
    const matchesData = matchesSnap.val();
    for (const mk of Object.keys(matchBatch)) {
      batchUpdates[`matches/${mk}/seasonId`] = s1Id;
      const m = matchesData[mk];
      if (m) {
        const pairKey = getPairKey(m.player1Id, m.player2Id);
        const [p1Id, p2Id] = pairKey.split('_');
        const p1Name = usersData[p1Id]?.displayName || m.player1Name || p1Id;
        const p2Name = usersData[p2Id]?.displayName || m.player2Name || p2Id;
        const fixRef = push(ref(db, `fixtures/${s1Id}/${pairKey}`));
        batchUpdates[`fixtures/${s1Id}/${pairKey}/${fixRef.key}`] = {
          seasonId: s1Id,
          pairKey,
          player1Id: p1Id,
          player2Id: p2Id,
          player1Name: p1Name,
          player2Name: p2Name,
          status: 'completed',
          matchId: mk,
          createdAt: m.createdAt || now,
          completedAt: m.approvedAt ? new Date(m.approvedAt).getTime() : (m.createdAt || now),
        };
      }
    }
  }

  if (Object.keys(batchUpdates).length > 0) {
    await update(ref(db), batchUpdates);
  }

  return s1Id;
}

// ==================== START NEW SEASON ====================

export async function startNewSeason(playerIds: string[]): Promise<string> {
  const active = await getActiveSeason();
  if (active) throw new Error('A season is already active. End the current season before starting a new one.');

  const seasons = await getAllSeasons();
  const nextNumber = seasons.length > 0 ? Math.max(...seasons.map((s) => s.seasonNumber)) + 1 : 2;

  const usersSnap = await get(ref(db, 'users'));
  const usersData = usersSnap.exists() ? usersSnap.val() : {};
  const userNames: Record<string, string> = {};
  for (const uid of playerIds) {
    userNames[uid] = usersData[uid]?.displayName || uid;
  }

  const n = playerIds.length;
  if (n < 2) throw new Error('Need at least 2 players to start a season.');

  const totalFixtures = (15 * n * (n - 1)) / 2;
  const now = Date.now();

  const seasonRef = push(ref(db, 'seasons'));
  const seasonId = seasonRef.key!;

  const season = {
    seasonNumber: nextNumber,
    name: `Season ${nextNumber}`,
    status: 'active',
    startedAt: now,
    playerIds,
    totalFixtures,
    completedFixtures: 0,
    isUnstructured: false,
  };

  await set(seasonRef, season);

  // Generate 15 fixtures per unique pair
  const fixturesBatch: Record<string, any> = {};
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const p1Id = playerIds[i];
      const p2Id = playerIds[j];
      const pairKey = getPairKey(p1Id, p2Id);
      const [canonP1Id, canonP2Id] = pairKey.split('_');
      const p1Name = userNames[canonP1Id] || canonP1Id;
      const p2Name = userNames[canonP2Id] || canonP2Id;

      for (let k = 0; k < 15; k++) {
        const fixRef = push(ref(db, `fixtures/${seasonId}/${pairKey}`));
        const fixId = fixRef.key!;
        fixturesBatch[`fixtures/${seasonId}/${pairKey}/${fixId}`] = {
          seasonId,
          pairKey,
          player1Id: canonP1Id,
          player2Id: canonP2Id,
          player1Name: p1Name,
          player2Name: p2Name,
          status: 'pending',
          createdAt: now,
        };
      }
    }
  }

  await update(ref(db), fixturesBatch);
  return seasonId;
}

// ==================== END SEASON ====================

export async function endSeason(seasonId: string): Promise<void> {
  const seasonRef = ref(db, `seasons/${seasonId}`);
  const snap = await get(seasonRef);
  if (!snap.exists()) throw new Error('Season not found');

  const season: Season = { ...snap.val(), id: seasonId };
  if (season.status === 'completed') throw new Error('Season is already completed');

  const now = Date.now();

  const [matchesSnap, usersSnap] = await Promise.all([
    get(ref(db, 'matches')),
    get(ref(db, 'users')),
  ]);

  const usersData = usersSnap.exists() ? usersSnap.val() : {};
  const snapshot: Record<string, SeasonPlayerSnapshot> = {};

  for (const uid of season.playerIds) {
    const u = usersData[uid] || {};
    snapshot[uid] = {
      userId: uid,
      displayName: u.displayName || 'Unknown',
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      stats: {
        dream: createEmptyModeStats(),
        auth: createEmptyModeStats(),
      },
    };
  }

  if (matchesSnap.exists()) {
    const matchesData = matchesSnap.val();
    for (const mk of Object.keys(matchesData)) {
      const m = matchesData[mk];
      if (m.seasonId !== seasonId) continue;
      if ((m.status || 'approved') !== 'approved') continue;

      const p1 = m.player1Id;
      const p2 = m.player2Id;
      const mType: 'dream' | 'auth' = m.matchType || 'dream';
      const s1 = Number(m.player1Score) || 0;
      const s2 = Number(m.player2Score) || 0;
      const isDraw = !!m.isDraw;
      let p1Win = false;
      let p2Win = false;
      if (!isDraw) {
        if (m.winnerId) {
          p1Win = m.winnerId === p1;
          p2Win = m.winnerId === p2;
        } else {
          p1Win = s1 > s2;
          p2Win = s2 > s1;
        }
      }

      const apply = (uid: string, gf: number, ga: number, isWin: boolean, isDrawMatch: boolean) => {
        if (!snapshot[uid]) return;
        const u = snapshot[uid];
        u.matchesPlayed += 1;
        u.goalsFor += gf;
        u.goalsAgainst += ga;
        u.goalDifference = u.goalsFor - u.goalsAgainst;
        if (isDrawMatch) u.draws += 1;
        else if (isWin) u.wins += 1;
        else u.losses += 1;
        u.points = u.wins * 3 + u.draws - u.losses;
        const ms = u.stats[mType] || createEmptyModeStats();
        ms.matchesPlayed += 1;
        ms.goalsFor += gf;
        ms.goalsAgainst += ga;
        ms.goalDifference = ms.goalsFor - ms.goalsAgainst;
        if (isDrawMatch) ms.draws += 1;
        else if (isWin) ms.wins += 1;
        else ms.losses += 1;
        ms.points = ms.wins * 3 + ms.draws - ms.losses;
        u.stats[mType] = ms;
      };

      apply(p1, s1, s2, p1Win, isDraw);
      apply(p2, s2, s1, p2Win, isDraw);
    }
  }

  const sorted = Object.values(snapshot).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return b.wins - a.wins;
  });

  const winner = sorted[0];

  // Count completed fixtures
  const fixturesSnap = await get(ref(db, `fixtures/${seasonId}`));
  let completedFixtures = 0;
  if (fixturesSnap.exists()) {
    const fd = fixturesSnap.val();
    for (const pairKey of Object.keys(fd)) {
      for (const fid of Object.keys(fd[pairKey])) {
        if (fd[pairKey][fid].status === 'completed') completedFixtures++;
      }
    }
  }

  await update(seasonRef, {
    status: 'completed',
    endedAt: now,
    endedManually: true,
    winnerId: winner?.userId || null,
    winnerName: winner?.displayName || null,
    completedFixtures,
    snapshot,
  });
}

// ==================== FIXTURE COMPLETION ====================

/**
 * Atomically marks one pending fixture as completed.
 * Returns true if a fixture was consumed; false if all 15 are already done.
 */
export async function completeOneFixture(
  seasonId: string,
  player1Id: string,
  player2Id: string,
  matchId: string
): Promise<boolean> {
  const pairKey = getPairKey(player1Id, player2Id);
  const pairRef = ref(db, `fixtures/${seasonId}/${pairKey}`);
  const snap = await get(pairRef);
  if (!snap.exists()) return false;

  const pairData = snap.val();
  const pendingId = Object.keys(pairData).find(
    (fid) => pairData[fid].status === 'pending'
  );
  if (!pendingId) return false;

  const now = Date.now();
  const fixtureRef = ref(db, `fixtures/${seasonId}/${pairKey}/${pendingId}`);

  let consumed = false;
  await runTransaction(fixtureRef, (currentData) => {
    if (!currentData || currentData.status !== 'pending') {
      return; // abort
    }
    consumed = true;
    return {
      ...currentData,
      status: 'completed',
      matchId,
      completedAt: now,
    };
  });

  if (consumed) {
    // Increment season's completedFixtures counter
    const cfSnap = await get(ref(db, `seasons/${seasonId}/completedFixtures`));
    const currentCount = cfSnap.val() || 0;
    await update(ref(db, `seasons/${seasonId}`), {
      completedFixtures: currentCount + 1,
    });
  }

  return consumed;
}

/**
 * Gets fixture progress for a specific pair of players in a season.
 */
export async function getPairFixtureProgress(
  seasonId: string,
  player1Id: string,
  player2Id: string
): Promise<{
  total: number;
  completed: number;
  remaining: number;
  isQuotaReached: boolean;
}> {
  const pairKey = getPairKey(player1Id, player2Id);
  const snap = await get(ref(db, `fixtures/${seasonId}/${pairKey}`));
  if (!snap.exists()) {
    return { total: 0, completed: 0, remaining: 0, isQuotaReached: false };
  }
  const data = snap.val();
  let total = 0;
  let completed = 0;
  for (const fid of Object.keys(data)) {
    total++;
    if (data[fid].status === 'completed') {
      completed++;
    }
  }
  const remaining = Math.max(0, total - completed);
  return {
    total,
    completed,
    remaining,
    isQuotaReached: total > 0 && remaining === 0,
  };
}

/**
 * Recalculates season completedFixtures from actual persisted fixture records.
 */
export async function recalculateSeasonCompletedFixtures(seasonId: string): Promise<number> {
  const fixSnap = await get(ref(db, `fixtures/${seasonId}`));
  let count = 0;
  if (fixSnap.exists()) {
    const data = fixSnap.val();
    for (const pk of Object.keys(data)) {
      const pair = data[pk];
      for (const fid of Object.keys(pair)) {
        if (pair[fid].status === 'completed') {
          count++;
        }
      }
    }
  }
  await update(ref(db, `seasons/${seasonId}`), {
    completedFixtures: count,
  });
  return count;
}

/**
 * Reverts any completed fixture associated with a rejected or deleted match,
 * restoring the fixture back to 'pending' and recalculating the season's completed fixtures.
 */
export async function revertFixtureForMatch(
  matchId: string,
  seasonId?: string,
  player1Id?: string,
  player2Id?: string
): Promise<boolean> {
  const targetSeasonId = seasonId;

  // 1. Try targeted lookup if seasonId and players are known
  if (targetSeasonId && player1Id && player2Id) {
    const pairKey = getPairKey(player1Id, player2Id);
    const snap = await get(ref(db, `fixtures/${targetSeasonId}/${pairKey}`));
    if (snap.exists()) {
      const data = snap.val();
      for (const fid of Object.keys(data)) {
        if (data[fid].matchId === matchId && data[fid].status === 'completed') {
          await update(ref(db, `fixtures/${targetSeasonId}/${pairKey}/${fid}`), {
            status: 'pending',
            matchId: null,
            completedAt: null,
          });
          await recalculateSeasonCompletedFixtures(targetSeasonId);
          return true;
        }
      }
    }
  }

  // 2. Fallback: Search all seasons/fixtures for this matchId
  const seasonsSnap = await get(ref(db, 'seasons'));
  if (seasonsSnap.exists()) {
    const sData = seasonsSnap.val();
    for (const sid of Object.keys(sData)) {
      const fixSnap = await get(ref(db, `fixtures/${sid}`));
      if (fixSnap.exists()) {
        const fData = fixSnap.val();
        for (const pk of Object.keys(fData)) {
          const pData = fData[pk];
          for (const fid of Object.keys(pData)) {
            if (pData[fid].matchId === matchId && pData[fid].status === 'completed') {
              await update(ref(db, `fixtures/${sid}/${pk}/${fid}`), {
                status: 'pending',
                matchId: null,
                completedAt: null,
              });
              await recalculateSeasonCompletedFixtures(sid);
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

// ==================== SEASON LEADERBOARD COMPUTATION ====================

export async function computeSeasonLeaderboard(
  seasonId: string,
  playerIds: string[]
): Promise<SeasonPlayerSnapshot[]> {
  const [matchesSnap, usersSnap] = await Promise.all([
    get(ref(db, 'matches')),
    get(ref(db, 'users')),
  ]);

  const usersData = usersSnap.exists() ? usersSnap.val() : {};
  const stats: Record<string, SeasonPlayerSnapshot> = {};

  for (const uid of playerIds) {
    const u = usersData[uid] || {};
    stats[uid] = {
      userId: uid,
      displayName: u.displayName || 'Unknown',
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      stats: {
        dream: createEmptyModeStats(),
        auth: createEmptyModeStats(),
      },
    };
  }

  if (matchesSnap.exists()) {
    const matchesData = matchesSnap.val();
    for (const mk of Object.keys(matchesData)) {
      const m = matchesData[mk];
      if (m.seasonId !== seasonId) continue;
      if ((m.status || 'approved') !== 'approved') continue;

      const p1 = m.player1Id;
      const p2 = m.player2Id;
      const mType: 'dream' | 'auth' = m.matchType || 'dream';
      const s1 = Number(m.player1Score) || 0;
      const s2 = Number(m.player2Score) || 0;
      const isDraw = !!m.isDraw;
      let p1Win = false;
      let p2Win = false;
      if (!isDraw) {
        if (m.winnerId) {
          p1Win = m.winnerId === p1;
          p2Win = m.winnerId === p2;
        } else {
          p1Win = s1 > s2;
          p2Win = s2 > s1;
        }
      }

      const apply = (uid: string, gf: number, ga: number, isWin: boolean, isDrawMatch: boolean) => {
        if (!stats[uid]) return;
        const u = stats[uid];
        u.matchesPlayed += 1;
        u.goalsFor += gf;
        u.goalsAgainst += ga;
        u.goalDifference = u.goalsFor - u.goalsAgainst;
        if (isDrawMatch) u.draws += 1;
        else if (isWin) u.wins += 1;
        else u.losses += 1;
        u.points = u.wins * 3 + u.draws - u.losses;
        const ms = u.stats[mType] || createEmptyModeStats();
        ms.matchesPlayed += 1;
        ms.goalsFor += gf;
        ms.goalsAgainst += ga;
        ms.goalDifference = ms.goalsFor - ms.goalsAgainst;
        if (isDrawMatch) ms.draws += 1;
        else if (isWin) ms.wins += 1;
        else ms.losses += 1;
        ms.points = ms.wins * 3 + ms.draws - ms.losses;
        u.stats[mType] = ms;
      };

      apply(p1, s1, s2, p1Win, isDraw);
      apply(p2, s2, s1, p2Win, isDraw);
    }
  }

  return Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return b.wins - a.wins;
  });
}

export async function computeAllTimeLeaderboard(): Promise<SeasonPlayerSnapshot[]> {
  const [matchesSnap, usersSnap] = await Promise.all([
    get(ref(db, 'matches')),
    get(ref(db, 'users')),
  ]);

  const usersData = usersSnap.exists() ? usersSnap.val() : {};
  const userIds = Object.keys(usersData);

  const stats: Record<string, SeasonPlayerSnapshot> = {};
  for (const uid of userIds) {
    const u = usersData[uid] || {};
    stats[uid] = {
      userId: uid,
      displayName: u.displayName || 'Unknown',
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      stats: {
        dream: createEmptyModeStats(),
        auth: createEmptyModeStats(),
      },
    };
  }

  if (matchesSnap.exists()) {
    const matchesData = matchesSnap.val();
    for (const mk of Object.keys(matchesData)) {
      const m = matchesData[mk];
      if ((m.status || 'approved') !== 'approved') continue;

      const p1 = m.player1Id;
      const p2 = m.player2Id;
      const mType: 'dream' | 'auth' = m.matchType || 'dream';
      const s1 = Number(m.player1Score) || 0;
      const s2 = Number(m.player2Score) || 0;
      const isDraw = !!m.isDraw;
      let p1Win = false;
      let p2Win = false;
      if (!isDraw) {
        if (m.winnerId) {
          p1Win = m.winnerId === p1;
          p2Win = m.winnerId === p2;
        } else {
          p1Win = s1 > s2;
          p2Win = s2 > s1;
        }
      }

      const apply = (uid: string, gf: number, ga: number, isWin: boolean, isDrawMatch: boolean) => {
        if (!stats[uid]) return;
        const u = stats[uid];
        u.matchesPlayed += 1;
        u.goalsFor += gf;
        u.goalsAgainst += ga;
        u.goalDifference = u.goalsFor - u.goalsAgainst;
        if (isDrawMatch) u.draws += 1;
        else if (isWin) u.wins += 1;
        else u.losses += 1;
        u.points = u.wins * 3 + u.draws - u.losses;
        const ms = u.stats[mType] || createEmptyModeStats();
        ms.matchesPlayed += 1;
        ms.goalsFor += gf;
        ms.goalsAgainst += ga;
        ms.goalDifference = ms.goalsFor - ms.goalsAgainst;
        if (isDrawMatch) ms.draws += 1;
        else if (isWin) ms.wins += 1;
        else ms.losses += 1;
        ms.points = ms.wins * 3 + ms.draws - ms.losses;
        u.stats[mType] = ms;
      };

      apply(p1, s1, s2, p1Win, isDraw);
      apply(p2, s2, s1, p2Win, isDraw);
    }
  }

  return Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return b.wins - a.wins;
  });
}

// ==================== FIXTURE STATS FOR DISPLAY ====================

export interface PairFixtureStats {
  pairKey: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  total: number;
  completed: number;
  pending: number;
}

export interface PlayerFixtureStats {
  userId: string;
  displayName: string;
  totalFixtures: number;
  completedFixtures: number;
  remainingFixtures: number;
}

export async function getFixtureStats(
  seasonId: string,
  playerIds: string[]
): Promise<{
  byPair: PairFixtureStats[];
  byPlayer: PlayerFixtureStats[];
  total: number;
  completed: number;
  pending: number;
}> {
  const [snap, usersSnap] = await Promise.all([
    get(ref(db, `fixtures/${seasonId}`)),
    get(ref(db, 'users')),
  ]);
  const usersData = usersSnap.exists() ? usersSnap.val() : {};

  const byPair: Record<string, PairFixtureStats> = {};
  const byPlayer: Record<string, { completed: number; total: number }> = {};
  let total = 0;
  let completed = 0;

  for (const uid of playerIds) {
    byPlayer[uid] = { completed: 0, total: 0 };
  }

  if (snap.exists()) {
    const data = snap.val();
    for (const pairKey of Object.keys(data)) {
      const [p1Id, p2Id] = pairKey.split('_');
      const pairData = data[pairKey];
      let pairTotal = 0;
      let pairCompleted = 0;
      let p1Name = usersData[p1Id]?.displayName || p1Id;
      let p2Name = usersData[p2Id]?.displayName || p2Id;

      for (const fid of Object.keys(pairData)) {
        const f = pairData[fid];
        pairTotal++;
        total++;
        if (f.player1Name) p1Name = f.player1Name;
        if (f.player2Name) p2Name = f.player2Name;
        if (f.status === 'completed') {
          pairCompleted++;
          completed++;
          if (byPlayer[p1Id]) byPlayer[p1Id].completed++;
          if (byPlayer[p2Id]) byPlayer[p2Id].completed++;
        }
        if (byPlayer[p1Id]) byPlayer[p1Id].total++;
        if (byPlayer[p2Id]) byPlayer[p2Id].total++;
      }

      byPair[pairKey] = {
        pairKey,
        player1Id: p1Id,
        player2Id: p2Id,
        player1Name: p1Name,
        player2Name: p2Name,
        total: pairTotal,
        completed: pairCompleted,
        pending: pairTotal - pairCompleted,
      };
    }
  }

  const byPlayerArr: PlayerFixtureStats[] = playerIds.map((uid) => {
    const u = usersData[uid] || {};
    const ps = byPlayer[uid] || { completed: 0, total: 0 };
    return {
      userId: uid,
      displayName: u.displayName || uid,
      totalFixtures: ps.total,
      completedFixtures: ps.completed,
      remainingFixtures: ps.total - ps.completed,
    };
  });

  return {
    byPair: Object.values(byPair),
    byPlayer: byPlayerArr,
    total,
    completed,
    pending: total - completed,
  };
}

/**
 * Checks whether a regular-season fixture slot is available for the pair in the active season.
 */
export async function checkFixtureAvailability(
  player1Id: string,
  player2Id: string
): Promise<{ seasonId: string; pairKey: string } | null> {
  const active = await getActiveSeason();
  if (!active) return null;

  const p1InSeason = active.playerIds.includes(player1Id);
  const p2InSeason = active.playerIds.includes(player2Id);
  if (!p1InSeason || !p2InSeason) return null;

  const pairKey = getPairKey(player1Id, player2Id);
  const snap = await get(ref(db, `fixtures/${active.id}/${pairKey}`));
  if (!snap.exists()) return null;

  const data = snap.val();
  const hasPending = Object.values(data as Record<string, any>).some(
    (f: any) => f.status === 'pending'
  );

  if (!hasPending) return null;
  return { seasonId: active.id, pairKey };
}
