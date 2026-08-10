const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { spawn, execFileSync } = require('node:child_process')

/** @type {Electron.Tray | null} */
let tray = null
/** @type {Electron.BrowserWindow | null} */
let setupWindow = null
/** @type {Electron.BrowserWindow | null} */
let statusWindow = null
/** @type {{ stop: () => void } | null} */
let running = null
let lastStatus = { online: false, detail: 'Starting…', devices: [] }
const logs = []
let showedLocalNetworkHelp = false
let openedSetupForBadToken = false

function openLocalNetworkSettings() {
  if (process.platform !== 'darwin') return
  const urls = [
    'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_LocalNetwork',
    'x-apple.systempreferences:com.apple.preference.security?Privacy_LocalNetwork',
  ]
  for (const url of urls) {
    try {
      shell.openExternal(url)
      return
    } catch {
      // try next
    }
  }
}

function findSystemNode() {
  const candidates = [
    '/usr/local/bin/node',
    '/opt/homebrew/bin/node',
    process.env.NODE_BINARY,
  ].filter(Boolean)
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c
    } catch {
      // continue
    }
  }
  try {
    const out = execFileSync('/usr/bin/which', ['node'], { encoding: 'utf8' }).trim()
    if (out && fs.existsSync(out)) return out
  } catch {
    // none
  }
  return null
}

/** Prefer app.asar.unpacked paths so system Node can read agent sources. */
function resolveUnpacked(...parts) {
  const asarPath = path.join(__dirname, '..', ...parts)
  let unpacked = asarPath.replace(
    `${path.sep}app.asar${path.sep}`,
    `${path.sep}app.asar.unpacked${path.sep}`,
  )
  // path.join(..., '..') may end with ".../app.asar" (no trailing slash)
  if (unpacked.endsWith(`${path.sep}app.asar`)) {
    unpacked = `${unpacked.slice(0, -'app.asar'.length)}app.asar.unpacked`
  }
  if (unpacked !== asarPath && fs.existsSync(unpacked)) return unpacked
  return asarPath
}

function userDataEnvDir() {
  return app.getPath('userData')
}

function envPath() {
  return path.join(userDataEnvDir(), '.env')
}

function pushLog(level, message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`
  logs.push({ level, line })
  if (logs.length > 200) logs.shift()
  statusWindow?.webContents.send('logs', logs.slice(-50))
}

function trayIcon(online) {
  // 16x16 simple colored circle as PNG data URL → nativeImage
  const color = online ? '#16a34a' : '#ca8a04'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="12" fill="${color}"/></svg>`
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
  )
}

