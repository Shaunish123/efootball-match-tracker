export interface User {
  id: string;
  displayName: string;
  efootballUsername: string; // Hidden in UI, used for delete confirmation
  matchesPlayed: number;
  wins: number;
  losses: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  createdAt: number;
}

// Head-to-head record stored under users/{userId}/h2h/{opponentId}
export interface H2HRecord {
  opponentId: string;
  opponentName: string;
  wins: number;
  losses: number;
}

export interface Match {
  id: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  isPenalty: boolean;
  penaltyScore1?: number;
  penaltyScore2?: number;
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
  tournamentId?: string;
  tournamentRound?: string;
  createdAt: number;
}

export interface Tournament {
  id: string;
  name: string;
  format: 4 | 8;
  status: 'in_progress' | 'completed';
  roster: string[]; // User IDs
  rosterNames: Record<string, string>; // userId -> displayName
  bracket: TournamentBracket;
  standings?: TournamentStandings;
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
