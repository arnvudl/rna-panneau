// In-memory login throttle: 5 failed attempts per email per 15 minutes.
// Single-instance deployment (one Node process), so a Map is sufficient —
// no Redis needed at this scale. State resets on server restart, which is
// an acceptable failure mode for a brute-force guard.

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

const attempts = new Map<string, { count: number; windowStart: number }>()

export function isLoginBlocked(email: string): boolean {
  const entry = attempts.get(email)
  if (!entry) return false
  if (Date.now() - entry.windowStart > WINDOW_MS) {
    attempts.delete(email)
    return false
  }
  return entry.count >= MAX_ATTEMPTS
}

export function recordFailedLogin(email: string) {
  const now = Date.now()
  const entry = attempts.get(email)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(email, { count: 1, windowStart: now })
  } else {
    entry.count++
  }
  // Opportunistic cleanup so the map can't grow unbounded from bogus emails.
  if (attempts.size > 1000) {
    attempts.forEach((e, key) => {
      if (now - e.windowStart > WINDOW_MS) attempts.delete(key)
    })
  }
}

export function recordSuccessfulLogin(email: string) {
  attempts.delete(email)
}
