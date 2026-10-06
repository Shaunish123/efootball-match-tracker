'use client';

import { useEffect, useState } from 'react';
import { subscribeToMatches, subscribeToUsers, recalculateAllUserStats } from '@/lib/db';
import { Match, User } from '@/lib/types';
import { getAdminToken, setAdminToken, clearAdminToken, loginWithPin } from '@/lib/adminAuth';
import Link from 'next/link';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [verifyingPin, setVerifyingPin] = useState<boolean>(false);

  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'controls'>('pending');

  const [processingMatchId, setProcessingMatchId] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string>('');
  const [actionErrorMessage, setActionErrorMessage] = useState<string>('');
  const [recalculating, setRecalculating] = useState<boolean>(false);

  useEffect(() => {
    // Check client session
    const token = getAdminToken();
    if (token) {
      setIsAuthenticated(true);
    }
    setCheckingAuth(false);

    const unsubMatches = subscribeToMatches(setMatches);
    const unsubUsers = subscribeToUsers(setUsers);
    return () => {
      unsubMatches();
      unsubUsers();
    };
  }, []);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (!pinInput || pinInput.length < 4) {
      setPinError('Please enter a 4-digit PIN');
      return;
    }

    setVerifyingPin(true);
    try {
      const res = await loginWithPin(pinInput);
      if (res.success) {
        setIsAuthenticated(true);
        setPinInput('');
      } else {
        setPinError(res.error || 'Invalid Admin PIN');
      }
    } catch {
      setPinError('Error connecting to server. Please try again.');
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setIsAuthenticated(false);
    setPinInput('');
    setPinError('');
  };

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setActionErrorMessage(msg);
      setTimeout(() => setActionErrorMessage(''), 4000);
    } else {
      setActionSuccessMessage(msg);
      setTimeout(() => setActionSuccessMessage(''), 4000);
    }
  };

  const handleApprove = async (matchId: string) => {
    const token = getAdminToken();
    setProcessingMatchId(matchId);
    try {
      const res = await fetch('/api/admin/approve-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId, token }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('✓ Match approved! Stats updated across all leaderboards in real time.');
      } else {
        showNotification(data.error || 'Failed to approve match', true);
      }
    } catch (err: any) {
      showNotification(err?.message || 'Network error approving match', true);
    } finally {
      setProcessingMatchId(null);
    }
  };

  const handleDeny = async (matchId: string, action: 'reject' | 'delete' = 'reject') => {
    const token = getAdminToken();
    setProcessingMatchId(matchId);
    try {
      const res = await fetch('/api/admin/deny-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId, action, token }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(action === 'delete' ? '✓ Match request deleted' : '✓ Match marked as rejected');
      } else {
        showNotification(data.error || 'Failed to deny match', true);
      }
    } catch (err: any) {
      showNotification(err?.message || 'Network error denying match', true);
    } finally {
      setProcessingMatchId(null);
    }
  };

  const handleRecalculateStats = async () => {
    setRecalculating(true);
    try {
      await recalculateAllUserStats();
      showNotification('✓ Successfully re-synchronized all user stats and H2H records from approved matches!');
    } catch (err: any) {
      showNotification(err?.message || 'Failed to recalculate stats', true);
    } finally {
      setRecalculating(false);
    }
  };

  const pendingMatches = matches.filter((m) => m.status === 'pending');
  const approvedMatches = matches.filter((m) => m.status === 'approved');
  const rejectedMatches = matches.filter((m) => m.status === 'rejected');

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-volt/30 border-t-volt rounded-full animate-spin" />
      </div>
    );
  }

  // ==================== PIN GATE MODAL / CARD ====================
  if (!isAuthenticated) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4 animate-fade-in">
        <div
          className="w-full max-w-md rounded-2xl border border-volt/30 p-8 space-y-6 text-center"
          style={{
            background: 'linear-gradient(145deg, #181818 0%, #121212 100%)',
            boxShadow: '0 0 50px rgba(212, 255, 0, 0.1), 0 20px 40px rgba(0, 0, 0, 0.6)',
          }}
        >
          {/* Admin Shield Icon */}
          <div className="w-16 h-16 rounded-2xl bg-volt/10 border border-volt/30 mx-auto flex items-center justify-center text-volt">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>

          <div>
            <h1 className="font-heading font-black text-2xl uppercase tracking-wider text-text-primary">
              ADMIN <span className="text-volt">PORTAL</span>
            </h1>
            <p className="text-text-secondary text-xs mt-1.5">
              Enter the 4-digit Master PIN to unlock match approval & tournament management
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <input
                id="admin-pin-input"
                type="password"
                maxLength={8}
                inputMode="numeric"
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError('');
                }}
                placeholder="••••"
                className="input-dark text-center tracking-[0.5em] text-2xl font-mono py-3 font-bold"
              />
            </div>

            {pinError && (
              <div className="p-3 rounded-lg bg-red/10 border border-red/30 text-red text-xs font-semibold animate-fade-in flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {pinError}
              </div>
            )}

            <button
              id="admin-login-button"
              type="submit"
              disabled={verifyingPin || pinInput.length < 4}
              className="btn-volt w-full flex items-center justify-center gap-2"
            >
              {verifyingPin ? (
                <>
                  <span className="w-4 h-4 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                'Unlock Admin Dashboard'
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-border/50 text-text-muted text-xs">
            <span>Server-side verification active</span>
          </div>
        </div>
      </div>
    );
  }

  // ==================== AUTHENTICATED ADMIN DASHBOARD ====================
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-bg-card border border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-volt/15 border border-volt/30 flex items-center justify-center text-volt">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading font-black text-2xl md:text-3xl tracking-tight text-text-primary">
                ADMIN <span className="text-volt">PORTAL</span>
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold bg-volt/15 text-volt border border-volt/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-volt animate-ping" />
                ACTIVE SESSION
              </span>
            </div>
            <p className="text-text-secondary text-xs mt-0.5">
              Review casual match submissions, manage tournaments, and sync player leaderboards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/matches" className="btn-outline text-xs">
            Log Match (Admin Mode)
          </Link>
          <button
            id="admin-logout-button"
            onClick={handleLogout}
            className="px-3.5 py-2 rounded-lg bg-bg-secondary hover:bg-red/10 hover:text-red border border-border hover:border-red/30 text-text-muted text-xs font-heading font-bold uppercase tracking-wider transition-colors"
          >
            Lock Session
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-heading font-bold flex items-center gap-2 animate-fade-in">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {actionSuccessMessage}
        </div>
      )}

      {actionErrorMessage && (
        <div className="p-4 rounded-xl bg-red/10 border border-red/30 text-red text-sm font-heading font-semibold flex items-center gap-2 animate-fade-in">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {actionErrorMessage}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-bg-card border border-border">
          <p className="text-text-muted text-xs font-heading font-bold uppercase tracking-wider">Pending Review</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-heading font-black text-amber-400">{pendingMatches.length}</span>
            <span className="text-xs text-text-muted">casual matches</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-bg-card border border-border">
          <p className="text-text-muted text-xs font-heading font-bold uppercase tracking-wider">Approved Matches</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-heading font-black text-volt">{approvedMatches.length}</span>
            <span className="text-xs text-text-muted">on leaderboard</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-bg-card border border-border">
          <p className="text-text-muted text-xs font-heading font-bold uppercase tracking-wider">Rejected Requests</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-heading font-black text-red">{rejectedMatches.length}</span>
            <span className="text-xs text-text-muted">dismissed</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-bg-card border border-border">
          <p className="text-text-muted text-xs font-heading font-bold uppercase tracking-wider">Registered Players</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-heading font-black text-cyan">{users.length}</span>
            <span className="text-xs text-text-muted">active</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-heading font-bold text-xs uppercase tracking-wider transition-all ${
            activeTab === 'pending'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-card border border-transparent'
          }`}
        >
          <span>Pending Queue</span>
          {pendingMatches.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[0.65rem] bg-amber-500 text-bg-primary font-black">
              {pendingMatches.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('approved')}
          className={`px-4 py-2.5 rounded-lg font-heading font-bold text-xs uppercase tracking-wider transition-all ${
            activeTab === 'approved'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-card border border-transparent'
          }`}
        >
          Approved Matches ({approvedMatches.length})
        </button>

        <button
          onClick={() => setActiveTab('rejected')}
          className={`px-4 py-2.5 rounded-lg font-heading font-bold text-xs uppercase tracking-wider transition-all ${
            activeTab === 'rejected'
              ? 'bg-red/15 text-red border border-red/40'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-card border border-transparent'
          }`}
        >
          Rejected ({rejectedMatches.length})
        </button>

        <button
          onClick={() => setActiveTab('controls')}
          className={`px-4 py-2.5 rounded-lg font-heading font-bold text-xs uppercase tracking-wider transition-all ${
            activeTab === 'controls'
              ? 'bg-volt/15 text-volt border border-volt/40'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-card border border-transparent'
          }`}
        >
          Maintenance & Controls
        </button>
      </div>

      {/* ================= TAB 1: PENDING QUEUE ================= */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
              Pending Match Queue
            </h2>
            <span className="text-xs text-text-muted">
              {pendingMatches.length} casual matches awaiting your verification
            </span>
          </div>

          {pendingMatches.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-bg-card border border-border">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="font-heading font-bold text-base text-text-primary">All Caught Up!</h3>
              <p className="text-text-secondary text-xs mt-1">
                There are no pending matches in the review queue.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingMatches.map((match) => {
                const isProcessing = processingMatchId === match.id;
                const formattedDate = match.submittedAt
                  ? new Date(match.submittedAt).toLocaleString()
                  : new Date(match.createdAt).toLocaleString();

                return (
                  <div
                    key={match.id}
                    className="p-5 rounded-2xl bg-bg-card border border-amber-500/30 hover:border-amber-500/60 transition-all flex flex-col justify-between space-y-4"
                    style={{
                      boxShadow: '0 4px 20px rgba(245, 158, 11, 0.05)',
                    }}
                  >
                    <div>
                      {/* Card Header Tag */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[0.65rem] font-heading font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Pending Review
                        </span>

                        <span className={`px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase ${
                          match.matchType === 'auth' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-cyan/15 text-cyan border border-cyan/30'
                        }`}>
                          {match.matchType === 'auth' ? '🛡️ AUTH' : '⚡ DREAM'}
                        </span>
                      </div>

                      {/* Matchup & Score */}
                      <div className="p-3.5 rounded-xl bg-bg-secondary border border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 text-left">
                            <span className="font-heading font-bold text-sm text-text-primary block truncate">
                              {match.player1Name}
                            </span>
                          </div>

                          <div className="px-4 text-center">
                            <span className="font-heading font-black text-2xl tracking-wider text-text-primary">
                              {match.player1Score} - {match.player2Score}
                            </span>
                            {match.isPenalty && (
                              <span className="block text-[0.7rem] text-cyan font-heading font-semibold">
                                ({match.penaltyScore1 ?? match.player1PenScore ?? 0} - {match.penaltyScore2 ?? match.player2PenScore ?? 0} pen)
                              </span>
                            )}
                          </div>

                          <div className="flex-1 text-right">
                            <span className="font-heading font-bold text-sm text-text-primary block truncate">
                              {match.player2Name}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 text-center">
                          {match.isDraw ? (
                            <span className="text-amber-400 text-xs font-heading font-semibold">🤝 Draw</span>
                          ) : (
                            <span className="text-volt text-xs font-heading font-bold">
                              👑 Winner: {match.winnerName || (match.winnerId === match.player1Id ? match.player1Name : match.player2Name)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Timestamp Info */}
                      <div className="mt-2 text-[0.7rem] text-text-muted flex items-center justify-between">
                        <span>Submitted:</span>
                        <span className="text-text-secondary">{formattedDate}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      <button
                        id={`approve-match-${match.id}`}
                        onClick={() => handleApprove(match.id)}
                        disabled={isProcessing}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 font-heading font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                      >
                        {isProcessing ? (
                          <span className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        Approve Match
                      </button>

                      <button
                        id={`reject-match-${match.id}`}
                        onClick={() => handleDeny(match.id, 'reject')}
                        disabled={isProcessing}
                        className="py-2.5 px-3 rounded-xl bg-red/10 hover:bg-red/20 border border-red/30 text-red font-heading font-bold text-xs uppercase tracking-wider transition-all"
                        title="Reject match request"
                      >
                        Reject
                      </button>

                      <button
                        id={`delete-match-${match.id}`}
                        onClick={() => handleDeny(match.id, 'delete')}
                        disabled={isProcessing}
                        className="p-2.5 rounded-xl bg-bg-secondary hover:bg-red/15 text-text-muted hover:text-red border border-border hover:border-red/30 transition-all"
                        title="Permanently Delete match"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: APPROVED MATCHES ================= */}
      {activeTab === 'approved' && (
        <div className="card-glow p-0 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
              Approved Match History
            </h2>
            <span className="text-xs text-text-muted">{approvedMatches.length} approved matches</span>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="table-gaming">
              <thead>
                <tr>
                  <th>Matchup</th>
                  <th className="text-center">Score</th>
                  <th>Outcome</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Type</th>
                  <th>Date Approved</th>
                </tr>
              </thead>
              <tbody>
                {approvedMatches.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="flex items-center gap-1.5 font-heading text-sm">
                        <span className="text-text-primary font-bold">{m.player1Name}</span>
                        <span className="text-text-muted text-xs font-normal">vs</span>
                        <span className="text-text-primary font-bold">{m.player2Name}</span>
                      </div>
                    </td>
                    <td className="text-center font-heading font-black text-base">
                      {m.player1Score} - {m.player2Score}
                      {m.isPenalty && (
                        <span className="block text-xs text-cyan">
                          ({m.penaltyScore1} - {m.penaltyScore2} pen)
                        </span>
                      )}
                    </td>
                    <td>
                      {m.isDraw ? (
                        <span className="text-amber-400 font-heading text-xs font-semibold">🤝 Draw</span>
                      ) : (
                        <span className="text-volt font-heading text-xs font-bold">👑 {m.winnerName} won</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Approved
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="text-xs text-text-muted">
                        {m.tournamentId ? 'CUP' : 'CASUAL'}
                      </span>
                    </td>
                    <td className="text-text-secondary text-xs">
                      {m.approvedAt ? new Date(m.approvedAt).toLocaleDateString() : new Date(m.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: REJECTED MATCHES ================= */}
      {activeTab === 'rejected' && (
        <div className="card-glow p-0 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar">
              Rejected Requests
            </h2>
            <span className="text-xs text-text-muted">{rejectedMatches.length} rejected matches</span>
          </div>

          {rejectedMatches.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-text-muted text-sm">No rejected matches found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="table-gaming">
                <thead>
                  <tr>
                    <th>Matchup</th>
                    <th className="text-center">Score</th>
                    <th className="text-center">Status</th>
                    <th>Date Submitted</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedMatches.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="flex items-center gap-1.5 font-heading text-sm">
                          <span className="text-text-primary">{m.player1Name}</span>
                          <span className="text-text-muted text-xs">vs</span>
                          <span className="text-text-primary">{m.player2Name}</span>
                        </div>
                      </td>
                      <td className="text-center font-heading font-bold text-base">
                        {m.player1Score} - {m.player2Score}
                      </td>
                      <td className="text-center">
                        <span className="px-2 py-0.5 rounded text-[0.6rem] font-heading font-bold uppercase bg-red/15 text-red border border-red/30">
                          Rejected
                        </span>
                      </td>
                      <td className="text-text-secondary text-xs">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => handleDeny(m.id, 'delete')}
                          className="text-text-muted hover:text-red p-1 transition-colors"
                          title="Delete permanently"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: CONTROLS & RECALCULATION ================= */}
      {activeTab === 'controls' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stat Engine Recalculation */}
          <div className="p-6 rounded-2xl bg-bg-card border border-border space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan/15 text-cyan flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-text-primary uppercase tracking-wide">
                  Global Stat Calculation Engine
                </h3>
                <p className="text-text-secondary text-xs">
                  Re-aggregate all user points, goals, W/D/L, and H2H from approved matches
                </p>
              </div>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              If manual edits or legacy matches caused stat discrepancies, clicking below will reset and re-tally stats across every user strictly from approved matches in real time.
            </p>

            <button
              id="recalculate-stats-button"
              onClick={handleRecalculateStats}
              disabled={recalculating}
              className="btn-cyan w-full flex items-center justify-center gap-2"
            >
              {recalculating ? (
                <>
                  <span className="w-4 h-4 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" />
                  Recalculating Stats...
                </>
              ) : (
                'Recalculate All User Stats'
              )}
            </button>
          </div>

          {/* Tournament Quick Manager */}
          <div className="p-6 rounded-2xl bg-bg-card border border-border space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-volt/15 text-volt flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" />
                </svg>
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-text-primary uppercase tracking-wide">
                  Tournament Center
                </h3>
                <p className="text-text-secondary text-xs">
                  Create and manage official bracket tournaments
                </p>
              </div>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Tournament matches are exempt from the 10-minute cooldown and advance brackets automatically. Creation requires the Admin PIN.
            </p>

            <Link href="/tournaments" className="btn-volt w-full block text-center">
              Go to Tournaments Page
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
