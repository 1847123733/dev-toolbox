import { BrowserWindow, ipcMain, screen, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let dockWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null

interface DockSettings {
  position: 'bottom' | 'left' | 'right'
  iconSize: number
  autoHide: boolean
  magnification: boolean
}

// 计算 Dock 窗口的位置和大小
function calculateDockBounds(settings: DockSettings) {
  const display = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = display.workAreaSize

  // 根据图标大小和应用数量计算 Dock 尺寸
  const iconCount = 5 // 应用数量
  const padding = 24
  const gap = 4
  const dockLength = iconCount * settings.iconSize + (iconCount - 1) * gap + padding * 2

  let width: number, height: number, x: number, y: number

  if (settings.position === 'bottom') {
    width = dockLength + 80
    height = settings.iconSize + padding + 80 // 增加高度容纳 tooltip
    x = Math.round((screenWidth - width) / 2)
    y = screenHeight - height
  } else if (settings.position === 'left') {
    width = settings.iconSize + padding + 100 // 增加宽度容纳 tooltip
    height = dockLength + 80
    x = 0
    y = Math.round((screenHeight - height) / 2)
  } else {
    // right
    width = settings.iconSize + padding + 100 // 增加宽度容纳 tooltip
    height = dockLength + 80
    x = screenWidth - width
    y = Math.round((screenHeight - height) / 2)
  }

  return { width, height, x, y }
}

// 创建 Dock 窗口
function createDockWindow(settings: DockSettings): BrowserWindow {
  const bounds = calculateDockBounds(settings)

  const dock = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/dock.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 设置窗口级别，使其始终在最前面（类似 macOS Dock）
  dock.setAlwaysOnTop(true, 'screen-saver')
  dock.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // 加载 Dock HTML
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    dock.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/dock.html`)
  } else {
    dock.loadFile(join(__dirname, '../renderer/dock.html'))
  }

  // 窗口准备好后发送配置
  dock.webContents.on('did-finish-load', () => {
    dock.webContents.executeJavaScript(`
      if (window.updateDockConfig) {
        window.updateDockConfig(${JSON.stringify(settings)});
      }
    `)
  })

  return dock
}

// 设置 Dock 服务
export function setupDockService(mainWin: BrowserWindow): void {
  mainWindow = mainWin

  // 打开 Dock 窗口
  ipcMain.handle('dock:open', async (_, settings: DockSettings) => {
    try {
      if (dockWindow && !dockWindow.isDestroyed()) {
        // 如果已存在，更新配置
        const bounds = calculateDockBounds(settings)
        dockWindow.setBounds(bounds)
        dockWindow.webContents.executeJavaScript(`
          if (window.updateDockConfig) {
            window.updateDockConfig(${JSON.stringify(settings)});
          }
        `)
        return { success: true, message: 'Dock 配置已更新' }
      }

      // 创建新的 Dock 窗口
      dockWindow = createDockWindow(settings)

      // 隐藏主窗口
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide()
      }

      return { success: true, message: 'Dock 已启动' }
    } catch (error) {
      return { success: false, message: `启动失败: ${error}` }
    }
  })

  // 关闭 Dock 窗口
  ipcMain.handle('dock:close', async () => {
    try {
      if (dockWindow && !dockWindow.isDestroyed()) {
        dockWindow.close()
        dockWindow = null
      }
      return { success: true, message: 'Dock 已关闭' }
    } catch (error) {
      return { success: false, message: `关闭失败: ${error}` }
    }
  })

  // 检查 Dock 是否打开
  ipcMain.handle('dock:isOpen', async () => {
    return dockWindow !== null && !dockWindow.isDestroyed()
  })

  // Dock 动作处理
  ipcMain.handle('dock:action', async (_, action: string) => {
    switch (action) {
      case 'openSettings':
        // 显示主窗口
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.focus()
        }
        break

      case 'openFolder':
        // 打开文件管理器`
        shell.openPath(process.env.HOME || process.env.USERPROFILE || 'C:\\')
        break

      case 'openTerminal':
        // 打开终端
        if (process.platform === 'win32') {
          shell.openExternal('cmd')
        } else if (process.platform === 'darwin') {
          shell.openExternal('Terminal.app')
        } else {
          shell.openExternal('x-terminal-emulator')
        }
        break

      case 'openBrowser':
        // 打开默认浏览器
        shell.openExternal('https://www.google.com')
        break

      default:
        console.log('Unknown dock action:', action)
    }

    return { success: true }
  })
}

// 获取 Dock 窗口实例
export function getDockWindow(): BrowserWindow | null {
  return dockWindow
}

// 关闭 Dock 窗口（用于应用退出时）
export function closeDockWindow(): void {
  if (dockWindow && !dockWindow.isDestroyed()) {
    dockWindow.close()
    dockWindow = null
  }
}
