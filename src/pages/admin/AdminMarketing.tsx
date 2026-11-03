import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField } from '@/components/ui/Field'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { formatINR } from '@/lib/money'
import { formatDay } from '@/lib/format'
import { AdminTitle, Table, Td, rupeesInput } from './ui'

export function AdminMarketing() {
  return (
    <>
      <AdminTitle title="Banners & coupons" />
      <Banners />
      <div className="h-8" />
      <Coupons />
    </>
  )
}

function Banners() {
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const { data } = useQuery({
    queryKey: ['admin', 'banners'],
    queryFn: async () => { const { data, error } = await requireSupabase().from('banners').select('*').order('placement').order('sort_order'); if (error) throw error; return data },
  })
  const db = requireSupabase()
  const run = async (p: PromiseLike<{ error: unknown }>) => { const { error } = await p; if (error) setErr(friendlyError(error)); else { setErr(null); qc.invalidateQueries({ queryKey: ['admin', 'banners'] }); qc.invalidateQueries({ queryKey: ['banners'] }) } }
  const [f, setF] = useState({ placement: 'hero', eyebrow: '', title: '', subtitle: '', cta_label: '', cta_href: '', theme: 'navy' })
  const [uploading, setUploading] = useState<string | null>(null)
  const upload = async (id: string, file?: File) => {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) return setErr('Use a JPG, PNG or WebP photo under 5 MB.')
    setUploading(id)
    const path = `${id}/${crypto.randomUUID()}.${file.type.split('/')[1]}`
    const { error } = await db.storage.from('banner-images').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
    setUploading(null)
    if (error) return setErr(friendlyError(error))
    run(db.from('banners').update({ image_url: db.storage.from('banner-images').getPublicUrl(path).data.publicUrl }).eq('id', id))
  }
  return (
    <section>
      <h2 className="mb-2 font-display text-2xl font-semibold text-navy-900">Homepage banners</h2>
      {err && <div className="mb-2"><Alert tone="error">{err}</Alert></div>}
      <Table head={['Where', 'Text', 'Button', 'Photo', 'Live', '']} empty={!data?.length}>
        {data?.map((b) => (
          <tr key={b.id}>
            <Td><Badge tone="navy">{b.placement}</Badge></Td>
            <Td><p className="font-semibold">{b.title}</p><p className="text-xs text-navy-600">{b.eyebrow} {b.subtitle}</p></Td>
            <Td>{b.cta_label}<span className="block text-xs text-navy-600">{b.cta_href}</span></Td>
            <Td>
              {b.image_url && <img src={b.image_url} alt="" className="mb-1 h-10 w-16 rounded object-cover" />}
              <label className="cursor-pointer text-xs font-semibold text-gold-700">{uploading === b.id ? 'Uploading…' : b.image_url ? 'Change' : 'Add photo'}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(b.id, e.target.files?.[0])} /></label>
            </Td>
            <Td><input type="checkbox" className="size-4 accent-gold-500" checked={b.is_active} onChange={(e) => run(db.from('banners').update({ is_active: e.target.checked }).eq('id', b.id))} aria-label="Banner live" /></Td>
            <Td><button className="text-xs text-danger" onClick={() => window.confirm('Delete this banner?') && run(db.from('banners').delete().eq('id', b.id))}>Delete</button></Td>
          </tr>
        ))}
      </Table>
      <form className="card mt-3 grid gap-3 p-4 sm:grid-cols-4" onSubmit={(e) => {
        e.preventDefault()
        if (f.cta_href && !/^(\/|https:\/\/)/.test(f.cta_href)) return setErr('Button link must start with / or https://')
        run(db.from('banners').insert({ ...f, eyebrow: f.eyebrow || null, subtitle: f.subtitle || null, cta_label: f.cta_label || null, cta_href: f.cta_href || null, sort_order: (data?.length ?? 0) + 1 }))
        setF({ ...f, eyebrow: '', title: '', subtitle: '', cta_label: '', cta_href: '' })
      }}>
        <SelectField label="Where" value={f.placement} onChange={(e) => setF({ ...f, placement: e.target.value })}><option value="hero">Hero slider</option><option value="promo">Promo pair</option><option value="strip">Top strip</option></SelectField>
        <InputField label="Small heading" value={f.eyebrow} onChange={(e) => setF({ ...f, eyebrow: e.target.value })} />
        <InputField className="sm:col-span-2" label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
        <InputField className="sm:col-span-2" label="Subtitle" value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} />
        <InputField label="Button text" value={f.cta_label} onChange={(e) => setF({ ...f, cta_label: e.target.value })} />
        <InputField label="Button link" value={f.cta_href} onChange={(e) => setF({ ...f, cta_href: e.target.value })} placeholder="/c/watches" />
        <SelectField label="Colour" value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value })}><option value="navy">Navy</option><option value="ivory">Ivory</option><option value="gold">Gold</option></SelectField>
        <div className="flex items-end"><Button type="submit" size="sm">Add banner</Button></div>
      </form>
    </section>
  )
}

