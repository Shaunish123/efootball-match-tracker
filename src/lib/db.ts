import { db } from './firebase';
import {
  ref,
  push,
  set,
  get,
  remove,
  update,
  onValue,
  off,
  DataSnapshot,
} from 'firebase/database';
import { User, Match, Tournament, TournamentMatch, TournamentBracket, H2HRecord, MatchType, ModeStats } from './types';

// Helper for default mode stats
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

// ==================== USER OPERATIONS ====================

export function subscribeToUsers(callback: (users: User[]) => void) {
  const usersRef = ref(db, 'users');
  const unsubscribe = onValue(
    usersRef,
    (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      const users: User[] = Object.keys(data).map((key) => {
        const u = data[key];
        const wins = u.wins || 0;
        const draws = u.draws || 0;
        const losses = u.losses || 0;
        const points = u.points ?? (wins * 3 + draws * 1 - losses * 1);
        const goalsFor = u.goalsFor || 0;
        const goalsAgainst = u.goalsAgainst || 0;
        const goalDifference = u.goalDifference ?? (goalsFor - goalsAgainst);

        const dreamStats = u.stats?.dream || createEmptyModeStats();
        const authStats = u.stats?.auth || createEmptyModeStats();

        return {
          ...u,
          id: key,
          matchesPlayed: u.matchesPlayed || 0,
          wins,
          draws,
          losses,
          points,
          goalsFor,
          goalsAgainst,
          goalDifference,
          stats: {
            dream: dreamStats,
            auth: authStats,
          },
        };
      });
      callback(users);
    },
    (error) => {
      console.warn('Firebase subscribeToUsers error:', error);
      callback([]);
    }
  );
  return () => off(usersRef);
}

export async function addUser(displayName: string, efootballUsername: string): Promise<string> {
  const usersRef = ref(db, 'users');
  const newRef = push(usersRef);
  const user: Omit<User, 'id'> = {
    displayName,
    efootballUsername,
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
    createdAt: Date.now(),
  };
  await set(newRef, user);
  return newRef.key!;
}

export async function deleteUser(userId: string): Promise<void> {
  await remove(ref(db, `users/${userId}`));
  // Also remove H2H records for this user from all other users
  const usersSnap = await get(ref(db, 'users'));
  if (usersSnap.exists()) {
    const updates: Record<string, null> = {};
    Object.keys(usersSnap.val()).forEach((uid) => {
      updates[`h2h/${uid}/${userId}`] = null;
    });
    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
    }
  }
  await remove(ref(db, `h2h/${userId}`));
}

export async function getUserById(userId: string): Promise<User | null> {
  const snap = await get(ref(db, `users/${userId}`));
  if (!snap.exists()) return null;
  const u = snap.val();
  const wins = u.wins || 0;
  const draws = u.draws || 0;
  const losses = u.losses || 0;
  const points = u.points ?? (wins * 3 + draws * 1 - losses * 1);
  const goalsFor = u.goalsFor || 0;
  const goalsAgainst = u.goalsAgainst || 0;
  const goalDifference = u.goalDifference ?? (goalsFor - goalsAgainst);

  return {
    ...u,
    id: userId,
    matchesPlayed: u.matchesPlayed || 0,
    wins,
    draws,
    losses,
    points,
    goalsFor,
    goalsAgainst,
    goalDifference,
    stats: {
      dream: u.stats?.dream || createEmptyModeStats(),
      auth: u.stats?.auth || createEmptyModeStats(),
    },
  };
}

// ==================== H2H OPERATIONS ====================

export function subscribeToH2H(userId: string, callback: (records: H2HRecord[]) => void) {
  const h2hRef = ref(db, `h2h/${userId}`);
  const unsubscribe = onValue(
    h2hRef,
    (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      const records: H2HRecord[] = Object.keys(data).map((key) => {
        const d = data[key];
        return {
          opponentId: key,
          opponentName: d.opponentName || 'Unknown',
          wins: d.wins || 0,
          draws: d.draws || 0,
          losses: d.losses || 0,
          dream: d.dream || { wins: d.wins || 0, draws: d.draws || 0, losses: d.losses || 0 },
          auth: d.auth || { wins: d.auth?.wins || 0, draws: d.auth?.draws || 0, losses: d.auth?.losses || 0 },
        };
      });
      callback(records);
    },
    (error) => {
      console.warn('Firebase subscribeToH2H error:', error);
      callback([]);
    }
  );
  return () => off(h2hRef);
}

