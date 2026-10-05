'use client';

import { useEffect, useState } from 'react';
import { subscribeToUsers, subscribeToTournaments, createTournament } from '@/lib/db';
import { User, Tournament, MatchType } from '@/lib/types';
import Link from 'next/link';

export default function TournamentsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  // Create tournament form
  const [showCreate, setShowCreate] = useState(false);
  const [tournamentName, setTournamentName] = useState('');
  const [format, setFormat] = useState<4 | 8>(4);
  const [matchType, setMatchType] = useState<MatchType>('dream');
  const [pairings, setPairings] = useState<Array<{ player1Id: string; player2Id: string }>>([
    { player1Id: '', player2Id: '' },
    { player1Id: '', player2Id: '' },
  ]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    const unsub1 = subscribeToUsers((u) => {
      setUsers(u);
      setLoading(false);
    });
    const unsub2 = subscribeToTournaments(setTournaments);
    return () => {
      clearTimeout(timer);
      unsub1();
      unsub2();
    };
  }, []);

  const handleFormatChange = (newFormat: 4 | 8) => {
    setFormat(newFormat);
    const count = newFormat / 2;
    setPairings(Array.from({ length: count }, () => ({ player1Id: '', player2Id: '' })));
  };

  const updatePairing = (index: number, field: 'player1Id' | 'player2Id', value: string) => {
    setPairings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const autoFillRandom = () => {
    const shuffled = [...users].sort(() => Math.random() - 0.5).slice(0, format);
    if (shuffled.length < format) return;
    const newPairings = [];
    for (let i = 0; i < format / 2; i++) {
      newPairings.push({
        player1Id: shuffled[i * 2].id,
        player2Id: shuffled[i * 2 + 1].id,
      });
    }
    setPairings(newPairings);
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!tournamentName.trim()) {
      setCreateError('Tournament name is required');
      return;
    }

    const allPicked = pairings.flatMap((p) => [p.player1Id, p.player2Id]);
    if (allPicked.some((id) => !id)) {
      setCreateError('Please select both players for all matchup slots');
      return;
    }

    const uniquePicked = new Set(allPicked);
    if (uniquePicked.size !== format) {
      setCreateError('Each player can only be selected once in the tournament');
      return;
    }

    setCreating(true);
    try {
      const userNames: Record<string, string> = {};
      allPicked.forEach((id) => {
        const u = users.find((u) => u.id === id);
        if (u) userNames[id] = u.displayName;
      });

      await createTournament(tournamentName.trim(), format, pairings, userNames, matchType);
      setTournamentName('');
      setMatchType('dream');
      setPairings(Array.from({ length: format / 2 }, () => ({ player1Id: '', player2Id: '' })));
      setShowCreate(false);
    } catch (err: any) {
      console.error('Error creating tournament:', err);
      setCreateError(err?.message ? `Failed: ${err.message}` : 'Failed to create tournament');
    } finally {
      setCreating(false);
    }
  };

  const activeTournaments = tournaments.filter((t) => t.status === 'in_progress');
  const completedTournaments = tournaments.filter((t) => t.status === 'completed');

  const selectedPlayerIds = new Set(pairings.flatMap((p) => [p.player1Id, p.player2Id]).filter(Boolean));

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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading font-black text-3xl md:text-4xl tracking-tight">
            TOURNA<span className="text-volt">MENTS</span>
          </h1>
          <p className="text-text-secondary mt-1 text-sm">Create and manage knockout tournaments</p>
        </div>
        <button
          id="create-tournament-btn"
          onClick={() => setShowCreate(!showCreate)}
          className="btn-volt"
        >
          {showCreate ? '✕ Cancel' : '🏆 New Tournament'}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card-glow p-6 animate-fade-in">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-cyan">
              Create Tournament
            </h3>
            {users.length >= format && (
              <button
                type="button"
                onClick={autoFillRandom}
                className="text-xs text-volt hover:text-volt-dim font-heading uppercase tracking-wider transition-colors flex items-center gap-1"
              >
                ⚡ Auto-fill Random Pairings
              </button>
            )}
          </div>

          <form onSubmit={handleCreateTournament} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-2">
                  Tournament Name
                </label>
                <input
                  id="input-tournament-name"
                  type="text"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  className="input-dark"
                  placeholder="e.g. Friday Night Cup"
                />
              </div>

              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-2">
                  Match Mode
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMatchType('dream')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-heading font-bold text-xs uppercase transition-all ${
                      matchType === 'dream'
                        ? 'bg-cyan/15 text-cyan border border-cyan/40 shadow-[0_0_15px_rgba(0,229,255,0.2)]'
                        : 'bg-bg-secondary text-text-muted border border-border'
                    }`}
                  >
                    ⚡ Dream Team
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchType('auth')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-heading font-bold text-xs uppercase transition-all ${
                      matchType === 'auth'
                        ? 'bg-purple-500/15 text-purple-400 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                        : 'bg-bg-secondary text-text-muted border border-border'
                    }`}
                  >
                    🛡️ Auth Team
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-2">
                Format
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleFormatChange(4)}
                  className={`px-6 py-3 rounded-lg font-heading font-bold text-sm uppercase tracking-wide transition-all ${
                    format === 4
                      ? 'bg-volt/15 text-volt border border-volt/30'
                      : 'bg-bg-secondary text-text-muted border border-border hover:border-border-accent'
                  }`}
                >
                  4 Players (2 Matches)
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatChange(8)}
                  className={`px-6 py-3 rounded-lg font-heading font-bold text-sm uppercase tracking-wide transition-all ${
                    format === 8
                      ? 'bg-volt/15 text-volt border border-volt/30'
                      : 'bg-bg-secondary text-text-muted border border-border hover:border-border-accent'
                  }`}
                >
                  8 Players (4 Matches)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-3">
                Round 1 Matchups ({format === 4 ? 'Semi-Finals' : 'Quarter-Finals'})
              </label>

              {users.length < format ? (
                <p className="text-red text-sm">
                  You need at least {format} registered players to create a {format}-player tournament. Currently have {users.length}.
                </p>
              ) : (
                <div className="space-y-4 max-w-2xl">
                  {pairings.map((pair, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-bg-secondary border border-border flex flex-col sm:flex-row items-center gap-3">
                      <span className="font-heading font-bold text-xs uppercase tracking-widest text-cyan w-24 shrink-0">
                        Match {idx + 1}
                      </span>

                      <select
                        value={pair.player1Id}
                        onChange={(e) => updatePairing(idx, 'player1Id', e.target.value)}
                        className="input-dark flex-1 text-sm py-2"
                      >
                        <option value="">Select Player 1</option>
                        {users.map((u) => {
                          const isAlreadySelected = selectedPlayerIds.has(u.id) && u.id !== pair.player1Id;
                          return (
                            <option key={u.id} value={u.id} disabled={isAlreadySelected}>
                              {u.displayName} {isAlreadySelected ? '(Already Assigned)' : ''}
                            </option>
                          );
                        })}
                      </select>

                      <span className="font-heading font-black text-volt text-xs uppercase tracking-widest px-2">
                        VS
                      </span>

                      <select
                        value={pair.player2Id}
                        onChange={(e) => updatePairing(idx, 'player2Id', e.target.value)}
                        className="input-dark flex-1 text-sm py-2"
                      >
                        <option value="">Select Player 2</option>
                        {users.map((u) => {
                          const isAlreadySelected = selectedPlayerIds.has(u.id) && u.id !== pair.player2Id;
                          return (
                            <option key={u.id} value={u.id} disabled={isAlreadySelected}>
                              {u.displayName} {isAlreadySelected ? '(Already Assigned)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {createError && (
              <div className="p-3 rounded-lg bg-red/10 border border-red/30 text-red text-sm font-medium max-w-2xl">
                {createError}
              </div>
            )}

            <button
              type="submit"
              disabled={creating || users.length < format}
              className="btn-cyan"
            >
              {creating ? 'Creating Bracket...' : 'Create Tournament'}
            </button>
          </form>
        </div>
      )}

      {/* Active Tournaments */}
      {activeTournaments.length > 0 && (
        <div>
          <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar mb-4">
            Active Tournaments
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {activeTournaments.map((t) => (
              <Link key={t.id} href={`/tournaments/${t.id}`} className="block">
                <div className="card-glow p-5 hover:border-volt/50 transition-all group animate-pulse-glow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="badge badge-tournament">LIVE</span>
                    <div className="flex gap-1.5 items-center">
                      <span className={`px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase ${
                        t.matchType === 'auth' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-cyan/15 text-cyan border border-cyan/30'
                      }`}>
                        {t.matchType === 'auth' ? 'AUTH' : 'DREAM'}
                      </span>
                      <span className="text-xs text-text-muted">{t.format}-player</span>
                    </div>
                  </div>
                  <h3 className="font-heading font-bold text-xl text-text-primary group-hover:text-volt transition-colors mb-2">
                    {t.name}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {t.roster.map((userId) => (
                      <span key={userId} className="px-2 py-0.5 rounded bg-bg-secondary text-xs text-text-secondary font-heading">
                        {t.rosterNames[userId]}
                      </span>
                    ))}
                  </div>
                  <p className="text-[0.65rem] text-text-muted mt-3">
                    Created {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Completed Tournaments */}
      {completedTournaments.length > 0 && (
        <div>
          <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar mb-4">
            Completed Tournaments
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {completedTournaments.map((t) => (
              <Link key={t.id} href={`/tournaments/${t.id}`} className="block">
                <div className="card-glow p-5 hover:border-cyan/30 transition-all group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-text-muted font-heading uppercase">Completed</span>
                    <div className="flex gap-1.5 items-center">
                      <span className={`px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase ${
                        t.matchType === 'auth' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-cyan/15 text-cyan border border-cyan/30'
                      }`}>
                        {t.matchType === 'auth' ? 'AUTH' : 'DREAM'}
                      </span>
                      <span className="text-xs text-text-muted">{t.format}-player</span>
                    </div>
                  </div>
                  <h3 className="font-heading font-bold text-xl text-text-primary group-hover:text-cyan transition-colors mb-2">
                    {t.name}
                  </h3>
                  {t.standings && (
                    <div className="space-y-1 mb-2">
                      {t.standings.first && (
                        <p className="text-sm">
                          <span className="text-gold">🥇</span>
                          <span className="text-text-primary font-semibold ml-1">
                            {t.rosterNames[t.standings.first]}
                          </span>
                        </p>
                      )}
                      {t.standings.second && (
                        <p className="text-sm">
                          <span className="text-silver">🥈</span>
                          <span className="text-text-secondary ml-1">
                            {t.rosterNames[t.standings.second]}
                          </span>
                        </p>
                      )}
                      {t.standings.third && (
                        <p className="text-sm">
                          <span className="text-bronze">🥉</span>
                          <span className="text-text-secondary ml-1">
                            {t.rosterNames[t.standings.third]}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-[0.65rem] text-text-muted mt-2">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {tournaments.length === 0 && !showCreate && (
        <div className="card-glow p-12 text-center">
          <p className="text-text-muted text-lg mb-2 font-heading">No tournaments yet</p>
          <p className="text-text-muted text-sm mb-4">Create your first tournament to start competing!</p>
          <button onClick={() => setShowCreate(true)} className="btn-volt">
            🏆 Create Tournament
          </button>
        </div>
      )}
    </div>
  );
}
