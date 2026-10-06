'use client';

import { useEffect, useState } from 'react';
import { subscribeToUsers, subscribeToMatches, deleteMatch } from '@/lib/db';
import { User, Match, MatchType } from '@/lib/types';
import { useRateLimit } from '@/lib/useRateLimit';
import { getAdminToken, loginWithPin, clearAdminToken, hasAdminSession } from '@/lib/adminAuth';

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
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  // Admin and rate limiting state
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminBypassModal, setShowAdminBypassModal] = useState(false);
  const [bypassPin, setBypassPin] = useState('');
  const [bypassPinError, setBypassPinError] = useState('');
  const [verifyingBypass, setVerifyingBypass] = useState(false);
  const { isRateLimited, formattedCountdown, recordSubmission } = useRateLimit(isAdmin);
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');

  // Delete modal state
  const [deleteModalMatch, setDeleteModalMatch] = useState<Match | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  useEffect(() => {
    setIsAdmin(hasAdminSession());
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

  const handleAdminBypassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBypassPinError('');
    if (!bypassPin || bypassPin.length < 4) {
      setBypassPinError('Enter 4-digit PIN');
      return;
    }
    setVerifyingBypass(true);
    try {
      const res = await loginWithPin(bypassPin);
      if (res.success) {
        setIsAdmin(true);
        setShowAdminBypassModal(false);
        setBypassPin('');
      } else {
        setBypassPinError(res.error || 'Invalid Admin PIN');
      }
    } catch {
      setBypassPinError('Failed to verify PIN');
    } finally {
      setVerifyingBypass(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRateLimited && !isAdmin) {
      setError(`Rate limit active. Please wait ${formattedCountdown} before submitting another casual match.`);
      return;
    }

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
      const token = getAdminToken();
      const res = await fetch('/api/matches/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isAdmin && token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
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
          adminToken: isAdmin ? token : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit match');
      }

      if (data.status === 'pending') {
        recordSubmission(); // Sets 10-minute cooldown in localStorage!
        setSuccessMessage('✓ Match submitted for review! It will appear on leaderboards once approved by an Admin.');
      } else {
        setSuccessMessage('✓ Match approved and logged! Leaderboard stats updated.');
      }

      resetForm();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      console.error('Error logging match:', err);
      setError(err?.message ? `Failed: ${err.message}` : 'Failed to log match. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete match handlers
  const openDeleteModal = (match: Match) => {
    setDeleteModalMatch(match);
    setDeletePassword('');
    setDeleteError('');
    setDeleteSuccess(false);
  };

  const closeDeleteModal = () => {
    setDeleteModalMatch(null);
    setDeletePassword('');
    setDeleteError('');
    setDeleteSuccess(false);
  };

  const handleDeleteMatch = async () => {
    if (!deleteModalMatch) return;

    const correctPassword = process.env.NEXT_PUBLIC_DELETE_PASSWORD || '';
    if (deletePassword !== correctPassword) {
      setDeleteError('Incorrect password. Access denied.');
      return;
    }

    setDeleting(true);
    setDeleteError('');
    try {
      await deleteMatch(deleteModalMatch.id);
      setDeleteSuccess(true);
      setTimeout(() => {
        closeDeleteModal();
      }, 1500);
    } catch (err: any) {
      console.error('Error deleting match:', err);
      setDeleteError(err?.message || 'Failed to delete match.');
    } finally {
      setDeleting(false);
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

            {successMessage && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium animate-fade-in">
                {successMessage}
              </div>
            )}

            {/* Admin status indicator banner */}
            {isAdmin && (
              <div className="p-2.5 rounded-lg bg-volt/10 border border-volt/30 flex items-center justify-between text-xs">
                <span className="font-heading font-bold text-volt flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-volt animate-pulse" />
                  Admin Active: Cooldown Bypassed
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearAdminToken();
                    setIsAdmin(false);
                  }}
                  className="text-text-muted hover:text-red transition-colors text-[0.7rem]"
                >
                  Exit Admin
                </button>
              </div>
            )}

            {/* Submit Button with Live Countdown */}
            <div>
              <button
                type="submit"
                id="submit-match"
                disabled={submitting || (isRateLimited && !isAdmin)}
                className={`w-full py-3 px-6 rounded-lg font-heading font-black text-sm uppercase tracking-wider transition-all duration-200 ${
                  isRateLimited && !isAdmin
                    ? 'bg-bg-elevated text-text-muted border border-border cursor-not-allowed opacity-80'
                    : 'btn-volt cursor-pointer'
                }`}
              >
                {submitting ? (
                  'Submitting Result...'
                ) : isRateLimited && !isAdmin ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin text-amber-400">
                      <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10" />
                    </svg>
                    <span>Cooldown Active ({formattedCountdown})</span>
                  </span>
                ) : isAdmin ? (
                  'Log Match Result (Admin Auto-Approve)'
                ) : (
                  'Submit Match Result'
                )}
              </button>

              {/* Countdown feedback directly under submit button */}
              {isRateLimited && !isAdmin && (
                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-heading flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Next submission available in <strong className="font-mono text-sm text-amber-300">{formattedCountdown}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdminBypassModal(true)}
                    className="text-[0.7rem] underline font-bold uppercase text-volt hover:text-white transition-colors"
                  >
                    Admin Bypass?
                  </button>
                </div>
              )}

              {!isAdmin && !isRateLimited && (
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAdminBypassModal(true)}
                    className="text-[0.65rem] text-text-muted hover:text-volt font-heading tracking-wide uppercase transition-colors"
                  >
                    Admin? Enter PIN to bypass queue
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Match History */}
        <div className="lg:col-span-3 card-glow p-0 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
                Match History
              </h2>
              <span className="text-xs text-text-muted">{matches.length} total matches</span>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 bg-bg-secondary p-1 rounded-lg border border-border text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded font-heading font-semibold text-[0.7rem] transition-colors ${
                  statusFilter === 'all' ? 'bg-volt text-bg-primary' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-2.5 py-1 rounded font-heading font-semibold text-[0.7rem] transition-colors ${
                  statusFilter === 'approved' ? 'bg-emerald-500 text-white' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Approved ({matches.filter((m) => m.status === 'approved').length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded font-heading font-semibold text-[0.7rem] transition-colors ${
                  statusFilter === 'pending' ? 'bg-amber-500 text-bg-primary' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Pending ({matches.filter((m) => m.status === 'pending').length})
              </button>
            </div>
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
                    <th className="text-center">Status</th>
                    <th className="text-center">Mode</th>
                    <th className="text-center">Type</th>
                    <th>Date</th>
                    <th className="text-center" style={{ width: '44px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {matches
                    .filter((m) => (statusFilter === 'all' ? true : m.status === statusFilter))
                    .map((match) => {
                      const isP1Winner = !match.isDraw && match.winnerId === match.player1Id;
                      const isP2Winner = !match.isDraw && match.winnerId === match.player2Id;
                      const isTournament = !!match.tournamentId;

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
                            {match.status === 'pending' ? (
                              <span className="px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse" title="Pending admin approval. Does not impact leaderboard stats yet.">
                                Pending
                              </span>
                            ) : match.status === 'rejected' ? (
                              <span className="px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase tracking-wider bg-red/15 text-red border border-red/30">
                                Rejected
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
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
                              {!match.isDraw && !match.isPenalty && !match.tournamentId && <span className="text-text-muted text-xs">REG</span>}
                            </div>
                          </td>
                          <td className="text-text-secondary text-xs">
                            {new Date(match.createdAt).toLocaleDateString()}
                          </td>
                          <td className="text-center">
                            <button
                              id={`delete-match-${match.id}`}
                              onClick={() => openDeleteModal(match)}
                              disabled={isTournament}
                              title={isTournament ? 'Cannot delete tournament matches' : 'Delete this match'}
                              className={`group relative p-1.5 rounded-md transition-all duration-200 ${
                                isTournament
                                  ? 'opacity-25 cursor-not-allowed text-text-muted'
                                  : 'text-text-muted hover:text-red hover:bg-red/10 cursor-pointer'
                              }`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </button>
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

      {/* Delete Confirmation Modal */}
      {deleteModalMatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}
        >
          <div
            className="relative w-full max-w-md mx-4 rounded-2xl border border-red/30 overflow-hidden animate-scale-in"
            style={{
              background: 'linear-gradient(145deg, #1e1e1e 0%, #1a1a1a 50%, #1e1e1e 100%)',
              boxShadow: '0 0 40px rgba(255, 75, 75, 0.15), 0 25px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Danger header strip */}
            <div className="h-1 w-full bg-gradient-to-r from-red via-red-dim to-red"></div>

            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-red/15 border border-red/25 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-heading font-black text-lg uppercase tracking-wide text-text-primary">
                    Delete Match Log
                  </h3>
                  <p className="text-text-secondary text-xs mt-0.5">
                    This action cannot be undone
                  </p>
                </div>
                <button
                  onClick={closeDeleteModal}
                  className="text-text-muted hover:text-text-primary transition-colors p-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Match details being deleted */}
              <div className="p-4 rounded-xl bg-bg-primary border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-heading text-sm">
                    <span className="text-text-primary font-bold">{deleteModalMatch.player1Name}</span>
                    <span className="text-text-muted text-xs">vs</span>
                    <span className="text-text-primary font-bold">{deleteModalMatch.player2Name}</span>
                  </div>
                  <span className="font-heading font-black text-base">
                    {deleteModalMatch.player1Score} - {deleteModalMatch.player2Score}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {deleteModalMatch.isDraw ? (
                    <span className="text-amber-400 text-xs font-heading font-semibold">🤝 Draw</span>
                  ) : (
                    <span className="text-volt text-xs font-heading font-bold">👑 {deleteModalMatch.winnerName} won</span>
                  )}
                  <span className="text-text-muted text-xs">•</span>
                  <span className={`text-xs font-heading font-bold uppercase ${
                    deleteModalMatch.matchType === 'auth' ? 'text-purple-400' : 'text-cyan'
                  }`}>
                    {deleteModalMatch.matchType === 'auth' ? '🛡️ Auth' : '⚡ Dream'}
                  </span>
                  <span className="text-text-muted text-xs">•</span>
                  <span className="text-text-secondary text-xs">
                    {new Date(deleteModalMatch.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* What will be reversed */}
              <div className="p-3 rounded-lg bg-red/5 border border-red/15 text-xs text-text-secondary space-y-1">
                <p className="text-red font-heading font-bold text-[0.7rem] uppercase tracking-wider mb-1.5">Stats that will be reversed:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span>• Points & W/D/L</span>
                  <span>• Goals For/Against</span>
                  <span>• Goal Difference</span>
                  <span>• Matches Played</span>
                  <span>• Head-to-Head record</span>
                  <span>• Mode-specific stats</span>
                </div>
              </div>

              {/* Password input */}
              {!deleteSuccess && (
                <div>
                  <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-2">
                    🔒 Enter Admin Password
                  </label>
                  <input
                    id="delete-password-input"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDeleteMatch(); }}
                    placeholder="Enter password to confirm..."
                    className="input-dark"
                    autoFocus
                  />
                </div>
              )}

              {/* Error */}
              {deleteError && (
                <div className="p-3 rounded-lg bg-red/10 border border-red/30 text-red text-sm font-medium animate-fade-in flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                  {deleteError}
                </div>
              )}

              {/* Success */}
              {deleteSuccess && (
                <div className="p-4 rounded-lg bg-volt/10 border border-volt/30 text-volt text-sm font-heading font-bold animate-fade-in flex items-center gap-2 justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Match deleted! Stats reversed successfully.
                </div>
              )}

              {/* Action buttons */}
              {!deleteSuccess && (
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={closeDeleteModal}
                    className="btn-outline flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-delete-match"
                    onClick={handleDeleteMatch}
                    disabled={deleting || !deletePassword}
                    className="btn-danger flex-1 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Delete Match
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin PIN Bypass Modal */}
      {showAdminBypassModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdminBypassModal(false); }}
        >
          <div
            className="relative w-full max-w-sm mx-4 rounded-2xl border border-volt/30 overflow-hidden animate-scale-in p-6 space-y-4"
            style={{
              background: 'linear-gradient(145deg, #181818 0%, #121212 100%)',
              boxShadow: '0 0 40px rgba(212, 255, 0, 0.15), 0 25px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-volt/15 text-volt flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3 className="font-heading font-black text-base uppercase tracking-wider text-text-primary">
                  Admin <span className="text-volt">Bypass</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminBypassModal(false)}
                className="text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <p className="text-text-secondary text-xs">
              Enter the 4-digit Master PIN to lift submission rate limits and auto-approve match results on this device.
            </p>

            <form onSubmit={handleAdminBypassSubmit} className="space-y-4">
              <input
                id="bypass-pin-input"
                type="password"
                maxLength={8}
                inputMode="numeric"
                autoFocus
                value={bypassPin}
                onChange={(e) => { setBypassPin(e.target.value); setBypassPinError(''); }}
                placeholder="••••"
                className="input-dark text-center tracking-[0.5em] text-xl font-mono py-2.5 font-bold"
              />

              {bypassPinError && (
                <div className="p-2.5 rounded-lg bg-red/10 border border-red/30 text-red text-xs font-semibold text-center">
                  {bypassPinError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminBypassModal(false)}
                  className="btn-outline flex-1 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingBypass || bypassPin.length < 4}
                  className="btn-volt flex-1 py-2 text-xs"
                >
                  {verifyingBypass ? 'Verifying...' : 'Unlock Bypass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
