'use client';

import { useEffect, useState } from 'react';
import { subscribeToUsers, addUser, deleteUser } from '@/lib/db';
import { User } from '@/lib/types';
import Link from 'next/link';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Add user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [efootballUsername, setEfootballUsername] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Delete user modal
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    const unsub = subscribeToUsers((u) => {
      setUsers(u);
      setLoading(false);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!displayName.trim()) {
      setAddError('Display name is required');
      return;
    }
    if (!efootballUsername.trim()) {
      setAddError('eFootball Username is required');
      return;
    }

    setAdding(true);
    try {
      await addUser(displayName.trim(), efootballUsername.trim());
      setDisplayName('');
      setEfootballUsername('');
      setShowAddForm(false);
    } catch (err: any) {
      console.error('Error adding user to Firebase:', err);
      setAddError(err?.message ? `Failed: ${err.message}` : 'Failed to add user. Check console & database rules.');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleteError('');

    if (deleteConfirm !== deleteTarget.efootballUsername) {
      setDeleteError('eFootball Username does not match. Deletion blocked.');
      return;
    }

    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirm('');
    } catch (err) {
      setDeleteError('Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const sorted = [...users].sort((a, b) => {
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
            PLAY<span className="text-volt">ERS</span>
          </h1>
          <p className="text-text-secondary mt-1 text-sm">
            Manage your player roster ({users.length} active)
          </p>
        </div>
        <button
          id="add-player-btn"
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-volt"
        >
          {showAddForm ? '✕ Cancel' : '+ Add Player'}
        </button>
      </div>

      {/* Add Player Form */}
      {showAddForm && (
        <div className="card-glow p-6 animate-fade-in max-w-lg">
          <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-cyan mb-4">
            New Player Registration
          </h3>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-2">
                Display Name
              </label>
              <input
                id="input-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-dark"
                placeholder="e.g. Shadow"
                maxLength={30}
              />
            </div>
            <div>
              <label className="block text-xs font-heading font-bold uppercase tracking-widest text-text-muted mb-2">
                eFootball Username / ID
              </label>
              <input
                id="input-efootball-username"
                type="text"
                value={efootballUsername}
                onChange={(e) => setEfootballUsername(e.target.value)}
                className="input-dark"
                placeholder="Hidden — used for security confirmation only"
              />
              <p className="text-[0.65rem] text-text-muted mt-1">
                ⚠ This is kept secret. It&apos;s only used to confirm account deletion.
              </p>
            </div>
            {addError && (
              <div className="p-3 rounded-lg bg-red/10 border border-red/30 text-red text-sm font-medium">
                {addError}
              </div>
            )}
            <button type="submit" disabled={adding} className="btn-cyan">
              {adding ? 'Adding...' : 'Register Player'}
            </button>
          </form>
        </div>
      )}

      {/* Players Grid */}
      {sorted.length === 0 ? (
        <div className="card-glow p-12 text-center">
          <p className="text-text-muted text-lg mb-2">No players registered yet</p>
          <p className="text-text-muted text-sm">Add your first player to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {sorted.map((user, idx) => {
            const winRate = user.matchesPlayed > 0
              ? ((user.wins / user.matchesPlayed) * 100).toFixed(1)
              : '0.0';
            const rankColors = ['text-gold', 'text-silver', 'text-bronze'];

            return (
              <div key={user.id} className="card-glow p-5 group relative overflow-hidden">
                {/* Rank badge */}
                <div className="absolute top-3 right-3">
                  <span className={`font-heading font-black text-2xl ${rankColors[idx] || 'text-text-muted'} opacity-20 group-hover:opacity-40 transition-opacity`}>
                    #{idx + 1}
                  </span>
                </div>

                {/* Player info */}
                <div className="mb-4">
                  <Link
                    href={`/users/${user.id}`}
                    className="font-heading font-bold text-xl text-text-primary hover:text-volt transition-colors"
                  >
                    {user.displayName}
                  </Link>
                  <p className="text-[0.65rem] text-text-muted mt-0.5">
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Main W/L Stats */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <div className="text-center p-2 rounded bg-bg-secondary">
                    <p className="text-lg font-heading font-black text-text-primary">{user.matchesPlayed}</p>
                    <p className="text-[0.6rem] text-text-muted font-heading uppercase">Played</p>
                  </div>
                  <div className="text-center p-2 rounded bg-bg-secondary">
                    <p className="text-lg font-heading font-black text-volt">{user.wins}</p>
                    <p className="text-[0.6rem] text-text-muted font-heading uppercase">Wins</p>
                  </div>
                  <div className="text-center p-2 rounded bg-bg-secondary">
                    <p className="text-lg font-heading font-black text-red">{user.losses}</p>
                    <p className="text-[0.6rem] text-text-muted font-heading uppercase">Losses</p>
                  </div>
                  <div className="text-center p-2 rounded bg-bg-secondary">
                    <p className="text-lg font-heading font-black text-cyan">{winRate}%</p>
                    <p className="text-[0.6rem] text-text-muted font-heading uppercase">Rate</p>
                  </div>
                </div>

                {/* Goal Stats Row */}
                {(() => {
                  const gf = user.goalsFor || 0;
                  const ga = user.goalsAgainst || 0;
                  const gd = user.goalDifference ?? (gf - ga);
                  return (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="text-center p-1.5 rounded bg-bg-secondary/60">
                        <p className="text-sm font-heading font-bold text-text-primary font-mono">{gf}</p>
                        <p className="text-[0.55rem] text-text-muted font-heading uppercase">Goals For (GF)</p>
                      </div>
                      <div className="text-center p-1.5 rounded bg-bg-secondary/60">
                        <p className="text-sm font-heading font-bold text-text-primary font-mono">{ga}</p>
                        <p className="text-[0.55rem] text-text-muted font-heading uppercase">Against (GA)</p>
                      </div>
                      <div className="text-center p-1.5 rounded bg-bg-secondary/60">
                        <p className={`text-sm font-heading font-bold font-mono ${gd > 0 ? 'text-volt' : gd < 0 ? 'text-red' : 'text-text-muted'}`}>
                          {gd > 0 ? `+${gd}` : gd}
                        </p>
                        <p className="text-[0.55rem] text-text-muted font-heading uppercase">Diff (GD)</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/users/${user.id}`}
                    className="btn-outline flex-1 text-center text-xs py-2"
                  >
                    View Profile
                  </Link>
                  <button
                    onClick={() => {
                      setDeleteTarget(user);
                      setDeleteConfirm('');
                      setDeleteError('');
                    }}
                    className="p-2 rounded-lg border border-border text-text-muted hover:text-red hover:border-red/50 transition-colors"
                    title="Delete player"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4 animate-fade-in">
          <div className="card-glow p-6 max-w-md w-full animate-scale-in border-red/30" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red/10 border-2 border-red/30 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="font-heading font-bold text-xl text-text-primary uppercase">
                Delete Player
              </h3>
              <p className="text-text-secondary text-sm mt-2">
                You are about to permanently delete <strong className="text-red">{deleteTarget.displayName}</strong>.
              </p>
              <p className="text-text-secondary text-sm mt-2">
                To confirm, type the player&apos;s <span className="text-cyan font-semibold">eFootball Username</span> below:
              </p>
            </div>

            <input
              id="delete-confirm-input"
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="input-dark text-center mb-4"
              placeholder="Type eFootball Username to confirm..."
              autoFocus
            />

            {deleteError && (
              <div className="p-3 rounded-lg bg-red/10 border border-red/30 text-red text-sm font-medium mb-4 text-center">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirm('');
                  setDeleteError('');
                }}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-btn"
                onClick={handleDeleteUser}
                disabled={deleting || !deleteConfirm}
                className="btn-danger flex-1"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
