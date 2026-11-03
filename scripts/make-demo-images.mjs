// Generates the elegant line-art placeholder images used by the local demo catalogue
// (supabase/seed.sql). Real product photos replace these via the admin panel.
import { writeFileSync, mkdirSync } from 'node:fs'

const out = new URL('../public/demo/', import.meta.url).pathname
mkdirSync(out, { recursive: true })

const art = {
  earbuds: '<rect x="-70" y="-10" width="140" height="80" rx="40"/><path d="M-70 26 H70"/><circle cx="-30" cy="-40" r="22"/><path d="M-30 -18 V10"/><circle cx="30" cy="-40" r="22"/><path d="M30 -18 V10"/>',
  camera: '<rect x="-90" y="-50" width="180" height="120" rx="14"/><path d="M-40 -50 L-28 -74 H28 L40 -50"/><circle cx="0" cy="10" r="40"/><circle cx="0" cy="10" r="24"/><circle cx="64" cy="-30" r="5"/>',
  backpack: '<path d="M-60 -40 a60 60 0 0 1 120 0 V90 H-60 Z"/><path d="M-26 -84 a26 20 0 0 1 52 0"/><rect x="-40" y="20" width="80" height="50" rx="8"/><path d="M-40 40 H40"/>',
  perfume: '<rect x="-50" y="-30" width="100" height="120" rx="16"/><rect x="-18" y="-62" width="36" height="32" rx="4"/><rect x="-28" y="-80" width="56" height="18" rx="4"/><path d="M-30 20 H30"/>',
  sandal: '<path d="M-96 50 C-96 20 -60 10 0 10 C60 10 96 20 96 50 V62 H-96 Z"/><path d="M-40 10 C-30 -40 30 -40 40 10"/><path d="M-70 14 C-60 -14 -40 -20 -30 -10"/>',
  jewellery: '<path d="M-80 -60 C-80 40 80 40 80 -60"/><circle cx="0" cy="38" r="18"/><path d="M0 56 L-10 76 H10 Z"/><circle cx="-50" cy="8" r="5"/><circle cx="50" cy="8" r="5"/><circle cx="-26" cy="26" r="5"/><circle cx="26" cy="26" r="5"/>',
  belt: '<rect x="-100" y="-14" width="200" height="28" rx="6"/><rect x="-30" y="-26" width="44" height="52" rx="6"/><path d="M-8 -26 V26"/><circle cx="50" cy="0" r="3"/><circle cx="70" cy="0" r="3"/>',
  cushion: '<path d="M-80 -70 Q0 -50 80 -70 Q60 0 80 70 Q0 50 -80 70 Q-60 0 -80 -70 Z"/><circle cx="0" cy="0" r="22"/><path d="M-22 0 H22 M0 -22 V22"/>',
  mug: '<path d="M-56 -60 H40 V50 a20 20 0 0 1 -20 20 H-36 a20 20 0 0 1 -20 -20 Z"/><path d="M40 -30 a28 28 0 0 1 0 56"/><path d="M-30 -86 c10 10 -10 16 0 26 M0 -86 c10 10 -10 16 0 26"/>',
  kurta: '<path d="M-26 -90 L-66 -70 L-80 -10 L-60 -4 L-52 -40 L-54 92 H54 L52 -40 L60 -4 L80 -10 L66 -70 L26 -90 L0 -66 Z"/><path d="M0 -66 V-20"/><circle cx="0" cy="-54" r="2.5"/><circle cx="0" cy="-40" r="2.5"/><path d="M-54 80 H54"/>',
  phone: '<rect x="-46" y="-86" width="92" height="172" rx="16"/><rect x="-36" y="-70" width="72" height="128" rx="4"/><circle cx="0" cy="72" r="5"/><rect x="-14" y="-80" width="28" height="4" rx="2"/>',
  laptop: '<rect x="-80" y="-56" width="160" height="100" rx="8"/><rect x="-70" y="-46" width="140" height="80" rx="3"/><path d="M-104 52 H104 L94 66 H-94 Z"/>',
  headphones: '<path d="M-60 30 V-6 a60 60 0 0 1 120 0 V30"/><rect x="-74" y="14" width="26" height="54" rx="10"/><rect x="48" y="14" width="26" height="54" rx="10"/>',
  watch: '<rect x="-24" y="-96" width="48" height="44" rx="6"/><rect x="-24" y="52" width="48" height="44" rx="6"/><circle cx="0" cy="0" r="54"/><circle cx="0" cy="0" r="44"/><path d="M0 0 V-30 M0 0 L22 12"/><circle cx="0" cy="0" r="3"/>',
  saree: '<path d="M-60 -90 C-20 -60 20 -60 60 -90 L70 90 H-70 Z"/><path d="M-62 40 H66 M-64 58 H68"/><path d="M60 -90 C20 -20 -40 20 -66 80"/>',
  kurti: '<path d="M-30 -90 L-70 -66 L-84 -16 L-62 -8 L-54 -40 L-58 90 H58 L54 -40 L62 -8 L84 -16 L70 -66 L30 -90 C20 -70 -20 -70 -30 -90 Z"/><path d="M0 -76 V-30"/><path d="M-56 70 H56"/>',
  shirt: '<path d="M-28 -88 L-76 -66 L-92 -24 L-66 -14 L-58 -44 L-58 90 H58 L58 -44 L66 -14 L92 -24 L76 -66 L28 -88 L0 -60 Z"/><path d="M0 -60 V90"/><circle cx="0" cy="-30" r="2.5"/><circle cx="0" cy="0" r="2.5"/><circle cx="0" cy="30" r="2.5"/>',
  dress: '<path d="M-22 -92 L-30 -40 L-78 90 H78 L30 -40 L22 -92"/><path d="M-30 -40 H30"/><path d="M-22 -92 C-8 -80 8 -80 22 -92"/>',
  shoe: '<path d="M-96 40 C-96 0 -70 -10 -50 -20 L-30 -56 C-10 -40 10 -30 40 -26 C70 -22 96 0 96 30 V48 H-96 Z"/><path d="M-96 34 H96"/><path d="M-24 -40 l14 10 M-14 -46 l14 10 M-4 -50 l14 10"/>',
  handbag: '<path d="M-82 -20 H82 L70 86 H-70 Z"/><path d="M-40 -20 V-46 a40 40 0 0 1 80 0 V-20"/><rect x="-14" y="10" width="28" height="18" rx="3"/>',
  sunglasses: '<circle cx="-46" cy="6" r="34"/><circle cx="46" cy="6" r="34"/><path d="M-12 0 C-4 -10 4 -10 12 0"/><path d="M-80 -6 L-104 -24 M80 -6 L104 -24"/>',
  lamp: '<path d="M-56 -20 L-30 -86 H30 L56 -20 Z"/><path d="M0 -20 V70"/><path d="M-44 86 C-44 66 44 66 44 86 Z"/>',
  tablet: '<rect x="-66" y="-88" width="132" height="176" rx="14"/><rect x="-56" y="-76" width="112" height="146" rx="3"/><circle cx="0" cy="80" r="4"/>',
  speaker: '<rect x="-54" y="-88" width="108" height="176" rx="18"/><circle cx="0" cy="26" r="36"/><circle cx="0" cy="26" r="12"/><circle cx="0" cy="-50" r="14"/>',
}

