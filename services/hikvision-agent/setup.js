#!/usr/bin/env node
/**
 * Interactive one-time setup for the apartment PC.
 * Usage: node setup.js
 * Or paste a full .env from Owner → Access → Start setup, then only edit DEVICES.
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env')

function ask(rl, question, fallback = '') {
  const hint = fallback ? ` [${fallback}]` : ''
  return new Promise((resolveAsk) => {
    rl.question(`${question}${hint}: `, (answer) => {
      resolveAsk(answer.trim() || fallback)
    })
  })
}

async function main() {
  console.log('\nMOJO Hikvision agent setup\n')
  console.log('Tip: On Owner → Access, click "Start setup" and paste the env block here')
  console.log('     if prompted — or answer the questions below.\n')

  if (existsSync(envPath)) {
    console.log(`Existing .env found at ${envPath}`)
    console.log('This will overwrite it.\n')
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const paste = await ask(
    rl,
    'Paste full .env from MOJO now? (y/N)',
    'N',
  )

  if (paste.toLowerCase() === 'y' || paste.toLowerCase() === 'yes') {
    console.log('\nPaste the .env contents, then press Enter on an empty line:\n')
    const lines = []
    for await (const line of rl) {
      if (line === '') break
      lines.push(line)
    }
    const text = lines.join('\n').trim() + '\n'
    writeFileSync(envPath, text, 'utf8')
    console.log(`\nWrote ${envPath}`)
    console.log('Edit DEVICES host/password if needed, then run: npm start\n')
    rl.close()
    return
  }

  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
  const pick = (key, fallback) => {
    const m = existing.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return m?.[1]?.trim() || fallback
  }

  const mojoUrl = await ask(rl, 'MOJO website URL', pick('MOJO_API_URL', 'https://your-app.vercel.app'))
  const hotelId = await ask(rl, 'Hotel ID (UUID from Access page)', pick('HOTEL_ID', ''))
  const token = await ask(rl, 'Agent token', pick('AGENT_TOKEN', ''))
  const host = await ask(rl, 'Hikvision controller IP', '192.168.1.64')
  const username = await ask(rl, 'Hikvision username', 'admin')
  const password = await ask(rl, 'Hikvision password', '')
  const key = await ask(rl, 'Device key (use same name in MOJO door maps)', 'lobby')

  rl.close()

  if (!hotelId || !token || !password) {
    console.error('\nHotel ID, agent token, and controller password are required.')
    process.exit(1)
  }

  const devices = JSON.stringify([
    {
      key,
      host,
      port: 80,
      username,
      password,
      useHttps: false,
    },
  ])

  const env = [
    `MOJO_API_URL=${mojoUrl.replace(/\/$/, '')}`,
    `HOTEL_ID=${hotelId}`,
    `AGENT_TOKEN=${token}`,
    `AGENT_ID=mojo-apartment-pc`,
    `DEVICES=${devices}`,
    '',
  ].join('\n')

  writeFileSync(envPath, env, 'utf8')
  console.log(`\nWrote ${envPath}`)
  console.log('Next: npm install && npm start')
  console.log('Then in MOJO → Access, map doors using device key:', key, '\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
