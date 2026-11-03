// Fails the build if dist/ contains anything that looks like a server secret,
// or if files that Netlify drag-and-drop needs are missing.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname
const required = ['index.html', '_redirects', '_headers']
const patterns = [
  [/sk_(live|test)_[A-Za-z0-9]{8,}/, 'Stripe secret key'],
  [/rk_(live|test)_[A-Za-z0-9]{8,}/, 'Stripe restricted key'],
  [/whsec_[A-Za-z0-9]{8,}/, 'Stripe webhook secret'],
  [/sb_secret_[A-Za-z0-9_-]{8,}/, 'Supabase secret key'],
  [/"role"\s*:\s*"service_role"/, 'Supabase service_role payload'],
]

const problems = []
for (const f of required) if (!existsSync(join(dist, f))) problems.push(`missing dist/${f}`)

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { walk(p); continue }
    if (!/\.(js|html|css|json|txt|map|webmanifest)$/.test(name) && !name.startsWith('_')) continue
    const text = readFileSync(p, 'utf8')
    for (const [re, label] of patterns) if (re.test(text)) problems.push(`${label} found in ${p.replace(dist, 'dist/')}`)
    // A JWT whose payload decodes to service_role
    for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
      try {
        const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString())
        if (payload.role === 'service_role') problems.push(`Supabase service_role key found in ${p.replace(dist, 'dist/')}`)
      } catch { /* not a JWT */ }
    }
  }
}
walk(dist)

if (problems.length) {
  console.error('dist/ verification FAILED:\n - ' + problems.join('\n - '))
  process.exit(1)
}
console.log('dist/ verified: no secrets found, Netlify files present.')
