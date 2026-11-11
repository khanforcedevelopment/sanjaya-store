import { useCallback, useEffect, useState } from 'react'
import { isEmirateCode } from '@/lib/emirates'

const KEY = 'sanjaya.emirate'
const EVENT = 'sanjaya:emirate'

function read(): string | null {
  try { const v = localStorage.getItem(KEY); return isEmirateCode(v) ? v : null } catch { return null }
}

/**
 * The customer's delivery emirate code (DXB, AUH, ...), remembered on this device and shared across the page.
 * The server calls it "pincode" for historical reasons.
 */
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
