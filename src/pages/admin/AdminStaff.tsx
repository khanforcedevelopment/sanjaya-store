import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Alert, Badge } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import type { AppRole } from '@/lib/types'
import { AdminTitle, Table, Td } from './ui'

const ROLES: { role: AppRole; label: string; hint: string }[] = [
  { role: 'super_admin', label: 'Super Admin', hint: 'Everything, including settings, refunds and staff' },
  { role: 'operations', label: 'Operations', hint: 'Orders, products, stock, delivery zones, banners' },
  { role: 'delivery', label: 'Delivery', hint: 'Only their own assigned deliveries' },
  { role: 'collections', label: 'Collections', hint: 'Installment payments and follow-ups' },
  { role: 'support', label: 'Support', hint: 'Read orders and help customers' },
]

type Person = { id: string; full_name: string; email: string; phone: string; roles: string[] }

function RoleToggles({ person, onDone, onError }: { person: Person; onDone: () => void; onError: (m: string) => void }) {
  const db = requireSupabase()
  const [busy, setBusy] = useState<string | null>(null)
  const toggle = async (role: AppRole, grant: boolean) => {
    if (role === 'super_admin' && !grant && !window.confirm('Remove Super Admin from this person?')) return
    setBusy(role)
    const { error } = await db.rpc('set_staff_role', { p_user_id: person.id, p_role: role, p_grant: grant })
    setBusy(null)
    if (error) onError(friendlyError(error))
    else onDone()
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROLES.map(({ role, label, hint }) => {
        const on = person.roles.includes(role)
        return (
          <button key={role} type="button" title={hint} disabled={busy !== null} onClick={() => toggle(role, !on)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? 'border-gold-500 bg-gold-200 text-navy-950' : 'border-navy-900/15 text-navy-700 hover:border-gold-500'} disabled:opacity-50`}
            aria-pressed={on}>
            {busy === role ? '…' : label}
          </button>
        )
      })}
    </div>
  )
}

export function AdminStaff() {
  const db = requireSupabase()
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Person[] | null>(null)
  const { data: staff } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: async () => { const { data, error } = await db.rpc('list_staff'); if (error) throw error; return data as Person[] },
  })
  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim().length < 3) { setErr('Type at least 3 characters of an email or phone number.'); return }
    const { data, error } = await db.rpc('find_user_for_staff', { p_query: q.trim() })
    if (error) setErr(friendlyError(error))
    else { setErr(null); setFound(data as Person[]) }
  }
  const refresh = async () => {
    setErr(null)
    await qc.invalidateQueries({ queryKey: ['admin', 'staff'] })
    if (found && q.trim().length >= 3) {
      const { data } = await db.rpc('find_user_for_staff', { p_query: q.trim() })
      setFound((data as Person[]) ?? null)
    }
  }

  return (
    <>
      <AdminTitle title="Staff" subtitle="The person must sign in to the store once before you can give them a role. Tap a role to switch it on or off." />
      {err && <div className="mb-3"><Alert tone="error">{err}</Alert></div>}
      <form onSubmit={search} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <InputField label="Find a customer by email or phone" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-64 flex-1" placeholder="name@example.com or 98…" />
        <Button type="submit" variant="navy"><Search className="size-4" /> Find</Button>
      </form>
      {found && (
        <div className="mb-6">
          <h2 className="mb-2 font-semibold text-navy-900">Search results</h2>
          <Table head={['Person', 'Roles']} empty={found.length === 0}>
            {found.map((p) => (
              <tr key={p.id}><Td><p className="font-semibold">{p.full_name || 'No name'}</p><p className="text-xs text-navy-600">{p.email} {p.phone}</p></Td>
                <Td><RoleToggles person={p} onDone={refresh} onError={setErr} /></Td></tr>
            ))}
          </Table>
        </div>
      )}
      <h2 className="mb-2 font-semibold text-navy-900">Current staff</h2>
      <Table head={['Person', 'Roles']} empty={staff?.length === 0}>
        {staff?.map((p) => (
          <tr key={p.id}>
            <Td><p className="font-semibold">{p.full_name || 'No name'}</p><p className="text-xs text-navy-600">{p.email} {p.phone}</p>
              <div className="mt-1 flex gap-1">{p.roles.map((r) => <Badge key={r} tone="navy">{r.replace('_', ' ')}</Badge>)}</div></Td>
            <Td><RoleToggles person={p} onDone={refresh} onError={setErr} /></Td>
          </tr>
        ))}
      </Table>
    </>
  )
}
