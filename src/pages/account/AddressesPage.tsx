import { useState } from 'react'
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { PageTitle, EmptyState, Badge, Skeleton, Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/account/AuthProvider'
import { AddressForm } from '@/features/account/AddressForm'
import {
  emptyAddress, formatAddressLines, toDraft, useAddresses, useDeleteAddress, useSaveAddress, useSetDefaultAddress, type Address,
} from '@/features/account/addresses'
import { friendlyError } from '@/lib/supabase'
import { useDocumentMeta } from '@/lib/meta'

export function AddressesPage() {
  useDocumentMeta({ title: 'Addresses', noindex: true })
  const { user, profile } = useAuth()
  const { data, isLoading } = useAddresses(user?.id)
  const save = useSaveAddress(user?.id)
  const del = useDeleteAddress()
  const setDefault = useSetDefaultAddress()
  const toast = useToast()
  const [editing, setEditing] = useState<Address | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fail = (e: unknown) => setError(/ADDRESS_LIMIT/.test(String((e as Error)?.message)) ? 'You can save up to 20 addresses. Please delete one first.' : friendlyError(e))

  if (editing) {
    const initial = editing === 'new'
      ? { ...emptyAddress, recipient_name: profile?.full_name ?? '', phone: profile?.phone?.replace(/^\+91/, '') ?? '' }
      : toDraft(editing)
    return (
      <>
        <PageTitle title={editing === 'new' ? 'Add address' : 'Edit address'} />
        <div className="card max-w-2xl p-6">
          {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
          <AddressForm initial={initial} busy={save.isPending} onCancel={() => { setEditing(null); setError(null) }}
            onSubmit={(values) => save.mutate({ id: editing === 'new' ? undefined : editing.id, values }, {
              onSuccess: () => { setEditing(null); setError(null); toast('Address saved') }, onError: fail,
            })} />
        </div>
      </>
    )
  }

  return (
    <>
      <PageTitle title="Addresses" subtitle="Saved delivery addresses for faster checkout.">
        {!!data?.length && <Button onClick={() => setEditing('new')}><Plus className="size-4" /> Add address</Button>}
      </PageTitle>
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
      {isLoading ? <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        : !data?.length ? (
          <EmptyState icon={<MapPin />} title="No saved addresses" action={<Button onClick={() => setEditing('new')}><Plus className="size-4" /> Add address</Button>}>
            Add an address now, or save one during checkout.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.map((a) => (
              <li key={a.id} className="card flex flex-col p-5">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-navy-900">{a.label}</p>
                  {a.is_default && <Badge tone="gold">Default</Badge>}
                  {a.location_source === 'gps' && <Badge tone="navy">Map pin</Badge>}
                </div>
                <p className="mt-2 text-sm font-medium text-navy-800">{a.recipient_name} · {a.phone.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2')}</p>
                <address className="mt-1 flex-1 text-sm not-italic text-navy-700">{formatAddressLines(a).map((l) => <span key={l} className="block">{l}</span>)}</address>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(a)}><Pencil className="size-3.5" /> Edit</Button>
                  {!a.is_default && (
                    <Button size="sm" variant="ghost" loading={setDefault.isPending && setDefault.variables === a.id}
                      onClick={() => setDefault.mutate(a.id, { onError: fail })}><Star className="size-3.5" /> Make default</Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-danger" loading={del.isPending && del.variables === a.id}
                    onClick={() => { if (confirmDelete(a)) del.mutate(a.id, { onSuccess: () => toast('Address deleted'), onError: fail }) }}>
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
    </>
  )
}

function confirmDelete(a: Address) {
  return window.confirm(`Delete the ${a.label} address?`)
}
