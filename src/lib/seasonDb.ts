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

// ==================== HPS HELPER FUNCTIONS ====================

export function isSeasonHps(season: Season | null | undefined): boolean {
  if (!season) return false;
  if (season.rankingSystem === 'hps') return true;
  if (season.rankingSystem === 'legacy_pts') return false;
  // Season 1 & 2 are historical legacy seasons as requested by user
  if (season.seasonNumber <= 2) return false;
  return true;
}

export interface MatchHpsResult {
  totalHps: number;
  resultPoints: number;
  gdBonus: number;
  cleanSheetBonus: number;
  handicapBonus: number;
}

/**
 * Calculates HPS for a single player in an approved match:
 * Formula: HPS = R + G + C + H
 * R: Win = 3, Draw = 1, Loss = 0
 * G: Winner's goal margin (+0.25 per goal, max 4 goals / +1.00). Normal time score only.
 * C: Clean sheet bonus (+0.25) only for win where opponent scores 0.
 * H: Handicap (+0.75 or configured) added for designated player on every approved match regardless of result.
 */
export function calculateMatchHps(
  match: {
    status?: string;
    player1Id: string;
    player2Id: string;
    player1Score: number;
    player2Score: number;
    isDraw?: boolean;
    winnerId?: string;
  },
  playerId: string,
  handicapPlayerId?: string | null,
  handicapBonus: number = 0.75
): MatchHpsResult {
  if ((match.status || 'approved') !== 'approved') {
    return { totalHps: 0, resultPoints: 0, gdBonus: 0, cleanSheetBonus: 0, handicapBonus: 0 };
  }

  const isP1 = match.player1Id === playerId;
  const isP2 = match.player2Id === playerId;
  if (!isP1 && !isP2) {
    return { totalHps: 0, resultPoints: 0, gdBonus: 0, cleanSheetBonus: 0, handicapBonus: 0 };
  }

  const myScore = isP1 ? Number(match.player1Score) || 0 : Number(match.player2Score) || 0;
  const oppScore = isP1 ? Number(match.player2Score) || 0 : Number(match.player1Score) || 0;

  let isWin = false;
  let isDraw = !!match.isDraw;

  if (!isDraw) {
    if (match.winnerId) {
      isWin = match.winnerId === playerId;
    } else {
      isWin = myScore > oppScore;
      isDraw = myScore === oppScore;
    }
  }

  // 1. Result points R: Win = 3, Draw = 1, Loss = 0
  const resultPoints = isWin ? 3 : isDraw ? 1 : 0;

  // 2. Goal-difference bonus G:
  // Winner's goal margin, +0.25 per goal, max 4 goals (0 to +1.00).
  // Normal time score, not penalty shootout margin.
  let gdBonus = 0;
  if (isWin) {
    const margin = Math.max(0, myScore - oppScore);
    gdBonus = Math.min(1.00, Math.max(0, margin * 0.25));
  }

  // 3. Clean-sheet bonus C:
  // Win without conceding a goal (+0.25). Only awarded for a win where opponent scores 0.
  let cleanSheetBonus = 0;
  if (isWin && oppScore === 0) {
    cleanSheetBonus = 0.25;
  }

  // 4. Handicap H:
  // Added to designated player for every approved match, regardless of result (+0.75 default).
  let handicapVal = 0;
  if (handicapPlayerId && playerId === handicapPlayerId) {
    handicapVal = typeof handicapBonus === 'number' ? handicapBonus : 0.75;
  }

  const totalHps = Number((resultPoints + gdBonus + cleanSheetBonus + handicapVal).toFixed(2));

  return {
    totalHps,
    resultPoints,
    gdBonus,
    cleanSheetBonus,
    handicapBonus: handicapVal,
  };
}

// ==================== START NEW SEASON ====================

export interface StartSeasonOptions {
  playerIds: string[];
  handicapPlayerId?: string | null;
  handicapPlayerName?: string | null;
  handicapBonus?: number;
  minMatchesRequired?: number;
}

