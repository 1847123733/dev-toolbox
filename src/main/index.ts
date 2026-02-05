import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { setupCodeRunner } from './services/codeRunner'
import { setupNpmManager } from './services/npmManager'
import { setupDomainLookup } from './services/domainLookup'
import { setupDockService, closeDockWindow } from './services/dockService'
import { setupOssManager } from './services/ossManager'
import { notify } from './services/notification'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AutoLaunch = require('auto-launch')

// 创建 AutoLaunch 实例
const appLauncher = new AutoLaunch({
  name: 'Dev Toolbox',
  isHidden: false
})

const UPDATER_REPO_OWNER = '1847123733'
const UPDATER_REPO_NAME = 'dev-toolbox'
let updaterConfigured = false
let lastUpdaterErrorAt = 0
let tray: Tray | null = null
let isQuitting = false // 是否真正退出应用

// 关闭行为类型: 'ask' = 每次询问, 'minimize' = 最小化到托盘, 'quit' = 直接退出
type CloseBehavior = 'ask' | 'minimize' | 'quit'
let closeBehavior: CloseBehavior = 'ask'

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

// 创建系统托盘
function createTray(mainWindow: BrowserWindow): void {
  // 如果托盘已存在，不重复创建
  if (tray && !tray.isDestroyed()) {
    return
  }

  // 创建托盘图标 - 根据打包状态使用不同路径
  let iconPath: string
  if (app.isPackaged) {
    iconPath = join(process.resourcesPath, 'icon.ico')
  } else {
    // 开发环境：从项目根目录的 resources 文件夹加载
    iconPath = join(__dirname, '../../resources/icon.ico')
  }
  console.log('Tray icon path:', iconPath)
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)

  // 托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出应用',
      click: () => {
        isQuitting = true
        closeDockWindow()
        app.quit()
      }
    }
  ])

  tray.setToolTip('Dev Toolbox')
  tray.setContextMenu(contextMenu)

  // 双击托盘图标显示主窗口
  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
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
    let message = '更新失败'
    if (error instanceof Error && error.message) {
      // 如果是网络超时或连接问题，提示用户设置代理
      if (
        error.message.includes('TIMED_OUT') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        message = '网络连接失败，请在设置中配置代理后重试'
      } else {
        message = `更新失败: ${error.message}`
      }
    }
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

  // 窗口关闭处理
  ipcMain.on('window:close', () => {
    // 触发窗口关闭，会被 close 事件拦截
    mainWindow.close()
  })

  // 拦截窗口关闭事件
  mainWindow.on('close', (event) => {
    // 如果是真正退出，不拦截
    if (isQuitting) {
      return
    }

    // 根据关闭行为处理
    if (closeBehavior === 'minimize') {
      // 最小化到托盘
      event.preventDefault()
      mainWindow.hide()
      createTray(mainWindow)
    } else if (closeBehavior === 'quit') {
      // 直接退出
      isQuitting = true
      closeDockWindow()
    } else {
      // 询问用户 - 通知渲染进程显示对话框
      event.preventDefault()
      mainWindow.webContents.send('app:showCloseDialog')
    }
  })

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
      let errorMsg = '检查更新失败'
      if (error instanceof Error && error.message) {
        if (
          error.message.includes('TIMED_OUT') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ENOTFOUND')
        ) {
          errorMsg = '网络连接失败，请在设置中配置代理后重试'
        }
      }
      if (Date.now() - lastUpdaterErrorAt > 1000) {
        notify.error(errorMsg)
      }
      return { success: false, error: errorMsg }
    }
  })

  ipcMain.handle('app:downloadUpdate', async (_event, _downloadUrl?: string) => {
    try {
      notify.success(`开始下载更新: ${_downloadUrl || ''}`)
      ensureUpdaterConfigured()
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      console.error('Download update failed:', error)
      let errorMsg = '下载更新失败'
      if (error instanceof Error && error.message) {
        if (
          error.message.includes('TIMED_OUT') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ENOTFOUND')
        ) {
          errorMsg = '网络连接失败，请在设置中配置代理后重试'
        }
      }
      if (Date.now() - lastUpdaterErrorAt > 1000) {
        notify.error(errorMsg)
      }
      return { success: false, error: errorMsg }
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

  // 开机自启动（使用 auto-launch 库）
  ipcMain.handle('app:getAutoLaunch', async () => {
    try {
      return await appLauncher.isEnabled()
    } catch (error) {
      console.error('Failed to get auto launch status:', error)
      return false
    }
  })

  ipcMain.handle('app:setAutoLaunch', async (_, enabled: boolean) => {
    try {
      if (enabled) {
        await appLauncher.enable()
      } else {
        await appLauncher.disable()
      }
      notify.success(enabled ? '已开启开机自启动' : '已关闭开机自启动')
      return { success: true }
    } catch (error) {
      console.error('Failed to set auto launch:', error)
      notify.error('设置开机自启动失败')
      return { success: false, error: '设置开机自启动失败' }
    }
  })

  // 关闭行为设置
  ipcMain.handle('app:getCloseBehavior', () => closeBehavior)

  ipcMain.handle('app:setCloseBehavior', async (_, behavior: CloseBehavior) => {
    closeBehavior = behavior
    return { success: true }
  })

  // 关闭对话框响应
  ipcMain.on('app:closeDialogResult', (_, result: { action: 'minimize' | 'quit'; remember: boolean }) => {
    if (result.remember) {
      closeBehavior = result.action
    }

    if (result.action === 'minimize') {
      mainWindow.hide()
      createTray(mainWindow)
    } else {
      isQuitting = true
      closeDockWindow()
      mainWindow.close()
    }
  })

  // 真正退出应用
  ipcMain.on('app:quit', () => {
    isQuitting = true
    closeDockWindow()
    app.quit()
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
    setupOssManager()

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
