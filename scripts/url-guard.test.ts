import { describe, expect, it } from 'vitest'
import { assertPublicHttpsUrl, isPrivateIp, parseHostList } from '../supabase/functions/_shared/url-guard'

describe('SSRF guard for image downloads', () => {
  it('accepts a normal supplier CDN link', () => {
    expect(assertPublicHttpsUrl('https://cdn.ourshopee.com/images/a.jpg').hostname).toBe('cdn.ourshopee.com')
  })

  it.each([
    ['http://cdn.ourshopee.com/a.jpg', 'https'],
    ['file:///etc/passwd', 'https'],
    ['https://127.0.0.1/a.jpg', 'IP address'],
    ['https://2130706433/a.jpg', 'IP address'],          // decimal form of 127.0.0.1
    ['https://0x7f.0.0.1/a.jpg', 'IP address'],          // hex form
    ['https://169.254.169.254/latest/meta-data', 'IP address'],
    ['https://[::1]/a.jpg', 'IP address'],
    ['https://localhost/a.jpg', 'internal'],
    ['https://db.internal/a.jpg', 'internal'],
    ['https://intranet/a.jpg', 'internal'],
    ['https://user:pass@cdn.ourshopee.com/a.jpg', 'user name'],
    ['https://cdn.ourshopee.com:8443/a.jpg', 'port'],
    ['not a url', 'valid'],
  ])('refuses %s', (url, reason) => {
    expect(() => assertPublicHttpsUrl(url)).toThrow(new RegExp(reason, 'i'))
  })

  it('applies the optional host allow-list, including sub-domains', () => {
    const allow = parseHostList(' ourshopee.com, *.example.org ')
    expect(allow).toEqual(['ourshopee.com', 'example.org'])
    expect(() => assertPublicHttpsUrl('https://cdn.ourshopee.com/a.jpg', allow)).not.toThrow()
    expect(() => assertPublicHttpsUrl('https://evil-ourshopee.com/a.jpg', allow)).toThrow(/not allowed/)
  })

  it('classifies private and public IP addresses (used for the DNS check)', () => {
    for (const ip of ['10.1.2.3', '172.16.0.1', '192.168.1.1', '127.0.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
      expect(isPrivateIp(ip), ip).toBe(true)
    }
    for (const ip of ['8.8.8.8', '104.18.20.1', '2606:4700::1111']) expect(isPrivateIp(ip), ip).toBe(false)
  })
})
