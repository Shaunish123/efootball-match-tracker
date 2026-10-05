'use client';

import { useEffect, useState, use } from 'react';
import { subscribeToTournament, submitTournamentMatchResult } from '@/lib/db';
import { Tournament, TournamentMatch } from '@/lib/types';
import Link from 'next/link';

interface MatchModalData {
  round: string;
  matchIndex: number;
  match: TournamentMatch;
}

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tournamentId } = use(params);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  // Match result modal
  const [modalData, setModalData] = useState<MatchModalData | null>(null);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isPenalty, setIsPenalty] = useState(false);
  const [penScore1, setPenScore1] = useState('');
  const [penScore2, setPenScore2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    const unsub = subscribeToTournament(tournamentId, (t) => {
      setTournament(t);
      setLoading(false);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [tournamentId]);

  const openMatchModal = (round: string, matchIndex: number, match: TournamentMatch) => {
    if (match.completed || !match.player1Id || !match.player2Id) return;
    setModalData({ round, matchIndex, match });
    setScore1('');
    setScore2('');
    setIsPenalty(false);
    setPenScore1('');
    setPenScore2('');
    setModalError('');
  };

  const handleSubmitResult = async () => {
    if (!modalData) return;
    setModalError('');

    const s1 = parseInt(score1);
    const s2 = parseInt(score2);

    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setModalError('Enter valid scores');
      return;
    }
    if (s1 === s2 && !isPenalty) {
      setModalError('Tied scores require penalty shootout');
      return;
    }
    if (isPenalty) {
      const ps1 = parseInt(penScore1);
      const ps2 = parseInt(penScore2);
      if (isNaN(ps1) || isNaN(ps2) || ps1 < 0 || ps2 < 0) {
        setModalError('Enter valid penalty scores');
        return;
      }
      if (ps1 === ps2) {
        setModalError('Penalty scores cannot be tied');
        return;
      }
    }

    setSubmitting(true);
    try {
      await submitTournamentMatchResult(
        tournamentId,
        modalData.round,
        modalData.matchIndex,
        {
          player1Score: s1,
          player2Score: s2,
          isPenalty,
          penaltyScore1: isPenalty ? parseInt(penScore1) : undefined,
          penaltyScore2: isPenalty ? parseInt(penScore2) : undefined,
        }
      );
      setModalData(null);
    } catch (err) {
      setModalError('Failed to submit result');
    } finally {
      setSubmitting(false);
    }
  };

  const scoresAreTied = score1 !== '' && score2 !== '' && parseInt(score1) === parseInt(score2);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center animate-fade-in">
          <div className="w-12 h-12 border-4 border-volt/30 border-t-volt rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary font-heading uppercase tracking-widest text-sm">Loading Tournament...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center animate-fade-in">
          <p className="text-text-muted text-lg font-heading">Tournament not found</p>
          <Link href="/tournaments" className="btn-outline inline-block mt-4">Back to Tournaments</Link>
        </div>
      </div>
    );
  }

  const { bracket } = tournament;

  const renderMatchCard = (
    match: TournamentMatch,
    round: string,
    matchIndex: number,
    roundLabel: string
  ) => {
    const isReady = match.player1Id && match.player2Id;
    const canClick = isReady && !match.completed;

    return (
      <div
        key={`${round}-${matchIndex}`}
        onClick={() => canClick && openMatchModal(round, matchIndex, match)}
        className={`
          card-glow p-4 min-w-[220px] transition-all
          ${canClick ? 'cursor-pointer hover:border-cyan/50 hover:shadow-[0_0_20px_rgba(0,229,255,0.15)]' : ''}
          ${match.completed ? 'border-volt/20' : ''}
          ${!isReady ? 'opacity-50' : ''}
        `}
      >
        <p className="text-[0.6rem] text-text-muted font-heading uppercase tracking-widest mb-2">{roundLabel}</p>

        {/* Player 1 */}
        <div className={`flex items-center justify-between py-1.5 ${match.completed && match.winnerId === match.player1Id ? 'text-volt' : 'text-text-primary'}`}>
          <span className="font-heading font-semibold text-sm truncate max-w-[140px]">
            {match.player1Name || 'TBD'}
          </span>
          {match.completed && (
            <span className="font-heading font-black text-lg ml-2">{match.player1Score}</span>
          )}
          {match.completed && match.winnerId === match.player1Id && (
            <span className="text-volt text-xs ml-1">◀</span>
          )}
        </div>

        <div className="h-px bg-border my-1" />

        {/* Player 2 */}
        <div className={`flex items-center justify-between py-1.5 ${match.completed && match.winnerId === match.player2Id ? 'text-volt' : 'text-text-primary'}`}>
          <span className="font-heading font-semibold text-sm truncate max-w-[140px]">
            {match.player2Name || 'TBD'}
          </span>
          {match.completed && (
            <span className="font-heading font-black text-lg ml-2">{match.player2Score}</span>
          )}
          {match.completed && match.winnerId === match.player2Id && (
            <span className="text-volt text-xs ml-1">◀</span>
          )}
        </div>

        {/* Penalty indicator */}
        {match.isPenalty && match.penaltyScore1 !== undefined && (
          <p className="text-[0.65rem] text-cyan font-heading mt-1 text-center">
            Penalties: {match.penaltyScore1} - {match.penaltyScore2}
          </p>
        )}

        {/* Status */}
        {!isReady && (
          <p className="text-[0.65rem] text-text-muted font-heading mt-1 text-center uppercase">Waiting...</p>
        )}
        {canClick && (
          <p className="text-[0.65rem] text-cyan font-heading mt-1 text-center uppercase animate-pulse">
            Click to play
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <Link href="/tournaments" className="text-text-muted hover:text-volt text-sm font-heading uppercase tracking-wider transition-colors inline-flex items-center gap-1 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to Tournaments
        </Link>

        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="font-heading font-black text-3xl md:text-4xl tracking-tight text-text-primary">
            {tournament.name}
          </h1>
          <span className={`badge ${tournament.status === 'in_progress' ? 'badge-tournament' : 'badge-win'}`}>
            {tournament.status === 'in_progress' ? 'LIVE' : 'COMPLETED'}
          </span>
        </div>
        <p className="text-text-secondary text-sm mt-1">
          {tournament.format}-Player Single Elimination • {tournament.roster.length} players
        </p>
      </div>

      {/* Standings (if completed) */}
      {tournament.standings && tournament.status === 'completed' && (
        <div className="card-glow p-6">
          <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar mb-4">
            Final Standings
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { place: '1st', key: 'first' as const, emoji: '🥇', color: 'text-gold' },
              { place: '2nd', key: 'second' as const, emoji: '🥈', color: 'text-silver' },
              { place: '3rd', key: 'third' as const, emoji: '🥉', color: 'text-bronze' },
              { place: '4th', key: 'fourth' as const, emoji: '4th', color: 'text-text-muted' },
            ].map((s) => (
              <div key={s.key} className="text-center p-4 rounded-lg bg-bg-secondary">
                <p className="text-2xl mb-1">{s.emoji}</p>
                <p className={`font-heading font-bold text-lg ${s.color}`}>
                  {tournament.standings![s.key]
                    ? tournament.rosterNames[tournament.standings![s.key]!]
                    : 'TBD'}
                </p>
                <p className="text-[0.65rem] text-text-muted font-heading uppercase">{s.place} Place</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bracket Visualization */}
      <div className="card-glow p-6 overflow-x-auto">
        <h2 className="font-heading font-bold text-lg uppercase tracking-wide accent-bar mb-6">
          Tournament Bracket
        </h2>

        <div className="flex items-start gap-8 min-w-max pb-4">
          {/* Quarter Finals (8-player only) */}
          {bracket.quarterFinals && (
            <div className="flex flex-col gap-4">
              <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-cyan text-center mb-2">
                Quarter-Finals
              </h3>
              {bracket.quarterFinals.map((match, i) =>
                renderMatchCard(match, 'quarterFinals', i, `QF ${i + 1}`)
              )}
            </div>
          )}

          {/* Connector lines visual cue */}
          {bracket.quarterFinals && (
            <div className="flex flex-col justify-center self-center">
              <div className="w-8 border-t-2 border-border-accent" />
            </div>
          )}

          {/* Semi Finals */}
          <div className="flex flex-col gap-4 justify-center">
            <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-cyan text-center mb-2">
              Semi-Finals
            </h3>
            {bracket.semiFinals.map((match, i) =>
              renderMatchCard(match, 'semiFinals', i, `SF ${i + 1}`)
            )}
          </div>

          {/* Connector */}
          <div className="flex flex-col justify-center self-center">
            <div className="w-8 border-t-2 border-border-accent" />
          </div>

          {/* Finals + 3rd Place */}
          <div className="flex flex-col gap-4 justify-center">
            <div>
              <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-gold text-center mb-2">
                🏆 Final
              </h3>
              {renderMatchCard(bracket.final, 'final', 0, 'FINAL')}
            </div>
            <div>
              <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-bronze text-center mb-2">
                3rd Place
              </h3>
              {renderMatchCard(bracket.thirdPlace, 'thirdPlace', 0, '3RD PLACE')}
            </div>
          </div>
        </div>
      </div>

      {/* Roster */}
      <div className="card-glow p-5">
        <h2 className="font-heading font-bold text-sm uppercase tracking-widest text-text-muted mb-3">
          Tournament Roster (Locked)
        </h2>
        <div className="flex flex-wrap gap-2">
          {tournament.roster.map((userId) => (
            <Link
              key={userId}
              href={`/users/${userId}`}
              className="px-3 py-1.5 rounded-lg bg-bg-secondary border border-border text-sm font-heading font-semibold text-text-secondary hover:text-volt hover:border-volt/30 transition-colors"
            >
              {tournament.rosterNames[userId]}
            </Link>
          ))}
        </div>
      </div>

      {/* Match Result Modal */}
      {modalData && (
        <div className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4">
          <div className="card-glow p-6 max-w-md w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading font-bold text-lg text-center uppercase tracking-wide mb-1">
              Submit Result
            </h3>
            <p className="text-center text-text-muted text-xs font-heading uppercase tracking-widest mb-6">
              {modalData.round.replace(/([A-Z])/g, ' $1').trim()}
            </p>

            {/* Scores */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 text-center">
                <p className="text-sm text-text-secondary mb-2 font-heading font-semibold truncate">
                  {modalData.match.player1Name}
                </p>
                <input
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
                  autoFocus
                />
              </div>
              <span className="text-text-muted font-heading font-black text-xl mt-6">VS</span>
              <div className="flex-1 text-center">
                <p className="text-sm text-text-secondary mb-2 font-heading font-semibold truncate">
                  {modalData.match.player2Name}
                </p>
                <input
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

            {/* Penalty Toggle */}
            {scoresAreTied && (
              <div className="mb-6 animate-fade-in">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan/5 border border-cyan/20 mb-3">
                  <button
                    type="button"
                    onClick={() => setIsPenalty(!isPenalty)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${isPenalty ? 'bg-cyan' : 'bg-border-accent'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isPenalty ? 'translate-x-5' : ''}`} />
                  </button>
                  <span className="text-sm font-heading font-semibold text-cyan uppercase tracking-wide">Penalties</span>
                </div>

                {isPenalty && (
                  <div className="flex items-center gap-4 animate-fade-in">
                    <div className="flex-1 text-center">
                      <input
                        type="number"
                        min="0"
                        value={penScore1}
                        onChange={(e) => setPenScore1(e.target.value)}
                        className="input-dark text-center text-lg font-heading font-bold"
                        placeholder="0"
                      />
                    </div>
                    <span className="text-cyan font-heading font-bold text-xs">PEN</span>
                    <div className="flex-1 text-center">
                      <input
                        type="number"
                        min="0"
                        value={penScore2}
                        onChange={(e) => setPenScore2(e.target.value)}
                        className="input-dark text-center text-lg font-heading font-bold"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {modalError && (
              <div className="p-3 rounded-lg bg-red/10 border border-red/30 text-red text-sm font-medium mb-4">
                {modalError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setModalData(null)}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitResult}
                disabled={submitting}
                className="btn-cyan flex-1"
              >
                {submitting ? 'Submitting...' : 'Submit Result'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