async function updateH2H(
  p1Id: string,
  p1Name: string,
  p2Id: string,
  p2Name: string,
  outcome: 'p1_win' | 'p2_win' | 'draw',
  matchType: MatchType
): Promise<void> {
  // Update Player 1 H2H against Player 2
  const p1H2HRef = ref(db, `h2h/${p1Id}/${p2Id}`);
  const p1Snap = await get(p1H2HRef);
  const p1Data = p1Snap.exists() ? p1Snap.val() : {};

  const p1ModeH2H = p1Data[matchType] || { wins: 0, draws: 0, losses: 0 };
  const p1Wins = (p1Data.wins || 0) + (outcome === 'p1_win' ? 1 : 0);
  const p1Draws = (p1Data.draws || 0) + (outcome === 'draw' ? 1 : 0);
  const p1Losses = (p1Data.losses || 0) + (outcome === 'p2_win' ? 1 : 0);

  const p1MWins = (p1ModeH2H.wins || 0) + (outcome === 'p1_win' ? 1 : 0);
  const p1MDraws = (p1ModeH2H.draws || 0) + (outcome === 'draw' ? 1 : 0);
  const p1MLosses = (p1ModeH2H.losses || 0) + (outcome === 'p2_win' ? 1 : 0);

  await set(p1H2HRef, {
    ...p1Data,
    opponentName: p2Name,
    wins: p1Wins,
    draws: p1Draws,
    losses: p1Losses,
    [matchType]: {
      wins: p1MWins,
      draws: p1MDraws,
      losses: p1MLosses,
    },
  });

  // Update Player 2 H2H against Player 1
  const p2H2HRef = ref(db, `h2h/${p2Id}/${p1Id}`);
  const p2Snap = await get(p2H2HRef);
  const p2Data = p2Snap.exists() ? p2Snap.val() : {};

  const p2ModeH2H = p2Data[matchType] || { wins: 0, draws: 0, losses: 0 };
  const p2Wins = (p2Data.wins || 0) + (outcome === 'p2_win' ? 1 : 0);
  const p2Draws = (p2Data.draws || 0) + (outcome === 'draw' ? 1 : 0);
  const p2Losses = (p2Data.losses || 0) + (outcome === 'p1_win' ? 1 : 0);

  const p2MWins = (p2ModeH2H.wins || 0) + (outcome === 'p2_win' ? 1 : 0);
  const p2MDraws = (p2ModeH2H.draws || 0) + (outcome === 'draw' ? 1 : 0);
  const p2MLosses = (p2ModeH2H.losses || 0) + (outcome === 'p1_win' ? 1 : 0);

  await set(p2H2HRef, {
    ...p2Data,
    opponentName: p1Name,
    wins: p2Wins,
    draws: p2Draws,
    losses: p2Losses,
    [matchType]: {
      wins: p2MWins,
      draws: p2MDraws,
      losses: p2MLosses,
    },
  });
}

