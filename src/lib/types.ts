export type MatchType = 'dream' | 'auth';

export interface ModeStats {
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface User {
  id: string;
  displayName: string;
  name?: string;
  efootballUsername: string; // Hidden in UI, used for delete confirmation
  avatar?: string;
  isHost?: boolean;
  teamName?: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points: number; // (wins * 3) + (draws * 1) - (losses * 1)
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  stats?: {
    dream?: ModeStats;
    auth?: ModeStats;
  };
  createdAt: number;
}

export interface ModeH2H {
  wins: number;
  draws: number;
  losses: number;
}

// Head-to-head record stored under users/{userId}/h2h/{opponentId} or h2h/{userId}/{opponentId}
export interface H2HRecord {
  opponentId: string;
  opponentName: string;
  wins: number;
  draws: number;
  losses: number;
  dream?: ModeH2H;
  auth?: ModeH2H;
}

export type MatchStatus = 'pending' | 'approved' | 'rejected';

export interface Match {
  id: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  matchType: MatchType;
  isDraw: boolean;
  isPenalty: boolean;
  isPenalties?: boolean;
  penaltyScore1?: number;
  penaltyScore2?: number;
  player1PenScore?: number | null;
  player2PenScore?: number | null;
  winnerId?: string;
  loserId?: string;
  winnerName?: string;
  loserName?: string;
  isTournament?: boolean;
  tournamentId?: string;
  tournamentRound?: string;
  seasonId?: string;
  status: MatchStatus;
  submittedAt?: string;
  approvedAt?: string | null;
  createdAt: number;
}

export interface Tournament {
  id: string;
  name: string;
  format: 4 | 8;
  matchType: MatchType;
  status: 'in_progress' | 'completed';
  roster: string[]; // User IDs
  rosterNames: Record<string, string>; // userId -> displayName
  bracket: TournamentBracket;
  standings?: TournamentStandings;
  seasonId?: string;
  createdAt: number;
  completedAt?: number;
}

export interface TournamentMatch {
  matchId?: string; // Reference to global match
  player1Id?: string;
  player2Id?: string;
  player1Name?: string;
  player2Name?: string;
  player1Score?: number;
  player2Score?: number;
  matchType?: MatchType;
  isDraw?: boolean;
  isPenalty?: boolean;
  penaltyScore1?: number;
  penaltyScore2?: number;
  winnerId?: string;
  loserId?: string;
  completed: boolean;
}

export interface TournamentBracket {
  quarterFinals?: TournamentMatch[]; // Only for 8-player
  semiFinals: TournamentMatch[];
  thirdPlace: TournamentMatch;
  final: TournamentMatch;
}

export interface TournamentStandings {
  first?: string;
  second?: string;
  third?: string;
  fourth?: string;
}

// ==================== SEASON TYPES ====================

export type SeasonStatus = 'active' | 'completed';

export interface SeasonPlayerSnapshot {
  userId: string;
  displayName: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  stats: {
    dream: ModeStats;
    auth: ModeStats;
  };
}

export interface Season {
  id: string;
  seasonNumber: number;
  name: string; // e.g., "Season 1"
  status: SeasonStatus;
  startedAt: number;
  endedAt?: number;
  winnerId?: string;
  winnerName?: string;
  playerIds: string[]; // participating player IDs
  totalFixtures: number; // 15 * C(N,2) — 0 for Season 1
  completedFixtures: number;
  endedManually?: boolean;
  isUnstructured?: boolean; // Season 1 flag — no fixture system
  snapshot?: Record<string, SeasonPlayerSnapshot>; // finalized leaderboard
}

export type FixtureStatus = 'pending' | 'completed';

export interface SeasonFixture {
  id: string;
  seasonId: string;
  pairKey: string; // sorted "${p1Id}_${p2Id}"
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  status: FixtureStatus;
  matchId?: string; // linked match when completed
  createdAt: number;
  completedAt?: number;
}

