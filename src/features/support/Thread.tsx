import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { TextareaField } from '@/components/ui/Field'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { cn } from '@/lib/cn'

/** Messages of one support ticket plus a reply box. Used by customers and support staff. */
export function SupportThread({ ticketId, userId, asStaff = false }: { ticketId: string; userId: string; asStaff?: boolean }) {
  const db = requireSupabase()
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['support', 'messages', ticketId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db.from('support_messages').select('id, body, is_staff, created_at').eq('ticket_id', ticketId).order('id')
      if (error) throw error
      return data
    },
  })
  const [body, setBody] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (!body.trim()) return
    setBusy(true)
    const { error } = await db.from('support_messages').insert({ ticket_id: ticketId, author_id: userId, is_staff: asStaff, body: body.trim() })
    setBusy(false)
    if (error) return setErr(friendlyError(error))
    setBody(''); setErr(null)
    qc.invalidateQueries({ queryKey: ['support'] })
  }
  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {data?.map((m) => {
          const mine = m.is_staff === asStaff
          return (
            <li key={m.id} className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', mine ? 'ml-auto bg-navy-900 text-white' : 'bg-navy-50 text-navy-900')}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className={cn('mt-1 text-[11px]', mine ? 'text-white/60' : 'text-navy-600/80')}>{m.is_staff ? 'Sanjaya support' : 'Customer'} · {new Date(m.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </li>
          )
        })}
      </ol>
      <TextareaField label={asStaff ? 'Reply to the customer' : 'Your message'} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
      {err && <Alert tone="error">{err}</Alert>}
      <Button size="sm" loading={busy} disabled={!body.trim()} onClick={send}>Send</Button>
    </div>
  )
}
