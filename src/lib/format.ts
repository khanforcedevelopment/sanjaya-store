const TZ = 'Asia/Dubai'
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })
const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ })
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
})

/** Dates without a time ("2026-11-05") are calendar dates in the UAE; parse them at noon Gulf time to avoid off-by-one. */
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+04:00`) : new Date(value)
}

export const formatDate = (v: string | Date) => dateFmt.format(toDate(v))
export const formatDay = (v: string | Date) => dayFmt.format(toDate(v))
export const formatDateTime = (v: string | Date) => dateTimeFmt.format(toDate(v))

export function formatDeliveryWindow(min?: string | null, max?: string | null): string | null {
  if (!min || !max) return null
  return min === max ? formatDay(min) : `${formatDay(min)} – ${formatDay(max)}`
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const m = phone.replace(/\s/g, '').match(/^(\+971)?\d*?(\d{3})$/)
  return m ? `${m[1] ?? ''} ••••• ${m[2]}`.trim() : phone
}

/** Plain number with UAE grouping, e.g. product counts. */
export const formatCount = (n: number) => n.toLocaleString('en-AE')
