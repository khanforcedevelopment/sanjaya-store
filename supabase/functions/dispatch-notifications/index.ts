// Sends queued notification emails through Resend. Run every few minutes by a Supabase cron job.
// Only the service role may call it. Without RESEND_API_KEY nothing is sent and emails stay queued.
import { Db } from '../_shared/clients.ts'
import { renderEmail } from '../_shared/emails.ts'
import { hasServerKey } from '../_shared/http.ts'

interface Row { id: number; user_id: string | null; channel: string; template: string; payload: Record<string, unknown>; attempts: number; created_at: string }

Deno.serve(async (req) => {
  if (!hasServerKey(req)) return new Response('Forbidden', { status: 403 })
  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM') // e.g. "Sanjaya Store <orders@sanjayatrading.store>"
  if (!key || !from) return Response.json({ sent: 0, note: 'RESEND_API_KEY or EMAIL_FROM not set; emails stay queued' })
  const site = (Deno.env.get('SITE_URL') ?? 'https://sanjayatrading.store').replace(/\/$/, '')
  const db = Db.admin()
  const rows = await db.select<Row>('notification_outbox', 'status=eq.queued&channel=eq.email&attempts=lt.5&order=created_at&limit=50&select=id,user_id,channel,template,payload,attempts,created_at')
  let sent = 0, failed = 0
  for (const r of rows) {
    // Old updates are no longer useful (for example after email is first switched on)
    if (Date.now() - new Date(r.created_at).getTime() > 2 * 86_400_000) {
      await db.update('notification_outbox', `id=eq.${r.id}`, { status: 'skipped', last_error: 'older than 2 days' })
      continue
    }
    const [u] = r.user_id ? await db.select<{ email: string | null }>('profiles', `id=eq.${r.user_id}&select=email`) : []
    const mail = renderEmail(r.template, r.payload ?? {}, site)
    if (!u?.email || !mail) {
      await db.update('notification_outbox', `id=eq.${r.id}`, { status: 'skipped', last_error: !mail ? 'unknown template' : 'no email address' })
      continue
    }
    try {
      const res = await fetch(`${Deno.env.get('RESEND_API_BASE') ?? 'https://api.resend.com'}/emails`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `outbox-${r.id}` },
        body: JSON.stringify({ from, to: [u.email], subject: mail.subject, html: mail.html }),
      })
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`)
      await db.update('notification_outbox', `id=eq.${r.id}`, { status: 'sent', sent_at: new Date().toISOString(), attempts: r.attempts + 1 })
      sent++
    } catch (e) {
      failed++
      await db.update('notification_outbox', `id=eq.${r.id}`, { attempts: r.attempts + 1, last_error: String(e).slice(0, 300), status: r.attempts + 1 >= 5 ? 'failed' : 'queued' })
    }
  }
  return Response.json({ sent, failed, checked: rows.length })
})
