'use client';

import Link from 'next/link';
import HpsExplainer from '@/components/HpsExplainer';

export default function AlertsPage() {
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-volt animate-ping" />
            <span className="font-heading font-black text-xs uppercase tracking-widest text-volt">
              League Announcements & System Updates
            </span>
          </div>
          <h1 className="font-heading font-black text-3xl md:text-4xl text-text-primary tracking-wide">
            Notices & Alerts
          </h1>
          <p className="text-text-secondary text-sm mt-1 max-w-xl">
            Stay updated with competitive rules, new ranking systems, and official announcements for all league players.
          </p>
        </div>

        <Link
          href="/"
          className="btn-secondary self-start sm:self-auto text-xs font-heading font-bold uppercase tracking-wider py-2 px-4"
        >
          ← Return to Dashboard
        </Link>
      </div>

      {/* Featured Release Announcement */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-volt/10 via-bg-card to-cyan/10 border border-volt/40 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full text-xs font-heading font-black uppercase tracking-wider bg-volt text-black shadow-md">
              📢 MAJOR SYSTEM UPDATE
            </span>
            <span className="text-xs text-text-muted font-mono">
              Effective: New Seasons (Season 3+)
            </span>
          </div>
          <span className="text-xs font-heading font-bold uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
            ● Active in League
          </span>
        </div>

        <div className="space-y-3">
          <h2 className="font-heading font-black text-2xl md:text-3xl text-text-primary">
            Important Note to All Players: Implementation of the HPS System &amp; Fluid Seasons
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed max-w-3xl">
            Attention contenders: We have officially rolled out a brand-new competitive architecture designed to reward dominant wins, disciplined defending, and balanced participation across the group. Here is everything you need to know about what has changed.
          </p>
        </div>

        {/* Key Points Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-bg-card border border-border space-y-1.5">
            <div className="text-volt font-heading font-black text-sm uppercase">
              1. No Fixed Seasons
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Match quotas and fixed 15-pair caps are eliminated. Play as many casual or tournament matches as you wish until the season concludes.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-bg-card border border-border space-y-1.5">
            <div className="text-cyan font-heading font-black text-sm uppercase">
              2. Historical Integrity
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Seasons 1 &amp; 2 remain completely unchanged under their original standard PTS rules. Their records and statistics are fully preserved.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-bg-card border border-border space-y-1.5">
            <div className="text-amber-400 font-heading font-black text-sm uppercase">
              3. HPS System + 35-Match Rule
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Rankings use Average HPS. When Season End is clicked, players must have at least 35 approved matches to qualify for podium standings.
            </p>
          </div>
        </div>
      </div>

      {/* Embedded Full HPS Explainer Card */}
      <HpsExplainer
        activeHandicapName="Ashu"
        activeHandicapBonus={0.75}
        minMatches={35}
        defaultExpanded={true}
        showFullPageNotice={true}
      />

      {/* Release Changelog */}
      <div className="card p-6 md:p-8 space-y-6">
        <h3 className="font-heading font-black text-xl text-text-primary uppercase tracking-wide accent-bar">
          Changelog &amp; Feature Release Notes
        </h3>

        <div className="space-y-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-bg-dark border border-border space-y-1">
            <div className="flex items-center justify-between text-text-primary font-bold">
              <span>● HPS Ranking System (Handicap Performance Score)</span>
              <span className="text-volt">Added</span>
            </div>
            <p className="text-text-muted leading-relaxed">
              Formula: HPS = R (Result: 3/1/0) + G (Margin: +0.25/goal up to +1.00) + C (Clean sheet: +0.25 for win with 0 conceded) + H (Handicap boost: +0.75 for designated player).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg-dark border border-border space-y-1">
            <div className="flex items-center justify-between text-text-primary font-bold">
              <span>● Points Per Game (PPG) Column Added</span>
              <span className="text-cyan">Added</span>
            </div>
            <p className="text-text-muted leading-relaxed">
              Shows PTS ÷ Matches Played for every player across all season tables and all-time leaderboards.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg-dark border border-border space-y-1">
            <div className="flex items-center justify-between text-text-primary font-bold">
              <span>● Admin Special Powers &amp; Handicap Configurator</span>
              <span className="text-amber-400">Added</span>
            </div>
            <p className="text-text-muted leading-relaxed">
              Admins are prompted to pick the weak player and bonus points when launching a season, and can update special powers anytime in the Admin Portal.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg-dark border border-border space-y-1">
            <div className="flex items-center justify-between text-text-primary font-bold">
              <span>● 35-Match Season End Requirement Rule</span>
              <span className="text-purple-400">Enforced</span>
            </div>
            <p className="text-text-muted leading-relaxed">
              Protects leaderboard integrity: when season ends, contenders with fewer than 35 approved matches are automatically moved to 4th and marked &ldquo;Minimum Requirements Not Met&rdquo;.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