const colours = {
  black: '#1D1D1F', white: '#F4F1EA', navy: '#1A3468', gold: '#C29A3B', crimson: '#9B1C31', emerald: '#1F6F50',
  rose: '#C98A95', sky: '#7AA7CF', silver: '#B8BCC4', cognac: '#8A5A2B', purple: '#5B3A7A', mustard: '#C9A227',
}
const darkBgs = new Set(['white', 'silver', 'gold', 'mustard', 'sky', 'rose'])

let n = 0
for (const [name, shapes] of Object.entries(art)) {
  for (const [colour, hex] of Object.entries(colours)) {
    const dark = darkBgs.has(colour)
    const [a, b] = dark ? ['#050C1F', '#1A3468'] : ['#F6F1E6', '#FFFFFF']
    const ink = dark ? '#E7CD84' : '#A07B26'
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
<defs><radialGradient id="g" cx="50%" cy="38%" r="78%"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></radialGradient>
<linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<rect width="600" height="600" fill="url(#g)"/>
<ellipse cx="300" cy="470" rx="170" ry="22" fill="#000" opacity="${dark ? 0.35 : 0.08}"/>
<g transform="translate(300 290) scale(1.85)" stroke-linecap="round" stroke-linejoin="round">
<g fill="${hex}" stroke="${ink}" stroke-width="2.4">${shapes}</g>
<g fill="url(#s)" stroke="none">${shapes}</g>
</g>
</svg>`
    writeFileSync(`${out}${name}-${colour}.svg`, svg)
    n++
  }
}
console.log(`wrote ${n} images to public/demo/`)
