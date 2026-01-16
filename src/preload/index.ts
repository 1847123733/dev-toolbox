import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 自定义 API 暴露给渲染进程
const api = {
  // 窗口控制
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
      ipcRenderer.on('window:maximized-change', (_, isMaximized) => callback(isMaximized))
    }
  },
  // 代码运行
  codeRunner: {
    run: (code: string, language: 'javascript' | 'typescript') =>
      ipcRenderer.invoke('code:run', code, language),
    stop: () => ipcRenderer.send('code:stop'),
    clean: () => ipcRenderer.invoke('code:clean'),
    killPort: (port: number) => ipcRenderer.invoke('code:killPort', port)
  },
  // NPM 管理
  npm: {
    search: (query: string) => ipcRenderer.invoke('npm:search', query),
    install: (packageName: string) => ipcRenderer.invoke('npm:install', packageName),
    uninstall: (packageName: string) => ipcRenderer.invoke('npm:uninstall', packageName),
    list: () => ipcRenderer.invoke('npm:list'),
    versions: (packageName: string) => ipcRenderer.invoke('npm:versions', packageName),
    changeVersion: (packageName: string, version: string) =>
      ipcRenderer.invoke('npm:changeVersion', packageName, version),
    getDir: () => ipcRenderer.invoke('npm:getDir'),
    setDir: () => ipcRenderer.invoke('npm:setDir'),
    resetDir: () => ipcRenderer.invoke('npm:resetDir'),
    // 类型定义相关
    getTypes: (packageName: string) => ipcRenderer.invoke('npm:getTypes', packageName),
    clearTypeCache: (packageName: string) => ipcRenderer.invoke('npm:clearTypeCache', packageName)
  }
}

// 如果支持 contextIsolation，使用 contextBridge 暴露 API
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
