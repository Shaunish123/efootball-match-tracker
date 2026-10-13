'use client';

import { useEffect, useState } from 'react';
import { subscribeToUsers, subscribeToMatches } from '@/lib/db';
import {
  subscribeToSeasons,
  computeSeasonLeaderboard,
  getFixtureStats,
} from '@/lib/seasonDb';
import type { PairFixtureStats } from '@/lib/seasonDb';
import { User, Match, Season, SeasonPlayerSnapshot } from '@/lib/types';
import Link from 'next/link';

export default function SeasonsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Leaderboard data for currently selected season
  const [standings, setStandings] = useState<SeasonPlayerSnapshot[]>([]);
  const [fixtureStats, setFixtureStats] = useState<PairFixtureStats[]>([]);
  const [modeFilter, setModeFilter] = useState<'overall' | 'dream' | 'auth'>('overall');

  useEffect(() => {
    const unsubUsers = subscribeToUsers((u) => setUsers(u));
    const unsubMatches = subscribeToMatches((m) => setMatches(m));
    const unsubSeasons = subscribeToSeasons((s) => {
      setSeasons(s);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubMatches();
      unsubSeasons();
    };
  }, []);

  // When seasons load, select the active season by default, or the latest completed
  useEffect(() => {
    if (seasons.length > 0 && !selectedSeasonId) {
      const active = seasons.find((s) => s.status === 'active');
      if (active) {
        setSelectedSeasonId(active.id);
      } else {
        // default to latest season
        setSelectedSeasonId(seasons[seasons.length - 1].id);
      }
    }
  }, [seasons, selectedSeasonId]);

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) || seasons[0];

  // Compute standings whenever selected season, matches, or users change
  useEffect(() => {
    if (!selectedSeason || users.length === 0) return;

    // If season has a finalized snapshot, use it!
    if (selectedSeason.snapshot && Object.keys(selectedSeason.snapshot).length > 0) {
      const snapList = Object.values(selectedSeason.snapshot);
      snapList.sort((a, b) => {
        if (modeFilter === 'overall') {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
          return b.goalsFor - a.goalsFor;
        }
        const sA = a.stats?.[modeFilter] || { points: 0, goalDifference: 0, goalsFor: 0 };
        const sB = b.stats?.[modeFilter] || { points: 0, goalDifference: 0, goalsFor: 0 };
        if (sB.points !== sA.points) return sB.points - sA.points;
        if (sB.goalDifference !== sA.goalDifference) return sB.goalDifference - sA.goalDifference;
        return sB.goalsFor - sA.goalsFor;
      });
      setStandings(snapList);
    } else {
      // Live calculation from matches tagged with this seasonId
      const pIds = selectedSeason.playerIds && selectedSeason.playerIds.length > 0
        ? selectedSeason.playerIds
        : users.map((u) => u.id);
      computeSeasonLeaderboard(selectedSeason.id, pIds).then((computed) => {
        computed.sort((a, b) => {
          if (modeFilter === 'overall') {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            return b.goalsFor - a.goalsFor;
          }
          const sA = a.stats?.[modeFilter] || { points: 0, goalDifference: 0, goalsFor: 0 };
          const sB = b.stats?.[modeFilter] || { points: 0, goalDifference: 0, goalsFor: 0 };
          if (sB.points !== sA.points) return sB.points - sA.points;
          if (sB.goalDifference !== sA.goalDifference) return sB.goalDifference - sA.goalDifference;
          return sB.goalsFor - sA.goalsFor;
        });
        setStandings(computed);
      });
    }

    // Fixture progress for active / structured seasons
    if (!selectedSeason.isUnstructured && selectedSeason.playerIds) {
      getFixtureStats(selectedSeason.id, selectedSeason.playerIds).then((stats) => {
        setFixtureStats(stats.byPair);
      });
    } else {
      setFixtureStats([]);
    }
  }, [selectedSeason, users, matches, modeFilter]);

  const activeSeason = seasons.find((s) => s.status === 'active');
  const completedSeasons = seasons.filter((s) => s.status === 'completed');

  const getRankBadgeClass = (index: number) => {
    if (index === 0) return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
    if (index === 1) return 'text-slate-300 bg-slate-300/10 border-slate-300/30';
    if (index === 2) return 'text-amber-700 bg-amber-700/10 border-amber-700/30';
    return 'text-text-muted bg-bg-card border-border';
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-volt/10 via-bg-card to-cyan/10 border border-border p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-volt/10 border border-volt/20 text-volt text-xs font-heading font-bold mb-3 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-volt animate-pulse" />
              Championship Archives
            </div>
            <h1 className="text-2xl md:text-3xl font-heading font-black text-text-primary tracking-tight uppercase">
              Season <span className="text-volt">History</span> & Archives
            </h1>
            <p className="text-sm text-text-secondary mt-1 max-w-xl">
              Inspect historical season standings, preserved leaderboard snapshots, and active fixture tracking with equal 15-match pairing quotas.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <Link
              href="/"
              className="btn-secondary text-xs font-heading uppercase tracking-wider py-2 px-3"
            >
              ← Back to Main Hub
            </Link>
            <Link
              href="/admin"
              className="btn-primary text-xs font-heading uppercase tracking-wider py-2 px-3"
            >
              Manage Seasons
            </Link>
          </div>
        </div>
      </div>

      {/* Season Selector Bar */}
      {seasons.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <span className="text-xs font-heading uppercase tracking-wider text-text-muted mr-2">
            Select Season:
          </span>
          {seasons.map((s) => {
            const isSelected = selectedSeason?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSeasonId(s.id)}
                style={isSelected ? { color: '#000000' } : undefined}
                className={`px-4 py-2 rounded-xl text-xs font-heading font-black uppercase tracking-wider transition-all flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-volt text-black border-volt shadow-lg shadow-volt/20'
                    : 'bg-bg-card hover:bg-bg-card-hover border-border text-text-secondary'
                }`}
              >
                <span>{s.name}</span>
                {s.status === 'active' ? (
                  <span className={`px-1.5 py-0.2 rounded text-[0.6rem] font-bold ${isSelected ? 'bg-black text-volt' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    LIVE
                  </span>
                ) : (
                  <span className={`px-1.5 py-0.2 rounded text-[0.6rem] font-bold ${isSelected ? 'bg-black text-white' : 'bg-border text-text-muted'}`}>
                    ENDED
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="card p-8 text-center border-dashed border-border">
          <p className="text-text-muted text-sm">No seasons have been initialized yet.</p>
          <p className="text-xs text-text-muted mt-1">Go to the Admin Portal to migrate Season 1 or start Season 2.</p>
          <Link href="/admin" className="btn-primary text-xs font-heading mt-4 inline-block py-2 px-4">
            Go to Admin Portal
          </Link>
        </div>
      )}

      {selectedSeason && (
        <div className="space-y-6">
          {/* Season Overview Banner */}
          <div className="card p-6 border-l-4 border-l-volt">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-heading font-black uppercase text-text-primary">
                    {selectedSeason.name}
                  </h2>
                  {selectedSeason.status === 'active' ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-heading font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      ACTIVE SEASON
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-heading font-bold bg-bg-card text-text-muted border border-border">
                      COMPLETED
                    </span>
                  )}
                  {selectedSeason.isUnstructured && (
                    <span className="px-2 py-0.5 rounded text-[0.65rem] font-heading font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Unstructured Inaugural Season
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted mt-2 font-mono">
                  <div>
                    Started: <span className="text-text-secondary">{new Date(selectedSeason.startedAt).toLocaleDateString()}</span>
                  </div>
                  {selectedSeason.endedAt && (
                    <div>
                      Ended: <span className="text-text-secondary">{new Date(selectedSeason.endedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {selectedSeason.winnerName && (
                    <div className="text-volt font-bold flex items-center gap-1">
                      👑 Champion: <span className="text-text-primary underline">{selectedSeason.winnerName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Summary if structured */}
              {!selectedSeason.isUnstructured && (
                <div className="bg-bg-dark/60 rounded-xl p-3 border border-border min-w-[220px]">
                  <div className="flex justify-between text-xs font-heading uppercase text-text-muted mb-1">
                    <span>Season Fixtures</span>
                    <span className="text-volt font-mono font-bold">
                      {selectedSeason.completedFixtures || 0} / {selectedSeason.totalFixtures || 0}
                    </span>
                  </div>
                  <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-volt h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          selectedSeason.totalFixtures
                            ? Math.min(100, Math.round(((selectedSeason.completedFixtures || 0) / selectedSeason.totalFixtures) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[0.65rem] text-text-muted mt-1 font-mono">
                    <span>
                      {selectedSeason.totalFixtures
                        ? Math.round(((selectedSeason.completedFixtures || 0) / selectedSeason.totalFixtures) * 100)
                        : 0}
                      % complete
                    </span>
                    <span>15 matches / pair</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Standings Filter */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-heading font-bold uppercase tracking-wider text-sm text-text-primary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-volt" />
              {selectedSeason.status === 'completed' ? 'Final Preserved Standings' : 'Current Standings'}
            </h3>
            <div className="flex items-center gap-1 bg-bg-card p-1 rounded-lg border border-border">
              {(['overall', 'dream', 'auth'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setModeFilter(m)}
                  style={modeFilter === m ? { color: '#000000' } : undefined}
                  className={`px-3 py-1 text-xs font-heading uppercase font-black rounded-md transition-colors ${
                    modeFilter === m
                      ? 'bg-volt text-black'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {m === 'overall' ? 'Combined' : m === 'dream' ? 'Dream Team' : 'Authentic'}
                </button>
              ))}
            </div>
          </div>

          {/* Standings Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th className="w-12 text-center">#</th>
                    <th>Player</th>
                    <th className="text-center">MP</th>
                    <th className="text-center">W</th>
                    <th className="text-center">D</th>
                    <th className="text-center">L</th>
                    <th className="text-center">GF</th>
                    <th className="text-center">GA</th>
                    <th className="text-center">GD</th>
                    <th className="text-center font-bold text-volt">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((p, idx) => {
                    const stats =
                      modeFilter === 'overall'
                        ? p
                        : p.stats?.[modeFilter] || {
                            matchesPlayed: 0,
                            wins: 0,
                            draws: 0,
                            losses: 0,
                            goalsFor: 0,
                            goalsAgainst: 0,
                            goalDifference: 0,
                            points: 0,
                          };

                    return (
                      <tr key={p.userId} className="group hover:bg-bg-card-hover transition-colors">
                        <td className="text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-mono text-xs font-bold border ${getRankBadgeClass(
                              idx
                            )}`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/users/${p.userId}`}
                            className="font-heading font-bold text-sm text-text-primary hover:text-volt transition-colors flex items-center gap-2"
                          >
                            <span>{p.displayName}</span>
                            {idx === 0 && selectedSeason.status === 'completed' && (
                              <span className="text-amber-400 text-xs" title="Season Winner">
                                👑 Champion
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="text-center font-mono text-xs text-text-secondary">{stats.matchesPlayed}</td>
                        <td className="text-center font-mono text-xs text-emerald-400 font-bold">{stats.wins}</td>
                        <td className="text-center font-mono text-xs text-amber-400">{stats.draws}</td>
                        <td className="text-center font-mono text-xs text-red">{stats.losses}</td>
                        <td className="text-center font-mono text-xs text-text-secondary">{stats.goalsFor}</td>
                        <td className="text-center font-mono text-xs text-text-muted">{stats.goalsAgainst}</td>
                        <td className="text-center font-mono text-xs font-bold">
                          <span
                            className={
                              stats.goalDifference > 0
                                ? 'text-emerald-400'
                                : stats.goalDifference < 0
                                ? 'text-red'
                                : 'text-text-muted'
                            }
                          >
                            {stats.goalDifference > 0 ? `+${stats.goalDifference}` : stats.goalDifference}
                          </span>
                        </td>
                        <td className="text-center font-mono text-sm font-bold text-volt">
                          {stats.points}
                        </td>
                      </tr>
                    );
                  })}
                  {standings.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-text-muted text-sm">
                        No standings data recorded for this season yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fixture Tracker if structured */}
          {!selectedSeason.isUnstructured && fixtureStats.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold uppercase tracking-wide text-sm text-text-primary">
                    15-Match Pairing Quotas ({fixtureStats.length} Unique Matchups)
                  </h3>
                  <p className="text-xs text-text-muted">
                    Every pair has exactly 15 regular-season match slots to complete.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {fixtureStats.map((item) => {
                  const pct = Math.round((item.completed / item.total) * 100);
                  const isFinished = item.pending === 0;

                  return (
                    <div
                      key={item.pairKey}
                      className={`card p-4 transition-all ${
                        isFinished ? 'border-emerald-500/30 bg-emerald-500/5' : 'hover:border-volt/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-heading font-bold text-xs text-text-primary truncate max-w-[180px]">
                          {item.player1Name} vs {item.player2Name}
                        </div>
                        <span
                          className={`text-[0.65rem] font-mono px-2 py-0.5 rounded font-bold ${
                            isFinished
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-volt/10 text-volt'
                          }`}
                        >
                          {item.completed} / {item.total}
                        </span>
                      </div>

                      <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${isFinished ? 'bg-emerald-400' : 'bg-volt'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[0.65rem] text-text-muted mt-2 font-mono">
                        <span>{item.pending} remaining</span>
                        <span className="font-semibold text-text-secondary">{pct}% done</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
