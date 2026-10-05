'use client';

import { useEffect, useState } from 'react';
import { subscribeToUsers, subscribeToMatches } from '@/lib/db';
import { User, Match } from '@/lib/types';
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

  // Sort users by wins desc, then goal difference desc, then goals for desc, then win rate desc
  const leaderboard = [...users].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aGD = a.goalDifference ?? ((a.goalsFor || 0) - (a.goalsAgainst || 0));
    const bGD = b.goalDifference ?? ((b.goalsFor || 0) - (b.goalsAgainst || 0));
    if (bGD !== aGD) return bGD - aGD;
    const aGF = a.goalsFor || 0;
    const bGF = b.goalsFor || 0;
    if (bGF !== aGF) return bGF - aGF;
    const aRate = a.matchesPlayed > 0 ? a.wins / a.matchesPlayed : 0;
    const bRate = b.matchesPlayed > 0 ? b.wins / b.matchesPlayed : 0;
    return bRate - aRate;
  });

  const recentMatches = matches.slice(0, 5);

  const totalMatches = matches.length;
  const totalUsers = users.length;
  const totalPenalties = matches.filter((m) => m.isPenalty).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center animate-fade-in">
          <div className="w-12 h-12 border-4 border-volt/30 border-t-volt rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary font-heading uppercase tracking-widest text-sm">Loading...</p>
        </div>
      </div>
    );
  }

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        <div className="card-glow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted font-heading text-xs uppercase tracking-widest">Total Players</p>
              <p className="text-3xl font-heading font-black text-text-primary mt-1">{totalUsers}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-volt/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-volt">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card-glow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted font-heading text-xs uppercase tracking-widest">Total Matches</p>
              <p className="text-3xl font-heading font-black text-text-primary mt-1">{totalMatches}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-cyan/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card-glow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-muted font-heading text-xs uppercase tracking-widest">Penalty Deciders</p>
              <p className="text-3xl font-heading font-black text-text-primary mt-1">{totalPenalties}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-cyan/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan">
                <rect x="2" y="2" width="20" height="20" rx="2" /><path d="M12 6v12" /><path d="M6 12h12" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard + Recent Matches */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="lg:col-span-2 card-glow p-0 overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
              Leaderboard
            </h2>
            <Link href="/users" className="text-xs text-cyan hover:text-cyan-dim font-heading uppercase tracking-wider transition-colors">
              View All →
            </Link>
          </div>

          {leaderboard.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-text-muted text-sm">No players added yet.</p>
              <Link href="/users" className="btn-volt inline-block mt-4 text-xs">
                Add Players
              </Link>
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
                    <th className="text-center">L</th>
                    <th className="text-center">GF</th>
                    <th className="text-center">GA</th>
                    <th className="text-center">GD</th>
                    <th className="text-center">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((user, idx) => {
                    const winRate = user.matchesPlayed > 0
                      ? ((user.wins / user.matchesPlayed) * 100).toFixed(1)
                      : '0.0';
                    const gf = user.goalsFor || 0;
                    const ga = user.goalsAgainst || 0;
                    const gd = user.goalDifference ?? (gf - ga);
                    const rankColors = [
                      'text-gold',
                      'text-silver',
                      'text-bronze',
                    ];
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
                        <td className="text-center text-text-secondary">{user.matchesPlayed}</td>
                        <td className="text-center text-volt font-semibold">{user.wins}</td>
                        <td className="text-center text-red font-semibold">{user.losses}</td>
                        <td className="text-center text-text-secondary font-mono">{gf}</td>
                        <td className="text-center text-text-secondary font-mono">{ga}</td>
                        <td className="text-center font-mono font-bold">
                          <span className={gd > 0 ? 'text-volt' : gd < 0 ? 'text-red' : 'text-text-muted'}>
                            {gd > 0 ? `+${gd}` : gd}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="font-heading font-bold text-text-primary">{winRate}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Matches */}
        <div className="card-glow p-0 overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
              Recent
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
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-heading font-bold ${match.winnerId === match.player1Id ? 'text-volt' : 'text-text-primary'}`}>
                      {match.player1Name}
                    </span>
                    <span className="font-heading font-black text-lg text-text-primary">
                      {match.player1Score} <span className="text-text-muted text-sm">-</span> {match.player2Score}
                    </span>
                    <span className={`text-sm font-heading font-bold ${match.winnerId === match.player2Id ? 'text-volt' : 'text-text-primary'}`}>
                      {match.player2Name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.65rem] text-text-muted">
                      {new Date(match.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1">
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
  );
}
