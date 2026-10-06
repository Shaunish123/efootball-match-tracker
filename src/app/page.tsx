'use client';

import { useEffect, useState } from 'react';
import { subscribeToUsers, subscribeToMatches } from '@/lib/db';
import { User, Match, ModeStats } from '@/lib/types';
import Link from 'next/link';

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    const unsub1 = subscribeToUsers((u) => {
      setUsers(u);
      setLoading(false);
    });
    const unsub2 = subscribeToMatches((m) => setMatches(m));
    return () => {
      clearTimeout(timer);
      unsub1();
      unsub2();
    };
  }, []);

  const approvedMatches = matches.filter((m) => (m.status || 'approved') === 'approved');
  const totalMatches = approvedMatches.length;
  const totalUsers = users.length;
  const totalPenalties = approvedMatches.filter((m) => m.isPenalty).length;
  const totalDraws = approvedMatches.filter((m) => m.isDraw).length;

  // Sorting function for leaderboard entries
  const sortLeaderboard = (
    getStats: (user: User) => ModeStats
  ) => {
    return [...users].sort((a, b) => {
      const statsA = getStats(a);
      const statsB = getStats(b);

      if (statsB.points !== statsA.points) return statsB.points - statsA.points;
      if (statsB.goalDifference !== statsA.goalDifference) return statsB.goalDifference - statsA.goalDifference;
      if (statsB.goalsFor !== statsA.goalsFor) return statsB.goalsFor - statsA.goalsFor;
      if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
      return statsA.matchesPlayed - statsB.matchesPlayed;
    });
  };

  const combinedLeaderboard = sortLeaderboard((u) => ({
    matchesPlayed: u.matchesPlayed,
    wins: u.wins,
    draws: u.draws || 0,
    losses: u.losses,
    points: u.points,
    goalsFor: u.goalsFor || 0,
    goalsAgainst: u.goalsAgainst || 0,
    goalDifference: u.goalDifference ?? ((u.goalsFor || 0) - (u.goalsAgainst || 0)),
  }));

  const dreamLeaderboard = sortLeaderboard(
    (u) =>
      u.stats?.dream || {
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
      }
  );

  const authLeaderboard = sortLeaderboard(
    (u) =>
      u.stats?.auth || {
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
      }
  );

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

  const renderTable = (
    title: string,
    badgeText: string,
    badgeColorClass: string,
    sortedUsers: User[],
    getStats: (u: User) => ModeStats
  ) => {
    return (
      <div className="card-glow p-0 overflow-hidden mb-8">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
              {title}
            </h2>
            <span className={`px-2.5 py-0.5 rounded text-[0.65rem] font-heading font-bold uppercase tracking-wider ${badgeColorClass}`}>
              {badgeText}
            </span>
          </div>
          <Link href="/users" className="text-xs text-cyan hover:text-cyan-dim font-heading uppercase tracking-wider transition-colors">
            View Players →
          </Link>
        </div>

        {sortedUsers.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-text-muted text-sm">No players recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-gaming">
              <thead>
                <tr>
                  <th className="w-14">Rank</th>
                  <th>Player</th>
                  <th className="text-center">P</th>
                  <th className="text-center">W</th>
                  <th className="text-center">D</th>
                  <th className="text-center">L</th>
                  <th className="text-center">GF</th>
                  <th className="text-center">GA</th>
                  <th className="text-center">GD</th>
                  <th className="text-center text-volt">PTS</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user, idx) => {
                  const s = getStats(user);
                  const rankColors = ['text-gold', 'text-silver', 'text-bronze'];
                  return (
                    <tr key={user.id}>
                      <td>
                        <span className={`font-heading font-black text-lg ${rankColors[idx] || 'text-text-muted'}`}>
                          #{idx + 1}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/users/${user.id}`}
                          className="font-heading font-semibold text-text-primary hover:text-volt transition-colors"
                        >
                          {user.displayName}
                        </Link>
                      </td>
                      <td className="text-center text-text-secondary">{s.matchesPlayed}</td>
                      <td className="text-center text-volt font-semibold">{s.wins}</td>
                      <td className="text-center text-cyan font-semibold">{s.draws}</td>
                      <td className="text-center text-red font-semibold">{s.losses}</td>
                      <td className="text-center text-text-secondary font-mono">{s.goalsFor}</td>
                      <td className="text-center text-text-secondary font-mono">{s.goalsAgainst}</td>
                      <td className="text-center font-mono font-bold">
                        <span className={s.goalDifference > 0 ? 'text-volt' : s.goalDifference < 0 ? 'text-red' : 'text-text-muted'}>
                          {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="font-heading font-black text-lg text-volt bg-volt/10 px-2 py-0.5 rounded border border-volt/20">
                          {s.points}
                        </span>
                      </td>
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-heading font-black text-3xl md:text-4xl tracking-tight">
          DASH<span className="text-volt">BOARD</span>
        </h1>
        <p className="text-text-secondary mt-1 text-sm">Real-time overview of your eFootball arena</p>
      </div>

      {/* Stats Cards */}
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

      {/* Main Grid: Stacked Leaderboards + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Stacked Leaderboards */}
        <div className="lg:col-span-2">
          {/* 1. Combined Leaderboard */}
          {renderTable(
            'Combined Leaderboard',
            'All Modes',
            'bg-volt/15 text-volt border border-volt/30',
            combinedLeaderboard,
            (u) => ({
              matchesPlayed: u.matchesPlayed,
              wins: u.wins,
              draws: u.draws || 0,
              losses: u.losses,
              points: u.points,
              goalsFor: u.goalsFor || 0,
              goalsAgainst: u.goalsAgainst || 0,
              goalDifference: u.goalDifference ?? ((u.goalsFor || 0) - (u.goalsAgainst || 0)),
            })
          )}

          {/* 2. Dream Leaderboard */}
          {renderTable(
            'Dream Team Leaderboard',
            'Dream Mode',
            'bg-cyan/15 text-cyan border border-cyan/30',
            dreamLeaderboard,
            (u) =>
              u.stats?.dream || {
                matchesPlayed: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                points: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalDifference: 0,
              }
          )}

          {/* 3. Auth Leaderboard */}
          {renderTable(
            'Auth Team Leaderboard',
            'Auth Mode',
            'bg-purple-500/15 text-purple-400 border border-purple-500/30',
            authLeaderboard,
            (u) =>
              u.stats?.auth || {
                matchesPlayed: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                points: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalDifference: 0,
              }
          )}
        </div>

        {/* Right Col: Recent Matches */}
        <div>
          <div className="card-glow p-0 overflow-hidden sticky top-6">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
                Recent Matches
              </h2>
              <Link href="/matches" className="text-xs text-cyan hover:text-cyan-dim font-heading uppercase tracking-wider transition-colors">
                Log Match →
              </Link>
            </div>

            {recentMatches.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-text-muted text-sm">No matches logged yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentMatches.map((match) => (
                  <div key={match.id} className="p-4 hover:bg-bg-card-hover transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-heading font-bold truncate max-w-[100px] ${match.isDraw ? 'text-text-primary' : match.winnerId === match.player1Id ? 'text-volt' : 'text-text-secondary'}`}>
                        {match.player1Name}
                      </span>
                      <span className="font-heading font-black text-base text-text-primary px-2">
                        {match.player1Score} <span className="text-text-muted text-xs">-</span> {match.player2Score}
                      </span>
                      <span className={`text-xs font-heading font-bold truncate max-w-[100px] text-right ${match.isDraw ? 'text-text-primary' : match.winnerId === match.player2Id ? 'text-volt' : 'text-text-secondary'}`}>
                        {match.player2Name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[0.65rem] text-text-muted">
                      <span>{new Date(match.createdAt).toLocaleDateString()}</span>
                      <div className="flex gap-1 items-center">
                        {match.status === 'pending' ? (
                          <span className="px-1.5 py-0.5 rounded uppercase font-bold text-[0.6rem] bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                            PENDING
                          </span>
                        ) : match.status === 'rejected' ? (
                          <span className="px-1.5 py-0.5 rounded uppercase font-bold text-[0.6rem] bg-red/15 text-red border border-red/30">
                            REJECTED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded uppercase font-bold text-[0.6rem] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            APPROVED
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded uppercase font-bold tracking-wider text-[0.6rem] ${match.matchType === 'auth' ? 'bg-purple-500/15 text-purple-400' : 'bg-cyan/15 text-cyan'}`}>
                          {match.matchType === 'auth' ? 'AUTH' : 'DREAM'}
                        </span>
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
