'use client';

import { useState } from 'react';
import Link from 'next/link';

interface HpsExplainerProps {
  activeHandicapName?: string | null;
  activeHandicapBonus?: number;
  minMatches?: number;
  defaultExpanded?: boolean;
  showFullPageNotice?: boolean;
}

export default function HpsExplainer({
  activeHandicapName = 'Ashu',
  activeHandicapBonus = 0.75,
  minMatches = 35,
  defaultExpanded = true,
  showFullPageNotice = false,
}: HpsExplainerProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [activeExampleTab, setActiveExampleTab] = useState<'strong' | 'weak' | 'season_end'>('strong');

  // Interactive Simulator State
  const [simScore1, setSimScore1] = useState<number>(2);
  const [simScore2, setSimScore2] = useState<number>(1);
  const [simP1HasHandicap, setSimP1HasHandicap] = useState<boolean>(false);
  const [simP2HasHandicap, setSimP2HasHandicap] = useState<boolean>(true);

  // Compute simulator result
  const s1 = Number(simScore1) || 0;
  const s2 = Number(simScore2) || 0;
  const isDraw = s1 === s2;
  const p1Wins = s1 > s2;
  const p2Wins = s2 > s1;

  const bonus = Number(activeHandicapBonus) || 0.75;
  const weakName = activeHandicapName || 'Ashu';

  // Player 1 HPS
  const p1R = p1Wins ? 3 : isDraw ? 1 : 0;
  const p1Margin = p1Wins ? Math.max(0, s1 - s2) : 0;
  const p1G = p1Wins ? Math.min(1.0, p1Margin * 0.25) : 0;
  const p1C = p1Wins && s2 === 0 ? 0.25 : 0;
  const p1H = simP1HasHandicap ? bonus : 0;
  const p1Hps = Number((p1R + p1G + p1C + p1H).toFixed(2));

  // Player 2 HPS
  const p2R = p2Wins ? 3 : isDraw ? 1 : 0;
  const p2Margin = p2Wins ? Math.max(0, s2 - s1) : 0;
  const p2G = p2Wins ? Math.min(1.0, p2Margin * 0.25) : 0;
  const p2C = p2Wins && s1 === 0 ? 0.25 : 0;
  const p2H = simP2HasHandicap ? bonus : 0;
  const p2Hps = Number((p2R + p2G + p2C + p2H).toFixed(2));

  return (
    <div className="card-glow rounded-2xl overflow-hidden border border-volt/30 bg-bg-card shadow-2xl transition-all">
      {/* Header Bar */}
      <div className="p-5 md:p-6 bg-gradient-to-r from-volt/15 via-bg-card to-cyan/10 border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[0.65rem] font-heading font-black uppercase tracking-wider bg-volt text-black">
              Official League Rules
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[0.65rem] font-heading font-bold uppercase tracking-wider bg-volt/15 text-volt border border-volt/30">
              ⚡ HPS Ranking System
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[0.65rem] font-heading font-bold uppercase tracking-wider bg-cyan/15 text-cyan border border-cyan/30">
              Fluid Seasons
            </span>
          </div>
          <h2 className="font-heading font-black text-xl md:text-2xl text-text-primary tracking-wide">
            eFootball League — HPS Ranking System Explained Simply
          </h2>
          <p className="text-text-secondary text-xs mt-1 max-w-2xl leading-relaxed">
            The goal of this system is to reward winning, winning convincingly, and keeping clean sheets, while giving {weakName} a small handicap so that he has a fairer chance on the leaderboard. It also prevents someone from winning the season with too few matches.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          {!showFullPageNotice && (
            <Link
              href="/alerts"
              className="text-xs font-heading font-bold uppercase text-cyan hover:text-cyan-dim underline mr-2"
            >
              Alerts & Notices →
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3.5 py-1.5 rounded-xl bg-bg-card-hover border border-border text-xs font-heading font-bold text-text-primary hover:text-volt hover:border-volt/40 transition-colors flex items-center gap-1.5"
          >
            {isExpanded ? 'Collapse Guide ▲' : 'Expand Guide ▼'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-5 md:p-8 space-y-8 animate-fade-in">
          {/* 1. The Core Formula Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-bg-dark via-bg-card to-bg-dark border border-volt/40 relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <span className="text-[0.7rem] font-heading uppercase tracking-widest text-volt font-bold">
                  1. The Match Performance Formula
                </span>
                <h3 className="font-heading font-black text-2xl md:text-3xl text-text-primary">
                  HPS = R + G + C + H
                </h3>
                <p className="text-xs text-text-muted">
                  For every approved match, calculate each player&apos;s Handicap Performance Score separately.
                </p>
              </div>

              <div className="flex items-center gap-2 text-center flex-wrap justify-center">
                <div className="p-3 rounded-xl bg-bg-card border border-border min-w-[70px]">
                  <div className="font-heading font-black text-volt text-lg">R</div>
                  <div className="text-[0.65rem] text-text-muted uppercase">Result</div>
                </div>
                <span className="text-text-muted font-bold text-lg">+</span>
                <div className="p-3 rounded-xl bg-bg-card border border-border min-w-[70px]">
                  <div className="font-heading font-black text-cyan text-lg">G</div>
                  <div className="text-[0.65rem] text-text-muted uppercase">Margin</div>
                </div>
                <span className="text-text-muted font-bold text-lg">+</span>
                <div className="p-3 rounded-xl bg-bg-card border border-border min-w-[70px]">
                  <div className="font-heading font-black text-emerald-400 text-lg">C</div>
                  <div className="text-[0.65rem] text-text-muted uppercase">Clean Sheet</div>
                </div>
                <span className="text-text-muted font-bold text-lg">+</span>
                <div className="p-3 rounded-xl bg-bg-card border border-border min-w-[70px]">
                  <div className="font-heading font-black text-amber-400 text-lg">H</div>
                  <div className="text-[0.65rem] text-text-muted uppercase">{weakName} Boost</div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Component Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* R */}
            <div className="p-5 rounded-2xl bg-bg-card border border-volt/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-volt/20 text-volt font-heading font-black flex items-center justify-center text-sm">
                  R
                </span>
                <span className="text-[0.65rem] font-mono text-text-muted">Result Points</span>
              </div>
              <h4 className="font-heading font-bold text-base text-text-primary">Match Result</h4>
              <ul className="text-xs font-mono space-y-1 text-text-secondary pt-1">
                <li className="flex justify-between">
                  <span>Win</span>
                  <strong className="text-volt font-bold">+3</strong>
                </li>
                <li className="flex justify-between">
                  <span>Draw</span>
                  <strong className="text-cyan font-bold">+1</strong>
                </li>
                <li className="flex justify-between">
                  <span>Loss</span>
                  <strong className="text-text-muted font-bold">+0</strong>
                </li>
              </ul>
            </div>

            {/* G */}
            <div className="p-5 rounded-2xl bg-bg-card border border-cyan/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-cyan/20 text-cyan font-heading font-black flex items-center justify-center text-sm">
                  G
                </span>
                <span className="text-[0.65rem] font-mono text-text-muted">Goal Margin</span>
              </div>
              <h4 className="font-heading font-bold text-base text-text-primary">Winner&apos;s Margin</h4>
              <ul className="text-xs font-mono space-y-1 text-text-secondary pt-1">
                <li className="flex justify-between">
                  <span>1 goal win</span>
                  <strong className="text-cyan">+0.25</strong>
                </li>
                <li className="flex justify-between">
                  <span>2 goals win</span>
                  <strong className="text-cyan">+0.50</strong>
                </li>
                <li className="flex justify-between">
                  <span>3 goals win</span>
                  <strong className="text-cyan">+0.75</strong>
                </li>
                <li className="flex justify-between">
                  <span>4+ goals (Max)</span>
                  <strong className="text-cyan font-bold">+1.00</strong>
                </li>
              </ul>
            </div>

            {/* C */}
            <div className="p-5 rounded-2xl bg-bg-card border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 font-heading font-black flex items-center justify-center text-sm">
                  C
                </span>
                <span className="text-[0.65rem] font-mono text-text-muted">Defense Bonus</span>
              </div>
              <h4 className="font-heading font-bold text-base text-text-primary">Clean Sheet</h4>
              <p className="text-xs text-text-secondary leading-relaxed pt-1">
                Awarded <strong className="text-emerald-400 font-bold">+0.25</strong> only for a <span className="underline">win</span> where the opponent scores zero.
              </p>
              <div className="text-[0.65rem] text-text-muted font-mono pt-1">
                *Draws (even 0–0) do NOT receive clean-sheet bonus.
              </div>
            </div>

            {/* H */}
            <div className="p-5 rounded-2xl bg-bg-card border border-amber-400/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 font-heading font-black flex items-center justify-center text-sm">
                  H
                </span>
                <span className="text-[0.65rem] font-mono text-text-muted">Handicap Power</span>
              </div>
              <h4 className="font-heading font-bold text-base text-text-primary">{weakName} Handicap</h4>
              <p className="text-xs text-text-secondary leading-relaxed pt-1">
                Added to {weakName} for every approved match, regardless of result: <strong className="text-amber-400 font-bold">+{bonus} HPS</strong>.
              </p>
              <div className="text-[0.65rem] text-text-muted font-mono pt-1">
                *{weakName} gets his boost even when he loses. His match result itself does not change.
              </div>
            </div>
          </div>

          {/* 3. Final Ranking & Season End 35-Match Rule */}
          <div className="p-6 rounded-2xl bg-bg-dark border border-border space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-volt" />
              <h3 className="font-heading font-black text-lg text-text-primary uppercase tracking-wide">
                2. How the Leaderboard & Final Ranking is Calculated
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="p-4 rounded-xl bg-bg-card border border-border text-center space-y-2">
                <span className="text-xs font-mono uppercase text-text-muted">Official Standing Metric</span>
                <div className="text-xl md:text-2xl font-heading font-black text-volt">
                  Average HPS = Total HPS ÷ Approved Matches
                </div>
                <p className="text-xs text-text-secondary">
                  The leaderboard uses <strong>Average HPS per match</strong>, not total HPS. This ensures players who have played different match counts compete on an even, fair ratio.
                </p>
              </div>

              <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
                <div className="p-3 rounded-xl bg-bg-secondary border border-border">
                  <strong className="text-text-primary block font-heading uppercase tracking-wide mb-0.5">
                    During the Season (Live):
                  </strong>
                  Everyone is ranked normally by their Average HPS. Fluid season allows unlimited matches.
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                  <strong className="text-amber-400 block font-heading uppercase tracking-wide mb-0.5">
                    When Season End is Clicked:
                  </strong>
                  Players with at least <strong>{minMatches} approved matches</strong> are eligible and ranked by Average HPS. Anyone with fewer than {minMatches} matches is moved to 4th (or bottom) and marked <span className="font-bold underline">&ldquo;Minimum Requirements Not Met&rdquo;</span>.
                </div>
              </div>
            </div>
          </div>

          {/* 4. Worked Examples (Tabs) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-heading font-black text-lg text-text-primary uppercase tracking-wide">
                  3. Real Match Examples & Scenarios
                </h3>
                <p className="text-xs text-text-muted">
                  Explore how match scores convert directly into HPS points for both players.
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-bg-card border border-border">
                <button
                  type="button"
                  onClick={() => setActiveExampleTab('strong')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase transition-all ${
                    activeExampleTab === 'strong'
                      ? 'bg-volt text-black font-black'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Strong vs Strong (Vansh vs Jishnuu)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveExampleTab('weak')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase transition-all ${
                    activeExampleTab === 'weak'
                      ? 'bg-amber-400 text-black font-black'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Strong vs Weak (Shaunish vs {weakName})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveExampleTab('season_end')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase transition-all ${
                    activeExampleTab === 'season_end'
                      ? 'bg-cyan text-black font-black'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  35-Match Season End Rule
                </button>
              </div>
            </div>

            {/* Example A: Strong vs Strong */}
            {activeExampleTab === 'strong' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                {/* Case 1 */}
                <div className="card p-5 space-y-3 border-l-4 border-l-volt">
                  <div className="flex justify-between items-center text-xs font-heading font-bold">
                    <span className="text-volt uppercase">Case 1: Vansh wins 2–1</span>
                    <span className="text-text-muted">1-Goal Margin</span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-bg-secondary flex justify-between items-center">
                      <span className="font-bold text-text-primary">Vansh (Win)</span>
                      <span className="text-volt font-black text-sm">3.25 HPS</span>
                    </div>
                    <div className="text-[0.7rem] text-text-muted pl-1">
                      3 (Win) + 0.25 (1-goal) + 0 (No Clean Sheet) = <strong>3.25</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-bg-secondary flex justify-between items-center">
                      <span className="text-text-secondary">Jishnuu (Loss)</span>
                      <span className="text-red font-bold text-sm">0 HPS</span>
                    </div>
                  </div>
                  <p className="text-[0.7rem] text-text-muted pt-1">
                    Vansh gets 3 for winning and 0.25 for the margin. No clean-sheet bonus because Jishnuu scored.
                  </p>
                </div>

                {/* Case 2 */}
                <div className="card p-5 space-y-3 border-l-4 border-l-emerald-500">
                  <div className="flex justify-between items-center text-xs font-heading font-bold">
                    <span className="text-emerald-400 uppercase">Case 2: Vansh wins 2–0</span>
                    <span className="text-emerald-400">+ Clean Sheet</span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-bg-secondary flex justify-between items-center">
                      <span className="font-bold text-text-primary">Vansh (Win + CS)</span>
                      <span className="text-emerald-400 font-black text-sm">3.75 HPS</span>
                    </div>
                    <div className="text-[0.7rem] text-text-muted pl-1">
                      3 (Win) + 0.50 (2-goal) + 0.25 (Clean Sheet) = <strong>3.75</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-bg-secondary flex justify-between items-center">
                      <span className="text-text-secondary">Jishnuu (Loss)</span>
                      <span className="text-red font-bold text-sm">0 HPS</span>
                    </div>
                  </div>
                  <p className="text-[0.7rem] text-text-muted pt-1">
                    Vansh earns more than in 2–1 because he wins by two goals AND kept a clean sheet.
                  </p>
                </div>

                {/* Case 3 */}
                <div className="card p-5 space-y-3 border-l-4 border-l-cyan">
                  <div className="flex justify-between items-center text-xs font-heading font-bold">
                    <span className="text-cyan uppercase">Case 3: Draw 1–1</span>
                    <span className="text-text-muted">Equal Points</span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-bg-secondary flex justify-between items-center">
                      <span className="font-bold text-text-primary">Vansh (Draw)</span>
                      <span className="text-cyan font-black text-sm">1.00 HPS</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-bg-secondary flex justify-between items-center">
                      <span className="font-bold text-text-primary">Jishnuu (Draw)</span>
                      <span className="text-cyan font-black text-sm">1.00 HPS</span>
                    </div>
                  </div>
                  <p className="text-[0.7rem] text-text-muted pt-1">
                    Both receive 1 HPS for the draw. Neither receives goal margin or clean-sheet bonuses.
                  </p>
                </div>
              </div>
            )}

            {/* Example B: Strong vs Weak */}
            {activeExampleTab === 'weak' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                {/* Case 1 */}
                <div className="card p-5 space-y-3 border-l-4 border-l-volt">
                  <div className="text-xs font-heading font-bold text-volt uppercase">
                    Shaunish wins 2–1
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2 rounded bg-bg-secondary flex justify-between">
                      <span>Shaunish:</span>
                      <strong className="text-volt">3.25 HPS</strong>
                    </div>
                    <div className="p-2 rounded bg-bg-secondary flex justify-between">
                      <span>{weakName}:</span>
                      <strong className="text-amber-400">0.75 HPS</strong>
                    </div>
                  </div>
                  <p className="text-[0.7rem] text-text-muted">
                    Shaunish gets 3 + 0.25 margin. {weakName} still earns 0.75 HPS from his handicap despite losing.
                  </p>
                </div>

                {/* Case 2 */}
                <div className="card p-5 space-y-3 border-l-4 border-l-emerald-500">
                  <div className="text-xs font-heading font-bold text-emerald-400 uppercase">
                    Shaunish wins 2–0
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2 rounded bg-bg-secondary flex justify-between">
                      <span>Shaunish:</span>
                      <strong className="text-emerald-400">3.75 HPS</strong>
                    </div>
                    <div className="p-2 rounded bg-bg-secondary flex justify-between">
                      <span>{weakName}:</span>
                      <strong className="text-amber-400">0.75 HPS</strong>
                    </div>
                  </div>
                  <p className="text-[0.7rem] text-text-muted">
                    Shaunish receives clean sheet (3 + 0.50 + 0.25). {weakName} gets his 0.75 handicap.
                  </p>
                </div>

                {/* Case 3 */}
                <div className="card p-5 space-y-3 border-l-4 border-l-amber-400">
                  <div className="text-xs font-heading font-bold text-amber-400 uppercase">
                    Draw 1–1
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2 rounded bg-bg-secondary flex justify-between">
                      <span>Shaunish:</span>
                      <strong className="text-cyan">1.00 HPS</strong>
                    </div>
                    <div className="p-2 rounded bg-bg-secondary flex justify-between">
                      <span>{weakName}:</span>
                      <strong className="text-amber-400 font-bold">1.75 HPS</strong>
                    </div>
                  </div>
                  <p className="text-[0.7rem] text-text-muted">
                    Handicap makes the difference: {weakName} earns 1 (Draw) + 0.75 = 1.75 HPS.
                  </p>
                </div>

                {/* Case 4 */}
                <div className="card p-5 space-y-3 border-l-4 border-l-purple-500">
                  <div className="text-xs font-heading font-bold text-purple-400 uppercase">
                    {weakName} wins 2–1!
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-2 rounded bg-bg-secondary flex justify-between">
                      <span>Shaunish:</span>
                      <strong className="text-red">0.00 HPS</strong>
                    </div>
                    <div className="p-2 rounded bg-bg-secondary flex justify-between">
                      <span>{weakName}:</span>
                      <strong className="text-volt font-black">4.00 HPS</strong>
                    </div>
                  </div>
                  <p className="text-[0.7rem] text-text-muted">
                    {weakName} gets 3 (Win) + 0.25 (Margin) + 0.75 (Handicap) = <strong>4.00 HPS</strong>!
                  </p>
                </div>
              </div>
            )}

            {/* Example C: 35-Match Season End Rule */}
            {activeExampleTab === 'season_end' && (
              <div className="p-6 rounded-2xl bg-bg-dark border border-cyan/30 space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-heading font-bold text-sm uppercase text-volt">
                      Hypothetical Season Leaderboard Scenario
                    </h4>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Imagine Shaunish plays <strong>40 approved matches</strong> and earns 80 Total HPS:
                    </p>
                    <div className="p-3 rounded-lg bg-bg-secondary font-mono text-xs text-text-primary">
                      Shaunish&apos;s Average HPS = 80 ÷ 40 = <strong className="text-volt">2.00</strong>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed pt-1">
                      {weakName} plays <strong>30 approved matches</strong> and earns 60 Total HPS:
                    </p>
                    <div className="p-3 rounded-lg bg-bg-secondary font-mono text-xs text-text-primary">
                      {weakName}&apos;s Average HPS = 60 ÷ 30 = <strong className="text-amber-400">2.00</strong>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs leading-relaxed">
                    <div className="p-3.5 rounded-xl bg-bg-card border border-border">
                      <span className="font-heading font-bold uppercase text-text-primary block mb-1">
                        1. During Live Season
                      </span>
                      Both players are tied at an average of <strong>2.00 Average HPS</strong>.
                    </div>
                    <div className="p-3.5 rounded-xl bg-red/10 border border-red/30 text-text-primary">
                      <span className="font-heading font-bold uppercase text-red block mb-1">
                        2. When Season End is Clicked
                      </span>
                      Shaunish played 40 matches (≥35) → <strong>Eligible for Podium Ranking</strong>.
                      <br />
                      {weakName} played 30 matches (&lt;35) → <strong className="text-red">Moved to 4th (Minimum Requirements Not Met)</strong>.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. Live Interactive Match HPS Calculator */}
          <div className="p-6 rounded-2xl bg-bg-dark/70 border border-volt/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧮</span>
                <h4 className="font-heading font-bold text-sm uppercase text-text-primary tracking-wide">
                  Live Match HPS Simulator
                </h4>
              </div>
              <span className="text-[0.7rem] text-text-muted font-mono">
                Try entering test scores to preview player HPS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Player 1 Box */}
              <div className="p-4 rounded-xl bg-bg-card border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-sm text-text-primary">Player 1</span>
                  <label className="flex items-center gap-1.5 text-xs font-mono text-text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simP1HasHandicap}
                      onChange={(e) => setSimP1HasHandicap(e.target.checked)}
                      className="rounded text-volt bg-bg-dark border-border"
                    />
                    <span>+{bonus} Handicap Boost</span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[0.65rem] text-text-muted uppercase font-mono block mb-1">Goals Scored</label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={simScore1}
                      onChange={(e) => setSimScore1(parseInt(e.target.value, 10) || 0)}
                      className="input w-full font-mono text-lg font-bold text-center p-2 rounded-lg bg-bg-dark border-border"
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-[0.65rem] text-text-muted uppercase font-mono block mb-1">Earned HPS</span>
                    <span className="font-heading font-black text-2xl text-volt">{p1Hps.toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-[0.65rem] text-text-muted font-mono pt-1">
                  R: {p1R} · G: +{p1G.toFixed(2)} · C: +{p1C.toFixed(2)} · H: +{p1H.toFixed(2)}
                </div>
              </div>

              {/* Player 2 Box */}
              <div className="p-4 rounded-xl bg-bg-card border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-sm text-text-primary">Player 2 ({weakName})</span>
                  <label className="flex items-center gap-1.5 text-xs font-mono text-text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simP2HasHandicap}
                      onChange={(e) => setSimP2HasHandicap(e.target.checked)}
                      className="rounded text-volt bg-bg-dark border-border"
                    />
                    <span>+{bonus} Handicap Boost</span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[0.65rem] text-text-muted uppercase font-mono block mb-1">Goals Scored</label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={simScore2}
                      onChange={(e) => setSimScore2(parseInt(e.target.value, 10) || 0)}
                      className="input w-full font-mono text-lg font-bold text-center p-2 rounded-lg bg-bg-dark border-border"
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-[0.65rem] text-text-muted uppercase font-mono block mb-1">Earned HPS</span>
                    <span className="font-heading font-black text-2xl text-amber-400">{p2Hps.toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-[0.65rem] text-text-muted font-mono pt-1">
                  R: {p2R} · G: +{p2G.toFixed(2)} · C: +{p2C.toFixed(2)} · H: +{p2H.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