// Helper function to update single user stats
async function updateUserStats(
  userId: string,
  matchType: MatchType,
  result: 'win' | 'draw' | 'loss',
  goalsFor: number,
  goalsAgainst: number
): Promise<void> {
  const userRef = ref(db, `users/${userId}`);
  const snap = await get(userRef);
  if (!snap.exists()) return;

  const data = snap.val();

  // Combined stats
  const cPlayed = (data.matchesPlayed || 0) + 1;
  const cWins = (data.wins || 0) + (result === 'win' ? 1 : 0);
  const cDraws = (data.draws || 0) + (result === 'draw' ? 1 : 0);
  const cLosses = (data.losses || 0) + (result === 'loss' ? 1 : 0);
  const cPoints = cWins * 3 + cDraws * 1 - cLosses * 1;
  const cGF = (data.goalsFor || 0) + goalsFor;
  const cGA = (data.goalsAgainst || 0) + goalsAgainst;
  const cGD = cGF - cGA;

  // Mode stats
  const modeStats = data.stats?.[matchType] || createEmptyModeStats();

  const mPlayed = (modeStats.matchesPlayed || 0) + 1;
  const mWins = (modeStats.wins || 0) + (result === 'win' ? 1 : 0);
  const mDraws = (modeStats.draws || 0) + (result === 'draw' ? 1 : 0);
  const mLosses = (modeStats.losses || 0) + (result === 'loss' ? 1 : 0);
  const mPoints = mWins * 3 + mDraws * 1 - mLosses * 1;
  const mGF = (modeStats.goalsFor || 0) + goalsFor;
  const mGA = (modeStats.goalsAgainst || 0) + goalsAgainst;
  const mGD = mGF - mGA;

  await update(userRef, {
    matchesPlayed: cPlayed,
    wins: cWins,
    draws: cDraws,
    losses: cLosses,
    points: cPoints,
    goalsFor: cGF,
    goalsAgainst: cGA,
    goalDifference: cGD,
    [`stats/${matchType}`]: {
      matchesPlayed: mPlayed,
      wins: mWins,
      draws: mDraws,
      losses: mLosses,
      points: mPoints,
      goalsFor: mGF,
      goalsAgainst: mGA,
      goalDifference: mGD,
    },
  });
}

// ==================== MATCH OPERATIONS ====================