function rebuildTrayMenu() {
  if (!tray) return
  const template = [
    {
      label: lastStatus.online ? 'Status: Connected' : 'Status: Attention needed',
      enabled: false,
    },
    { label: lastStatus.detail.slice(0, 60) || '—', enabled: false },
    { type: 'separator' },
    {
      label: 'Open status',
      click: () => openStatusWindow(),
    },
    {
      label: 'Edit connection settings…',
      click: () => openSetupWindow({ force: true, reason: 'edit' }),
    },
    ...(process.platform === 'darwin'
      ? [
          {
            label: 'Open Local Network settings…',
            click: () => openLocalNetworkSettings(),
          },
        ]
      : []),
    {
      label: app.getLoginItemSettings().openAtLogin
        ? '✓ Start when I log in'
        : 'Start when I log in',
      click: () => {
        const next = !app.getLoginItemSettings().openAtLogin
        app.setLoginItemSettings({ openAtLogin: next, openAsHidden: true })
        rebuildTrayMenu()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit MOJO Access Agent',
      click: () => {
        running?.stop()
        app.quit()
      },
    },
  ]
  tray.setContextMenu(Menu.buildFromTemplate(template))
  tray.setToolTip(`MOJO Access Agent\n${lastStatus.detail}`)
  tray.setImage(trayIcon(lastStatus.online))
}

function openSetupWindow(opts = {}) {
  const force = opts === true || opts.force === true
  const reason = typeof opts === 'object' && opts.reason ? String(opts.reason) : force ? 'edit' : ''
  if (setupWindow) {
    setupWindow.focus()
    if (reason) {
      setupWindow.loadFile(path.join(__dirname, 'setup.html'), {
        query: { edit: '1', reason },
      })
    }
    return
  }
  setupWindow = new BrowserWindow({
    width: 560,
    height: 640,
    resizable: false,
    title: 'MOJO Access Agent setup',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  const query = {}
  if (force || reason) query.edit = '1'
  if (reason) query.reason = reason
  setupWindow.loadFile(path.join(__dirname, 'setup.html'), { query })
  setupWindow.on('closed', () => {
    setupWindow = null
  })
}

function noteMaybeInvalidAgentToken(message) {
  const text = String(message || '')
  if (!/401:\s*Invalid agent token/i.test(text) && !/Invalid agent token/i.test(text)) {
    return
  }
  lastStatus = {
    online: false,
    detail: 'Invalid agent token — paste a fresh config from Owner → Access → Start setup / Rotate token',
    devices: lastStatus.devices || [],
  }
  rebuildTrayMenu()
  statusWindow?.webContents.send('status', lastStatus)
  if (openedSetupForBadToken) return
  openedSetupForBadToken = true
  if (process.platform === 'darwin') app.dock?.show()
  openSetupWindow({ force: true, reason: 'token' })
}

function openStatusWindow() {
  if (statusWindow) {
    if (statusWindow.isMinimized()) statusWindow.restore()
    statusWindow.show()
    statusWindow.focus()
    statusWindow.webContents.send('status', lastStatus)
    statusWindow.webContents.send('logs', logs.slice(-50))
    return
  }
  statusWindow = new BrowserWindow({
    width: 480,
    height: 520,
    show: true,
    title: 'MOJO Access Agent',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  statusWindow.loadFile(path.join(__dirname, 'status.html'))
  statusWindow.once('ready-to-show', () => {
    statusWindow?.show()
    statusWindow?.focus()
  })
  statusWindow.webContents.on('did-finish-load', () => {
    statusWindow?.webContents.send('status', lastStatus)
    statusWindow?.webContents.send('logs', logs.slice(-50))
  })
  statusWindow.on('closed', () => {
    statusWindow = null
  })
}

function noteMaybeLocalNetworkBlocked(message) {
  if (process.platform !== 'darwin') return
  if (!/EHOSTUNREACH|ENETUNREACH|Local Network/i.test(String(message || ''))) return
  if (showedLocalNetworkHelp) return
  showedLocalNetworkHelp = true
  dialog
    .showMessageBox({
      type: 'warning',
      buttons: ['Open Local Network settings', 'Later'],
      defaultId: 0,
      title: 'Allow local network access',
      message: 'macOS is blocking MOJO Access Agent from reaching door controllers on your LAN.',
      detail:
        'System Settings → Privacy & Security → Local Network → enable “MOJO Access Agent”, then Quit and reopen this app.\n\nTerminal can reach the devices; the app needs the same permission.',
    })
    .then((r) => {
      if (r.response === 0) openLocalNetworkSettings()
    })
    .catch(() => {})
}

/**
 * Prefer system Node on macOS — Electron's process is often denied Local Network
 * (EHOSTUNREACH) even when Terminal/Node can reach Hikvision devices.
 */
async function startAgentProcess() {
  if (running) {
    running.stop()
    running = null
  }

  // Clear env keys we manage so .env reload wins on restart
  for (const key of [
    'MOJO_API_URL',
    'HOTEL_ID',
    'AGENT_TOKEN',
    'AGENT_ID',
    'DEVICE_SOURCE',
    'DEVICES',
    'POLL_INTERVAL_MS',
    'HEARTBEAT_INTERVAL_MS',
  ]) {
    delete process.env[key]
  }

  const envDir = userDataEnvDir()
  const nodeBin = process.platform === 'darwin' ? findSystemNode() : null
  const cliMain = resolveUnpacked('agent', 'cli-main.mjs')
  const workerCwd = resolveUnpacked()

  if (nodeBin && fs.existsSync(cliMain)) {
    pushLog('info', `Starting device worker via system Node (${nodeBin})`)
    const childEnv = { ...process.env, MOJO_AGENT_ENV_DIR: envDir }
    // Homebrew ffmpeg (face capture on enrollment station) + clean credential env
    const pathParts = String(childEnv.PATH || '')
      .split(':')
      .filter(Boolean)
    for (const extra of ['/opt/homebrew/bin', '/usr/local/bin']) {
      if (!pathParts.includes(extra)) pathParts.unshift(extra)
    }
    childEnv.PATH = pathParts.join(':')
    for (const key of [
      'MOJO_API_URL',
      'HOTEL_ID',
      'AGENT_TOKEN',
      'AGENT_ID',
      'DEVICE_SOURCE',
      'DEVICES',
      'POLL_INTERVAL_MS',
      'HEARTBEAT_INTERVAL_MS',
    ]) {
      delete childEnv[key]
    }
    const child = spawn(nodeBin, [cliMain], {
      cwd: workerCwd,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let buf = ''
    const onLine = (line) => {
      const text = String(line || '').trim()
      if (!text) return
      try {
        const msg = JSON.parse(text)
        if (msg.type === 'status' && msg.status) {
          lastStatus = msg.status
          rebuildTrayMenu()
          statusWindow?.webContents.send('status', lastStatus)
          return
        }
        if (msg.message) {
          pushLog(msg.level || 'info', msg.message)
          noteMaybeLocalNetworkBlocked(msg.message)
          noteMaybeInvalidAgentToken(msg.message)
          return
        }
      } catch {
        pushLog('info', text)
        noteMaybeLocalNetworkBlocked(text)
        noteMaybeInvalidAgentToken(text)
      }
    }

    const feed = (chunk) => {
      buf += chunk.toString('utf8')
      const parts = buf.split('\n')
      buf = parts.pop() || ''
      for (const p of parts) onLine(p)
    }
    child.stdout.on('data', feed)
    child.stderr.on('data', feed)
    child.on('error', (err) => {
      pushLog('error', `Device worker failed to start: ${err.message}`)
      lastStatus = { online: false, detail: err.message, devices: [] }
      rebuildTrayMenu()
      statusWindow?.webContents.send('status', lastStatus)
    })
    child.on('exit', (code) => {
      pushLog('warn', `Device worker exited (code ${code ?? '?'})`)
      if (running && running._child === child) {
        lastStatus = {
          online: false,
          detail: 'Device worker stopped — reopen the agent',
          devices: [],
        }
        rebuildTrayMenu()
        statusWindow?.webContents.send('status', lastStatus)
      }
    })

    running = {
      _child: child,
      stop() {
        try {
          child.kill('SIGTERM')
        } catch {
          // ignore
        }
      },
    }
    return
  }

  const agentPath = path.join(__dirname, '..', 'agent', 'run.js')
  const { startAgent } = await import(pathToFileUrl(agentPath))

  running = await startAgent({
    envDir,
    log: (level, message) => {
      pushLog(level, message)
      noteMaybeLocalNetworkBlocked(message)
      noteMaybeInvalidAgentToken(message)
    },
    onStatus: (status) => {
      lastStatus = status
      rebuildTrayMenu()
      statusWindow?.webContents.send('status', status)
    },
  })
}

function pathToFileUrl(filePath) {
  const resolved = path.resolve(filePath)
  let urlPath = resolved.replace(/\\/g, '/')
  if (!urlPath.startsWith('/')) urlPath = `/${urlPath}`
  return `file://${urlPath}`
}

function createTray() {
  tray = new Tray(trayIcon(false))
  // macOS menu-bar: single click should open status (double-click is easy to miss)
  tray.on('click', () => openStatusWindow())
  tray.on('double-click', () => openStatusWindow())
  rebuildTrayMenu()
}

function shouldOpenWindowOnLaunch() {
  if (process.platform !== 'darwin') return true
  try {
    const login = app.getLoginItemSettings()
    // Stay quiet only when macOS started us hidden at login
    if (login.wasOpenedAtLogin && login.wasOpenedAsHidden) return false
  } catch {
    // ignore
  }
  return true
}

function normalizeEnvContents(raw) {
  const text = String(raw || '').trim()
  const lines = text.split(/\r?\n/)
  const out = []
  let sawApiUrl = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      out.push(line)
      continue
    }
    const eq = trimmed.indexOf('=')
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key === 'MOJO_API_URL') {
      sawApiUrl = true
      let withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
      try {
        const url = new URL(withProtocol)
        const host = url.host.toLowerCase()
        if (host === 'mcs-pms.vercel.app' || host === 'www.mcs-pms.vercel.app') {
          value = 'https://portal.mojoapartmentsgh.com'
        } else {
          value = `${url.protocol}//${url.host}`
        }
      } catch {
        value = 'https://portal.mojoapartmentsgh.com'
      }
      out.push(`MOJO_API_URL=${value}`)
      continue
    }
    out.push(`${key}=${value}`)
  }
  if (!sawApiUrl) {
    out.unshift('MOJO_API_URL=https://portal.mojoapartmentsgh.com')
  }
  return `${out.join('\n').trim()}\n`
}

ipcMain.handle('save-env', async (_event, contents) => {
  const text = normalizeEnvContents(contents)
  if (!text.includes('MOJO_API_URL') || !text.includes('AGENT_TOKEN') || !text.includes('HOTEL_ID')) {
    return {
      ok: false,
      error: 'That does not look like a MOJO Access Agent config. Use Start setup → Copy full .env.',
    }
  }
  fs.mkdirSync(userDataEnvDir(), { recursive: true })
  fs.writeFileSync(envPath(), text, 'utf8')
  openedSetupForBadToken = false
  try {
    await startAgentProcess()
    lastStatus = { online: true, detail: 'Connected — syncing…', devices: [] }
    rebuildTrayMenu()
    setupWindow?.close()
    openStatusWindow()
    return { ok: true }
  } catch (err) {
    pushLog('error', err.message)
    lastStatus = { online: false, detail: err.message, devices: [] }
    rebuildTrayMenu()
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('has-env', () => fs.existsSync(envPath()))
ipcMain.handle('read-env', () => {
  try {
    return fs.readFileSync(envPath(), 'utf8')
  } catch {
    return ''
  }
})
ipcMain.handle('get-status', () => lastStatus)
ipcMain.handle('get-logs', () => logs.slice(-50))
ipcMain.handle('clear-logs', () => {
  logs.length = 0
  statusWindow?.webContents.send('logs', [])
  return { ok: true }
})
ipcMain.handle('open-setup', () => {
  openSetupWindow({ force: true, reason: 'edit' })
  return { ok: true }
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (fs.existsSync(envPath())) openStatusWindow()
    else openSetupWindow(true)
  })

  app.whenReady().then(async () => {
    createTray()

    // Enable auto-start once on first install
    const autostartFlag = path.join(userDataEnvDir(), 'autostart-initialized')
    if (!fs.existsSync(autostartFlag)) {
      app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })
      fs.writeFileSync(autostartFlag, '1')
    }

    const openWindow = shouldOpenWindowOnLaunch()
    const hasEnv = fs.existsSync(envPath())

    // Always show UI first — never wait on controller/network (that used to look like "nothing opens")
    if (process.platform === 'darwin' && openWindow) app.dock?.show()
    if (!hasEnv) {
      openSetupWindow()
      return
    }
    if (openWindow) openStatusWindow()
    else if (process.platform === 'darwin') app.dock?.hide()

    try {
      await startAgentProcess()
    } catch (err) {
      pushLog('error', err.message)
      lastStatus = { online: false, detail: err.message, devices: [] }
      rebuildTrayMenu()
      if (process.platform === 'darwin') app.dock?.show()
      openSetupWindow(true)
      dialog.showErrorBox('MOJO Access Agent', err.message)
    }
  })

  app.on('activate', () => {
    // Clicking the Dock icon while running
    if (process.platform === 'darwin') app.dock?.show()
    if (fs.existsSync(envPath())) openStatusWindow()
    else openSetupWindow(true)
  })

  app.on('window-all-closed', (e) => {
    // Keep running in menu bar / tray after windows close
    e.preventDefault?.()
    if (process.platform === 'darwin') app.dock?.hide()
  })

  app.on('before-quit', () => {
    running?.stop()
  })
}