export async function startNewSeason(
  optionsOrPlayerIds: string[] | StartSeasonOptions
): Promise<string> {
  const options: StartSeasonOptions = Array.isArray(optionsOrPlayerIds)
    ? { playerIds: optionsOrPlayerIds }
    : optionsOrPlayerIds;

  const {
    playerIds,
    handicapPlayerId = null,
    handicapPlayerName = null,
    handicapBonus = 0.75,
    minMatchesRequired = 35,
  } = options;

  const active = await getActiveSeason();
  if (active) throw new Error('A season is already active. End the current season before starting a new one.');

  const seasons = await getAllSeasons();
  const nextNumber = seasons.length > 0 ? Math.max(...seasons.map((s) => s.seasonNumber)) + 1 : 2;

  const usersSnap = await get(ref(db, 'users'));
  const usersData = usersSnap.exists() ? usersSnap.val() : {};

  let resolvedHandicapName = handicapPlayerName;
  if (handicapPlayerId && !resolvedHandicapName && usersData[handicapPlayerId]) {
    resolvedHandicapName = usersData[handicapPlayerId].displayName || null;
  }

  const n = playerIds.length;
  if (n < 2) throw new Error('Need at least 2 players to start a season.');

  const now = Date.now();

  const seasonRef = push(ref(db, 'seasons'));
  const seasonId = seasonRef.key!;

  const season: Season = {
    id: seasonId,
    seasonNumber: nextNumber,
    name: `Season ${nextNumber}`,
    status: 'active',
    startedAt: now,
    playerIds,
    totalFixtures: 0,
    completedFixtures: 0,
    isUnstructured: true,
    rankingSystem: 'hps',
    handicapPlayerId: handicapPlayerId || null,
    handicapPlayerName: resolvedHandicapName || null,
    handicapBonus: typeof handicapBonus === 'number' ? handicapBonus : 0.75,
    minMatchesRequired: typeof minMatchesRequired === 'number' ? minMatchesRequired : 35,
  };

  await set(seasonRef, season);
  return seasonId;
}

// ==================== UPDATE SEASON SETTINGS ====================

export async function updateSeasonSettings(
  seasonId: string,
  settings: {
    handicapPlayerId?: string | null;
    handicapPlayerName?: string | null;
    handicapBonus?: number;
    minMatchesRequired?: number;
    rankingSystem?: 'legacy_pts' | 'hps';
  }
): Promise<void> {
  const seasonRef = ref(db, `seasons/${seasonId}`);
  const snap = await get(seasonRef);
  if (!snap.exists()) throw new Error('Season not found');

  const updates: Record<string, any> = {};
  if (settings.handicapPlayerId !== undefined) {
    updates.handicapPlayerId = settings.handicapPlayerId;
    if (settings.handicapPlayerId) {
      const uSnap = await get(ref(db, `users/${settings.handicapPlayerId}`));
      updates.handicapPlayerName = uSnap.exists() ? (uSnap.val().displayName || null) : null;
    } else {
      updates.handicapPlayerName = null;
    }
  }
  if (settings.handicapBonus !== undefined) {
    updates.handicapBonus = Number(settings.handicapBonus) || 0.75;
  }
  if (settings.minMatchesRequired !== undefined) {
    updates.minMatchesRequired = Number(settings.minMatchesRequired) || 35;
  }
  if (settings.rankingSystem !== undefined) {
    updates.rankingSystem = settings.rankingSystem;
  }

  await update(seasonRef, updates);
}

// ==================== END SEASON ====================

