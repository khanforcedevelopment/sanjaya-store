import { useSyncExternalStore } from 'react'

/** Chrome's install prompt event. It fires once, early, so we catch it as soon as the app loads. */
export type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallEvent | null = null
let installed = typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; emit() })
  window.addEventListener('appinstalled', () => { installed = true; deferred = null; emit() })
}

let snap = { canPrompt: !!deferred, installed }
function getSnapshot() {
  if (snap.canPrompt !== !!deferred || snap.installed !== installed) snap = { canPrompt: !!deferred, installed }
  return snap
}
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }

export function usePwaInstall() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const platform: 'ios' | 'android' | 'other' = typeof navigator === 'undefined' ? 'other'
    : /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'other'
  /** Opens the browser's own install dialog. Returns false when the browser has not offered one. */
  async function install() {
    const e = deferred
    if (!e) return false
    await e.prompt()
    const r = await e.userChoice
    deferred = null
    if (r.outcome === 'accepted') installed = true
    emit()
    return true
  }
  return { ...state, platform, install }
}
