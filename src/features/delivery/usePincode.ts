import { useCallback, useEffect, useState } from 'react'

const KEY = 'sanjaya.pincode'
const EVENT = 'sanjaya:pincode'

function read(): string | null {
  try { const v = localStorage.getItem(KEY); return v && /^[1-9][0-9]{5}$/.test(v) ? v : null } catch { return null }
}

/** The customer's delivery pincode, remembered on this device and shared across the page. */
export function usePincode() {
  const [pincode, setState] = useState<string | null>(read)
  useEffect(() => {
    const sync = () => setState(read())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])
  const setPincode = useCallback((p: string) => {
    try { localStorage.setItem(KEY, p) } catch { /* ignore */ }
    setState(p)
    window.dispatchEvent(new Event(EVENT))
  }, [])
  return { pincode, setPincode }
}
