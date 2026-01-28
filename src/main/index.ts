import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { setupCodeRunner } from './services/codeRunner'
import { setupNpmManager } from './services/npmManager'
import { setupDomainLookup } from './services/domainLookup'
import { setupDockService, closeDockWindow } from './services/dockService'
import { notify } from './services/notification'

const UPDATER_REPO_OWNER = '1847123733'
const UPDATER_REPO_NAME = 'dev-toolbox'
let updaterConfigured = false
let lastUpdaterErrorAt = 0

// 配置 autoUpdater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowPrerelease = true

// Windows 上透明窗口需要禁用某些 GPU 功能以避免标题栏问题
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu-compositing')
}

function ensureUpdaterConfigured(): void {
  if (updaterConfigured || !app.isPackaged) return
  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: UPDATER_REPO_OWNER,
      repo: UPDATER_REPO_NAME
    })
    updaterConfigured = true
  } catch (error) {
    console.warn('Failed to configure autoUpdater feed:', error)
  }
}

function createWindow(): void {
  // 创建浏览器窗口
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    frame: false, // 无边框窗口
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent || 0)
    mainWindow.webContents.send('app:downloadProgress', percent)
  })

  autoUpdater.on('update-downloaded', () => {
    notify.success('更新已下载，正在安装...')
    mainWindow.webContents.send('app:updateDownloaded')
    autoUpdater.quitAndInstall(true, true)
  })

  autoUpdater.on('error', (error) => {
    console.error('AutoUpdater error:', error)
    const message =
      error instanceof Error && error.message ? `更新失败: ${error.message}` : '更新失败'
    notify.error(message)
    lastUpdaterErrorAt = Date.now()
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发环境加载 HMR URL，生产环境加载本地文件
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 窗口控制 IPC
  ipcMain.on('window:minimize', () => mainWindow.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow.close())
  ipcMain.handle('window:isMaximized', () => mainWindow.isMaximized())
  ipcMain.handle('app:getVersion', () => app.getVersion())

  // 检查最新版本
  ipcMain.handle('app:checkUpdate', async () => {
    try {
      if (!app.isPackaged) {
        const currentVersion = app.getVersion()
        return {
          success: true,
          currentVersion,
          latestVersion: currentVersion,
          hasUpdate: false,
          releaseUrl: 'https://github.com/1847123733/dev-toolbox/releases',
          downloadUrl: ''
        }
      }

      ensureUpdaterConfigured()
      const result = await autoUpdater.checkForUpdates()
      const info = result?.updateInfo
      const currentVersion = app.getVersion()
      const latestVersion = info?.version || ''
      const hasUpdate = latestVersion ? latestVersion !== currentVersion : false
      const tagName = latestVersion ? `v${latestVersion}` : ''
      const releaseUrl = tagName
        ? `https://github.com/1847123733/dev-toolbox/releases/tag/${tagName}`
        : 'https://github.com/1847123733/dev-toolbox/releases'

      return {
        success: true,
        currentVersion,
        latestVersion,
        hasUpdate,
        releaseUrl,
        downloadUrl: ''
      }
    } catch (error) {
      console.error('Check update failed:', error)
      if (Date.now() - lastUpdaterErrorAt > 1000) {
        notify.error('检查更新失败')
      }
      return { success: false, error: '检查更新失败' }
    }
  })

  ipcMain.handle('app:downloadUpdate', async (_event, _downloadUrl?: string) => {
    try {
      ensureUpdaterConfigured()
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      console.error('Download update failed:', error)
      if (Date.now() - lastUpdaterErrorAt > 1000) {
        notify.error('下载更新失败')
      }
      return { success: false, error: '下载更新失败' }
    }
  })

  ipcMain.handle('app:installUpdate', async () => {
    autoUpdater.quitAndInstall(true, true)
    return { success: true }
  })

  ipcMain.handle('app:openFile', async (_, filePath: string) => {
    shell.openPath(filePath)
    return { success: true }
  })

  // 设置代理
  ipcMain.handle('app:setProxy', async (_, proxyUrl: string) => {
    try {
      // 设置代理（同时应用到 autoUpdater）
      const config = proxyUrl ? { proxyRules: proxyUrl } : { mode: 'direct' as const }
      await mainWindow.webContents.session.setProxy(config)
      // 设置环境变量让 autoUpdater 也使用代理
      if (proxyUrl) {
        process.env.HTTPS_PROXY = proxyUrl
        process.env.HTTP_PROXY = proxyUrl
      } else {
        delete process.env.HTTPS_PROXY
        delete process.env.HTTP_PROXY
      }
      notify.success(proxyUrl ? '代理已设置' : '代理已清除')
      return { success: true }
    } catch (error) {
      console.error('Failed to set proxy:', error)
      notify.error('设置代理失败')
      return { success: false, error: '设置代理失败' }
    }
  })

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized-change', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized-change', false)
  })

  // 设置 Dock 服务
  setupDockService(mainWindow)
}

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      const win = windows[0]
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    // 设置应用程序用户模型 ID
    electronApp.setAppUserModelId('com.devtoolbox.app')

    // 开发环境 F12 打开 DevTools，生产环境忽略 Ctrl/Cmd+R
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // 设置 IPC 服务
    setupCodeRunner()
    setupNpmManager()
    setupDomainLookup()

    createWindow()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    // 关闭 Dock 窗口
    closeDockWindow()
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
