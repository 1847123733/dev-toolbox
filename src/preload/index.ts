import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 通知类型
type NotificationType = 'info' | 'success' | 'warning' | 'error'

// 通知回调
type NotificationCallback = (message: string, type: NotificationType) => void

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

  // 应用信息
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
    downloadUpdate: (url?: string) => ipcRenderer.invoke('app:downloadUpdate', url),
    installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
    openFile: (filePath: string) => ipcRenderer.invoke('app:openFile', filePath),
    setProxy: (proxyUrl: string) => ipcRenderer.invoke('app:setProxy', proxyUrl),
    getAutoLaunch: () => ipcRenderer.invoke('app:getAutoLaunch'),
    setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('app:setAutoLaunch', enabled),
    getCloseBehavior: () => ipcRenderer.invoke('app:getCloseBehavior'),
    setCloseBehavior: (behavior: 'ask' | 'minimize' | 'quit') =>
      ipcRenderer.invoke('app:setCloseBehavior', behavior),
    sendCloseDialogResult: (result: { action: 'minimize' | 'quit'; remember: boolean }) =>
      ipcRenderer.send('app:closeDialogResult', result),
    quit: () => ipcRenderer.send('app:quit'),
    onShowCloseDialog: (callback: () => void) => {
      ipcRenderer.on('app:showCloseDialog', () => callback())
    },
    onDownloadProgress: (callback: (progress: number) => void) => {
      ipcRenderer.on('app:downloadProgress', (_, progress) => callback(progress))
    },
    onUpdateDownloaded: (callback: () => void) => {
      ipcRenderer.on('app:updateDownloaded', () => callback())
    }
  },

  // 全局通知
  notification: {
    onNotify: (callback: NotificationCallback) => {
      ipcRenderer.on('app:notify', (_, message: string, type: NotificationType) => {
        callback(message, type)
      })
    },
    removeListener: () => {
      ipcRenderer.removeAllListeners('app:notify')
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
    getTypes: (packageName: string) => ipcRenderer.invoke('npm:getTypes', packageName),
    clearTypeCache: (packageName: string) => ipcRenderer.invoke('npm:clearTypeCache', packageName)
  },

  // 域名查询
  domainLookup: {
    lookup: (input: string) => ipcRenderer.invoke('domain:lookup', input),
    scanPorts: (ip: string) => ipcRenderer.invoke('domain:scanPorts', ip)
  },

  // macOS Dock
  dock: {
    open: (settings: {
      position: 'bottom' | 'left' | 'right'
      iconSize: number
      autoHide: boolean
      magnification: boolean
    }) => ipcRenderer.invoke('dock:open', settings),
    close: () => ipcRenderer.invoke('dock:close'),
    isOpen: () => ipcRenderer.invoke('dock:isOpen'),
    action: (action: string) => ipcRenderer.invoke('dock:action', action)
  },

  // 阿里云 OSS
  oss: {
    selectFiles: () => ipcRenderer.invoke('oss:selectFiles'),
    selectFolder: () => ipcRenderer.invoke('oss:selectFolder'),
    cancelUpload: (payload: { taskId: string }) => ipcRenderer.invoke('oss:cancelUpload', payload),
    upload: (payload: {
      taskId: string
      config: {
        accessKeyId: string
        accessKeySecret: string
        endpoint: string
        bucket: string
        targetPath?: string
      }
      files: { path: string; name?: string; relativePath?: string; size?: number }[]
    }) => ipcRenderer.invoke('oss:upload', payload),
    onUploadProgress: (
      callback: (progress: {
        taskId: string
        fileIndex: number
        fileName: string
        relativePath: string
        fileLoaded: number
        fileTotal: number
        filePercent: number
        overallLoaded: number
        overallTotal: number
        overallPercent: number
        status: 'uploading' | 'done' | 'error'
        message?: string
      }) => void
    ) => {
      ipcRenderer.on('oss:uploadProgress', (_, progress) => callback(progress))
    },
    removeUploadListener: () => {
      ipcRenderer.removeAllListeners('oss:uploadProgress')
    }
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
