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

  // HTTP 客户端
  httpClient: {
    send: (payload: {
      method: string
      url: string
      headers: Record<string, string>
      body?: string
      timeout?: number
    }) => ipcRenderer.invoke('http:send', payload)
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
  },

  // SQL 专家
  sqlExpert: {
    testDb: (config: {
      host: string
      port: number
      user: string
      password: string
      database: string
    }) => ipcRenderer.invoke('sql-expert:test-db', config),
    askAi: (payload: {
      requestId?: string
      messages: Array<{ role: string; content: string; status?: string; toolCalls?: any[] }>
      schema: string
    }) => ipcRenderer.invoke('sql-expert:ask-ai', payload),
    cancelAskAi: (payload: { requestId: string }) => ipcRenderer.invoke('sql-expert:cancel-ask-ai', payload),
    executeSql: (sql: string) => ipcRenderer.invoke('sql-expert:execute-sql', sql),
    saveConfig: (config: {
      db: { host: string; port: number; user: string; password: string; database: string }
      ai: { url: string; apiKey: string; model: string }
    }) => ipcRenderer.invoke('sql-expert:save-config', config),
    loadConfig: () => ipcRenderer.invoke('sql-expert:load-config'),
    loadSchema: (dbConfig?: {
      host: string
      port: number
      user: string
      password: string
      database: string
    }) => ipcRenderer.invoke('sql-expert:load-schema', dbConfig),
    loadMemories: (payload?: { database?: string; apiKey?: string }) =>
      ipcRenderer.invoke('sql-expert:load-memories', payload),
    describeTable: (tableNames: string[]) =>
      ipcRenderer.invoke('sql-expert:describe-table', tableNames),

    // 流式进度事件监听
    onAiContent: (callback: (data: { requestId: string; content: string }) => void) => {
      ipcRenderer.on('sql-expert:ai-content', (_, data) => callback(data))
    },
    onAiToolStart: (callback: (data: { requestId: string; id: string; name: string; args: Record<string, unknown> }) => void) => {
      ipcRenderer.on('sql-expert:ai-tool-start', (_, data) => callback(data))
    },
    onAiToolDone: (callback: (data: { requestId: string; id: string; name: string; args: Record<string, unknown>; status: string; result: Record<string, unknown>; errorMessage?: string }) => void) => {
      ipcRenderer.on('sql-expert:ai-tool-done', (_, data) => callback(data))
    },
    removeAiListeners: () => {
      ipcRenderer.removeAllListeners('sql-expert:ai-content')
      ipcRenderer.removeAllListeners('sql-expert:ai-tool-start')
      ipcRenderer.removeAllListeners('sql-expert:ai-tool-done')
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
