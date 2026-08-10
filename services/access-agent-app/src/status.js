const badge = document.getElementById('badge')
const detail = document.getElementById('detail')
const logsEl = document.getElementById('logs')
const clearBtn = document.getElementById('clearLogs')
const editBtn = document.getElementById('editConfig')

function renderStatus(s) {
  badge.textContent = s.online ? 'Connected' : 'Needs attention'
  badge.className = s.online ? 'ok' : 'warn'
  detail.textContent = s.detail || '—'
}

function renderLogs(items) {
  if (!items?.length) {
    logsEl.textContent = 'No recent activity.'
    return
  }
  logsEl.textContent = items.map((i) => i.line).join('\n')
  logsEl.scrollTop = logsEl.scrollHeight
}

if (!window.mojoAgent) {
  badge.textContent = 'Needs attention'
  badge.className = 'warn'
  detail.textContent = 'App bridge failed to load. Quit and reopen MOJO Access Agent.'
  if (clearBtn) clearBtn.disabled = true
  if (editBtn) editBtn.disabled = true
} else {
  window.mojoAgent.getStatus().then(renderStatus)
  window.mojoAgent.getLogs().then(renderLogs)
  window.mojoAgent.onStatus(renderStatus)
  window.mojoAgent.onLogs(renderLogs)
  clearBtn?.addEventListener('click', async () => {
    await window.mojoAgent.clearLogs()
    renderLogs([])
  })
  editBtn?.addEventListener('click', () => {
    window.mojoAgent.openSetup()
  })
}
