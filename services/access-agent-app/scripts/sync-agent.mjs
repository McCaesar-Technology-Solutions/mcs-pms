#!/usr/bin/env node
/** Keep packaged agent sources in sync with services/hikvision-agent/src */
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const src = join(root, '..', '..', 'hikvision-agent', 'src')
const dest = join(root, '..', 'agent')
mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })
console.log('Synced hikvision-agent/src → access-agent-app/agent')
