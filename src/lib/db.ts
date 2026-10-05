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
  query,
  orderByChild,
  serverTimestamp,
  DataSnapshot,
} from 'firebase/database';
import { User, Match, Tournament, TournamentMatch, TournamentBracket, H2HRecord } from './types';

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
      const users: User[] = Object.keys(data).map((key) => ({
        ...data[key],
        id: key,
      }));
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
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
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
  return { ...snap.val(), id: userId };
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
      const records: H2HRecord[] = Object.keys(data).map((key) => ({
        opponentId: key,
        opponentName: data[key].opponentName || 'Unknown',
        wins: data[key].wins || 0,
        losses: data[key].losses || 0,
      }));
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
  winnerId: string,
  winnerName: string,
  loserId: string,
  loserName: string
): Promise<void> {
  // Update winner's H2H record against loser
  const winnerH2HRef = ref(db, `h2h/${winnerId}/${loserId}`);
  const winnerSnap = await get(winnerH2HRef);
  if (winnerSnap.exists()) {
    const current = winnerSnap.val();
    await update(winnerH2HRef, {
      wins: (current.wins || 0) + 1,
      opponentName: loserName,
    });
  } else {
    await set(winnerH2HRef, { opponentName: loserName, wins: 1, losses: 0 });
  }

  // Update loser's H2H record against winner
  const loserH2HRef = ref(db, `h2h/${loserId}/${winnerId}`);
  const loserSnap = await get(loserH2HRef);
  if (loserSnap.exists()) {
    const current = loserSnap.val();
    await update(loserH2HRef, {
      losses: (current.losses || 0) + 1,
      opponentName: winnerName,
    });
  } else {
    await set(loserH2HRef, { opponentName: winnerName, wins: 0, losses: 1 });
  }
}

// ==================== MATCH OPERATIONS ====================