export function subscribeToMatches(callback: (matches: Match[]) => void) {
  const matchesRef = ref(db, 'matches');
  const unsubscribe = onValue(
    matchesRef,
    async (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      const usersSnap = await get(ref(db, 'users'));
      const usersData = usersSnap.exists() ? usersSnap.val() : {};

      const matches: Match[] = Object.keys(data)
        .map((key) => {
          const item = data[key];
          const p1Name = usersData[item.player1Id]?.displayName || item.player1Name;
          const p2Name = usersData[item.player2Id]?.displayName || item.player2Name;
          const winnerName = item.winnerId ? (usersData[item.winnerId]?.displayName || item.winnerName) : undefined;
          const loserName = item.loserId ? (usersData[item.loserId]?.displayName || item.loserName) : undefined;

          return {
            ...item,
            id: key,
            player1Name: p1Name,
            player2Name: p2Name,
            winnerName,
            loserName,
            matchType: item.matchType || 'dream',
            isDraw: !!item.isDraw,
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(matches);
    },
    (error) => {
      console.warn('Firebase subscribeToMatches error:', error);
      callback([]);
    }
  );
  return () => off(matchesRef);
}

export function subscribeToUserMatches(userId: string, callback: (matches: Match[]) => void) {
  const matchesRef = ref(db, 'matches');
  const unsubscribe = onValue(
    matchesRef,
    async (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      const usersSnap = await get(ref(db, 'users'));
      const usersData = usersSnap.exists() ? usersSnap.val() : {};

      const matches: Match[] = Object.keys(data)
        .map((key) => {
          const item = data[key];
          const p1Name = usersData[item.player1Id]?.displayName || item.player1Name;
          const p2Name = usersData[item.player2Id]?.displayName || item.player2Name;
          const winnerName = item.winnerId ? (usersData[item.winnerId]?.displayName || item.winnerName) : undefined;
          const loserName = item.loserId ? (usersData[item.loserId]?.displayName || item.loserName) : undefined;

          return {
            ...item,
            id: key,
            player1Name: p1Name,
            player2Name: p2Name,
            winnerName,
            loserName,
            matchType: item.matchType || 'dream',
            isDraw: !!item.isDraw,
          };
        })
        .filter((m) => m.player1Id === userId || m.player2Id === userId)
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(matches);
    },
    (error) => {
      console.warn('Firebase subscribeToUserMatches error:', error);
      callback([]);
    }
  );
  return () => off(matchesRef);
}

export async function logMatch(matchData: {
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  matchType?: MatchType;
  isDraw?: boolean;
  isPenalty?: boolean;
  penaltyScore1?: number;
  penaltyScore2?: number;
  tournamentId?: string;
  tournamentRound?: string;
}): Promise<string> {
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
  } = matchData;

  let winnerId: string | undefined;
  let loserId: string | undefined;
  let winnerName: string | undefined;
  let loserName: string | undefined;

  if (isDraw) {
    winnerId = undefined;
    loserId = undefined;
    winnerName = undefined;
    loserName = undefined;
  } else if (isPenalty && penaltyScore1 !== undefined && penaltyScore2 !== undefined) {
    winnerId = penaltyScore1 > penaltyScore2 ? player1Id : player2Id;
    loserId = penaltyScore1 > penaltyScore2 ? player2Id : player1Id;
    winnerName = penaltyScore1 > penaltyScore2 ? player1Name : player2Name;
    loserName = penaltyScore1 > penaltyScore2 ? player2Name : player1Name;
  } else {
    winnerId = player1Score > player2Score ? player1Id : player2Id;
    loserId = player1Score > player2Score ? player2Id : player1Id;
    winnerName = player1Score > player2Score ? player1Name : player2Name;
    loserName = player1Score > player2Score ? player2Name : player1Name;
  }

  const match: Record<string, any> = {
    player1Id,
    player2Id,
    player1Name,
    player2Name,
    player1Score,
    player2Score,
    matchType,
    isDraw: !!isDraw,
    isPenalty: !isDraw && !!isPenalty,
    createdAt: Date.now(),
  };

  if (winnerId) match.winnerId = winnerId;
  if (loserId) match.loserId = loserId;
  if (winnerName) match.winnerName = winnerName;
  if (loserName) match.loserName = loserName;

  if (isPenalty && penaltyScore1 !== undefined) match.penaltyScore1 = penaltyScore1;
  if (isPenalty && penaltyScore2 !== undefined) match.penaltyScore2 = penaltyScore2;
  if (tournamentId) match.tournamentId = tournamentId;
  if (tournamentRound) match.tournamentRound = tournamentRound;

  // Save match
  const matchesRef = ref(db, 'matches');
  const newRef = push(matchesRef);
  await set(newRef, match);

  // Update Player 1 and Player 2 stats
  if (isDraw) {
    await updateUserStats(player1Id, matchType, 'draw', player1Score, player2Score);
    await updateUserStats(player2Id, matchType, 'draw', player2Score, player1Score);
    await updateH2H(player1Id, player1Name, player2Id, player2Name, 'draw', matchType);
  } else {
    const isP1Winner = winnerId === player1Id;
    await updateUserStats(player1Id, matchType, isP1Winner ? 'win' : 'loss', player1Score, player2Score);
    await updateUserStats(player2Id, matchType, isP1Winner ? 'loss' : 'win', player2Score, player1Score);
    await updateH2H(player1Id, player1Name, player2Id, player2Name, isP1Winner ? 'p1_win' : 'p2_win', matchType);
  }

  return newRef.key!;
}

// Helper to sanitize and auto-heal tournament bracket data (recomputes thirdPlace & final slots from SF winners/losers if needed)
function sanitizeTournamentData(t: Tournament): Tournament {
  if (!t.bracket) return t;

  const bracket = { ...t.bracket };
  let needsDbUpdate = false;
  const updates: Record<string, unknown> = {};

  if (bracket.semiFinals && bracket.semiFinals.length === 2) {
    const sf0 = bracket.semiFinals[0];
    const sf1 = bracket.semiFinals[1];

    if (sf0.completed && sf1.completed && sf0.winnerId && sf1.winnerId) {
      const sf0WinnerId = sf0.winnerId;
      const sf0LoserId = sf0WinnerId === sf0.player1Id ? sf0.player2Id : sf0.player1Id;
      const sf0WinnerName = sf0WinnerId === sf0.player1Id ? sf0.player1Name : sf0.player2Name;
      const sf0LoserName = sf0LoserId === sf0.player1Id ? sf0.player1Name : sf0.player2Name;

      const sf1WinnerId = sf1.winnerId;
      const sf1LoserId = sf1WinnerId === sf1.player1Id ? sf1.player2Id : sf1.player1Id;
      const sf1WinnerName = sf1WinnerId === sf1.player1Id ? sf1.player1Name : sf1.player2Name;
      const sf1LoserName = sf1LoserId === sf1.player1Id ? sf1.player1Name : sf1.player2Name;

      // Heal Final match slot if not completed
      if (!bracket.final.completed) {
        if (
          bracket.final.player1Id !== sf0WinnerId ||
          bracket.final.player2Id !== sf1WinnerId
        ) {
          bracket.final = {
            ...bracket.final,
            player1Id: sf0WinnerId,
            player1Name: sf0WinnerName,
            player2Id: sf1WinnerId,
            player2Name: sf1WinnerName,
          };
          updates[`tournaments/${t.id}/bracket/final`] = bracket.final;
          needsDbUpdate = true;
        }
      }

      // Heal 3rd Place match slot if not completed
      if (!bracket.thirdPlace.completed) {
        if (
          bracket.thirdPlace.player1Id !== sf0LoserId ||
          bracket.thirdPlace.player2Id !== sf1LoserId
        ) {
          bracket.thirdPlace = {
            ...bracket.thirdPlace,
            player1Id: sf0LoserId,
            player1Name: sf0LoserName,
            player2Id: sf1LoserId,
            player2Name: sf1LoserName,
          };
          updates[`tournaments/${t.id}/bracket/thirdPlace`] = bracket.thirdPlace;
          needsDbUpdate = true;
        }
      }
    }
  }

  if (needsDbUpdate) {
    update(ref(db), updates).catch((err) =>
      console.warn('Auto-heal tournament update error:', err)
    );
  }

  return { ...t, bracket };
}

// ==================== TOURNAMENT OPERATIONS ====================

export function subscribeToTournaments(callback: (tournaments: Tournament[]) => void) {
  const tournamentsRef = ref(db, 'tournaments');
  const unsubscribe = onValue(
    tournamentsRef,
    (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      const tournaments: Tournament[] = Object.keys(data)
        .map((key) => {
          const raw = {
            ...data[key],
            id: key,
            matchType: data[key].matchType || 'dream',
          };
          return sanitizeTournamentData(raw);
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(tournaments);
    },
    (error) => {
      console.warn('Firebase subscribeToTournaments error:', error);
      callback([]);
    }
  );
  return () => off(tournamentsRef);
}

export function subscribeToTournament(
  tournamentId: string,
  callback: (tournament: Tournament | null) => void
) {
  const tournamentRef = ref(db, `tournaments/${tournamentId}`);
  const unsubscribe = onValue(
    tournamentRef,
    (snapshot: DataSnapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const data = snapshot.val();
      const raw: Tournament = {
        ...data,
        id: tournamentId,
        matchType: data.matchType || 'dream',
      };
      callback(sanitizeTournamentData(raw));
    },
    (error) => {
      console.warn('Firebase subscribeToTournament error:', error);
      callback(null);
    }
  );
  return () => off(tournamentRef);
}

export async function createTournament(
  name: string,
  format: 4 | 8,
  pairings: Array<{ player1Id: string; player2Id: string }>,
  userNames: Record<string, string>,
  matchType: MatchType = 'dream'
): Promise<string> {
  const roster = pairings.flatMap((p) => [p.player1Id, p.player2Id]);

  let bracket: TournamentBracket;

  if (format === 4) {
    bracket = {
      semiFinals: pairings.map((p) => ({
        player1Id: p.player1Id,
        player2Id: p.player2Id,
        player1Name: userNames[p.player1Id] || 'Player 1',
        player2Name: userNames[p.player2Id] || 'Player 2',
        matchType,
        completed: false,
      })),
      thirdPlace: { matchType, completed: false },
      final: { matchType, completed: false },
    };
  } else {
    bracket = {
      quarterFinals: pairings.map((p) => ({
        player1Id: p.player1Id,
        player2Id: p.player2Id,
        player1Name: userNames[p.player1Id] || 'Player 1',
        player2Name: userNames[p.player2Id] || 'Player 2',
        matchType,
        completed: false,
      })),
      semiFinals: [
        { matchType, completed: false },
        { matchType, completed: false },
      ],
      thirdPlace: { matchType, completed: false },
      final: { matchType, completed: false },
    };
  }

  const tournament: Omit<Tournament, 'id'> = {
    name,
    format,
    matchType,
    status: 'in_progress',
    roster,
    rosterNames: userNames,
    bracket,
    createdAt: Date.now(),
  };

  const tournamentsRef = ref(db, 'tournaments');
  const newRef = push(tournamentsRef);
  await set(newRef, tournament);
  return newRef.key!;
}

export async function submitTournamentMatchResult(
  tournamentId: string,
  round: string,
  matchIndex: number,
  matchData: {
    player1Score: number;
    player2Score: number;
    matchType?: MatchType;
    isDraw?: boolean;
    isPenalty?: boolean;
    penaltyScore1?: number;
    penaltyScore2?: number;
  }
): Promise<void> {
  const tournamentRef = ref(db, `tournaments/${tournamentId}`);
  const snap = await get(tournamentRef);
  if (!snap.exists()) throw new Error('Tournament not found');

  const tournament: Tournament = { ...snap.val(), id: tournamentId };
  const bracket = tournament.bracket;
  const matchType = matchData.matchType || tournament.matchType || 'dream';

  let matchSlot: TournamentMatch | undefined;

  if (round === 'quarterFinals' && bracket.quarterFinals) {
    matchSlot = bracket.quarterFinals[matchIndex];
  } else if (round === 'semiFinals') {
    matchSlot = bracket.semiFinals[matchIndex];
  } else if (round === 'thirdPlace') {
    matchSlot = bracket.thirdPlace;
  } else if (round === 'final') {
    matchSlot = bracket.final;
  }

  if (!matchSlot || !matchSlot.player1Id || !matchSlot.player2Id) {
    throw new Error('Match slot not ready');
  }

  // Log global match
  const matchId = await logMatch({
    player1Id: matchSlot.player1Id,
    player2Id: matchSlot.player2Id,
    player1Name: matchSlot.player1Name || '',
    player2Name: matchSlot.player2Name || '',
    player1Score: matchData.player1Score,
    player2Score: matchData.player2Score,
    matchType,
    isDraw: matchData.isDraw,
    isPenalty: matchData.isPenalty,
    penaltyScore1: matchData.penaltyScore1,
    penaltyScore2: matchData.penaltyScore2,
    tournamentId,
    tournamentRound: round,
  });

  // Determine winner/loser for bracket progression
  let winnerId: string;
  let loserId: string;

  if (matchData.isPenalty && matchData.penaltyScore1 !== undefined && matchData.penaltyScore2 !== undefined) {
    winnerId = matchData.penaltyScore1 > matchData.penaltyScore2 ? matchSlot.player1Id : matchSlot.player2Id;
    loserId = matchData.penaltyScore1 > matchData.penaltyScore2 ? matchSlot.player2Id : matchSlot.player1Id;
  } else if (matchData.player1Score !== matchData.player2Score) {
    winnerId = matchData.player1Score > matchData.player2Score ? matchSlot.player1Id : matchSlot.player2Id;
    loserId = matchData.player1Score > matchData.player2Score ? matchSlot.player2Id : matchSlot.player1Id;
  } else {
    // If score tied & isDraw is true, bracket still needs a winner to advance. If penalty scores provided, use them; else fallback to P1
    if (matchData.penaltyScore1 !== undefined && matchData.penaltyScore2 !== undefined) {
      winnerId = matchData.penaltyScore1 > matchData.penaltyScore2 ? matchSlot.player1Id : matchSlot.player2Id;
      loserId = matchData.penaltyScore1 > matchData.penaltyScore2 ? matchSlot.player2Id : matchSlot.player1Id;
    } else {
      winnerId = matchSlot.player1Id;
      loserId = matchSlot.player2Id;
    }
  }

  // Update the match slot in bracket
  const updatedSlot: TournamentMatch = {
    ...matchSlot,
    player1Score: matchData.player1Score,
    player2Score: matchData.player2Score,
    matchType,
    isDraw: !!matchData.isDraw,
    isPenalty: !!matchData.isPenalty,
    winnerId,
    loserId,
    matchId,
    completed: true,
  };

  if (matchData.isPenalty && matchData.penaltyScore1 !== undefined) {
    updatedSlot.penaltyScore1 = matchData.penaltyScore1;
  }
  if (matchData.isPenalty && matchData.penaltyScore2 !== undefined) {
    updatedSlot.penaltyScore2 = matchData.penaltyScore2;
  }

  const cleanUpdatedSlot = Object.fromEntries(
    Object.entries(updatedSlot).filter(([_, v]) => v !== undefined)
  );

  // Build path for update
  const updates: Record<string, unknown> = {};

  if (round === 'quarterFinals') {
    updates[`tournaments/${tournamentId}/bracket/quarterFinals/${matchIndex}`] = cleanUpdatedSlot;

    const qf = bracket.quarterFinals!;
    const updatedQF = [...qf];
    updatedQF[matchIndex] = updatedSlot;

    if (updatedQF[0].completed && updatedQF[1].completed) {
      updates[`tournaments/${tournamentId}/bracket/semiFinals/0`] = {
        player1Id: updatedQF[0].winnerId,
        player2Id: updatedQF[1].winnerId,
        player1Name: updatedQF[0].winnerId === updatedQF[0].player1Id ? updatedQF[0].player1Name : updatedQF[0].player2Name,
        player2Name: updatedQF[1].winnerId === updatedQF[1].player1Id ? updatedQF[1].player1Name : updatedQF[1].player2Name,
        matchType,
        completed: false,
      };
    }
    if (updatedQF[2].completed && updatedQF[3].completed) {
      updates[`tournaments/${tournamentId}/bracket/semiFinals/1`] = {
        player1Id: updatedQF[2].winnerId,
        player2Id: updatedQF[3].winnerId,
        player1Name: updatedQF[2].winnerId === updatedQF[2].player1Id ? updatedQF[2].player1Name : updatedQF[2].player2Name,
        player2Name: updatedQF[3].winnerId === updatedQF[3].player1Id ? updatedQF[3].player1Name : updatedQF[3].player2Name,
        matchType,
        completed: false,
      };
    }
  } else if (round === 'semiFinals') {
    updates[`tournaments/${tournamentId}/bracket/semiFinals/${matchIndex}`] = cleanUpdatedSlot;

    const updatedSF = [...bracket.semiFinals];
    updatedSF[matchIndex] = updatedSlot;

    if (updatedSF[0].completed && updatedSF[1].completed) {
      updates[`tournaments/${tournamentId}/bracket/final`] = {
        player1Id: updatedSF[0].winnerId,
        player2Id: updatedSF[1].winnerId,
        player1Name: updatedSF[0].winnerId === updatedSF[0].player1Id ? updatedSF[0].player1Name : updatedSF[0].player2Name,
        player2Name: updatedSF[1].winnerId === updatedSF[1].player1Id ? updatedSF[1].player1Name : updatedSF[1].player2Name,
        matchType,
        completed: false,
      };
      updates[`tournaments/${tournamentId}/bracket/thirdPlace`] = {
        player1Id: updatedSF[0].loserId,
        player2Id: updatedSF[1].loserId,
        player1Name: updatedSF[0].loserId === updatedSF[0].player1Id ? updatedSF[0].player1Name : updatedSF[0].player2Name,
        player2Name: updatedSF[1].loserId === updatedSF[1].player1Id ? updatedSF[1].player1Name : updatedSF[1].player2Name,
        matchType,
        completed: false,
      };
    }
  } else if (round === 'thirdPlace') {
    updates[`tournaments/${tournamentId}/bracket/thirdPlace`] = cleanUpdatedSlot;
    updates[`tournaments/${tournamentId}/standings/third`] = winnerId;
    updates[`tournaments/${tournamentId}/standings/fourth`] = loserId;
  } else if (round === 'final') {
    updates[`tournaments/${tournamentId}/bracket/final`] = cleanUpdatedSlot;
    updates[`tournaments/${tournamentId}/standings/first`] = winnerId;
    updates[`tournaments/${tournamentId}/standings/second`] = loserId;
  }

  const isFinalDone = round === 'final' || bracket.final.completed;
  const isThirdDone = round === 'thirdPlace' || bracket.thirdPlace.completed;

  if (isFinalDone && isThirdDone) {
    updates[`tournaments/${tournamentId}/status`] = 'completed';
    updates[`tournaments/${tournamentId}/completedAt`] = Date.now();
  }

  await update(ref(db), updates);
}
