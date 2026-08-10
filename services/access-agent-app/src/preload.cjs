const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mojoAgent', {
  saveEnv: (contents) => ipcRenderer.invoke('save-env', contents),
  hasEnv: () => ipcRenderer.invoke('has-env'),
  readEnv: () => ipcRenderer.invoke('read-env'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  openSetup: () => ipcRenderer.invoke('open-setup'),
  onStatus: (cb) => {
    ipcRenderer.on('status', (_e, data) => cb(data))
  },
  onLogs: (cb) => {
    ipcRenderer.on('logs', (_e, data) => cb(data))
  },
})
