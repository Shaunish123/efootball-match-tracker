'use client';

import { useEffect, useState } from 'react';
import { subscribeToMatches, subscribeToUsers, recalculateAllUserStats } from '@/lib/db';
import { subscribeToSeasons, getFixtureStats } from '@/lib/seasonDb';
import type { PairFixtureStats, PlayerFixtureStats } from '@/lib/seasonDb';
import { Match, User, Season } from '@/lib/types';
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
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'seasons' | 'controls'>('pending');

  const [processingMatchId, setProcessingMatchId] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string>('');
  const [actionErrorMessage, setActionErrorMessage] = useState<string>('');
  const [recalculating, setRecalculating] = useState<boolean>(false);

  // Season management state
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [startingSeason, setStartingSeason] = useState<boolean>(false);
  const [migratingSeason1, setMigratingSeason1] = useState<boolean>(false);
  const [endingSeason, setEndingSeason] = useState<boolean>(false);
  const [showEndModal, setShowEndModal] = useState<boolean>(false);
  const [activeFixtureStats, setActiveFixtureStats] = useState<{
    byPair: PairFixtureStats[];
    byPlayer: PlayerFixtureStats[];
    total: number;
    completed: number;
    pending: number;
  } | null>(null);

  useEffect(() => {
    // Check client session
    const token = getAdminToken();
    if (token) {
      setIsAuthenticated(true);
    }
    setCheckingAuth(false);

    const unsubMatches = subscribeToMatches(setMatches);
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubSeasons = subscribeToSeasons(setSeasons);
    return () => {
      unsubMatches();
      unsubUsers();
      unsubSeasons();
    };
  }, []);

  useEffect(() => {
    if (users.length > 0 && selectedPlayerIds.length === 0) {
      setSelectedPlayerIds(users.map((u) => u.id));
    }
  }, [users, selectedPlayerIds.length]);

  const activeSeason = seasons.find((s) => s.status === 'active') || null;
  const completedSeasons = seasons.filter((s) => s.status === 'completed');
  const season1Exists = seasons.some((s) => s.seasonNumber === 1);

  useEffect(() => {
    if (activeSeason && !activeSeason.isUnstructured && activeSeason.playerIds) {
      getFixtureStats(activeSeason.id, activeSeason.playerIds).then(setActiveFixtureStats);
    } else {
      setActiveFixtureStats(null);
    }
  }, [activeSeason?.id, activeSeason?.completedFixtures]);

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

  const handleMigrateSeason1 = async () => {
    const token = getAdminToken();
    setMigratingSeason1(true);
    try {
      const res = await fetch('/api/admin/seasons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'migrate-season-1', token }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('✓ Season 1 migrated successfully as a completed historical record!');
      } else {
        showNotification(data.error || 'Failed to migrate Season 1', true);
      }
    } catch {
      showNotification('Server connection error during migration', true);
    } finally {
      setMigratingSeason1(false);
    }
  };

  const handleStartSeason = async () => {
    if (selectedPlayerIds.length < 2) {
      showNotification('Please select at least 2 players to start a season', true);
      return;
    }
    const token = getAdminToken();
    setStartingSeason(true);
    try {
      const res = await fetch('/api/admin/seasons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'start', playerIds: selectedPlayerIds, token }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(`✓ ${data.message || 'New season started successfully with 15 fixtures per pair!'}`);
      } else {
        showNotification(data.error || 'Failed to start season', true);
      }
    } catch {
      showNotification('Server connection error while starting season', true);
    } finally {
      setStartingSeason(false);
    }
  };

  const handleEndSeason = async () => {
    if (!activeSeason) return;
    const token = getAdminToken();
    setEndingSeason(true);
    try {
      const res = await fetch('/api/admin/seasons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'end', seasonId: activeSeason.id, token }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowEndModal(false);
        showNotification('✓ Season ended successfully! Final standings snapshot saved to Season History.');
      } else {
        showNotification(data.error || 'Failed to end season', true);
      }
    } catch {
      showNotification('Server connection error while ending season', true);
    } finally {
      setEndingSeason(false);
    }
  };

  const togglePlayerSelection = (userId: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
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
          onClick={() => setActiveTab('seasons')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-heading font-bold text-xs uppercase tracking-wider transition-all ${
            activeTab === 'seasons'
              ? 'bg-volt/15 text-volt border border-volt/40'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-card border border-transparent'
          }`}
        >
          <span>Season Manager</span>
          {activeSeason ? (
            <span className="px-1.5 py-0.2 rounded text-[0.6rem] bg-emerald-500 text-bg-primary font-black">
              S{activeSeason.seasonNumber} LIVE
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded text-[0.6rem] bg-border text-text-muted font-bold">
              IDLE
            </span>
          )}
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
                  <th className="text-center">Actions</th>
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
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDeny(m.id, 'reject')}
                          disabled={processingMatchId === m.id}
                          className="px-2 py-1 rounded bg-red/10 hover:bg-red/20 text-red text-[0.65rem] font-heading font-bold uppercase border border-red/30 transition-all"
                          title="Reject match and restore season fixture"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleDeny(m.id, 'delete')}
                          disabled={processingMatchId === m.id}
                          className="p-1 rounded text-text-muted hover:text-red transition-colors"
                          title="Permanently delete match"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
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

      {/* ================= TAB: SEASON MANAGEMENT ================= */}
      {activeTab === 'seasons' && (
        <div className="space-y-6">
          {/* Active Season Overview Card */}
          {activeSeason ? (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-bg-card to-bg-card border border-emerald-500/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-heading font-black text-lg">
                    S{activeSeason.seasonNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading font-black text-xl text-text-primary uppercase">
                        {activeSeason.name}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-emerald-500 text-bg-primary">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-xs text-text-muted font-mono mt-0.5">
                      Started: {new Date(activeSeason.startedAt).toLocaleDateString()} • {activeSeason.playerIds?.length || 0} Contenders
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/seasons"
                    className="btn-secondary text-xs uppercase font-heading font-bold py-2 px-3"
                  >
                    View Public Standings →
                  </Link>
                  <button
                    onClick={() => setShowEndModal(true)}
                    className="px-4 py-2 rounded-xl bg-red/15 hover:bg-red/25 border border-red/40 text-red font-heading font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                    End Season Manually
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-text-muted">Season Fixture Completion</span>
                  <span className="text-volt font-bold">
                    {activeSeason.completedFixtures || 0} of {activeSeason.totalFixtures || 0} matches ({activeSeason.totalFixtures ? Math.round(((activeSeason.completedFixtures || 0) / activeSeason.totalFixtures) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-volt h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        activeSeason.totalFixtures
                          ? Math.min(100, Math.round(((activeSeason.completedFixtures || 0) / activeSeason.totalFixtures) * 100))
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[0.7rem] text-text-muted font-mono">
                  <span>
                    Remaining fixtures:{' '}
                    <span className="text-amber-400 font-bold">
                      {activeFixtureStats
                        ? activeFixtureStats.pending
                        : ((activeSeason.totalFixtures || 0) - (activeSeason.completedFixtures || 0))}
                    </span>
                  </span>
                  <span>15 matches between every pair</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* No active season banner */}
              <div className="p-6 rounded-2xl bg-bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-border/40 text-text-muted flex items-center justify-center font-heading font-black text-lg">
                    OFF
                  </div>
                  <div>
                    <h2 className="font-heading font-black text-lg text-text-primary uppercase">
                      No Active Season
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Select participating players below to launch the next competitive season with equal 15-match pairing quotas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Season 1 Migration Prompt if Season 1 doesn't exist */}
              {!season1Exists && (
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      S1
                    </span>
                    <div>
                      <h3 className="font-heading font-bold text-sm text-text-primary uppercase tracking-wide">
                        Inaugural Season 1 Migration Needed
                      </h3>
                      <p className="text-xs text-text-muted">
                        Preserve all historical non-tournament matches as completed "Season 1" (unstructured season) before starting Season 2.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleMigrateSeason1}
                    disabled={migratingSeason1}
                    className="btn-amber text-xs uppercase font-heading font-bold py-2 px-4 flex items-center gap-2"
                  >
                    {migratingSeason1 ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Migrating Season 1...
                      </>
                    ) : (
                      'Migrate & Archive Season 1'
                    )}
                  </button>
                </div>
              )}

              {/* Start New Season Form */}
              <div className="p-6 rounded-2xl bg-bg-card border border-border space-y-6">
                <div>
                  <h3 className="font-heading font-black text-lg uppercase tracking-wide text-text-primary">
                    Launch New Structured Season
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">
                    Select players who will compete. The system generates an equal quota of 15 regular-season matches for every unique player matchup.
                  </p>
                </div>

                {/* Player Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-heading uppercase tracking-wider text-text-muted">
                      Select Contenders ({selectedPlayerIds.length} of {users.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPlayerIds(users.map((u) => u.id))}
                        className="text-xs text-volt hover:underline font-mono"
                      >
                        Select All
                      </button>
                      <span className="text-border">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedPlayerIds([])}
                        className="text-xs text-text-muted hover:underline font-mono"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {users.map((user) => {
                      const isSelected = selectedPlayerIds.includes(user.id);
                      return (
                        <label
                          key={user.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-volt/10 border-volt/40 text-text-primary'
                              : 'bg-bg-dark/50 border-border text-text-muted hover:border-border/80'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePlayerSelection(user.id)}
                            className="w-4 h-4 rounded text-volt bg-bg-dark border-border focus:ring-volt"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-heading font-bold truncate">
                              {user.displayName || user.name}
                            </div>
                            <div className="text-[0.65rem] text-text-muted truncate">
                              {user.teamName || 'Custom Team'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Fixture calculation preview */}
                <div className="p-4 rounded-xl bg-bg-dark/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                  <div>
                    <span className="text-text-muted">Fixture Formula: </span>
                    <span className="text-text-primary font-bold">
                      15 matches × {selectedPlayerIds.length >= 2 ? (selectedPlayerIds.length * (selectedPlayerIds.length - 1)) / 2 : 0} pairs
                    </span>
                  </div>
                  <div className="text-volt font-bold text-sm">
                    Total Fixtures: {selectedPlayerIds.length >= 2 ? (15 * selectedPlayerIds.length * (selectedPlayerIds.length - 1)) / 2 : 0}
                  </div>
                </div>

                <button
                  onClick={handleStartSeason}
                  disabled={startingSeason || selectedPlayerIds.length < 2}
                  className="btn-volt w-full flex items-center justify-center gap-2 py-3"
                >
                  {startingSeason ? (
                    <>
                      <span className="w-4 h-4 border-2 border-bg-primary/30 border-t-bg-primary rounded-full animate-spin" />
                      Generating Fixtures & Launching Season...
                    </>
                  ) : (
                    `Launch Season (${selectedPlayerIds.length >= 2 ? (15 * selectedPlayerIds.length * (selectedPlayerIds.length - 1)) / 2 : 0} Fixtures)`
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Active Fixture Breakdown */}
          {activeSeason && activeFixtureStats && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-black text-base text-text-primary uppercase tracking-wide">
                    15-Match Pairing Quota Progress
                  </h3>
                  <p className="text-xs text-text-muted">
                    Every unique matchup has 15 casual match slots. Extra tournament matches can also be played and are tracked separately.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeFixtureStats.byPair.map((pair) => {
                  const pct = Math.round((pair.completed / pair.total) * 100);
                  const isDone = pair.pending === 0;
                  return (
                    <div
                      key={pair.pairKey}
                      className={`card p-4 transition-all ${
                        isDone ? 'border-emerald-500/40 bg-emerald-500/5' : 'hover:border-volt/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-heading font-bold text-xs text-text-primary truncate max-w-[170px]">
                          {pair.player1Name} vs {pair.player2Name}
                        </span>
                        <span
                          className={`text-[0.65rem] font-mono px-2 py-0.5 rounded font-bold ${
                            isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-volt/10 text-volt'
                          }`}
                        >
                          {pair.completed} / {pair.total}
                        </span>
                      </div>
                      <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full ${isDone ? 'bg-emerald-400' : 'bg-volt'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[0.65rem] text-text-muted mt-2 font-mono">
                        <span>{pair.pending} remaining</span>
                        <span>{pct}% complete</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Per-Player Match Balance Table */}
              <div className="card p-5 space-y-3">
                <h4 className="font-heading font-bold text-sm text-text-primary uppercase">
                  Player Match Balance Verification
                </h4>
                <div className="overflow-x-auto">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th className="text-center">Total Assigned</th>
                        <th className="text-center">Completed</th>
                        <th className="text-center">Remaining</th>
                        <th className="text-center font-bold text-volt">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeFixtureStats.byPlayer.map((p) => {
                        const pct = p.totalFixtures > 0 ? Math.round((p.completedFixtures / p.totalFixtures) * 100) : 0;
                        return (
                          <tr key={p.userId}>
                            <td className="font-heading font-bold text-xs text-text-primary">
                              {p.displayName}
                            </td>
                            <td className="text-center font-mono text-xs">{p.totalFixtures}</td>
                            <td className="text-center font-mono text-xs text-emerald-400 font-bold">{p.completedFixtures}</td>
                            <td className="text-center font-mono text-xs text-amber-400">{p.remainingFixtures}</td>
                            <td className="text-center font-mono text-xs font-bold text-volt">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Completed Seasons Archive */}
          {completedSeasons.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-heading font-black text-base text-text-primary uppercase tracking-wide">
                Completed Seasons History
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedSeasons.map((s) => (
                  <div key={s.id} className="card p-5 border-l-4 border-l-volt space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-base text-text-primary uppercase">
                          {s.name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[0.6rem] font-bold bg-border text-text-muted">
                          COMPLETED
                        </span>
                      </div>
                      <Link
                        href="/seasons"
                        className="text-xs text-volt hover:underline font-mono"
                      >
                        Inspect Standings →
                      </Link>
                    </div>

                    <div className="text-xs text-text-muted font-mono space-y-1">
                      <div>Started: {new Date(s.startedAt).toLocaleDateString()}</div>
                      {s.endedAt && <div>Ended: {new Date(s.endedAt).toLocaleDateString()}</div>}
                      {s.winnerName && (
                        <div className="text-volt font-bold">
                          👑 Champion: {s.winnerName}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal: End Season */}
      {showEndModal && activeSeason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="card p-6 md:p-8 max-w-lg w-full border border-red/40 bg-bg-card space-y-6 shadow-2xl shadow-red/10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red/15 text-red border border-red/30 flex items-center justify-center shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="font-heading font-black text-xl text-text-primary uppercase tracking-wide">
                  End {activeSeason.name}?
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  You are about to manually conclude this season.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-bg-dark border border-border space-y-2 text-xs font-mono">
              <div className="flex justify-between text-text-muted">
                <span>Completed Fixtures:</span>
                <span className="text-text-primary font-bold">
                  {activeSeason.completedFixtures || 0} / {activeSeason.totalFixtures || 0}
                </span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Remaining Fixtures:</span>
                <span className="text-amber-400 font-bold">
                  {activeFixtureStats
                    ? activeFixtureStats.pending
                    : ((activeSeason.totalFixtures || 0) - (activeSeason.completedFixtures || 0))}
                </span>
              </div>
              <div className="pt-2 border-t border-border/60 text-text-muted leading-relaxed">
                Ending the season now will freeze the current standings, save a permanent snapshot to Season History, and crown the current leader as Champion. Unplayed fixtures will be cancelled.
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                disabled={endingSeason}
                className="btn-secondary text-xs uppercase font-heading font-bold py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndSeason}
                disabled={endingSeason}
                className="px-4 py-2 rounded-xl bg-red hover:bg-red/90 text-white font-heading font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red/20"
              >
                {endingSeason ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Finalizing & Ending...
                  </>
                ) : (
                  'Confirm & End Season'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
