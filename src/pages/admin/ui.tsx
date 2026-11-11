import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export function AdminTitle({ title, children, subtitle }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="big-num text-3xl sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm muted">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function Table({ head, children, empty, compact }: { head: ReactNode[]; children: ReactNode; empty?: boolean; compact?: boolean }) {
  return (
    <div className="card overflow-x-auto">
      <table className={cn('w-full text-left text-sm', !compact && 'min-w-[640px]')}>
        <thead className="border-b text-xs uppercase tracking-wider muted">
          <tr>{head.map((h, i) => <th key={i} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
      {empty && <p className="p-6 text-center text-sm muted">Nothing to show.</p>}
    </div>
  )
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cn('px-3 py-2.5 align-top', className)}>{children}</td>

export function Stat({ label, value, tone, delta, green, sub }: {
  label: string; value: ReactNode; tone?: 'warn' | 'ok'; delta?: number | null; green?: boolean; sub?: ReactNode
}) {
  return (
    <div className={cn('card lift p-4', green && 'card-green')}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-xs font-semibold', green ? 'text-white/85' : 'muted')}>{label}</p>
        {delta != null && <Delta value={delta} />}
      </div>
      <p className={cn('big-num mt-2 text-2xl sm:text-[28px]', tone === 'warn' && 'text-[#c23a22]', tone === 'ok' && 'text-[#0f8f62]')}>{value}</p>
      {sub && <p className={cn('mt-1 text-xs', green ? 'text-white/80' : 'muted')}>{sub}</p>}
    </div>
  )
}

/** Green pill for an increase, red for a decrease (percent). */
export function Delta({ value, invert }: { value: number; invert?: boolean }) {
  const up = value >= 0
  const good = invert ? !up : up
  return (
    <span className={cn('chip', good ? 'chip-up' : 'chip-down')}>
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(value).toFixed(value !== 0 && Math.abs(value) < 10 ? 1 : 0)}%
    </span>
  )
}
/** Percent change from prev to cur; null when there is nothing to compare. */
export const pctChange = (cur: number, prev: number): number | null => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : null)

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('glass p-4 sm:p-5', className)}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** Small segmented switch (7 / 30 days, week / month / year). */
export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-white/40 p-1">
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={v === value} onClick={() => onChange(v)}
          className={cn('pill !h-8 !px-3', v === value ? 'pill-on' : 'pill-ghost !bg-transparent')}>{l}</button>
      ))}
    </div>
  )
}

export function ProgressBar({ value, color = 'var(--black)', label }: { value: number; color?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="bar-track" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="bar-fill" style={{ width: `${v}%`, background: color }} />
    </div>
  )
}

/** Circular progress ring. */
export function Ring({ value, size = 86, stroke = 9, color = 'var(--green2)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.6)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

/** Vertical bars; each bar can be a stack of parts (bottom first). */
export function Bars({ data, height = 180, colors, highlightLast, label, format }: {
  data: { key: string; label: string; parts: number[] }[]; height?: number; colors: string[]; highlightLast?: string
  label: string; format: (n: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => d.parts.reduce((a, b) => a + b, 0)))
  const showEvery = data.length > 16 ? Math.ceil(data.length / 8) : 1
  return (
    <div>
      <div className="flex items-end gap-[3px] sm:gap-1.5" style={{ height }} role="img" aria-label={label}>
        {data.map((d, i) => {
          const total = d.parts.reduce((a, b) => a + b, 0)
          return (
            <div key={d.key} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${d.parts.map(format).join(' / ')}`}>
              <div className="flex flex-col-reverse overflow-hidden rounded-full" style={{ height: `${Math.max(3, (total / max) * 100)}%` }}>
                {d.parts.map((p, j) => (
                  <div key={j} style={{ height: total ? `${(p / total) * 100}%` : j === 0 ? '100%' : 0, background: highlightLast && i === data.length - 1 && j === 0 ? highlightLast : colors[j] ?? colors[0], opacity: total ? 1 : 0.25 }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-[3px] text-[10px] muted sm:gap-1.5">
        {data.map((d, i) => <span key={d.key} className="flex-1 truncate text-center">{i % showEvery === 0 ? d.label : ''}</span>)}
      </div>
    </div>
  )
}

/** Smooth line chart for one or more series. */
export function LineChart({ labels, series, height = 200, label, format }: {
  labels: string[]; series: { name: string; color: string; values: number[] }[]; height?: number; label: string; format: (n: number) => string
}) {
  const w = 600, h = height, pad = 8
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const n = Math.max(1, labels.length - 1)
  const pt = (i: number, v: number) => [pad + (i / n) * (w - pad * 2), h - pad - (v / max) * (h - pad * 2)] as const
  const path = (vals: number[]) => vals.map((v, i) => {
    const [x, y] = pt(i, v)
    if (i === 0) return `M${x},${y}`
    const [px, py] = pt(i - 1, vals[i - 1] ?? 0)
    const cx = (px + x) / 2
    return `C${cx},${py} ${cx},${y} ${x},${y}`
  }).join(' ')
  const showEvery = labels.length > 12 ? Math.ceil(labels.length / 6) : 1
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img"
        aria-label={`${label}: ${series.map((s) => `${s.name} ${format(s.values.reduce((a, b) => a + b, 0))}`).join(', ')}`}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={w} y1={h * f} y2={h * f} stroke="rgba(255,255,255,.7)" strokeDasharray="4 6" />)}
        {series.map((s) => <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="mt-1 flex text-[10px] muted">{labels.map((l, i) => <span key={i} className="flex-1 truncate text-center">{i % showEvery === 0 ? l : ''}</span>)}</div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs">
        {series.map((s) => <span key={s.name} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span>)}
      </div>
    </div>
  )
}

export function Donut({ parts, size = 150, children }: { parts: { value: number; color: string }[]; size?: number; children?: ReactNode }) {
  const total = parts.reduce((a, b) => a + b.value, 0)
  const r = size / 2 - 12, c = 2 * Math.PI * r
  let off = 0
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={18} />
        {total > 0 && parts.map((p, i) => {
          const len = (p.value / total) * c
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={18} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />
          off += len
          return el
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export const CHART_COLORS = ['#141414', '#33c48a', '#4c8dff', '#f4c534', '#f0533a', '#f59f2f', '#8b5cf6', '#0f8f62']

/** Downloads rows as a CSV file (values are quoted, so commas and quotes in names are safe). */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    let s = v == null ? '' : String(v)
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}` // stop spreadsheet formulas
    return `"${s.replace(/"/g, '""')}"`
  }
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Parses "1,299.50" or "AED 1,299.50" into fils; null when invalid. */
export function aedInput(v: string): number | null {
  const n = Number(v.replace(/aed/gi, '').replace(/[,\s]/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

const aedFmt = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** Staff panel money: always two decimals, "AED 1,234.50". */
export const aed = (fils: number | null | undefined) => `${(fils ?? 0) < 0 ? '-' : ''}AED ${aedFmt.format(Math.abs(fils ?? 0) / 100)}`
/** Short form for chart axes and big tiles: "AED 12.4K". */
export const aedShort = (fils: number) => {
  const n = fils / 100
  return Math.abs(n) >= 1e6 ? `AED ${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e4 ? `AED ${(n / 1e3).toFixed(1)}K` : aed(fils)
}
export const colorAt = (i: number): string => CHART_COLORS[i % CHART_COLORS.length] ?? '#141414'
