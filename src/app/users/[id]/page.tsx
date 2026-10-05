'use client';

import { useEffect, useState, use } from 'react';
import { subscribeToUsers, subscribeToH2H, subscribeToUserMatches } from '@/lib/db';
import { User, Match, H2HRecord } from '@/lib/types';
import Link from 'next/link';
import ActivityChart from '@/components/ActivityChart';

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [h2hRecords, setH2hRecords] = useState<H2HRecord[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    // Subscribe to users to find current user
    const unsub1 = subscribeToUsers((users) => {
      const found = users.find((u) => u.id === userId);
      setUser(found || null);
      setLoading(false);
    });

    const unsub2 = subscribeToH2H(userId, setH2hRecords);
    const unsub3 = subscribeToUserMatches(userId, setMatches);

    return () => {
      clearTimeout(timer);
      unsub1();
      unsub2();
      unsub3();
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center animate-fade-in">
          <div className="w-12 h-12 border-4 border-volt/30 border-t-volt rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary font-heading uppercase tracking-widest text-sm">Loading Profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center animate-fade-in">
          <p className="text-text-muted text-lg font-heading">Player not found</p>
          <Link href="/users" className="btn-outline inline-block mt-4">
            Back to Players
          </Link>
        </div>
      </div>
    );
  }

  const winRate = user.matchesPlayed > 0
    ? ((user.wins / user.matchesPlayed) * 100).toFixed(1)
    : '0.0';

  // Find best H2H (highest win rate with minimum 1 match)
  const bestH2H = h2hRecords.length > 0
    ? h2hRecords.reduce((best, current) => {
        const currentTotal = current.wins + current.losses;
        const bestTotal = best.wins + best.losses;
        if (currentTotal === 0) return best;
        if (bestTotal === 0) return current;
        const currentRate = current.wins / currentTotal;
        const bestRate = best.wins / bestTotal;
        if (currentRate > bestRate) return current;
        if (currentRate === bestRate && (current.wins - current.losses) > (best.wins - best.losses)) return current;
        return best;
      })
    : null;

  // Find worst H2H (lowest win rate)
  const worstH2H = h2hRecords.length > 0
    ? h2hRecords.reduce((worst, current) => {
        const currentTotal = current.wins + current.losses;
        const worstTotal = worst.wins + worst.losses;
        if (currentTotal === 0) return worst;
        if (worstTotal === 0) return current;
        const currentRate = current.wins / currentTotal;
        const worstRate = worst.wins / worstTotal;
        if (currentRate < worstRate) return current;
        return worst;
      })
    : null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Back + Header */}
      <div>
        <Link href="/users" className="text-text-muted hover:text-volt text-sm font-heading uppercase tracking-wider transition-colors inline-flex items-center gap-1 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to Players
        </Link>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-xl bg-volt/10 border-2 border-volt/30 flex items-center justify-center">
            <span className="font-heading font-black text-2xl text-volt">
              {user.displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="font-heading font-black text-3xl md:text-4xl tracking-tight text-text-primary">
              {user.displayName}
            </h1>
            <p className="text-text-muted text-xs font-heading uppercase tracking-widest mt-0.5">
              Player Profile
            </p>
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-glow p-5 text-center">
          <p className="text-3xl font-heading font-black text-text-primary">{user.matchesPlayed}</p>
          <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Matches</p>
        </div>
        <div className="card-glow p-5 text-center">
          <p className="text-3xl font-heading font-black text-volt">{user.wins}</p>
          <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Wins</p>
        </div>
        <div className="card-glow p-5 text-center">
          <p className="text-3xl font-heading font-black text-red">{user.losses}</p>
          <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Losses</p>
        </div>
        <div className="card-glow p-5 text-center">
          <p className="text-3xl font-heading font-black text-cyan">{winRate}%</p>
          <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Win Rate</p>
        </div>
      </div>

      {/* Goal Stats Cards */}
      {(() => {
        const gf = user.goalsFor || 0;
        const ga = user.goalsAgainst || 0;
        const gd = user.goalDifference ?? (gf - ga);
        return (
          <div className="grid grid-cols-3 gap-4">
            <div className="card-glow p-4 text-center">
              <p className="text-2xl font-heading font-black text-text-primary font-mono">{gf}</p>
              <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Goals For (GF)</p>
            </div>
            <div className="card-glow p-4 text-center">
              <p className="text-2xl font-heading font-black text-text-primary font-mono">{ga}</p>
              <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Goals Against (GA)</p>
            </div>
            <div className="card-glow p-4 text-center">
              <p className={`text-2xl font-heading font-black font-mono ${gd > 0 ? 'text-volt' : gd < 0 ? 'text-red' : 'text-text-muted'}`}>
                {gd > 0 ? `+${gd}` : gd}
              </p>
              <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Goal Diff (GD)</p>
            </div>
          </div>
        );
      })()}

      {/* Best & Worst H2H Highlights */}
      {h2hRecords.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bestH2H && (bestH2H.wins + bestH2H.losses > 0) && (
            <div className="card-glow p-5 border-volt/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-volt text-lg">🎯</span>
                <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-volt">Best H2H</h3>
              </div>
              <p className="font-heading font-bold text-xl text-text-primary">{bestH2H.opponentName}</p>
              <p className="text-sm text-text-secondary mt-1">
                <span className="text-volt font-bold">{bestH2H.wins}W</span>
                <span className="text-text-muted mx-1">-</span>
                <span className="text-red font-bold">{bestH2H.losses}L</span>
                <span className="text-text-muted ml-2">
                  ({((bestH2H.wins / (bestH2H.wins + bestH2H.losses)) * 100).toFixed(0)}% win rate)
                </span>
              </p>
            </div>
          )}
          {worstH2H && (worstH2H.wins + worstH2H.losses > 0) && worstH2H.opponentId !== bestH2H?.opponentId && (
            <div className="card-glow p-5 border-red/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red text-lg">⚠</span>
                <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-red">Toughest Rival</h3>
              </div>
              <p className="font-heading font-bold text-xl text-text-primary">{worstH2H.opponentName}</p>
              <p className="text-sm text-text-secondary mt-1">
                <span className="text-volt font-bold">{worstH2H.wins}W</span>
                <span className="text-text-muted mx-1">-</span>
                <span className="text-red font-bold">{worstH2H.losses}L</span>
                <span className="text-text-muted ml-2">
                  ({((worstH2H.wins / (worstH2H.wins + worstH2H.losses)) * 100).toFixed(0)}% win rate)
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* H2H Breakdown */}
        <div className="card-glow p-0 overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
              Head-to-Head Records
            </h2>
          </div>
          {h2hRecords.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">No H2H records yet</div>
          ) : (
            <div className="divide-y divide-border">
              {h2hRecords
                .sort((a, b) => {
                  const aTotal = a.wins + a.losses;
                  const bTotal = b.wins + b.losses;
                  if (aTotal === 0) return 1;
                  if (bTotal === 0) return -1;
                  return (b.wins / bTotal) - (a.wins / aTotal);
                })
                .map((record) => {
                  const total = record.wins + record.losses;
                  const rate = total > 0 ? ((record.wins / total) * 100).toFixed(0) : '0';
                  const barWidth = total > 0 ? (record.wins / total) * 100 : 50;

                  return (
                    <div key={record.opponentId} className="p-4 hover:bg-bg-card-hover transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-heading font-semibold text-sm text-text-primary">
                          vs {record.opponentName}
                        </span>
                        <span className="text-xs text-text-muted">{rate}% WR</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-volt font-bold w-8 text-right">{record.wins}W</span>
                        <div className="flex-1 h-2 bg-red/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-volt rounded-full transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-xs text-red font-bold w-8">{record.losses}L</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Activity Chart */}
        <div className="card-glow p-0 overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
              Activity Timeline
            </h2>
          </div>
          <div className="p-5">
            <ActivityChart matches={matches} />
          </div>
        </div>
      </div>

      {/* Match History */}
      <div className="card-glow p-0 overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
            Match History
          </h2>
        </div>

        {matches.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">No matches played yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-gaming">
              <thead>
                <tr>
                  <th>Opponent</th>
                  <th className="text-center">Score</th>
                  <th className="text-center">Result</th>
                  <th className="text-center">Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => {
                  const isWinner = match.winnerId === userId;
                  const opponent = match.player1Id === userId ? match.player2Name : match.player1Name;
                  const userScore = match.player1Id === userId ? match.player1Score : match.player2Score;
                  const oppScore = match.player1Id === userId ? match.player2Score : match.player1Score;

                  return (
                    <tr key={match.id}>
                      <td className="font-heading font-semibold text-sm">{opponent}</td>
                      <td className="text-center">
                        <span className="font-heading font-black text-lg">
                          {userScore} - {oppScore}
                        </span>
                        {match.isPenalty && match.penaltyScore1 !== undefined && (
                          <span className="block text-xs text-cyan">
                            ({match.player1Id === userId ? match.penaltyScore1 : match.penaltyScore2} - {match.player1Id === userId ? match.penaltyScore2 : match.penaltyScore1} pen)
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${isWinner ? 'badge-win' : 'badge-loss'}`}>
                          {isWinner ? 'WIN' : 'LOSS'}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex justify-center gap-1">
                          {match.isPenalty && <span className="badge badge-penalty text-[0.6rem]">PEN</span>}
                          {match.tournamentId && <span className="badge badge-tournament text-[0.6rem]">CUP</span>}
                        </div>
                      </td>
                      <td className="text-text-secondary text-xs">
                        {new Date(match.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
