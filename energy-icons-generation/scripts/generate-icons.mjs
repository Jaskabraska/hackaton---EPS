import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

const OUT_DIR = "/vercel/share/v0-project/public/icons"

// ---- Resource definitions ---------------------------------------------------
// Each glyph is authored in a 24x24 box, drawn in white, then scaled/placed.

const G = {
  solar: `
    <circle cx="12" cy="12" r="4.4" fill="#fff"/>
    <g stroke="#fff" stroke-width="2" stroke-linecap="round">
      <line x1="12" y1="1.6" x2="12" y2="4"/>
      <line x1="12" y1="20" x2="12" y2="22.4"/>
      <line x1="1.6" y1="12" x2="4" y2="12"/>
      <line x1="20" y1="12" x2="22.4" y2="12"/>
      <line x1="4.4" y1="4.4" x2="6.1" y2="6.1"/>
      <line x1="17.9" y1="17.9" x2="19.6" y2="19.6"/>
      <line x1="19.6" y1="4.4" x2="17.9" y2="6.1"/>
      <line x1="4.4" y1="19.6" x2="6.1" y2="17.9"/>
    </g>`,

  wind: `
    <g fill="#fff">
      <path d="M11.3 11.6 L10.6 21.4 L13.4 21.4 L12.7 11.6 Z"/>
      <g transform="rotate(0 12 11.6)"><path d="M12 11.6 C 11.2 7.6, 11.2 5, 12 2.7 C 12.8 5, 12.8 7.6, 12 11.6 Z"/></g>
      <g transform="rotate(120 12 11.6)"><path d="M12 11.6 C 11.2 7.6, 11.2 5, 12 2.7 C 12.8 5, 12.8 7.6, 12 11.6 Z"/></g>
      <g transform="rotate(240 12 11.6)"><path d="M12 11.6 C 11.2 7.6, 11.2 5, 12 2.7 C 12.8 5, 12.8 7.6, 12 11.6 Z"/></g>
      <circle cx="12" cy="11.6" r="1.5"/>
    </g>`,

  hydro: `
    <path d="M12 2.5 C 8 8.5, 5.5 12, 5.5 15.5 a6.5 6.5 0 0 0 13 0 C 18.5 12, 16 8.5, 12 2.5 Z" fill="#fff"/>`,

  biomass: `
    <path d="M4.5 19.5 C 4.5 11, 10.5 4.5, 19.5 4.5 C 19.5 13, 13 19.5, 4.5 19.5 Z" fill="#fff"/>`,

  geothermal: `
    <path d="M3.5 21 A 8.5 8.5 0 0 1 20.5 21 Z" fill="#fff"/>
    <g stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round">
      <path d="M8 9.5 C 9.5 8, 6.5 6.5, 8 4.5"/>
      <path d="M12 9 C 13.5 7.5, 10.5 6, 12 4"/>
      <path d="M16 9.5 C 17.5 8, 14.5 6.5, 16 4.5"/>
    </g>`,

  combustion_gas: `
    <path d="M12 2.5 C 15 6.5, 17 8.5, 17 13 a5 5 0 0 1 -10 0 c0 -2.2 1 -3.8 2.4 -5 c-0.2 2 0.6 3.2 1.6 3.6 c1.4 -2.4 -1.2 -5.6 -1 -9.1 Z" fill="#fff"/>`,

  combined_cycle_gas: `
    <g fill="#fff">
      <path d="M10.3 3 C 12.8 6.5, 14.3 8.2, 14.3 12 a4 4 0 0 1 -8 0 c0 -1.8 0.8 -3 2 -4 c-0.2 1.6 0.5 2.6 1.3 2.9 c1.1 -2 -0.9 -4.5 -0.8 -7.9 Z"/>
      <path d="M17 9 C 18.3 10.8, 19 11.7, 19 13.5 a2 2 0 0 1 -4 0 c0 -0.9 0.4 -1.5 1 -2 c-0.1 0.8 0.3 1.3 0.7 1.4 c0.55 -1 -0.4 -2.3 -0.4 -3.9 Z"/>
    </g>`,

  steam_gas: `
    <path d="M12 10.5 C 13.8 13, 14.7 14, 14.7 16 a2.7 2.7 0 0 1 -5.4 0 c0 -1.2 0.5 -2 1.3 -2.7 c-0.1 1.1 0.4 1.7 0.9 1.9 c0.7 -1.3 -0.6 -2.9 -0.5 -4.7 Z" fill="#fff"/>
    <g stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round">
      <path d="M8.5 8 C 10 6.5, 7 5, 8.5 3"/>
      <path d="M15.5 8 C 17 6.5, 14 5, 15.5 3"/>
    </g>`,

  internal_combustion_gas: `
    <g fill="#fff">
      <rect x="8.5" y="3" width="7" height="6" rx="1"/>
      <rect x="10.8" y="9" width="2.4" height="4.5"/>
      <circle cx="12" cy="17.5" r="1.3"/>
    </g>
    <circle cx="12" cy="17.5" r="4" fill="none" stroke="#fff" stroke-width="2"/>`,

  combustion_oil: `
    <g fill="#fff">
      <path d="M12 9.5 C 9.6 12.8, 8.2 14.7, 8.2 16.6 a3.8 3.8 0 0 0 7.6 0 C 15.8 14.7, 14.4 12.8, 12 9.5 Z"/>
      <path d="M12 2.5 C 13.2 4.6, 14 5.6, 14 7.1 a2 2 0 0 1 -4 0 c0 -0.9 0.4 -1.5 1 -2 c-0.1 0.8 0.3 1.2 0.6 1.4 c0.55 -1 -0.5 -2.3 -0.6 -4 Z"/>
    </g>`,

  steam_coal: `
    <g fill="#fff">
      <path d="M3.5 16.5 L7 11 L12 12.5 L13 17.5 L8.5 20.5 Z"/>
      <path d="M12 9 L16.5 8 L20.5 12 L19.5 17.5 L13.5 17.5 L12.5 12 Z"/>
    </g>`,

  steam_other: `
    <path d="M4 20.5 L4 13 L9 15 L9 13 L14 15 L14 8.5 L20 8.5 L20 20.5 Z" fill="#fff"/>
    <g stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round">
      <path d="M17 6.5 C 18.5 5, 15.5 3.5, 17 2"/>
    </g>`,
}

