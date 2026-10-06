'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { subscribeToMatches } from '@/lib/db';

const navItems = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/matches',
    label: 'Log Match',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    href: '/users',
    label: 'Players',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/tournaments',
    label: 'Tournaments',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    ),
  },
  {
    href: '/admin',
    label: 'Admin Portal',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsub = subscribeToMatches((matches) => {
      const count = matches.filter((m) => m.status === 'pending').length;
      setPendingCount(count);
    });
    return () => unsub();
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        id="mobile-menu-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-bg-card border border-border"
        aria-label="Toggle navigation"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {mobileOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <path d="M3 12h18M3 6h18M3 18h18" />
          )}
        </svg>
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 z-40
          bg-bg-secondary border-r border-border
          flex flex-col
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {/* Logo / Brand */}
        <div className="p-6 border-b border-border">
          <Link href="/" className="flex items-center gap-3 group" onClick={() => setMobileOpen(false)}>
            <div className="w-10 h-10 rounded-lg bg-volt flex items-center justify-center transform -skew-x-6 group-hover:skew-x-0 transition-transform">
              <span className="text-bg-primary font-heading font-black text-lg skew-x-6 group-hover:skew-x-0 transition-transform">
                eF
              </span>
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-lg tracking-tight text-text-primary leading-none">
                eFOOTBALL
              </h1>
              <p className="font-heading text-[0.65rem] font-semibold tracking-[0.2em] text-volt uppercase">
                TRACKER
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg font-heading font-semibold text-sm uppercase tracking-wide
                  transition-all duration-200
                  ${active
                    ? 'bg-volt/10 text-volt border-l-4 border-volt pl-3'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-card border-l-4 border-transparent pl-3'
                  }
                `}
              >
                <span className={active ? 'text-volt' : 'text-text-muted group-hover:text-text-secondary'}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.href === '/admin' && pendingCount > 0 && (
                  <span className="px-2 py-0.5 text-[0.65rem] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom decoration */}
        <div className="p-4 border-t border-border">
          <div className="text-center">
            <p className="text-[0.65rem] text-text-muted font-heading uppercase tracking-widest">
              Real-Time Sync
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="w-2 h-2 rounded-full bg-volt animate-pulse" />
              <span className="text-xs text-text-secondary">Live</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
