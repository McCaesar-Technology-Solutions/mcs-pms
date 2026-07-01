#!/usr/bin/env node
/**
 * Injects the hosted PMS URL into tauri.conf.json before dev/build.
 *
 *   MOJO_APP_URL=https://mcs-pms.vercel.app node scripts/sync-app-url.mjs
 *   node scripts/sync-app-url.mjs --dev
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.join(__dirname, '../src-tauri/tauri.conf.json')
const isDev = process.argv.includes('--dev')

const base = (
  process.env.MOJO_APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  'https://mcs-pms.vercel.app'
)
  .trim()
  .replace(/\/$/, '')

const loginUrl = `${base}/login`
const config = JSON.parse(readFileSync(configPath, 'utf8'))

config.productName = 'MOJO Apartments'
config.identifier = 'com.mojoapartments.pms'
config.build.beforeDevCommand = 'node scripts/sync-app-url.mjs --dev'
config.build.beforeBuildCommand = 'node scripts/sync-app-url.mjs'
config.build.frontendDist = '../src'
config.build.devUrl = isDev
  ? process.env.MOJO_APP_URL
    ? loginUrl
    : 'http://127.0.0.1:3000/login'
  : config.build.devUrl ?? 'http://127.0.0.1:3000/login'

const mainWindow = config.app.windows[0] ?? {}
mainWindow.label = 'main'
mainWindow.title = 'MOJO Apartments'
mainWindow.width = 1366
mainWindow.height = 900
mainWindow.minWidth = 1024
mainWindow.minHeight = 700
mainWindow.center = true
mainWindow.resizable = true

if (isDev) {
  delete mainWindow.url
} else {
  mainWindow.url = loginUrl
}

config.app.windows[0] = mainWindow
config.app.withGlobalTauri = false
config.app.security = {
  csp: null,
  dangerousDisableAssetCspModification: true,
}

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
console.log(isDev ? `Dev URL: ${config.build.devUrl}` : `Production window URL: ${loginUrl}`)