const COLOR = {
  solar: "#f59e0b",
  wind: "#0ea5e9",
  hydro: "#2563eb",
  biomass: "#16a34a",
  geothermal: "#dc2626",
  combustion_gas: "#f97316",
  combined_cycle_gas: "#0d9488",
  steam_gas: "#0891b2",
  internal_combustion_gas: "#9a3412",
  combustion_oil: "#475569",
  steam_coal: "#1f2937",
  steam_other: "#64748b",
}

// ---- Geometry helpers -------------------------------------------------------
const SIZE = 100
const C = SIZE / 2 // center 50
const R = 50 // radius

const rad = (deg) => (deg * Math.PI) / 180
const ptOnCircle = (angleDeg, r = R) => [C + r * Math.cos(rad(angleDeg)), C + r * Math.sin(rad(angleDeg))]

function slicePath(startDeg, endDeg) {
  const [x1, y1] = ptOnCircle(startDeg)
  const [x2, y2] = ptOnCircle(endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M${C} ${C} L${x1.toFixed(3)} ${y1.toFixed(3)} A${R} ${R} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`
}

function placedGlyph(type, gx, gy, gsize) {
  const x = gx - gsize / 2
  const y = gy - gsize / 2
  return `<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${gsize}" height="${gsize}" viewBox="0 0 24 24">${G[type]}</svg>`
}

// glyph sizing/placement per slice count
const LAYOUT = {
  1: { gsize: 50, gr: 0 },
  2: { gsize: 30, gr: 21 },
  3: { gsize: 23, gr: 24 },
  4: { gsize: 20, gr: 26 },
  5: { gsize: 17, gr: 28 },
}

function buildIcon(types) {
  const n = types.length
  const layout = LAYOUT[n] || LAYOUT[5]
  let body = ""

  if (n === 1) {
    body += `<circle cx="${C}" cy="${C}" r="${R}" fill="${COLOR[types[0]]}"/>`
    body += placedGlyph(types[0], C, C, layout.gsize)
  } else {
    const step = 360 / n
    const start0 = -90 // start at top
    // colored slices
    for (let i = 0; i < n; i++) {
      const s = start0 + i * step
      const e = s + step
      body += `<path d="${slicePath(s, e)}" fill="${COLOR[types[i]]}"/>`
    }
    // white separators
    for (let i = 0; i < n; i++) {
      const s = start0 + i * step
      const [x, y] = ptOnCircle(s)
      body += `<line x1="${C}" y1="${C}" x2="${x.toFixed(3)}" y2="${y.toFixed(3)}" stroke="#fff" stroke-width="2"/>`
    }
    // glyphs centered in each slice
    for (let i = 0; i < n; i++) {
      const s = start0 + i * step
      const bis = s + step / 2
      const [gx, gy] = ptOnCircle(bis, layout.gr)
      body += placedGlyph(types[i], gx, gy, layout.gsize)
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="${types.join(", ")}">${body}</svg>`
}

// ---- What to generate -------------------------------------------------------
const TYPES = [
  "solar", "wind", "hydro", "biomass", "geothermal",
  "combined_cycle_gas", "combustion_gas", "internal_combustion_gas",
  "steam_gas", "combustion_oil", "steam_coal", "steam_other",
]

const COMBINATIONS = [
  ["combined_cycle_gas", "combustion_gas", "hydro", "internal_combustion_gas", "solar"],
  ["biomass", "combined_cycle_gas", "hydro", "internal_combustion_gas"],
  ["combined_cycle_gas", "combustion_gas", "solar", "wind"],
  ["combined_cycle_gas", "combustion_gas", "solar", "steam_coal"],
  ["combined_cycle_gas", "combustion_gas", "hydro"],
  ["combined_cycle_gas", "combustion_gas", "combustion_oil"],
  ["combined_cycle_gas", "combustion_gas", "steam_gas"],
  ["combined_cycle_gas", "hydro", "internal_combustion_gas"],
  ["combustion_gas", "geothermal", "solar"],
  ["steam_gas", "steam_other", "wind"],
  ["combined_cycle_gas", "combustion_gas"],
  ["solar", "steam_gas"],
  ["biomass", "combined_cycle_gas"],
  ["combined_cycle_gas", "hydro"],
  ["combustion_gas", "hydro"],
  ["hydro", "internal_combustion_gas"],
  ["hydro", "solar"],
  ["combustion_oil", "solar"],
]

mkdirSync(`${OUT_DIR}/types`, { recursive: true })
mkdirSync(`${OUT_DIR}/combinations`, { recursive: true })

const manifest = { types: [], combinations: [] }

for (const t of TYPES) {
  const file = `types/${t}.svg`
  writeFileSync(`${OUT_DIR}/${file}`, buildIcon([t]))
  manifest.types.push(file)
}

for (const combo of COMBINATIONS) {
  const name = combo.join("+")
  const file = `combinations/${name}.svg`
  const path = `${OUT_DIR}/${file}`
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, buildIcon(combo))
  manifest.combinations.push(file)
}

// gallery for visual verification
const card = (label, file) =>
  `<figure style="margin:0;text-align:center"><img src="/icons/${file}" width="84" height="84" alt="${label}"/><figcaption style="font:11px ui-monospace,monospace;color:#334155;margin-top:6px;word-break:break-word;max-width:110px">${label}</figcaption></figure>`

const html = `<!doctype html><meta charset="utf-8"><title>Energy icons</title>
<body style="font-family:ui-sans-serif,system-ui;background:#f8fafc;color:#0f172a;padding:32px">
<h1 style="font-size:18px">Resource types</h1>
<div style="display:flex;flex-wrap:wrap;gap:24px;align-items:start">
${TYPES.map((t) => card(t, `types/${t}.svg`)).join("")}
</div>
<h1 style="font-size:18px;margin-top:40px">Combinations (equal pie slices)</h1>
<div style="display:flex;flex-wrap:wrap;gap:24px;align-items:start">
${COMBINATIONS.map((c) => card(c.join(" + "), `combinations/${c.join("+")}.svg`)).join("")}
</div>
</body>`
writeFileSync(`${OUT_DIR}/index.html`, html)

console.log("[v0] generated", manifest.types.length, "types and", manifest.combinations.length, "combinations")
