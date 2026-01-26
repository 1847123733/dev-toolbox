import { contextBridge, ipcRenderer } from 'electron'

// Dock 窗口专用 API
const dockAPI = {
  action: (action: string) => ipcRenderer.invoke('dock:action', action)
}

// 暴露给 Dock 窗口
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('dockAPI', dockAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.dockAPI = dockAPI
}
