/**
 * Normalises a UAE mobile number to E.164 (+9715XXXXXXXX). Returns null if invalid.
 * Accepts "050 123 4567", "50 123 4567", "+971 50 123 4567" and "00971501234567".
 */
export function normaliseUaeMobile(input: string): string | null {
  let d = input.replace(/\D/g, '')
  if (d.startsWith('00971')) d = d.slice(5)
  else if (d.startsWith('971')) d = d.slice(3)
  if (d.startsWith('0')) d = d.slice(1)
  return /^5[024568]\d{7}$/.test(d) ? `+971${d}` : null
}

/** "+971501234567" -> "50 123 4567" for editing in a field that shows the +971 prefix. */
export function localUaeMobile(e164: string | null | undefined): string {
  if (!e164) return ''
  const m = e164.match(/^\+971(\d{2})(\d{3})(\d{4})$/)
  return m ? `${m[1]} ${m[2]} ${m[3]}` : e164.replace(/^\+971/, '')
}

/** "+971501234567" -> "+971 50 123 4567". */
export function displayUaeMobile(e164: string | null | undefined): string {
  if (!e164) return ''
  return /^\+971\d{9}$/.test(e164) ? `+971 ${localUaeMobile(e164)}` : e164
}
