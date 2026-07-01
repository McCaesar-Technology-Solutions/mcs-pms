#!/usr/bin/env node
/**
 * Generates PNG icons required for browser PWA install (192 + 512).
 * Run: npm run generate:pwa-icons
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../public/icons')

const BRAND_PURPLE = '#22124c'
const BRAND_GOLD = '#d4a62e'

function iconSvg(size) {
  const fontSize = Math.round(size * 0.38)
  const y = Math.round(size * 0.58)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="${BRAND_PURPLE}"/>
  <text x="50%" y="${y}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="${fontSize}" fill="${BRAND_GOLD}">M</text>
</svg>`
}

function maskableSvg(size) {
  const inset = Math.round(size * 0.1)
  const inner = size - inset * 2
  const fontSize = Math.round(inner * 0.42)
  const y = inset + Math.round(inner * 0.62)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BRAND_PURPLE}"/>
  <text x="50%" y="${y}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="${fontSize}" fill="${BRAND_GOLD}">M</text>
</svg>`
}

async function writePng(name, svg) {
  const file = path.join(outDir, name)
  await sharp(Buffer.from(svg)).png().toFile(file)
  console.log(`Wrote ${file}`)
}

await mkdir(outDir, { recursive: true })
await writePng('icon-192.png', iconSvg(192))
await writePng('icon-512.png', iconSvg(512))
await writePng('icon-512-maskable.png', maskableSvg(512))

// Apple touch icon (180×180)
await writePng('apple-touch-icon.png', iconSvg(180))
console.log('PWA icons ready.')
