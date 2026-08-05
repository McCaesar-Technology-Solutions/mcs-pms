const msg = document.getElementById('msg')
const env = document.getElementById('env')
const save = document.getElementById('save')

if (!window.mojoAgent) {
  msg.textContent = 'App bridge failed to load. Quit and reopen MOJO Access Agent.'
} else {
  window.mojoAgent.readEnv().then((text) => {
    if (text) env.value = text
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
