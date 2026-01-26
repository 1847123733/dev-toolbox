/**
 * 全局通知辅助模块
 * 用于从主进程向渲染进程发送通知
 */
import { BrowserWindow } from 'electron'

// 通知类型
type NotificationType = 'info' | 'success' | 'warning' | 'error'

/**
 * 发送通知到渲染进程
 * @param message 通知消息
 * @param type 通知类型：info | success | warning | error
 */
export function sendNotification(message: string, type: NotificationType = 'info'): void {
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) {
    windows[0].webContents.send('app:notify', message, type)
  }
}

// 便捷方法
export const notify = {
  info: (message: string) => sendNotification(message, 'info'),
  success: (message: string) => sendNotification(message, 'success'),
  warning: (message: string) => sendNotification(message, 'warning'),
  error: (message: string) => sendNotification(message, 'error')
}
