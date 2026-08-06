#!/usr/bin/env node
/**
 * Copy latest MOJO Access Agent installers into public/downloads/access-agent/
 * with stable filenames for in-app download buttons.
 *
 * Usage (from repo root):
 *   node scripts/publish-access-agent.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'services/access-agent-app/dist')
const outDir = join(root, 'public/downloads/access-agent')

if (!existsSync(dist)) {
  console.error('No dist folder. Build first: npm run access-agent:dist:mac (and/or :win)')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

const files = readdirSync(dist)

function versionOf(name) {
  const m = name.match(/(\d+\.\d+\.\d+)/)
  if (!m) return [0, 0, 0]
  return m[1].split('.').map((n) => Number(n) || 0)
}

function cmpVersion(a, b) {
  const va = versionOf(a)
  const vb = versionOf(b)
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] - vb[i]
  }
  return 0
}

function latestMatching(re) {
  const hits = files.filter((f) => re.test(f)).sort(cmpVersion)
  return hits.at(-1) ?? null
}

const map = [
  {
    src: latestMatching(/^MOJO Access Agent-.*-arm64\.dmg$/),
    dest: 'MOJO-Access-Agent-mac.dmg',
  },
  {
    src: latestMatching(/^MOJO Access Agent-.*-arm64-mac\.zip$/),
    dest: 'MOJO-Access-Agent-mac.zip',
  },
  {
    src: latestMatching(/^MOJO Access Agent Setup .*\.exe$/),
    dest: 'MOJO-Access-Agent-windows-setup.exe',
  },
  {
    src: latestMatching(/^MOJO Access Agent \d.*\.exe$/),
    dest: 'MOJO-Access-Agent-windows.exe',
  },
]

let copied = 0
for (const { src, dest } of map) {
  if (!src) {
    console.warn(`Skip ${dest} (no matching build in dist/)`)
    continue
  }
  copyFileSync(join(dist, src), join(outDir, dest))
  console.log(`Copied ${src} → ${dest}`)
  copied += 1
}

if (!copied) {
  console.error('Nothing copied.')
  process.exit(1)
}
console.log(`Done. ${copied} file(s) in public/downloads/access-agent/`)
