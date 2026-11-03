const KEY = 'sanjaya.ref'

/** Remembers ?ref=CODE from an invite link so it can be attached at sign-up. */
export function captureReferral(search: string) {
  const code = new URLSearchParams(search).get('ref')
  if (code && /^[A-Za-z0-9]{4,16}$/.test(code)) {
    try { localStorage.setItem(KEY, code.toUpperCase()) } catch { /* ignore */ }
  }
}
export function storedReferral(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}
export function clearReferral() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
