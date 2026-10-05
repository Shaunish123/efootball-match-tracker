'use client';

import { useEffect, useState } from 'react';
import { subscribeToUsers, subscribeToMatches, logMatch } from '@/lib/db';
import { User, Match } from '@/lib/types';

export default function MatchesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isPenalty, setIsPenalty] = useState(false);
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

  // Check if scores are tied (enable penalty toggle)
  const scoresAreTied = score1 !== '' && score2 !== '' && parseInt(score1) === parseInt(score2);

  const resetForm = () => {
    setPlayer1Id('');
    setPlayer2Id('');
    setScore1('');
    setScore2('');
    setIsPenalty(false);
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
    if (s1 === s2 && !isPenalty) {
      setError('Scores are tied. Enable penalty shootout to determine a winner.');
      return;
    }
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
        <p className="text-text-secondary mt-1 text-sm">Record a match result and update all stats instantly</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Match Form */}
        <div className="lg:col-span-2 card-glow p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                        setIsPenalty(false);
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
                        setIsPenalty(false);
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

            {/* Penalty Toggle */}
            {scoresAreTied && (
              <div className="animate-fade-in">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-cyan/5 border border-cyan/20">
                  <button
                    type="button"
                    id="penalty-toggle"
                    onClick={() => setIsPenalty(!isPenalty)}
                    className={`
                      relative w-12 h-6 rounded-full transition-colors duration-200
                      ${isPenalty ? 'bg-cyan' : 'bg-border-accent'}
                    `}
                  >
                    <span
                      className={`
                        absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200
                        ${isPenalty ? 'translate-x-6' : 'translate-x-0'}
                      `}
                    />
                  </button>
                  <span className="text-sm font-heading font-semibold text-cyan uppercase tracking-wide">
                    Penalty Shootout
                  </span>
                </div>

                {isPenalty && (
                  <div className="mt-4 animate-fade-in">
                    <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-2">
                      Penalty Score
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
                ✓ Match logged successfully! Stats updated across all devices.
              </div>
            )}

            <button
              type="submit"
              id="submit-match"
              disabled={submitting}
              className="btn-volt w-full"
            >
              {submitting ? 'Logging...' : 'Log Match Result'}
            </button>
          </form>
        </div>

        {/* Match History */}
        <div className="lg:col-span-3 card-glow p-0 overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
              Match History
            </h2>
          </div>

          {matches.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-text-muted text-sm">No matches logged yet. Record your first match!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-gaming">
                <thead>
                  <tr>
                    <th>Players</th>
                    <th className="text-center">Score</th>
                    <th>Winner</th>
                    <th className="text-center">Type</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => (
                    <tr key={match.id}>
                      <td>
                        <span className="font-heading font-semibold text-sm">
                          {match.player1Name} <span className="text-text-muted">vs</span> {match.player2Name}
                        </span>
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
                        <span className="text-volt font-heading font-semibold text-sm">
                          {match.winnerName}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex justify-center gap-1">
                          {match.isPenalty && <span className="badge badge-penalty text-[0.6rem]">PEN</span>}
                          {match.tournamentId && <span className="badge badge-tournament text-[0.6rem]">CUP</span>}
                          {!match.isPenalty && !match.tournamentId && <span className="text-text-muted text-xs">REG</span>}
                        </div>
                      </td>
                      <td className="text-text-secondary text-xs">
                        {new Date(match.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
