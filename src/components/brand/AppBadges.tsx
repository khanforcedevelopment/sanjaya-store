import { useState, type ReactNode } from 'react'
import { Share, Smartphone, SquarePlus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePwaInstall } from '@/lib/pwaInstall'
import { cn } from '@/lib/cn'

function AndroidMark({ className }: { className?: string }) {
  // Android robot head (the Android robot is shared by Google under CC BY 3.0)
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.87 3.23a11.4 11.4 0 0 0-9.82 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
    </svg>
  )
}
function Badge({ onClick, icon, top, main, className }: { onClick: () => void; icon: ReactNode; top: string; main: string; className?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('flex h-14 min-w-44 items-center gap-3 rounded-xl border border-gold-400/50 bg-navy-950 px-4 text-left text-white shadow-[var(--shadow-card)] transition hover:border-gold-300 hover:brightness-110 active:scale-[0.98]', className)}>
      <span className="text-gold-300">{icon}</span>
      <span className="leading-tight"><span className="block text-[10px] uppercase tracking-[0.18em] text-white/60">{top}</span><span className="block text-[17px] font-semibold">{main}</span></span>
    </button>
  )
}

/** "Download for Android / iPhone" buttons. Android starts the browser's install dialog in one tap; iPhone shows the two Safari steps. */
export function AppBadges({ className }: { className?: string }) {
  const { installed, canPrompt, platform, install } = usePwaInstall()
  const navigate = useNavigate()
  const [help, setHelp] = useState<'ios' | 'android' | null>(null)

  if (installed) return <p className={cn('text-sm font-semibold text-gold-300', className)}>The Sanjaya Store app is installed on this device.</p>

  async function android() {
    if (canPrompt && (await install())) return
    if (platform === 'ios') return setHelp('ios')
    setHelp('android')
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        <Badge onClick={android} icon={<AndroidMark className="size-7" />} top="Download for" main="Android" />
        <Badge onClick={() => (canPrompt && platform !== 'ios' ? void install() : setHelp('ios'))} icon={<Smartphone className="size-7" />} top="Download for" main="iPhone" />
      </div>
      {help && (
        <div role="dialog" aria-label="How to install" className="relative mt-3 max-w-md rounded-2xl border border-gold-400/40 bg-white p-4 pr-10 text-sm text-navy-900 shadow-[var(--shadow-lift)]">
          <button type="button" onClick={() => setHelp(null)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full hover:bg-navy-50" aria-label="Close"><X className="size-4" /></button>
          {help === 'ios' ? (
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open <strong>sanjayatrading.store</strong> in <strong>Safari</strong>.</li>
              <li>Tap <Share className="inline size-4" /> <strong>Share</strong> at the bottom.</li>
              <li>Tap <SquarePlus className="inline size-4" /> <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open <strong>sanjayatrading.store</strong> in <strong>Chrome</strong>.</li>
              <li>Tap the <strong>⋮</strong> menu at the top right.</li>
              <li>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</li>
            </ol>
          )}
          {location.pathname !== '/install' && <button type="button" className="mt-2 text-xs font-semibold text-gold-700 underline" onClick={() => navigate('/install')}>More help</button>}
        </div>
      )}
    </div>
  )
}