export function subscribeToMatches(callback: (matches: Match[]) => void) {
  const matchesRef = ref(db, 'matches');
  const unsubscribe = onValue(
    matchesRef,
    (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      const matches: Match[] = Object.keys(data)
        .map((key) => ({
          ...data[key],
          id: key,
        }))
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
    (snapshot: DataSnapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }
      const matches: Match[] = Object.keys(data)
        .map((key) => ({ ...data[key], id: key }))
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
  isPenalty: boolean;
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
    isPenalty,
    penaltyScore1,
    penaltyScore2,
    tournamentId,
    tournamentRound,
  } = matchData;

  // Determine winner
  let winnerId: string;
  let loserId: string;
  let winnerName: string;
  let loserName: string;

  if (isPenalty && penaltyScore1 !== undefined && penaltyScore2 !== undefined) {
    // Penalty shootout - use penalty scores
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
    isPenalty: !!isPenalty,
    winnerId,
    loserId,
    winnerName,
    loserName,
    createdAt: Date.now(),
  };

  if (isPenalty && penaltyScore1 !== undefined) match.penaltyScore1 = penaltyScore1;
  if (isPenalty && penaltyScore2 !== undefined) match.penaltyScore2 = penaltyScore2;
  if (tournamentId) match.tournamentId = tournamentId;
  if (tournamentRound) match.tournamentRound = tournamentRound;

  // Save match
  const matchesRef = ref(db, 'matches');
  const newRef = push(matchesRef);
  await set(newRef, match);

  // Update Player 1 stats
  const p1Ref = ref(db, `users/${player1Id}`);
  const p1Snap = await get(p1Ref);
  if (p1Snap.exists()) {
    const d = p1Snap.val();
    const isP1Winner = winnerId === player1Id;
    const newGF = (d.goalsFor || 0) + player1Score;
    const newGA = (d.goalsAgainst || 0) + player2Score;
    await update(p1Ref, {
      matchesPlayed: (d.matchesPlayed || 0) + 1,
      wins: (d.wins || 0) + (isP1Winner ? 1 : 0),
      losses: (d.losses || 0) + (isP1Winner ? 0 : 1),
      goalsFor: newGF,
      goalsAgainst: newGA,
      goalDifference: newGF - newGA,
    });
  }

  // Update Player 2 stats
  const p2Ref = ref(db, `users/${player2Id}`);
  const p2Snap = await get(p2Ref);
  if (p2Snap.exists()) {
    const d = p2Snap.val();
    const isP2Winner = winnerId === player2Id;
    const newGF = (d.goalsFor || 0) + player2Score;
    const newGA = (d.goalsAgainst || 0) + player1Score;
    await update(p2Ref, {
      matchesPlayed: (d.matchesPlayed || 0) + 1,
      wins: (d.wins || 0) + (isP2Winner ? 1 : 0),
      losses: (d.losses || 0) + (isP2Winner ? 0 : 1),
      goalsFor: newGF,
      goalsAgainst: newGA,
      goalDifference: newGF - newGA,
    });
  }

  // Update H2H
  await updateH2H(winnerId, winnerName, loserId, loserName);

  return newRef.key!;
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
        .map((key) => ({
          ...data[key],
          id: key,
        }))
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
      callback({ ...snapshot.val(), id: tournamentId });
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
  userNames: Record<string, string>
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
        completed: false,
      })),
      thirdPlace: { completed: false },
      final: { completed: false },
    };
  } else {
    bracket = {
      quarterFinals: pairings.map((p) => ({
        player1Id: p.player1Id,
        player2Id: p.player2Id,
        player1Name: userNames[p.player1Id] || 'Player 1',
        player2Name: userNames[p.player2Id] || 'Player 2',
        completed: false,
      })),
      semiFinals: [
        { completed: false },
        { completed: false },
      ],
      thirdPlace: { completed: false },
      final: { completed: false },
    };
  }

  const tournament: Omit<Tournament, 'id'> = {
    name,
    format,
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
    isPenalty: boolean;
    penaltyScore1?: number;
    penaltyScore2?: number;
  }
): Promise<void> {
  const tournamentRef = ref(db, `tournaments/${tournamentId}`);
  const snap = await get(tournamentRef);
  if (!snap.exists()) throw new Error('Tournament not found');

  const tournament: Tournament = { ...snap.val(), id: tournamentId };
  const bracket = tournament.bracket;

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
    isPenalty: matchData.isPenalty,
    penaltyScore1: matchData.penaltyScore1,
    penaltyScore2: matchData.penaltyScore2,
    tournamentId,
    tournamentRound: round,
  });

  // Determine winner/loser
  let winnerId: string;
  let loserId: string;
  let winnerName: string;
  let loserName: string;

  if (matchData.isPenalty && matchData.penaltyScore1 !== undefined && matchData.penaltyScore2 !== undefined) {
    winnerId = matchData.penaltyScore1 > matchData.penaltyScore2 ? matchSlot.player1Id : matchSlot.player2Id;
    loserId = matchData.penaltyScore1 > matchData.penaltyScore2 ? matchSlot.player2Id : matchSlot.player1Id;
    winnerName = matchData.penaltyScore1 > matchData.penaltyScore2 ? matchSlot.player1Name! : matchSlot.player2Name!;
    loserName = matchData.penaltyScore1 > matchData.penaltyScore2 ? matchSlot.player2Name! : matchSlot.player1Name!;
  } else {
    winnerId = matchData.player1Score > matchData.player2Score ? matchSlot.player1Id : matchSlot.player2Id;
    loserId = matchData.player1Score > matchData.player2Score ? matchSlot.player2Id : matchSlot.player1Id;
    winnerName = matchData.player1Score > matchData.player2Score ? matchSlot.player1Name! : matchSlot.player2Name!;
    loserName = matchData.player1Score > matchData.player2Score ? matchSlot.player2Name! : matchSlot.player1Name!;
  }

  // Update the match slot in bracket
  const updatedSlot: TournamentMatch = {
    ...matchSlot,
    player1Score: matchData.player1Score,
    player2Score: matchData.player2Score,
    isPenalty: matchData.isPenalty,
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

    // Check if we can fill semi-finals
    const qf = bracket.quarterFinals!;
    // Temporarily update the current match
    const updatedQF = [...qf];
    updatedQF[matchIndex] = updatedSlot;

    // QF0 winner vs QF1 winner -> SF0
    if (updatedQF[0].completed && updatedQF[1].completed) {
      updates[`tournaments/${tournamentId}/bracket/semiFinals/0`] = {
        player1Id: updatedQF[0].winnerId,
        player2Id: updatedQF[1].winnerId,
        player1Name: updatedQF[0].winnerId === updatedQF[0].player1Id ? updatedQF[0].player1Name : updatedQF[0].player2Name,
        player2Name: updatedQF[1].winnerId === updatedQF[1].player1Id ? updatedQF[1].player1Name : updatedQF[1].player2Name,
        completed: false,
      };
    }
    // QF2 winner vs QF3 winner -> SF1
    if (updatedQF[2].completed && updatedQF[3].completed) {
      updates[`tournaments/${tournamentId}/bracket/semiFinals/1`] = {
        player1Id: updatedQF[2].winnerId,
        player2Id: updatedQF[3].winnerId,
        player1Name: updatedQF[2].winnerId === updatedQF[2].player1Id ? updatedQF[2].player1Name : updatedQF[2].player2Name,
        player2Name: updatedQF[3].winnerId === updatedQF[3].player1Id ? updatedQF[3].player1Name : updatedQF[3].player2Name,
        completed: false,
      };
    }
  } else if (round === 'semiFinals') {
    updates[`tournaments/${tournamentId}/bracket/semiFinals/${matchIndex}`] = cleanUpdatedSlot;

    // Check if both semis complete -> fill final & 3rd place
    const updatedSF = [...bracket.semiFinals];
    updatedSF[matchIndex] = updatedSlot;

    if (updatedSF[0].completed && updatedSF[1].completed) {
      // Winners go to final
      updates[`tournaments/${tournamentId}/bracket/final`] = {
        player1Id: updatedSF[0].winnerId,
        player2Id: updatedSF[1].winnerId,
        player1Name: updatedSF[0].winnerId === updatedSF[0].player1Id ? updatedSF[0].player1Name : updatedSF[0].player2Name,
        player2Name: updatedSF[1].winnerId === updatedSF[1].player1Id ? updatedSF[1].player1Name : updatedSF[1].player2Name,
        completed: false,
      };
      // Losers go to 3rd place
      updates[`tournaments/${tournamentId}/bracket/thirdPlace`] = {
        player1Id: updatedSF[0].loserId,
        player2Id: updatedSF[1].loserId,
        player1Name: updatedSF[0].loserId === updatedSF[0].player1Id ? updatedSF[0].player1Name : updatedSF[0].player2Name,
        player2Name: updatedSF[1].loserId === updatedSF[1].player1Id ? updatedSF[1].player1Name : updatedSF[1].player2Name,
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

  // Check if tournament is complete (both final and 3rd place done)
  const isFinalDone = round === 'final' || bracket.final.completed;
  const isThirdDone = round === 'thirdPlace' || bracket.thirdPlace.completed;

  if (isFinalDone && isThirdDone) {
    updates[`tournaments/${tournamentId}/status`] = 'completed';
    updates[`tournaments/${tournamentId}/completedAt`] = Date.now();
  }

  await update(ref(db), updates);
}
