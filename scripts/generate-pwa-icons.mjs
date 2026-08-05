#!/usr/bin/env node
/**
 * Generates favicons + PWA/app icons from public/logo.svg (single brand source).
 * Run: npm run generate:pwa-icons
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const logoPath = path.join(root, 'public/logo.svg')
const publicDir = path.join(root, 'public')
const iconsDir = path.join(publicDir, 'icons')

const BRAND_PURPLE = '#22124c'
const BRAND_GOLD = '#d4a62e'

/** Logo artwork paths (viewBox 0 0 1203 944) — gold fill for dark purple chrome. */
const LOGO_PATHS = `
  <path fill="${BRAND_GOLD}" d="M1182.03,910.58c.42,3.36-3.62,1.33-5.49.99-66.91-12.43-135.33-28.45-201.86-43.35-124.34-27.85-248.14-58.46-372.28-87.15-144.62,33.33-288.76,69.06-433.58,101.58-49.02,11.01-98.48,22.39-147.88,30.63,189.94-83.45,385.2-154.44,581.46-221.87,195.01,68.26,389.61,138.1,579.63,219.18Z"/>
  <path fill="${BRAND_GOLD}" d="M839.49,380.5l-237.08-246.97-437.2,469.65c-2.79,2.48-1.76-1.83-1.81-3.6-.22-7.77-1.44-17.62,2.78-24.29,88-111.51,175.08-223.77,264.1-334.47,53.06-65.98,110.62-144.74,167.68-205.62,1.09-1.16,1.65-2.88,1.78-4.46l4.52,1.75,235.24,289.41v58.6Z"/>
  <path fill="${BRAND_GOLD}" d="M1026.97,638.31l-424.57-367.77-439.02,383.09.38-21.26c89.79-95.06,184.87-185.62,278.23-277.07,52.86-51.77,104.69-104.55,158.86-154.97,1.52-.26,9.58,6.34,11.49,7.96,52.06,44.21,106.31,99.09,155.98,146.92,87.55,84.3,172.59,171.22,256.97,258.67l1.69,24.44Z"/>
  <path fill="${BRAND_GOLD}" d="M1026.98,690.59l-424.58-295.65-439.02,309.18.04-19.79,2.61-4.6,436.37-347.3c142.32,108.81,282.42,220.53,421.95,332.88,5.31,5.99,1.61,17.53,2.64,25.29Z"/>
  <polygon fill="${BRAND_GOLD}" points="1026.7 766.61 1026.1 789.75 602.4 625.93 163.41 795.17 165.18 774.42 602.4 564.53 1026.7 766.61"/>
  <path fill="${BRAND_GOLD}" d="M1026.62,718l-.51,23.07-423.69-232.45-439,243.28,1.8-22.52,437.21-278.45c143.29,85.96,282.81,178.08,424.2,267.07Z"/>
  <polygon fill="${BRAND_GOLD}" points="862.93 241.67 977.38 358.89 978.4 514.73 1024.26 571.64 1025.17 587.83 862.93 406.64 862.93 241.67"/>
`

function appIconSvg(size, { rounded = true, maskable = false } = {}) {
  const pad = maskable ? 0.18 : 0.14
  const content = size * (1 - pad * 2)
  const x = (size - content) / 2
  const y = (size - content) / 2
  // Logo is wider than tall (1203×944); fit width and center vertically.
  const scale = content / 1203
  const logoH = 944 * scale
  const ty = y + (content - logoH) / 2
  const radius = rounded && !maskable ? Math.round(size * 0.2) : 0

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}"${radius ? ` rx="${radius}"` : ''} fill="${BRAND_PURPLE}"/>
  <g transform="translate(${x} ${ty}) scale(${scale})">${LOGO_PATHS}</g>
</svg>`
}

async function writePngFromSvg(file, svg) {
  await sharp(Buffer.from(svg)).png().toFile(file)
  console.log(`Wrote ${file}`)
}

async function writeFaviconSvg() {
  const svg = appIconSvg(180, { rounded: true })
  const file = path.join(publicDir, 'icon.svg')
  await writeFile(file, svg, 'utf8')
  console.log(`Wrote ${file}`)
}

async function writePlaceholderLogoSvg() {
  // Transparent wordmark-adjacent mark for light surfaces — use brand purple logo as-is.
  const source = await readFile(logoPath, 'utf8')
  const file = path.join(publicDir, 'placeholder-logo.svg')
  await writeFile(file, source, 'utf8')
  console.log(`Wrote ${file}`)
}

await mkdir(iconsDir, { recursive: true })

// Ensure source logo exists
await readFile(logoPath)

await writeFaviconSvg()
await writePlaceholderLogoSvg()

await writePngFromSvg(path.join(iconsDir, 'icon-192.png'), appIconSvg(192))
await writePngFromSvg(path.join(iconsDir, 'icon-512.png'), appIconSvg(512))
await writePngFromSvg(
  path.join(iconsDir, 'icon-512-maskable.png'),
  appIconSvg(512, { maskable: true, rounded: false }),
)
await writePngFromSvg(path.join(iconsDir, 'apple-touch-icon.png'), appIconSvg(180))

await writePngFromSvg(path.join(publicDir, 'apple-icon.png'), appIconSvg(180))
await writePngFromSvg(path.join(publicDir, 'icon-dark-32x32.png'), appIconSvg(32, { rounded: true }))
await writePngFromSvg(path.join(publicDir, 'icon-light-32x32.png'), appIconSvg(32, { rounded: true }))
await writePngFromSvg(path.join(publicDir, 'placeholder-logo.png'), appIconSvg(512))

// Source PNG for Tauri / Electron icon tooling (1024, no rounded corners for better platform masks)
const desktopSource = path.join(publicDir, 'icons', 'icon-1024.png')
await writePngFromSvg(desktopSource, appIconSvg(1024, { rounded: false, maskable: false }))

console.log('Brand icons ready from public/logo.svg')
