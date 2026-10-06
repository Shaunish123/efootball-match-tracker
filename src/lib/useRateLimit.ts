'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAdminToken } from './adminAuth';

export const RATE_LIMIT_KEY = 'last_casual_submit_timestamp';
export const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes (600,000 ms)

export function useRateLimit(isAdminOverride = false) {
  const [remainingMs, setRemainingMs] = useState<number>(0);

  const calculateRemaining = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    // Admin exemption check
    if (isAdminOverride || !!getAdminToken()) return 0;

    const lastTimeStr = localStorage.getItem(RATE_LIMIT_KEY);
    if (!lastTimeStr) return 0;

    const lastTime = parseInt(lastTimeStr, 10);
    if (isNaN(lastTime)) return 0;

    const elapsed = Date.now() - lastTime;
    const remaining = Math.max(0, COOLDOWN_MS - elapsed);
    return remaining;
  }, [isAdminOverride]);

  useEffect(() => {
    setRemainingMs(calculateRemaining());

    const interval = setInterval(() => {
      setRemainingMs(calculateRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemaining]);

  const recordSubmission = useCallback(() => {
    if (typeof window === 'undefined') return;
    // Only record cooldown if not admin
    if (!isAdminOverride && !getAdminToken()) {
      localStorage.setItem(RATE_LIMIT_KEY, Date.now().toString());
      setRemainingMs(COOLDOWN_MS);
    }
  }, [isAdminOverride]);

  const clearRateLimit = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(RATE_LIMIT_KEY);
    setRemainingMs(0);
  }, []);

  const isRateLimited = remainingMs > 0 && !isAdminOverride && !getAdminToken();

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedCountdown = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    isRateLimited,
    remainingMs,
    formattedCountdown,
    recordSubmission,
    clearRateLimit,
  };
}
