const msg = document.getElementById('msg')
const env = document.getElementById('env')
const save = document.getElementById('save')
const banner = document.getElementById('banner')
const intro = document.getElementById('intro')

const params = new URLSearchParams(window.location.search)
const reason = params.get('reason') || ''

if (reason === 'token' && banner && intro) {
  intro.textContent =
    'This PC still has an old agent token. Paste a fresh config from the portal — do not reuse the previous AGENT_TOKEN.'
  banner.hidden = false
  banner.textContent =
    'Invalid agent token. In MOJO: Owner → Access → Setup → Start setup / Rotate token → Copy full .env, then paste here.'
} else if (reason === 'edit' && intro) {
  intro.textContent =
    'Update the connection settings for this PC. Paste a fresh Copy full .env from Owner → Access → Setup.'
}

if (!window.mojoAgent) {
  msg.textContent = 'App bridge failed to load. Quit and reopen MOJO Access Agent.'
} else {
  window.mojoAgent.readEnv().then((text) => {
    if (!text) return
    if (reason === 'token') {
      // Keep hotel/api lines for context, but blank the dead token so staff paste a new one.
      env.value = String(text).replace(/^AGENT_TOKEN=.*$/m, 'AGENT_TOKEN=')
      return
    }
    env.value = text
  })

  save.addEventListener('click', async () => {
    msg.textContent = ''
    msg.className = 'err'
    save.disabled = true
    save.textContent = 'Starting…'
    const result = await window.mojoAgent.saveEnv(env.value)
    save.disabled = false
    save.textContent = 'Save & start'
    if (!result.ok) {
      msg.textContent = result.error || 'Could not start'
      return
    }
    msg.className = 'ok'
    msg.textContent = 'Connected. You can close this window — the agent stays in the tray.'
  })
}
