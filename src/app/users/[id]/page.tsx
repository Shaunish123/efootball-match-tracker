'use client';

import { useEffect, useState, use } from 'react';
import { subscribeToUsers, subscribeToH2H, subscribeToUserMatches } from '@/lib/db';
import { User, Match, H2HRecord, MatchType, ModeStats } from '@/lib/types';
import Link from 'next/link';
import ActivityChart from '@/components/ActivityChart';

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [h2hRecords, setH2hRecords] = useState<H2HRecord[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab selections
  const [statsMode, setStatsMode] = useState<'combined' | MatchType>('combined');
  const [h2hMode, setH2hMode] = useState<'combined' | MatchType>('combined');

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
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

  // Get active stats depending on statsMode
  const activeStats: ModeStats =
    statsMode === 'combined'
      ? {
          matchesPlayed: user.matchesPlayed,
          wins: user.wins,
          draws: user.draws || 0,
          losses: user.losses,
          points: user.points,
          goalsFor: user.goalsFor || 0,
          goalsAgainst: user.goalsAgainst || 0,
          goalDifference: user.goalDifference ?? ((user.goalsFor || 0) - (user.goalsAgainst || 0)),
        }
      : user.stats?.[statsMode] || {
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
        };

  const winRate = activeStats.matchesPlayed > 0
    ? ((activeStats.wins / activeStats.matchesPlayed) * 100).toFixed(1)
    : '0.0';

  // Helper to extract H2H stats for a record based on h2hMode
  const getRecordH2H = (r: H2HRecord) => {
    if (h2hMode === 'dream') return r.dream || { wins: r.wins, draws: r.draws, losses: r.losses };
    if (h2hMode === 'auth') return r.auth || { wins: 0, draws: 0, losses: 0 };
    return { wins: r.wins, draws: r.draws, losses: r.losses };
  };

  // Find best and worst H2H for selected mode
  const sortedH2H = [...h2hRecords]
    .map((r) => ({ ...r, currentH2H: getRecordH2H(r) }))
    .filter((r) => r.currentH2H.wins + r.currentH2H.draws + r.currentH2H.losses > 0);

  const bestH2H = sortedH2H.length > 0
    ? sortedH2H.reduce((best, current) => {
        const cTotal = current.currentH2H.wins + current.currentH2H.draws + current.currentH2H.losses;
        const bTotal = best.currentH2H.wins + best.currentH2H.draws + best.currentH2H.losses;
        if (cTotal === 0) return best;
        if (bTotal === 0) return current;
        const cRate = current.currentH2H.wins / cTotal;
        const bRate = best.currentH2H.wins / bTotal;
        if (cRate > bRate) return current;
        if (cRate === bRate && (current.currentH2H.wins - current.currentH2H.losses) > (best.currentH2H.wins - best.currentH2H.losses)) return current;
        return best;
      })
    : null;

  const worstH2H = sortedH2H.length > 0
    ? sortedH2H.reduce((worst, current) => {
        const cTotal = current.currentH2H.wins + current.currentH2H.draws + current.currentH2H.losses;
        const wTotal = worst.currentH2H.wins + worst.currentH2H.draws + worst.currentH2H.losses;
        if (cTotal === 0) return worst;
        if (wTotal === 0) return current;
        const cRate = current.currentH2H.wins / cTotal;
        const wRate = worst.currentH2H.wins / wTotal;
        if (cRate < wRate) return current;
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

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
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

          {/* Stats Mode Toggle */}
          <div className="flex bg-bg-secondary p-1 rounded-xl border border-border">
            <button
              onClick={() => setStatsMode('combined')}
              className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase transition-all ${
                statsMode === 'combined' ? 'bg-volt text-bg-primary shadow' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Combined
            </button>
            <button
              onClick={() => setStatsMode('dream')}
              className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase transition-all ${
                statsMode === 'dream' ? 'bg-cyan text-bg-primary shadow' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Dream Mode
            </button>
            <button
              onClick={() => setStatsMode('auth')}
              className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase transition-all ${
                statsMode === 'auth' ? 'bg-purple-500 text-white shadow' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Auth Mode
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="card-glow p-5 text-center">
          <p className="text-3xl font-heading font-black text-text-primary">{activeStats.matchesPlayed}</p>
          <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Played</p>
        </div>
        <div className="card-glow p-5 text-center">
          <p className="text-3xl font-heading font-black text-volt">{activeStats.wins}</p>
          <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Wins (+3)</p>
        </div>
        <div className="card-glow p-5 text-center">
          <p className="text-3xl font-heading font-black text-cyan">{activeStats.draws}</p>
          <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Draws (+1)</p>
        </div>
        <div className="card-glow p-5 text-center">
          <p className="text-3xl font-heading font-black text-red">{activeStats.losses}</p>
          <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Losses (-1)</p>
        </div>
        <div className="card-glow p-5 text-center col-span-2 sm:col-span-1 border-volt/30">
          <p className="text-3xl font-heading font-black text-volt">{activeStats.points}</p>
          <p className="text-xs text-volt font-heading uppercase tracking-widest mt-1">Total Points</p>
        </div>
      </div>

      {/* Goal Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-glow p-4 text-center">
          <p className="text-2xl font-heading font-black text-text-primary font-mono">{activeStats.goalsFor}</p>
          <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Goals For (GF)</p>
        </div>
        <div className="card-glow p-4 text-center">
          <p className="text-2xl font-heading font-black text-text-primary font-mono">{activeStats.goalsAgainst}</p>
          <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Goals Against (GA)</p>
        </div>
        <div className="card-glow p-4 text-center">
          <p className={`text-2xl font-heading font-black font-mono ${activeStats.goalDifference > 0 ? 'text-volt' : activeStats.goalDifference < 0 ? 'text-red' : 'text-text-muted'}`}>
            {activeStats.goalDifference > 0 ? `+${activeStats.goalDifference}` : activeStats.goalDifference}
          </p>
          <p className="text-xs text-text-muted font-heading uppercase tracking-widest mt-1">Goal Diff (GD)</p>
        </div>
      </div>

      {/* Best & Worst H2H Highlights */}
      {sortedH2H.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bestH2H && (
            <div className="card-glow p-5 border-volt/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-volt text-lg">🎯</span>
                <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-volt">
                  Best H2H ({h2hMode.toUpperCase()})
                </h3>
              </div>
              <p className="font-heading font-bold text-xl text-text-primary">{bestH2H.opponentName}</p>
              <p className="text-sm text-text-secondary mt-1">
                <span className="text-volt font-bold">{bestH2H.currentH2H.wins}W</span>
                <span className="text-text-muted mx-1">-</span>
                <span className="text-cyan font-bold">{bestH2H.currentH2H.draws}D</span>
                <span className="text-text-muted mx-1">-</span>
                <span className="text-red font-bold">{bestH2H.currentH2H.losses}L</span>
              </p>
            </div>
          )}
          {worstH2H && worstH2H.opponentId !== bestH2H?.opponentId && (
            <div className="card-glow p-5 border-red/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red text-lg">⚠</span>
                <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-red">
                  Toughest Rival ({h2hMode.toUpperCase()})
                </h3>
              </div>
              <p className="font-heading font-bold text-xl text-text-primary">{worstH2H.opponentName}</p>
              <p className="text-sm text-text-secondary mt-1">
                <span className="text-volt font-bold">{worstH2H.currentH2H.wins}W</span>
                <span className="text-text-muted mx-1">-</span>
                <span className="text-cyan font-bold">{worstH2H.currentH2H.draws}D</span>
                <span className="text-text-muted mx-1">-</span>
                <span className="text-red font-bold">{worstH2H.currentH2H.losses}L</span>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Head-to-Head Section with Mode Filters */}
        <div className="card-glow p-0 overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
              Head-to-Head Records
            </h2>

            {/* H2H Mode Selector */}
            <div className="flex bg-bg-secondary p-1 rounded-lg border border-border">
              <button
                onClick={() => setH2hMode('combined')}
                className={`px-2.5 py-1 rounded text-[0.65rem] font-heading font-bold uppercase transition-all ${
                  h2hMode === 'combined' ? 'bg-volt text-bg-primary' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setH2hMode('dream')}
                className={`px-2.5 py-1 rounded text-[0.65rem] font-heading font-bold uppercase transition-all ${
                  h2hMode === 'dream' ? 'bg-cyan text-bg-primary' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Dream H2H
              </button>
              <button
                onClick={() => setH2hMode('auth')}
                className={`px-2.5 py-1 rounded text-[0.65rem] font-heading font-bold uppercase transition-all ${
                  h2hMode === 'auth' ? 'bg-purple-500 text-white' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Auth H2H
              </button>
            </div>
          </div>

          {h2hRecords.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">No H2H records yet</div>
          ) : (
            <div className="divide-y divide-border">
              {h2hRecords
                .map((record) => {
                  const modeH2H = getRecordH2H(record);
                  return { ...record, modeH2H };
                })
                .filter((r) => r.modeH2H.wins + r.modeH2H.draws + r.modeH2H.losses > 0 || h2hMode === 'combined')
                .sort((a, b) => {
                  const aTotal = a.modeH2H.wins + a.modeH2H.draws + a.modeH2H.losses;
                  const bTotal = b.modeH2H.wins + b.modeH2H.draws + b.modeH2H.losses;
                  if (aTotal === 0) return 1;
                  if (bTotal === 0) return -1;
                  return (b.modeH2H.wins / bTotal) - (a.modeH2H.wins / aTotal);
                })
                .map((record) => {
                  const total = record.modeH2H.wins + record.modeH2H.draws + record.modeH2H.losses;
                  const rate = total > 0 ? ((record.modeH2H.wins / total) * 100).toFixed(0) : '0';
                  const winPercent = total > 0 ? (record.modeH2H.wins / total) * 100 : 33;
                  const drawPercent = total > 0 ? (record.modeH2H.draws / total) * 100 : 33;

                  return (
                    <div key={record.opponentId} className="p-4 hover:bg-bg-card-hover transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-heading font-semibold text-sm text-text-primary">
                          vs {record.opponentName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-volt font-bold">{record.modeH2H.wins}W</span>
                          <span className="text-xs text-cyan font-bold">{record.modeH2H.draws}D</span>
                          <span className="text-xs text-red font-bold">{record.modeH2H.losses}L</span>
                          <span className="text-[0.65rem] text-text-muted ml-1">({rate}% WR)</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden bg-bg-secondary border border-border">
                        <div className="h-full bg-volt transition-all duration-500" style={{ width: `${winPercent}%` }} />
                        <div className="h-full bg-cyan transition-all duration-500" style={{ width: `${drawPercent}%` }} />
                        <div className="h-full bg-red transition-all duration-500 flex-1" />
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
            <ActivityChart matches={matches.filter((m) => (m.status || 'approved') === 'approved')} />
          </div>
        </div>
      </div>

      {/* Match History */}
      <div className="card-glow p-0 overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
            Match History
          </h2>
          <span className="text-xs text-text-muted">{matches.length} matches logged</span>
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
                  <th className="text-center">Status</th>
                  <th className="text-center">Mode</th>
                  <th className="text-center">Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => {
                  const isP1 = match.player1Id === userId;
                  const opponent = isP1 ? match.player2Name : match.player1Name;
                  const userScore = isP1 ? match.player1Score : match.player2Score;
                  const oppScore = isP1 ? match.player2Score : match.player1Score;

                  let resultBadge = <span className="badge badge-loss">LOSS</span>;
                  if (match.isDraw) {
                    resultBadge = <span className="badge bg-amber-500/15 text-amber-400 border border-amber-500/30">DRAW (+1)</span>;
                  } else if (match.winnerId === userId) {
                    resultBadge = <span className="badge badge-win">WIN (+3)</span>;
                  }

                  return (
                    <tr key={match.id}>
                      <td className="font-heading font-semibold text-sm">{opponent}</td>
                      <td className="text-center">
                        <span className="font-heading font-black text-lg">
                          {userScore} - {oppScore}
                        </span>
                        {match.isPenalty && match.penaltyScore1 !== undefined && (
                          <span className="block text-xs text-cyan">
                            ({isP1 ? match.penaltyScore1 : match.penaltyScore2} - {isP1 ? match.penaltyScore2 : match.penaltyScore1} pen)
                          </span>
                        )}
                      </td>
                      <td className="text-center">{resultBadge}</td>
                      <td className="text-center">
                        {match.status === 'pending' ? (
                          <span className="px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                            Pending
                          </span>
                        ) : match.status === 'rejected' ? (
                          <span className="px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase bg-red/15 text-red border border-red/30">
                            Rejected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Approved
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <span className={`px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase tracking-wider ${
                          match.matchType === 'auth' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-cyan/15 text-cyan border border-cyan/30'
                        }`}>
                          {match.matchType === 'auth' ? 'AUTH' : 'DREAM'}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex justify-center gap-1">
                          {match.isDraw && <span className="badge badge-loss text-[0.6rem] bg-amber-500/15 text-amber-400 border-amber-500/30">DRAW</span>}
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
