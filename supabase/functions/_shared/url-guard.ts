// Server-Side Request Forgery (SSRF) guard for functions that download a URL given by a user
// (for example supplier photo links from the CSV import). Pure functions, no Deno APIs, so they
// can be unit tested with Vitest. A URL is only fetched when it is a public https address.

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.corp', '.intranet', '.arpa']

/** True for IPv4 addresses that are not on the public internet (loopback, private, link-local, ...). */
export function isPrivateIPv4(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return false
  const [a, b, c] = m.slice(1, 4).map(Number)
  return a === 0 || a === 10 || a === 127 || a >= 224 ||               // this-net, private, loopback, multicast/reserved
    (a === 100 && b >= 64 && b <= 127) ||                                // carrier-grade NAT
    (a === 169 && b === 254) ||                                          // link-local, cloud metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||     // private
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||                    // IETF, TEST-NET-1
    (a === 198 && (b === 18 || b === 19)) ||                             // benchmarking
    (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) // TEST-NET-2/3
}

/** True for IPv6 addresses that are not global unicast (loopback, ULA, link-local, mapped IPv4, ...). */
export function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (!v.includes(':')) return false
  if (v === '::' || v === '::1') return true
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v)
  if (mapped) return isPrivateIPv4(mapped[1])
  if (v.startsWith('::ffff:') || v.startsWith('64:ff9b:')) return true // mapped / NAT64 in hex form
  return /^(fc|fd|fe[89ab]|ff)/.test(v) || v.startsWith('2001:db8') || v.startsWith('100:')
}

export const isPrivateIp = (ip: string) => isPrivateIPv4(ip) || isPrivateIPv6(ip)

/**
 * Checks that `raw` is safe to download: https, default port, no credentials, a public host name
 * (not an IP address, not an internal name) and, when `allowHosts` is given, a listed domain.
 * Returns the parsed URL or throws an Error with a short reason.
 */
export function assertPublicHttpsUrl(raw: string, allowHosts: string[] = []): URL {
  let u: URL
  try { u = new URL(raw) } catch { throw new Error('not a valid link') }
  if (u.protocol !== 'https:') throw new Error('only https:// links are allowed')
  if (u.username || u.password) throw new Error('links with a user name or password are not allowed')
  if (u.port && u.port !== '443') throw new Error('links must use the standard https port')
  const host = u.hostname.toLowerCase().replace(/\.$/, '')
  // The URL parser turns 0x7f.1, 2130706433 etc. into dotted IPv4, so one check covers them all.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[') || host.includes(':')) throw new Error('links to an IP address are not allowed')
  if (!host.includes('.') || host === 'localhost' || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) throw new Error('links to internal servers are not allowed')
  if (allowHosts.length && !allowHosts.some((d) => host === d || host.endsWith(`.${d}`))) throw new Error(`downloads from ${host} are not allowed`)
  return u
}

/** Parses a comma-separated allow-list such as "ourshopee.com, cdn.example.com". */
export const parseHostList = (v: string | undefined | null) =>
  (v ?? '').split(',').map((s) => s.trim().toLowerCase().replace(/^\*\./, '')).filter(Boolean)