function Coupons() {
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const { data } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: async () => { const { data, error } = await requireSupabase().from('coupons').select('*').is('assigned_user_id', null).order('created_at', { ascending: false }); if (error) throw error; return data },
  })
  const db = requireSupabase()
  const run = async (p: PromiseLike<{ error: unknown }>) => { const { error } = await p; if (error) setErr(friendlyError(error)); else { setErr(null); qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }) } }
  const [f, setF] = useState({ code: '', description: '', type: 'percent', value: '', max: '', min: '', ends: '', limit: '', per_user: '1', first: false })
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const code = f.code.trim().toUpperCase()
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return setErr('Code: 3–32 letters, numbers, - or _.')
    const value = f.type === 'percent' ? parseInt(f.value, 10) : rupeesInput(f.value)
    if (!value || (f.type === 'percent' && value > 100)) return setErr('Enter a valid discount.')
    run(db.from('coupons').insert({
      code, description: f.description || null, discount_type: f.type, discount_value: value,
      max_discount_paise: f.max ? rupeesInput(f.max) : null, min_subtotal_paise: f.min ? rupeesInput(f.min) ?? 0 : 0,
      ends_at: f.ends ? new Date(`${f.ends}T23:59:59+05:30`).toISOString() : null, usage_limit: f.limit ? parseInt(f.limit, 10) : null,
      per_user_limit: parseInt(f.per_user || '1', 10), first_order_only: f.first,
    }))
    setF({ ...f, code: '', description: '', value: '' })
  }
  return (
    <section>
      <h2 className="mb-2 font-display text-2xl font-semibold text-navy-900">Coupons</h2>
      {err && <div className="mb-2"><Alert tone="error">{err}</Alert></div>}
      <Table head={['Code', 'Discount', 'Rules', 'Ends', 'Active']} empty={!data?.length}>
        {data?.map((c) => (
          <tr key={c.id}>
            <Td><span className="font-mono font-semibold">{c.code}</span><span className="block text-xs text-navy-600">{c.description}</span></Td>
            <Td>{c.discount_type === 'percent' ? `${c.discount_value}%` : formatINR(c.discount_value)}{c.max_discount_paise ? ` (max ${formatINR(c.max_discount_paise)})` : ''}</Td>
            <Td className="text-xs">{c.min_subtotal_paise ? `Min ${formatINR(c.min_subtotal_paise)} · ` : ''}{c.per_user_limit} per customer{c.usage_limit ? ` · ${c.usage_limit} total` : ''}{c.first_order_only ? ' · first order' : ''}</Td>
            <Td>{c.ends_at ? formatDay(c.ends_at) : '—'}</Td>
            <Td><input type="checkbox" className="size-4 accent-gold-500" checked={c.is_active} onChange={(e) => run(db.from('coupons').update({ is_active: e.target.checked }).eq('id', c.id))} aria-label="Coupon active" /></Td>
          </tr>
        ))}
      </Table>
      <form className="card mt-3 grid gap-3 p-4 sm:grid-cols-5" onSubmit={add}>
        <InputField label="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} required />
        <SelectField label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="percent">Percent off</option><option value="fixed">Rupees off</option></SelectField>
        <InputField label={f.type === 'percent' ? 'Percent' : 'Amount ₹'} inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} required />
        <InputField label="Max discount ₹" inputMode="decimal" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} />
        <InputField label="Min order ₹" inputMode="decimal" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
        <InputField className="sm:col-span-2" label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <InputField label="Last day" type="date" value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} />
        <InputField label="Total uses" inputMode="numeric" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value.replace(/\D/g, '') })} />
        <InputField label="Uses per customer" inputMode="numeric" value={f.per_user} onChange={(e) => setF({ ...f, per_user: e.target.value.replace(/\D/g, '') })} />
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="size-4 accent-gold-500" checked={f.first} onChange={(e) => setF({ ...f, first: e.target.checked })} /> First order only</label>
        <div className="flex items-end"><Button type="submit" size="sm">Add coupon</Button></div>
      </form>
    </section>
  )
}
