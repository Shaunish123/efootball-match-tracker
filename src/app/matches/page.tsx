'use client';

import { useEffect, useState } from 'react';
import { subscribeToUsers, subscribeToMatches, logMatch } from '@/lib/db';
import { User, Match, MatchType } from '@/lib/types';

export default function MatchesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('dream');
  const [tieResultType, setTieResultType] = useState<'draw' | 'pens'>('draw');
  const [penScore1, setPenScore1] = useState('');
  const [penScore2, setPenScore2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub1 = subscribeToUsers(setUsers);
    const unsub2 = subscribeToMatches(setMatches);
    return () => { unsub1(); unsub2(); };
  }, []);

  // Check if scores are tied
  const scoresAreTied = score1 !== '' && score2 !== '' && parseInt(score1) === parseInt(score2);

  const resetForm = () => {
    setPlayer1Id('');
    setPlayer2Id('');
    setScore1('');
    setScore2('');
    setMatchType('dream');
    setTieResultType('draw');
    setPenScore1('');
    setPenScore2('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!player1Id || !player2Id) {
      setError('Please select both players');
      return;
    }
    if (player1Id === player2Id) {
      setError('Players must be different');
      return;
    }
    const s1 = parseInt(score1);
    const s2 = parseInt(score2);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setError('Please enter valid scores');
      return;
    }

    const isDraw = s1 === s2 && tieResultType === 'draw';
    const isPenalty = s1 === s2 && tieResultType === 'pens';

    if (isPenalty) {
      const ps1 = parseInt(penScore1);
      const ps2 = parseInt(penScore2);
      if (isNaN(ps1) || isNaN(ps2) || ps1 < 0 || ps2 < 0) {
        setError('Please enter valid penalty scores');
        return;
      }
      if (ps1 === ps2) {
        setError('Penalty scores cannot be tied');
        return;
      }
    }

    const p1 = users.find((u) => u.id === player1Id)!;
    const p2 = users.find((u) => u.id === player2Id)!;

    setSubmitting(true);
    try {
      await logMatch({
        player1Id,
        player2Id,
        player1Name: p1.displayName,
        player2Name: p2.displayName,
        player1Score: s1,
        player2Score: s2,
        matchType,
        isDraw,
        isPenalty,
        penaltyScore1: isPenalty ? parseInt(penScore1) : undefined,
        penaltyScore2: isPenalty ? parseInt(penScore2) : undefined,
      });
      setSuccess(true);
      resetForm();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error logging match to Firebase:', err);
      setError(err?.message ? `Failed: ${err.message}` : 'Failed to log match. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const p1Name = users.find((u) => u.id === player1Id)?.displayName || 'Player 1';
  const p2Name = users.find((u) => u.id === player2Id)?.displayName || 'Player 2';

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-heading font-black text-3xl md:text-4xl tracking-tight">
          LOG <span className="text-cyan">MATCH</span>
        </h1>
        <p className="text-text-secondary mt-1 text-sm">Record a match result and update stats across all leaderboards</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Match Form */}
        <div className="lg:col-span-2 card-glow p-6 h-fit">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Match Mode Selector (Dream vs Auth) */}
            <div>
              <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-2">
                Match Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="mode-dream-btn"
                  onClick={() => setMatchType('dream')}
                  className={`py-2.5 px-4 rounded-lg font-heading font-bold text-xs uppercase tracking-wider transition-all border ${
                    matchType === 'dream'
                      ? 'bg-cyan/15 text-cyan border-cyan/40 shadow-[0_0_15px_rgba(0,229,255,0.2)]'
                      : 'bg-bg-secondary text-text-muted border-border hover:border-border-accent'
                  }`}
                >
                  ⚡ Dream Team
                </button>
                <button
                  type="button"
                  id="mode-auth-btn"
                  onClick={() => setMatchType('auth')}
                  className={`py-2.5 px-4 rounded-lg font-heading font-bold text-xs uppercase tracking-wider transition-all border ${
                    matchType === 'auth'
                      ? 'bg-purple-500/15 text-purple-400 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                      : 'bg-bg-secondary text-text-muted border-border hover:border-border-accent'
                  }`}
                >
                  🛡️ Auth Team
                </button>
              </div>
            </div>

            {/* Player Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-2">
                  Player 1
                </label>
                <select
                  id="select-player1"
                  value={player1Id}
                  onChange={(e) => setPlayer1Id(e.target.value)}
                  className="select-dark"
                >
                  <option value="">Select...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} disabled={u.id === player2Id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-2">
                  Player 2
                </label>
                <select
                  id="select-player2"
                  value={player2Id}
                  onChange={(e) => setPlayer2Id(e.target.value)}
                  className="select-dark"
                >
                  <option value="">Select...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} disabled={u.id === player1Id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Score Input */}
            <div>
              <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-2">
                Match Score
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <p className="text-xs text-text-secondary mb-1 font-heading truncate">{p1Name}</p>
                  <input
                    id="score-player1"
                    type="number"
                    min="0"
                    value={score1}
                    onChange={(e) => {
                      setScore1(e.target.value);
                      if (e.target.value !== score2) {
                        setPenScore1('');
                        setPenScore2('');
                      }
                    }}
                    className="input-dark text-center text-2xl font-heading font-black"
                    placeholder="0"
                  />
                </div>
                <span className="text-text-muted font-heading font-black text-2xl mt-5">VS</span>
                <div className="flex-1 text-center">
                  <p className="text-xs text-text-secondary mb-1 font-heading truncate">{p2Name}</p>
                  <input
                    id="score-player2"
                    type="number"
                    min="0"
                    value={score2}
                    onChange={(e) => {
                      setScore2(e.target.value);
                      if (score1 !== e.target.value) {
                        setPenScore1('');
                        setPenScore2('');
                      }
                    }}
                    className="input-dark text-center text-2xl font-heading font-black"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Tied Score Result Option: Draw vs Pens */}
            {scoresAreTied && (
              <div className="p-4 rounded-xl bg-bg-secondary border border-cyan/20 animate-fade-in space-y-3">
                <label className="block text-xs font-heading font-bold uppercase tracking-widest text-cyan">
                  Scores Are Tied: Choose Result Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    id="tie-draw-btn"
                    onClick={() => setTieResultType('draw')}
                    className={`py-2 px-3 rounded-lg font-heading font-bold text-xs uppercase transition-all ${
                      tieResultType === 'draw'
                        ? 'bg-volt/15 text-volt border border-volt/30'
                        : 'bg-bg-primary text-text-muted border border-border hover:border-border-accent'
                    }`}
                  >
                    🤝 Draw (1 Pt Each)
                  </button>
                  <button
                    type="button"
                    id="tie-pens-btn"
                    onClick={() => setTieResultType('pens')}
                    className={`py-2 px-3 rounded-lg font-heading font-bold text-xs uppercase transition-all ${
                      tieResultType === 'pens'
                        ? 'bg-cyan/15 text-cyan border border-cyan/30'
                        : 'bg-bg-primary text-text-muted border border-border hover:border-border-accent'
                    }`}
                  >
                    ⚽ Penalties (Pens)
                  </button>
                </div>

                {tieResultType === 'pens' && (
                  <div className="pt-2 animate-fade-in">
                    <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-2">
                      Penalty Shootout Score
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 text-center">
                        <p className="text-xs text-text-secondary mb-1 font-heading truncate">{p1Name}</p>
                        <input
                          id="penalty-score-player1"
                          type="number"
                          min="0"
                          value={penScore1}
                          onChange={(e) => setPenScore1(e.target.value)}
                          className="input-dark text-center text-xl font-heading font-bold"
                          placeholder="0"
                        />
                      </div>
                      <span className="text-cyan font-heading font-black text-sm mt-5">PEN</span>
                      <div className="flex-1 text-center">
                        <p className="text-xs text-text-secondary mb-1 font-heading truncate">{p2Name}</p>
                        <input
                          id="penalty-score-player2"
                          type="number"
                          min="0"
                          value={penScore2}
                          onChange={(e) => setPenScore2(e.target.value)}
                          className="input-dark text-center text-xl font-heading font-bold"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red/10 border border-red/30 text-red text-sm font-medium animate-fade-in">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-volt/10 border border-volt/30 text-volt text-sm font-medium animate-fade-in">
                ✓ Match logged successfully! Stats updated across all leaderboards.
              </div>
            )}

            <button
              type="submit"
              id="submit-match"
              disabled={submitting}
              className="btn-volt w-full"
            >
              {submitting ? 'Logging Result...' : 'Log Match Result'}
            </button>
          </form>
        </div>

        {/* Match History */}
        <div className="lg:col-span-3 card-glow p-0 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
              Match History
            </h2>
            <span className="text-xs text-text-muted">{matches.length} matches logged</span>
          </div>

          {matches.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-text-muted text-sm">No matches logged yet. Record your first match!</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="table-gaming">
                <thead>
                  <tr>
                    <th>Matchup</th>
                    <th className="text-center">Score</th>
                    <th>Outcome</th>
                    <th className="text-center">Mode</th>
                    <th className="text-center">Type</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => {
                    const isP1Winner = !match.isDraw && match.winnerId === match.player1Id;
                    const isP2Winner = !match.isDraw && match.winnerId === match.player2Id;

                    return (
                      <tr key={match.id}>
                        <td>
                          <div className="flex items-center gap-1.5 font-heading text-sm">
                            <span className={isP1Winner ? 'text-volt font-bold' : 'text-text-primary'}>
                              {match.player1Name}
                            </span>
                            <span className="text-text-muted text-xs font-normal px-1">vs</span>
                            <span className={isP2Winner ? 'text-volt font-bold' : 'text-text-primary'}>
                              {match.player2Name}
                            </span>
                          </div>
                        </td>
                        <td className="text-center">
                          <span className="font-heading font-black text-lg">
                            {match.player1Score} - {match.player2Score}
                          </span>
                          {match.isPenalty && match.penaltyScore1 !== undefined && (
                            <span className="block text-xs text-cyan">
                              ({match.penaltyScore1} - {match.penaltyScore2} pen)
                            </span>
                          )}
                        </td>
                        <td>
                          {match.isDraw ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-heading font-semibold text-xs px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                              <span>🤝</span> Draw (+1)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-volt font-heading font-bold text-xs px-2.5 py-1 rounded-md bg-volt/10 border border-volt/25">
                              <span>👑</span> {match.winnerName} (+3)
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
                            {!match.isDraw && !match.isPenalty && !match.tournamentId && <span className="text-text-muted text-xs">REG</span>}
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
    </div>
  );
}
