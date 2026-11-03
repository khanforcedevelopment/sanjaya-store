import { useState } from 'react'
import { Download, FileUp, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/account/AuthProvider'
import { csvToObjects } from '@/lib/csv'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { AdminTitle, Table, Td } from './ui'

const COLUMNS = ['product_slug', 'product_name', 'brand', 'category_slug', 'short_description', 'description', 'tags', 'is_active',
  'sku', 'variant_name', 'size', 'colour', 'storage', 'price_rupees', 'mrp_rupees', 'stock', 'image_urls']
const SAMPLE = [
  ['cotton-kurta-navy', 'Cotton Kurta, Navy', 'Your Brand', 'men', 'Breathable cotton kurta', '', 'kurta|cotton', 'true', 'CK-NAVY-M', 'M', 'M', 'Navy', '', '1299', '1599', '10', 'https://example.com/photo1.jpg|https://example.com/photo2.jpg'],
  ['cotton-kurta-navy', '', '', 'men', '', '', '', '', 'CK-NAVY-L', 'L', 'L', 'Navy', '', '1299', '1599', '8', ''],
]

interface Result { dry_run?: boolean; errors: { row: number; error: string }[]; new_products: number; new_variants: number; updated_variants: number }

function toRow(r: Record<string, string>) {
  const options: Record<string, string> = {}
  for (const k of ['size', 'colour', 'storage']) if (r[k]) options[k] = r[k]
  // empty cells mean "not given" so the database keeps or defaults the value
  const rest = Object.fromEntries(Object.entries(r).filter(([k, v]) => v !== '' && !['size', 'colour', 'storage'].includes(k)))
  return { ...rest, tags: r.tags ? r.tags.split('|').join(',') : undefined, options: Object.keys(options).length ? options : undefined }
}

export function AdminImport() {
  const { hasRole } = useAuth()
  const qc = useQueryClient()
  const [rows, setRows] = useState<ReturnType<typeof toRow>[]>([])
  const [file, setFile] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [demo, setDemo] = useState<string | null>(null)

  const load = async (f: File | undefined) => {
    setResult(null); setErr(null)
    if (!f) return
    if (f.size > 5 * 1024 * 1024) return setErr('Please split files larger than 5 MB.')
    const parsed = csvToObjects(await f.text())
    if (!parsed.length) return setErr('The file has no rows.')
    if (parsed.length > 2000) return setErr('Please import at most 2,000 rows at a time.')
    setFile(f.name); setRows(parsed.map(toRow))
  }
  const run = async (dry: boolean) => {
    setBusy(true); setErr(null)
    const { data, error } = await requireSupabase().rpc('preview_or_import_products', { p_rows: rows as never, p_dry_run: dry })
    setBusy(false)
    if (error) return setErr(friendlyError(error))
    setResult(data as unknown as Result)
    if (!dry) qc.invalidateQueries()
  }
  const template = () => {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const csv = [COLUMNS, ...SAMPLE].map((r) => r.map(esc).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'sanjaya-products-template.csv'; a.click()
  }
  const removeDemo = async () => {
    if (!window.confirm('Remove all demo products? Products that were ever ordered are hidden instead of deleted. This cannot be undone.')) return
    const { data, error } = await requireSupabase().rpc('remove_demo_products')
    if (error) return setDemo(friendlyError(error))
    const r = data as { deleted: number; hidden: number }
    setDemo(`Removed ${r.deleted} demo products and hid ${r.hidden}.`); qc.invalidateQueries()
  }

  return (
    <>
      <AdminTitle title="Import products" subtitle="Add or update many products from a spreadsheet (CSV). One row per variant (size/colour).">
        <Button size="sm" variant="outline" onClick={template}><Download className="size-4" /> Template CSV</Button>
      </AdminTitle>
      <div className="card space-y-4 p-5">
        <ul className="list-disc space-y-1 pl-5 text-sm text-navy-700">
          <li>Rows with the same <code>product_slug</code> become one product with several variants. Existing SKUs are updated (price, MRP, stock, name).</li>
          <li><code>category_slug</code> must match a category (e.g. mobile-phones, men, women, sarees, watches). Separate tags and image links with <code>|</code>.</li>
          <li>Use photos you own or have permission to use. New products go live straight away; set <code>is_active</code> to false to keep one hidden.</li>
        </ul>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-navy-200 p-5 hover:border-gold-500">
          <FileUp className="size-6 text-gold-600" />
          <span className="text-sm">{file ? <><strong>{file}</strong> · {rows.length} rows</> : 'Choose a CSV file (Excel: File → Save as → CSV UTF-8)'}</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
        </label>
        {err && <Alert tone="error">{err}</Alert>}
        <div className="flex gap-2">
          <Button variant="outline" disabled={!rows.length} loading={busy} onClick={() => run(true)}>Check file</Button>
          <Button disabled={!rows.length || !result?.dry_run || result.errors.length > 0} loading={busy} onClick={() => run(false)}>Import now</Button>
        </div>
        {result && (
          <div className="space-y-3">
            <Alert tone={result.errors.length ? 'error' : 'success'} title={result.dry_run ? 'Check result (nothing saved yet)' : 'Imported'}>
              {result.new_products} new products, {result.new_variants} new variants, {result.updated_variants} updated variants.
              {result.errors.length ? ` ${result.errors.length} rows need fixing; nothing will be imported until they are fixed.` : ''}
            </Alert>
            {result.errors.length > 0 && (
              <Table head={['Row', 'Problem']}>
                {result.errors.slice(0, 200).map((e) => <tr key={e.row}><Td>{e.row + 1}</Td><Td>{e.error}</Td></tr>)}
              </Table>
            )}
          </div>
        )}
      </div>
      {hasRole('super_admin') && (
        <div className="card mt-6 space-y-3 p-5">
          <h2 className="font-semibold text-navy-900">Demo products</h2>
          <p className="text-sm text-navy-700">The store came with about 1,150 sample products (tagged “demo”) for testing. Remove them before launch.</p>
          {demo && <Alert tone="info">{demo}</Alert>}
          <Button variant="danger" size="sm" onClick={removeDemo}><Trash2 className="size-4" /> Remove demo products</Button>
        </div>
      )}
    </>
  )
}
