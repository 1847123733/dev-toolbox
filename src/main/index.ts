import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { setupCodeRunner } from './services/codeRunner'
import { setupNpmManager } from './services/npmManager'
import { setupDomainLookup } from './services/domainLookup'
import { setupDockService, closeDockWindow } from './services/dockService'

// 配置 autoUpdater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

// Windows 上透明窗口需要禁用某些 GPU 功能以避免标题栏问题
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-gpu-compositing')
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
      const https = await import('https')
      return new Promise((resolve) => {
        const options = {
          hostname: 'api.github.com',
          path: '/repos/1847123733/dev-toolbox/releases/latest',
          headers: { 'User-Agent': 'dev-toolbox' }
        }
        https
          .get(options, (res) => {
            let data = ''
            res.on('data', (chunk) => (data += chunk))
            res.on('end', () => {
              try {
                const release = JSON.parse(data)
                const latestVersion = release.tag_name?.replace('v', '') || ''
                const currentVersion = app.getVersion()
                const hasUpdate = latestVersion && latestVersion !== currentVersion
                // 找到 exe 文件
                const exeAsset = release.assets?.find((a: any) => a.name?.endsWith('.exe'))
                resolve({
                  success: true,
                  currentVersion,
                  latestVersion,
                  hasUpdate,
                  releaseUrl:
                    release.html_url || 'https://github.com/1847123733/dev-toolbox/releases',
                  downloadUrl: exeAsset?.browser_download_url || ''
                })
              } catch {
                resolve({ success: false, error: '解析失败' })
              }
            })
          })
          .on('error', () => resolve({ success: false, error: '网络错误' }))
      })
    } catch {
      return { success: false, error: '检查失败' }
    }
  })

  // 下载更新
  ipcMain.handle('app:downloadUpdate', async (_, downloadUrl: string) => {
    try {
      const https = await import('https')
      const fs = await import('fs')
      const path = await import('path')

      const fileName = downloadUrl.split('/').pop() || 'update.exe'
      const filePath = path.join(app.getPath('downloads'), fileName)

      return new Promise((resolve) => {
        const file = fs.createWriteStream(filePath)

        https
          .get(
            downloadUrl,
            {
              headers: { 'User-Agent': 'dev-toolbox' }
            },
            (response) => {
              // 处理重定向
              if (response.statusCode === 302 || response.statusCode === 301) {
                const redirectUrl = response.headers.location
                if (redirectUrl) {
                  https
                    .get(redirectUrl, (redirectRes) => {
                      const totalSize = parseInt(redirectRes.headers['content-length'] || '0', 10)
                      let downloadedSize = 0

                      redirectRes.on('data', (chunk) => {
                        downloadedSize += chunk.length
                        if (totalSize > 0) {
                          const progress = Math.round((downloadedSize / totalSize) * 100)
                          mainWindow.webContents.send('app:downloadProgress', progress)
                        }
                      })

                      redirectRes.pipe(file)
                      file.on('finish', () => {
                        file.close()
                        resolve({ success: true, filePath })
                      })
                    })
                    .on('error', () => {
                      resolve({ success: false, error: '下载失败' })
                    })
                }
              } else {
                const totalSize = parseInt(response.headers['content-length'] || '0', 10)
                let downloadedSize = 0

                response.on('data', (chunk) => {
                  downloadedSize += chunk.length
                  if (totalSize > 0) {
                    const progress = Math.round((downloadedSize / totalSize) * 100)
                    mainWindow.webContents.send('app:downloadProgress', progress)
                  }
                })

                response.pipe(file)
                file.on('finish', () => {
                  file.close()
                  resolve({ success: true, filePath })
                })
              }
            }
          )
          .on('error', () => {
            // 如果下载失败，在浏览器中打开
            shell.openExternal(downloadUrl)
            resolve({ success: false, error: '已在浏览器中打开下载' })
          })
      })
    } catch {
      shell.openExternal(downloadUrl)
      return { success: false, error: '已在浏览器中打开下载' }
    }
  })

  // 打开下载的文件（运行安装程序）
  ipcMain.handle('app:openFile', async (_, filePath: string) => {
    shell.openPath(filePath)
    return { success: true }
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
