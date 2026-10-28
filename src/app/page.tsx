'use client';

import { useEffect, useState } from 'react';
import { subscribeToUsers, subscribeToMatches } from '@/lib/db';
import {
  subscribeToSeasons,
  computeSeasonLeaderboard,
  computeAllTimeLeaderboard,
  isSeasonHps,
} from '@/lib/seasonDb';
import { User, Match, Season, SeasonPlayerSnapshot } from '@/lib/types';
import Link from 'next/link';
import HpsExplainer from '@/components/HpsExplainer';

type DashTab = 'season' | 'alltime' | 'history';

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashTab>('season');
  const [seasonMode, setSeasonMode] = useState<'all' | 'combined' | 'dream' | 'auth'>('all');
  const [allTimeMode, setAllTimeMode] = useState<'all' | 'combined' | 'dream' | 'auth'>('all');
  const [historyMode, setHistoryMode] = useState<'all' | 'combined' | 'dream' | 'auth'>('all');

  const [seasonLeaderboard, setSeasonLeaderboard] = useState<SeasonPlayerSnapshot[]>([]);
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<SeasonPlayerSnapshot[]>([]);
  const [seasonLbLoading, setSeasonLbLoading] = useState(false);



  const [selectedHistorySeason, setSelectedHistorySeason] = useState<Season | null>(null);

  const activeSeason = seasons.find((s) => s.status === 'active') || null;
  const completedSeasons = seasons.filter((s) => s.status === 'completed').sort((a, b) => b.seasonNumber - a.seasonNumber);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    const unsub1 = subscribeToUsers((u) => { setUsers(u); setLoading(false); });
    const unsub2 = subscribeToMatches((m) => setMatches(m));
    const unsub3 = subscribeToSeasons((s) => setSeasons(s));
    return () => { clearTimeout(timer); unsub1(); unsub2(); unsub3(); };
  }, []);

  useEffect(() => {
    if (activeTab === 'season') {
      if (activeSeason) {
        setSeasonLbLoading(true);
        computeSeasonLeaderboard(activeSeason.id, activeSeason.playerIds)
          .then(setSeasonLeaderboard)
          .finally(() => setSeasonLbLoading(false));
      } else {
        setSeasonLeaderboard([]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeSeason?.id, matches.length]);

  useEffect(() => {
    computeAllTimeLeaderboard().then(setAllTimeLeaderboard);
  }, [matches.length, users.length]);



  const approvedMatches = matches.filter((m) => (m.status || 'approved') === 'approved');
  const totalMatches = approvedMatches.length;
  const totalUsers = users.length;
  const totalPenalties = approvedMatches.filter((m) => m.isPenalty).length;
  const totalDraws = approvedMatches.filter((m) => m.isDraw).length;
  const recentMatches = matches.slice(0, 6);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center animate-fade-in">
          <div className="w-12 h-12 border-4 border-volt/30 border-t-volt rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary font-heading uppercase tracking-widest text-sm">Loading Arena...</p>
        </div>
      </div>
    );
  }

  const getSortedRows = (
    list: SeasonPlayerSnapshot[],
    mode: 'combined' | 'dream' | 'auth',
    isHps: boolean = false,
    isCompletedSeason: boolean = false,
    minReq: number = 35
  ) => {
    return [...list]
      .map((player) => {
        const stats =
          mode === 'combined'
            ? {
                matchesPlayed: player.matchesPlayed,
                wins: player.wins,
                draws: player.draws,
                losses: player.losses,
                goalsFor: player.goalsFor,
                goalsAgainst: player.goalsAgainst,
                goalDifference: player.goalDifference,
                points: player.points,
              }
            : player.stats?.[mode] || {
                matchesPlayed: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalDifference: 0,
                points: 0,
              };

        const ppg = stats.matchesPlayed > 0 ? Number((stats.points / stats.matchesPlayed).toFixed(2)) : 0;

        return {
          ...player,
          modeStats: {
            ...stats,
            ppg,
          },
        };
      })
      .sort((a, b) => {
        if (isHps) {
          // If viewing an ended season, players with >= minReq matches rank first; < minReq moved to bottom
          if (isCompletedSeason) {
            const aMet = a.matchesPlayed >= minReq;
            const bMet = b.matchesPlayed >= minReq;
            if (aMet !== bMet) return aMet ? -1 : 1;
          }
          if ((b.avgHps ?? 0) !== (a.avgHps ?? 0)) return (b.avgHps ?? 0) - (a.avgHps ?? 0);
          if ((b.totalHps ?? 0) !== (a.totalHps ?? 0)) return (b.totalHps ?? 0) - (a.totalHps ?? 0);
          if (b.modeStats.points !== a.modeStats.points) return b.modeStats.points - a.modeStats.points;
          if (b.modeStats.goalDifference !== a.modeStats.goalDifference)
            return b.modeStats.goalDifference - a.modeStats.goalDifference;
          return b.modeStats.wins - a.modeStats.wins;
        }

        // Legacy PTS ranking (Seasons 1 & 2, All-time)
        if (b.modeStats.points !== a.modeStats.points) return b.modeStats.points - a.modeStats.points;
        if (b.modeStats.goalDifference !== a.modeStats.goalDifference)
          return b.modeStats.goalDifference - a.modeStats.goalDifference;
        if (b.modeStats.goalsFor !== a.modeStats.goalsFor) return b.modeStats.goalsFor - a.modeStats.goalsFor;
        return b.modeStats.wins - a.modeStats.wins;
      });
  };

  const renderModeSwitcher = (
    currentMode: 'all' | 'combined' | 'dream' | 'auth',
    setMode: (m: 'all' | 'combined' | 'dream' | 'auth') => void
  ) => (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-bg-card border border-border overflow-x-auto">
      <button
        onClick={() => setMode('all')}
        style={currentMode === 'all' ? { color: '#000000' } : undefined}
        className={`px-3 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider transition-all whitespace-nowrap ${
          currentMode === 'all'
            ? 'bg-volt text-black font-black shadow-md ring-1 ring-volt'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-card-hover font-bold'
        }`}
      >
        All 3 Standings (Stacked)
      </button>
      <button
        onClick={() => setMode('combined')}
        style={currentMode === 'combined' ? { color: '#000000' } : undefined}
        className={`px-3 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider transition-all whitespace-nowrap ${
          currentMode === 'combined'
            ? 'bg-volt text-black font-black shadow-md ring-1 ring-volt'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-card-hover font-bold'
        }`}
      >
        Combined
      </button>
      <button
        onClick={() => setMode('dream')}
        style={currentMode === 'dream' ? { color: '#000000' } : undefined}
        className={`px-3 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider transition-all whitespace-nowrap ${
          currentMode === 'dream'
            ? 'bg-cyan text-black font-black shadow-md ring-1 ring-cyan'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-card-hover font-bold'
        }`}
      >
        Dream Team
      </button>
      <button
        onClick={() => setMode('auth')}
        style={currentMode === 'auth' ? { color: '#ffffff' } : undefined}
        className={`px-3 py-1.5 rounded-lg text-xs font-heading uppercase tracking-wider transition-all whitespace-nowrap ${
          currentMode === 'auth'
            ? 'bg-purple-600 text-white font-black shadow-md ring-1 ring-purple-400'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-card-hover font-bold'
        }`}
      >
        Authentic Team
      </button>
    </div>
  );

  const renderLeaderboardTable = (
    title: string,
    badgeText: string,
    badgeColorClass: string,
    pointsColorClass: string,
    rows: SeasonPlayerSnapshot[],
    mode: 'combined' | 'dream' | 'auth' = 'combined',
    isHps: boolean = false,
    handicapPlayerId?: string | null,
    handicapBonus: number = 0.75,
    isCompletedSeason: boolean = false,
    minReq: number = 35
  ) => {
    const sorted = getSortedRows(rows, mode, isHps, isCompletedSeason, minReq);

    return (
      <div className="card-glow p-0 overflow-hidden mb-6 bg-bg-card">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-heading font-bold text-lg uppercase tracking-wide text-text-primary accent-bar">{title}</h2>
            <span className={`px-2.5 py-0.5 rounded text-[0.65rem] font-heading font-bold uppercase tracking-wider ${badgeColorClass}`}>
              {badgeText}
            </span>
            {isHps && (
              <span className="px-2 py-0.5 rounded text-[0.65rem] font-heading font-bold uppercase tracking-wider bg-volt/15 text-volt border border-volt/30">
                Sorted by Avg HPS
              </span>
            )}
          </div>
          <Link href="/users" className="text-xs text-cyan hover:text-cyan-dim font-heading uppercase tracking-wider transition-colors">
            View Players →
          </Link>
        </div>
        {sorted.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-text-muted text-sm">No matches recorded in this mode yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-gaming">
              <thead>
                <tr>
                  <th className="w-14">Rank</th>
                  <th>Player</th>
                  <th className="text-center">MP</th>
                  <th className="text-center">W</th>
                  <th className="text-center">D</th>
                  <th className="text-center">L</th>
                  <th className="text-center">GF</th>
                  <th className="text-center">GA</th>
                  <th className="text-center">GD</th>
                  <th className={`text-center ${pointsColorClass}`}>PTS</th>
                  <th className="text-center text-cyan">PPG</th>
                  {isHps && (
                    <>
                      <th className="text-center text-text-muted">Total HPS</th>
                      <th className="text-center text-volt font-black">Avg HPS</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {sorted.map((player, idx) => {
                  const rankColors = ['text-gold', 'text-silver', 'text-bronze'];
                  const s = player.modeStats;
                  const userObj = users.find((u) => u.id === player.userId);
                  const isHandicap = handicapPlayerId && player.userId === handicapPlayerId;
                  const isUnderMin = isCompletedSeason && player.matchesPlayed < minReq;

                  return (
                    <tr
                      key={player.userId}
                      className={isUnderMin ? 'bg-red/5 opacity-80' : undefined}
                    >
                      <td>
                        <span className={`font-heading font-black text-lg ${rankColors[idx] || 'text-text-muted'}`}>
                          #{idx + 1}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <Link href={`/users/${player.userId}`} className="flex items-center gap-2.5 group">
                            <div className="w-7 h-7 rounded-full overflow-hidden bg-bg-card-hover border border-border flex items-center justify-center text-xs font-bold text-text-primary shrink-0">
                              {userObj?.avatar ? (
                                <img src={userObj.avatar} alt={player.displayName} className="w-full h-full object-cover" />
                              ) : (
                                player.displayName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-heading font-semibold text-sm text-text-primary group-hover:text-volt transition-colors flex items-center gap-1.5 flex-wrap">
                                <span>{player.displayName}</span>
                                {userObj?.isHost && (
                                  <span className="px-1.5 py-0.2 bg-volt/15 text-volt text-[0.6rem] rounded font-bold">
                                    HOST
                                  </span>
                                )}
                                {isHandicap && (
                                  <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-bold bg-amber-400/20 text-amber-400 border border-amber-400/30">
                                    ⚡ +{handicapBonus} HPS Boost
                                  </span>
                                )}
                              </div>
                              {userObj?.teamName && (
                                <div className="text-[0.65rem] text-text-muted font-mono">{userObj.teamName}</div>
                              )}
                            </div>
                          </Link>
                          {isUnderMin && (
                            <span className="text-[0.65rem] text-red font-mono font-bold mt-1">
                              ⚠️ Minimum Requirements Not Met (&lt;{minReq} matches)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center text-text-secondary font-mono">{s.matchesPlayed}</td>
                      <td className="text-center text-emerald-400 font-bold font-mono">{s.wins}</td>
                      <td className="text-center text-cyan font-mono">{s.draws}</td>
                      <td className="text-center text-red font-mono">{s.losses}</td>
                      <td className="text-center text-text-secondary font-mono">{s.goalsFor}</td>
                      <td className="text-center text-text-secondary font-mono">{s.goalsAgainst}</td>
                      <td className="text-center font-mono font-bold">
                        <span className={s.goalDifference > 0 ? 'text-emerald-400' : s.goalDifference < 0 ? 'text-red' : 'text-text-muted'}>
                          {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`font-heading font-bold text-base ${pointsColorClass} bg-bg-card px-2 py-0.5 rounded border border-border`}>
                          {s.points}
                        </span>
                      </td>
                      <td className="text-center text-cyan font-mono font-bold">
                        {s.ppg?.toFixed(2) || '0.00'}
                      </td>
                      {isHps && (
                        <>
                          <td className="text-center font-mono text-text-muted text-sm">
                            {(player.totalHps ?? 0).toFixed(2)}
                          </td>
                          <td className="text-center">
                            <span className="font-heading font-black text-lg text-volt bg-volt/15 px-2.5 py-0.5 rounded border border-volt/40 shadow-sm">
                              {(player.avgHps ?? 0).toFixed(2)}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderSeasonTab = () => {
    if (!activeSeason) {
      return (
        <div className="card-glow p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-volt/10 border border-volt/20 mx-auto flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-volt">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="font-heading font-bold text-xl text-text-primary">No Active Season</h3>
          <p className="text-text-secondary text-sm mt-2 max-w-xs mx-auto">An admin needs to start a new season. Previous seasons are viewable in Season History.</p>
          <Link href="/admin" className="btn-volt mt-6 inline-block">Go to Admin Portal</Link>
        </div>
      );
    }

    const isHps = isSeasonHps(activeSeason);
    const activeSeasonMatches = matches.filter(
      (m) => m.seasonId === activeSeason.id && (m.status || 'approved') === 'approved'
    );
    const casualCount = activeSeasonMatches.filter((m) => !m.tournamentId).length;
    const tournCount = activeSeasonMatches.filter((m) => !!m.tournamentId).length;

    return (
      <div className="space-y-6">
        {/* Active Season Banner */}
        <div className="p-5 rounded-2xl border border-volt/30 bg-volt/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-volt animate-pulse" />
              <span className="font-heading font-black text-volt text-sm uppercase tracking-widest">Active Season</span>
              <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-volt/15 text-volt border border-volt/30">
                {isHps ? '⚡ HPS Ranking System' : 'Classic PTS System'}
              </span>
            </div>
            <h2 className="font-heading font-black text-2xl text-text-primary">{activeSeason.name}</h2>
            <p className="text-text-secondary text-xs mt-0.5">
              Started: {activeSeason.startedAt ? new Date(activeSeason.startedAt).toLocaleDateString() : 'Unknown'} · {activeSeason.playerIds.length} Contenders
              {isHps && activeSeason.handicapPlayerName && (
                <span className="text-amber-400 font-bold ml-2">
                  • Special Power: {activeSeason.handicapPlayerName} (+{activeSeason.handicapBonus ?? 0.75} HPS)
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-text-muted text-xs font-heading uppercase tracking-wider">Matches Recorded</p>
            <p className="font-heading font-black text-2xl text-text-primary mt-0.5">
              {activeSeasonMatches.length} <span className="text-volt text-sm uppercase">Total</span>
            </p>
            <p className="text-text-muted text-[0.65rem] mt-0.5 font-mono">
              {casualCount} Casual · {tournCount} Tournament · Fluid Season
            </p>
          </div>
        </div>

        {/* eFootball League — HPS Ranking System Explainer Card (embedded) */}
        {isHps && (
          <HpsExplainer
            activeHandicapName={activeSeason.handicapPlayerName || 'Ashu'}
            activeHandicapBonus={activeSeason.handicapBonus ?? 0.75}
            minMatches={activeSeason.minMatchesRequired ?? 35}
            defaultExpanded={false}
          />
        )}

        {/* Mode switcher bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs font-heading uppercase tracking-wider text-text-muted">
            Season Standings:
          </span>
          {renderModeSwitcher(seasonMode, setSeasonMode)}
        </div>

        {seasonLbLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-volt/30 border-t-volt rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {(seasonMode === 'all' || seasonMode === 'combined') &&
              renderLeaderboardTable(
                `${activeSeason.name} — Combined Leaderboard`,
                isHps ? 'All Modes (HPS)' : 'All Modes',
                'bg-volt/15 text-volt border border-volt/30',
                'text-volt',
                seasonLeaderboard,
                'combined',
                isHps,
                activeSeason.handicapPlayerId,
                activeSeason.handicapBonus ?? 0.75,
                false,
                activeSeason.minMatchesRequired ?? 35
              )}

            {(seasonMode === 'all' || seasonMode === 'dream') &&
              renderLeaderboardTable(
                `${activeSeason.name} — Dream Team Standings`,
                'Dream Mode',
                'bg-cyan/15 text-cyan border border-cyan/30',
                'text-cyan',
                seasonLeaderboard,
                'dream',
                isHps,
                activeSeason.handicapPlayerId,
                activeSeason.handicapBonus ?? 0.75,
                false,
                activeSeason.minMatchesRequired ?? 35
              )}

            {(seasonMode === 'all' || seasonMode === 'auth') &&
              renderLeaderboardTable(
                `${activeSeason.name} — Authentic Team Standings`,
                'Auth Mode',
                'bg-purple-500/15 text-purple-400 border border-purple-500/30',
                'text-purple-400',
                seasonLeaderboard,
                'auth',
                isHps,
                activeSeason.handicapPlayerId,
                activeSeason.handicapBonus ?? 0.75,
                false,
                activeSeason.minMatchesRequired ?? 35
              )}
          </div>
        )}
      </div>
    );
  };

  const renderAllTimeTab = () => (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="font-heading font-bold text-text-primary uppercase tracking-wider text-sm">
            All Time Leaderboard
          </span>
          <p className="text-xs text-text-secondary mt-0.5">
            Cumulative statistics across all seasons and matches ever played. Points: W×3 + D×1 − L×1.
          </p>
        </div>
        <div>
          {renderModeSwitcher(allTimeMode, setAllTimeMode)}
        </div>
      </div>

      <div className="space-y-6">
        {(allTimeMode === 'all' || allTimeMode === 'combined') &&
          renderLeaderboardTable(
            'All Time Combined Leaderboard',
            'All Modes',
            'bg-volt/15 text-volt border border-volt/30',
            'text-volt',
            allTimeLeaderboard,
            'combined'
          )}

        {(allTimeMode === 'all' || allTimeMode === 'dream') &&
          renderLeaderboardTable(
            'All Time Dream Team Standings',
            'Dream Mode',
            'bg-cyan/15 text-cyan border border-cyan/30',
            'text-cyan',
            allTimeLeaderboard,
            'dream'
          )}

        {(allTimeMode === 'all' || allTimeMode === 'auth') &&
          renderLeaderboardTable(
            'All Time Authentic Team Standings',
            'Auth Mode',
            'bg-purple-500/15 text-purple-400 border border-purple-500/30',
            'text-purple-400',
            allTimeLeaderboard,
            'auth'
          )}
      </div>
    </div>
  );

  const renderHistoryTab = () => {
    if (selectedHistorySeason) {
      const s = selectedHistorySeason;
      const isHistHps = isSeasonHps(s);
      const snap = s.snapshot ? Object.values(s.snapshot).sort((a, b) => {
        if (isHistHps) {
          const aMet = a.meetsMinimumMatches !== false;
          const bMet = b.meetsMinimumMatches !== false;
          if (aMet !== bMet) return aMet ? -1 : 1;
          const aAvg = a.avgHps ?? 0;
          const bAvg = b.avgHps ?? 0;
          if (bAvg !== aAvg) return bAvg - aAvg;
        }
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return b.wins - a.wins;
      }) : [];

      const mostWins = snap.length > 0 ? snap.reduce((a, b) => b.wins > a.wins ? b : a, snap[0]) : null;
      const mostGoals = snap.length > 0 ? snap.reduce((a, b) => b.goalsFor > a.goalsFor ? b : a, snap[0]) : null;
      const mostDreamGoals = snap.length > 0 ? snap.reduce((a, b) => (b.stats?.dream?.goalsFor || 0) > (a.stats?.dream?.goalsFor || 0) ? b : a, snap[0]) : null;
      const mostAuthGoals = snap.length > 0 ? snap.reduce((a, b) => (b.stats?.auth?.goalsFor || 0) > (a.stats?.auth?.goalsFor || 0) ? b : a, snap[0]) : null;
      const bestGD = snap.length > 0 ? snap.reduce((a, b) => b.goalDifference > a.goalDifference ? b : a, snap[0]) : null;
      const totalGoals = snap.reduce((sum, p) => sum + p.goalsFor, 0);

      return (
        <div className="space-y-6 animate-fade-in">
          <button onClick={() => setSelectedHistorySeason(null)} className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-heading">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Back to Season History
          </button>

          <div className="p-6 rounded-2xl bg-bg-card border border-border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded text-[0.65rem] font-heading font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Completed</span>
                  {s.isUnstructured && <span className="px-2.5 py-0.5 rounded text-[0.65rem] font-heading font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">Unstructured</span>}
                </div>
                <h2 className="font-heading font-black text-2xl text-text-primary">{s.name}</h2>
                <p className="text-text-secondary text-xs mt-0.5">
                  {s.startedAt ? new Date(s.startedAt).toLocaleDateString() : 'Unknown start'} → {s.endedAt ? new Date(s.endedAt).toLocaleDateString() : 'Unknown end'}
                </p>
              </div>
              {s.winnerName && (
                <div className="text-right p-4 rounded-xl bg-volt/5 border border-volt/20">
                  <p className="text-text-muted text-xs font-heading uppercase tracking-wider">Season Winner 🏆</p>
                  <p className="font-heading font-black text-xl text-volt mt-0.5">{s.winnerName}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Matches Played', value: s.completedFixtures },
                { label: 'Total Goals', value: totalGoals },
                { label: 'Players', value: s.playerIds.length },
                { label: 'Fixtures Required', value: s.totalFixtures || '—' },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-lg bg-bg-secondary border border-border">
                  <p className="text-text-muted text-[0.65rem] font-heading uppercase tracking-wider">{stat.label}</p>
                  <p className="font-heading font-black text-xl text-text-primary mt-0.5">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card-glow p-0 overflow-hidden">
            <div className="p-5 border-b border-border">
              <h3 className="font-heading font-bold text-base uppercase tracking-wide accent-bar">Season Records</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
              {[
                { label: 'Most Wins', value: mostWins?.wins, name: mostWins?.displayName, color: 'text-volt' },
                { label: 'Most Goals (Total)', value: mostGoals?.goalsFor, name: mostGoals?.displayName, color: 'text-cyan' },
                { label: 'Best Goal Difference', value: bestGD?.goalDifference !== undefined ? (bestGD.goalDifference > 0 ? `+${bestGD.goalDifference}` : String(bestGD.goalDifference)) : '—', name: bestGD?.displayName, color: 'text-volt' },
                { label: 'Most Dream Goals', value: mostDreamGoals?.stats?.dream?.goalsFor, name: mostDreamGoals?.displayName, color: 'text-cyan' },
                { label: 'Most Auth Goals', value: mostAuthGoals?.stats?.auth?.goalsFor, name: mostAuthGoals?.displayName, color: 'text-purple-400' },
              ].map((record) => (
                <div key={record.label} className="p-5">
                  <p className="text-text-muted text-[0.65rem] font-heading uppercase tracking-wider">{record.label}</p>
                  {record.name ? (
                    <>
                      <p className={`font-heading font-black text-xl mt-1 ${record.color}`}>{record.value}</p>
                      <p className="text-text-secondary text-xs mt-0.5">{record.name}</p>
                    </>
                  ) : (
                    <p className="text-text-muted text-sm mt-1">N/A</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {snap.length > 0 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs font-heading uppercase tracking-wider text-text-muted">
                  Final Standings:
                </span>
                {renderModeSwitcher(historyMode, setHistoryMode)}
              </div>

              <div className="space-y-6">
                {(historyMode === 'all' || historyMode === 'combined') &&
                  renderLeaderboardTable(
                    `${s.name} — Final Combined Standings`,
                    isHistHps ? 'Completed (HPS)' : 'Completed',
                    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
                    'text-volt',
                    snap,
                    'combined',
                    isHistHps,
                    s.handicapPlayerId,
                    s.handicapBonus ?? 0.75,
                    true,
                    s.minMatchesRequired ?? 35
                  )}

                {(historyMode === 'all' || historyMode === 'dream') &&
                  renderLeaderboardTable(
                    `${s.name} — Final Dream Team Standings`,
                    'Dream Mode',
                    'bg-cyan/15 text-cyan border border-cyan/30',
                    'text-cyan',
                    snap,
                    'dream',
                    isHistHps,
                    s.handicapPlayerId,
                    s.handicapBonus ?? 0.75,
                    true,
                    s.minMatchesRequired ?? 35
                  )}

                {(historyMode === 'all' || historyMode === 'auth') &&
                  renderLeaderboardTable(
                    `${s.name} — Final Authentic Team Standings`,
                    'Auth Mode',
                    'bg-purple-500/15 text-purple-400 border border-purple-500/30',
                    'text-purple-400',
                    snap,
                    'auth',
                    isHistHps,
                    s.handicapPlayerId,
                    s.handicapBonus ?? 0.75,
                    true,
                    s.minMatchesRequired ?? 35
                  )}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">Season History</h2>
          <span className="text-text-muted text-xs">{completedSeasons.length} completed seasons</span>
        </div>
        {completedSeasons.length === 0 ? (
          <div className="card-glow p-12 text-center">
            <p className="text-text-muted text-sm">No completed seasons yet. Migrate Season 1 from the Admin Portal to see history here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedSeasons.map((s) => (
              <button key={s.id} onClick={() => setSelectedHistorySeason(s)} className="w-full text-left p-5 rounded-2xl bg-bg-card border border-border hover:border-volt/40 hover:bg-bg-card-hover transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-heading font-black text-lg text-text-primary group-hover:text-volt transition-colors">{s.name}</span>
                      {s.isUnstructured && <span className="px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">Unstructured</span>}
                    </div>
                    <p className="text-text-secondary text-xs">{s.endedAt ? new Date(s.endedAt).toLocaleDateString() : 'Unknown end'} · {s.completedFixtures} matches · {s.playerIds.length} players</p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    {s.winnerName && (
                      <div>
                        <p className="text-text-muted text-[0.65rem] font-heading uppercase tracking-wider">Winner</p>
                        <p className="font-heading font-bold text-sm text-volt">🏆 {s.winnerName}</p>
                      </div>
                    )}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted group-hover:text-volt transition-colors"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };



  const tabs: { id: DashTab; label: string; badge?: number }[] = [
    { id: 'season', label: 'This Season' },
    { id: 'alltime', label: 'All Time' },
    { id: 'history', label: 'Season History', badge: completedSeasons.length },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-black text-3xl md:text-4xl tracking-tight">DASH<span className="text-volt">BOARD</span></h1>
          <p className="text-text-secondary mt-1 text-sm">Real-time overview of your eFootball arena</p>
        </div>

        {/* Notices & Alerts Callout */}
        <Link
          href="/alerts"
          className="group flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-volt/10 via-volt/5 to-cyan/10 border border-volt/30 hover:border-volt/60 transition-all shadow-lg shadow-volt/5"
        >
          <div className="w-8 h-8 rounded-lg bg-volt/20 flex items-center justify-center flex-shrink-0 text-volt group-hover:scale-105 transition-transform">
            🔔
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-xs font-heading font-bold text-volt uppercase tracking-wider">New System Update</span>
              <span className="text-[0.6rem] px-1.5 py-0.2 bg-volt text-bg-primary font-black rounded uppercase">NEW</span>
            </div>
            <p className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
              eFootball League HPS System & Fluid Seasons Active → Read Details
            </p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger-children">
        <div className="card-glow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted font-heading text-xs uppercase tracking-widest">Players</p>
              <p className="text-3xl font-heading font-black text-text-primary mt-1">{totalUsers}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-volt/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-volt">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
        </div>
        <div className="card-glow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted font-heading text-xs uppercase tracking-widest">Total Matches</p>
              <p className="text-3xl font-heading font-black text-text-primary mt-1">{totalMatches}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-cyan/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
          </div>
        </div>
        <div className="card-glow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted font-heading text-xs uppercase tracking-widest">Draw Matches</p>
              <p className="text-3xl font-heading font-black text-text-primary mt-1">{totalDraws}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-cyan/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan">
                <path d="M5 12h14" />
              </svg>
            </div>
          </div>
        </div>
        <div className="card-glow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted font-heading text-xs uppercase tracking-widest">Penalty Shootouts</p>
              <p className="text-3xl font-heading font-black text-text-primary mt-1">{totalPenalties}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-volt/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-volt">
                <rect x="2" y="2" width="20" height="20" rx="2" /><path d="M12 6v12" /><path d="M6 12h12" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-1 border-b border-border pb-1 overflow-x-auto mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-heading font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-volt/15 text-volt border border-volt/40'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-card border border-transparent'
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[0.6rem] bg-text-muted/20 text-text-muted font-black">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'season' && renderSeasonTab()}
          {activeTab === 'alltime' && renderAllTimeTab()}
          {activeTab === 'history' && renderHistoryTab()}
        </div>

        <div>
          <div className="card-glow p-0 overflow-hidden sticky top-6">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">Recent Matches</h2>
              <Link href="/matches" className="text-xs text-cyan hover:text-cyan-dim font-heading uppercase tracking-wider transition-colors">Log Match →</Link>
            </div>
            {recentMatches.length === 0 ? (
              <div className="p-12 text-center"><p className="text-text-muted text-sm">No matches logged yet.</p></div>
            ) : (
              <div className="divide-y divide-border">
                {recentMatches.map((match) => (
                  <div key={match.id} className="p-4 hover:bg-bg-card-hover transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-heading font-bold truncate max-w-[100px] ${match.isDraw ? 'text-text-primary' : match.winnerId === match.player1Id ? 'text-volt' : 'text-text-secondary'}`}>{match.player1Name}</span>
                      <span className="font-heading font-black text-base text-text-primary px-2">{match.player1Score} <span className="text-text-muted text-xs">-</span> {match.player2Score}</span>
                      <span className={`text-xs font-heading font-bold truncate max-w-[100px] text-right ${match.isDraw ? 'text-text-primary' : match.winnerId === match.player2Id ? 'text-volt' : 'text-text-secondary'}`}>{match.player2Name}</span>
                    </div>
                    <div className="flex items-center justify-between text-[0.65rem] text-text-muted">
                      <span>{new Date(match.createdAt).toLocaleDateString()}</span>
                      <div className="flex gap-1 items-center">
                        {match.status === 'pending' ? (
                          <span className="px-1.5 py-0.5 rounded uppercase font-bold text-[0.6rem] bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">PENDING</span>
                        ) : match.status === 'rejected' ? (
                          <span className="px-1.5 py-0.5 rounded uppercase font-bold text-[0.6rem] bg-red/15 text-red border border-red/30">REJECTED</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded uppercase font-bold text-[0.6rem] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">APPROVED</span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded uppercase font-bold tracking-wider text-[0.6rem] ${match.matchType === 'auth' ? 'bg-purple-500/15 text-purple-400' : 'bg-cyan/15 text-cyan'}`}>{match.matchType === 'auth' ? 'AUTH' : 'DREAM'}</span>
                        {match.isDraw && <span className="badge badge-loss text-[0.6rem] bg-amber-500/15 text-amber-400 border-amber-500/30">DRAW</span>}
                        {match.isPenalty && <span className="badge badge-penalty text-[0.6rem]">PEN</span>}
                        {match.tournamentId && <span className="badge badge-tournament text-[0.6rem]">CUP</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
