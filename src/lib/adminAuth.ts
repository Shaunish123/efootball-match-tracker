'use client';

const ADMIN_TOKEN_KEY = 'efootball_admin_token';

/**
 * Retrieves the stored admin session token from browser localStorage.
 */
export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

/**
 * Stores the admin session token in browser localStorage.
 */
export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

/**
 * Removes the admin session token from browser localStorage.
 */
export function clearAdminToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

/**
 * Checks whether an admin token exists in localStorage.
 */
export function hasAdminSession(): boolean {
  return !!getAdminToken();
}

/**
 * Calls server API to verify PIN. If valid, persists token.
 */
export async function loginWithPin(pin: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.token) {
      setAdminToken(data.token);
      return { success: true, token: data.token };
    }
    return { success: false, error: data.error || 'Invalid Admin PIN' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error verifying PIN' };
  }
}