export async function endSeason(seasonId: string): Promise<void> {
  const seasonRef = ref(db, `seasons/${seasonId}`);
  const snap = await get(seasonRef);
  if (!snap.exists()) throw new Error('Season not found');

  const season: Season = { ...snap.val(), id: seasonId };
  if (season.status === 'completed') throw new Error('Season is already completed');

  const now = Date.now();
  const useHps = isSeasonHps(season);

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
      ppg: 0,
      totalHps: 0,
      avgHps: 0,
      meetsMinimumMatches: true,
      hpsBreakdown: {
        resultPoints: 0,
        gdBonus: 0,
        cleanSheetBonus: 0,
        handicapBonus: 0,
      },
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

        if (useHps) {
          const hpsRes = calculateMatchHps(m, uid, season.handicapPlayerId, season.handicapBonus ?? 0.75);
          u.totalHps = Number(((u.totalHps || 0) + hpsRes.totalHps).toFixed(2));
          if (!u.hpsBreakdown) {
            u.hpsBreakdown = { resultPoints: 0, gdBonus: 0, cleanSheetBonus: 0, handicapBonus: 0 };
          }
          u.hpsBreakdown.resultPoints += hpsRes.resultPoints;
          u.hpsBreakdown.gdBonus = Number((u.hpsBreakdown.gdBonus + hpsRes.gdBonus).toFixed(2));
          u.hpsBreakdown.cleanSheetBonus = Number((u.hpsBreakdown.cleanSheetBonus + hpsRes.cleanSheetBonus).toFixed(2));
          u.hpsBreakdown.handicapBonus = Number((u.hpsBreakdown.handicapBonus + hpsRes.handicapBonus).toFixed(2));
        }

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

  // Finalize averages and minimum match criteria
  const minMatches = season.minMatchesRequired ?? 35;
  for (const uid of Object.keys(snapshot)) {
    const u = snapshot[uid];
    u.ppg = u.matchesPlayed > 0 ? Number((u.points / u.matchesPlayed).toFixed(2)) : 0;
    if (useHps) {
      u.avgHps = u.matchesPlayed > 0 ? Number(((u.totalHps || 0) / u.matchesPlayed).toFixed(2)) : 0;
      u.meetsMinimumMatches = u.matchesPlayed >= minMatches;
    }
  }

  let winnerId: string | null = null;
  let winnerName: string | null = null;

  if (useHps) {
    // When Season End is clicked:
    // Players with at least 35 approved matches are ranked by average HPS.
    // Anyone with fewer than 35 matches is moved to bottom (e.g. 4th) and marked "Minimum Requirements Not Met".
    const eligible: SeasonPlayerSnapshot[] = [];
    const ineligible: SeasonPlayerSnapshot[] = [];

    for (const player of Object.values(snapshot)) {
      if (player.meetsMinimumMatches) {
        eligible.push(player);
      } else {
        ineligible.push(player);
      }
    }

    const hpsSorter = (a: SeasonPlayerSnapshot, b: SeasonPlayerSnapshot) => {
      if ((b.avgHps ?? 0) !== (a.avgHps ?? 0)) return (b.avgHps ?? 0) - (a.avgHps ?? 0);
      if ((b.totalHps ?? 0) !== (a.totalHps ?? 0)) return (b.totalHps ?? 0) - (a.totalHps ?? 0);
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return b.wins - a.wins;
    };

    eligible.sort(hpsSorter);
    ineligible.sort(hpsSorter);

    const winner = eligible.length > 0 ? eligible[0] : (ineligible.length > 0 ? ineligible[0] : null);
    winnerId = winner?.userId || null;
    winnerName = winner?.displayName || null;
  } else {
    // Legacy seasons (Season 1 and 2):
    // Ranked by standard PTS system, goal difference, goals for, wins
    const sorted = Object.values(snapshot).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return b.wins - a.wins;
    });
    const winner = sorted[0];
    winnerId = winner?.userId || null;
    winnerName = winner?.displayName || null;
  }

  // Count total approved matches in this season
  let seasonMatchCount = 0;
  if (matchesSnap.exists()) {
    const matchesData = matchesSnap.val();
    for (const mk of Object.keys(matchesData)) {
      const m = matchesData[mk];
      if (m.seasonId === seasonId && (m.status || 'approved') === 'approved') {
        seasonMatchCount++;
      }
    }
  }

  await update(seasonRef, {
    status: 'completed',
    endedAt: now,
    endedManually: true,
    winnerId,
    winnerName,
    totalFixtures: seasonMatchCount,
    completedFixtures: seasonMatchCount,
    isUnstructured: true,
    snapshot,
  });
}

// ==================== FIXTURE HELPERS (COMPATIBILITY) ====================

/**
 * No-op in fluid seasons (matches are unlimited).
 */
export async function completeOneFixture(
  _seasonId: string,
  _player1Id: string,
  _player2Id: string,
  _matchId: string
): Promise<boolean> {
  return false;
}

/**
 * In fluid seasons, quotas are never reached and matches are unlimited.
 */
export async function getPairFixtureProgress(
  _seasonId: string,
  _player1Id: string,
  _player2Id: string
): Promise<{
  total: number;
  completed: number;
  remaining: number;
  isQuotaReached: boolean;
}> {
  return {
    total: 0,
    completed: 0,
    remaining: 999,
    isQuotaReached: false,
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
  _matchId: string,
  _seasonId?: string,
  _player1Id?: string,
  _player2Id?: string
): Promise<boolean> {
  return false;
}

// ==================== SEASON LEADERBOARD COMPUTATION ====================

// ==================== SEASON LEADERBOARD COMPUTATION ====================

export async function computeSeasonLeaderboard(
  seasonId: string,
  playerIds: string[]
): Promise<SeasonPlayerSnapshot[]> {
  const [seasonSnap, matchesSnap, usersSnap] = await Promise.all([
    get(ref(db, `seasons/${seasonId}`)),
    get(ref(db, 'matches')),
    get(ref(db, 'users')),
  ]);

  const season: Season | null = seasonSnap.exists()
    ? ({ ...seasonSnap.val(), id: seasonId } as Season)
    : null;
  const useHps = isSeasonHps(season);

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
      ppg: 0,
      totalHps: 0,
      avgHps: 0,
      meetsMinimumMatches: true,
      hpsBreakdown: {
        resultPoints: 0,
        gdBonus: 0,
        cleanSheetBonus: 0,
        handicapBonus: 0,
      },
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

        if (useHps && season) {
          const hpsRes = calculateMatchHps(m, uid, season.handicapPlayerId, season.handicapBonus ?? 0.75);
          u.totalHps = Number(((u.totalHps || 0) + hpsRes.totalHps).toFixed(2));
          if (!u.hpsBreakdown) {
            u.hpsBreakdown = { resultPoints: 0, gdBonus: 0, cleanSheetBonus: 0, handicapBonus: 0 };
          }
          u.hpsBreakdown.resultPoints += hpsRes.resultPoints;
          u.hpsBreakdown.gdBonus = Number((u.hpsBreakdown.gdBonus + hpsRes.gdBonus).toFixed(2));
          u.hpsBreakdown.cleanSheetBonus = Number((u.hpsBreakdown.cleanSheetBonus + hpsRes.cleanSheetBonus).toFixed(2));
          u.hpsBreakdown.handicapBonus = Number((u.hpsBreakdown.handicapBonus + hpsRes.handicapBonus).toFixed(2));
        }

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

  const minMatches = season?.minMatchesRequired ?? 35;
  for (const uid of Object.keys(stats)) {
    const u = stats[uid];
    u.ppg = u.matchesPlayed > 0 ? Number((u.points / u.matchesPlayed).toFixed(2)) : 0;
    if (useHps) {
      u.avgHps = u.matchesPlayed > 0 ? Number(((u.totalHps || 0) / u.matchesPlayed).toFixed(2)) : 0;
      u.meetsMinimumMatches = u.matchesPlayed >= minMatches;
    }
  }

  if (useHps) {
    // Ranked by average HPS during season
    return Object.values(stats).sort((a, b) => {
      if ((b.avgHps ?? 0) !== (a.avgHps ?? 0)) return (b.avgHps ?? 0) - (a.avgHps ?? 0);
      if ((b.totalHps ?? 0) !== (a.totalHps ?? 0)) return (b.totalHps ?? 0) - (a.totalHps ?? 0);
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return b.wins - a.wins;
    });
  }

  // Legacy seasons (Season 1 and 2):
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
      ppg: 0,
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

  for (const uid of Object.keys(stats)) {
    const u = stats[uid];
    u.ppg = u.matchesPlayed > 0 ? Number((u.points / u.matchesPlayed).toFixed(2)) : 0;
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
