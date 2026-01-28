export {}

interface NpmPackage {
  name: string
  version: string
  description: string
}

interface InstalledPackage {
  name: string
  version: string
  installed: boolean
}

interface WindowAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => void
}

interface CodeRunnerAPI {
  run: (
    code: string,
    language: 'javascript' | 'typescript'
  ) => Promise<{
    success: boolean
    output: string
    error?: string
    duration: number
  }>
  stop: () => void
  killPort: (port: number) => Promise<{ success: boolean; message: string }>
}

interface NpmAPI {
  search: (query: string) => Promise<NpmPackage[]>
  install: (packageName: string) => Promise<{ success: boolean; message: string }>
  uninstall: (packageName: string) => Promise<{ success: boolean; message: string }>
  list: () => Promise<InstalledPackage[]>
  versions: (packageName: string) => Promise<string[]>
  changeVersion: (
    packageName: string,
    version: string
  ) => Promise<{ success: boolean; message: string }>
  getDir: () => Promise<string>
  setDir: () => Promise<{ success: boolean; path?: string }>
  resetDir: () => Promise<{ success: boolean; path: string }>
  getTypes: (packageName: string) => Promise<{
    success: boolean
    content?: string
    version?: string
    files?: Record<string, string>
    entry?: string
  }>
  clearTypeCache: (packageName: string) => Promise<void>
}

interface DockSettings {
  position: 'bottom' | 'left' | 'right'
  iconSize: number
  autoHide: boolean
  magnification: boolean
}

interface DockResult {
  success: boolean
  message?: string
}

interface DockAPI {
  open: (settings: DockSettings) => Promise<DockResult>
  close: () => Promise<DockResult>
  isOpen: () => Promise<boolean>
  action: (action: string) => Promise<{ success: boolean }>
}

// 通知类型
type NotificationType = 'info' | 'success' | 'warning' | 'error'

interface NotificationAPI {
  onNotify: (callback: (message: string, type: NotificationType) => void) => void
  removeListener: () => void
}

interface DomainLookupAPI {
  lookup: (input: string) => Promise<any>
  scanPorts: (ip: string) => Promise<any>
}

interface AppAPI {
  getVersion: () => Promise<string>
  checkUpdate: () => Promise<{
    success: boolean
    currentVersion?: string
    latestVersion?: string
    hasUpdate?: boolean
    releaseUrl?: string
    downloadUrl?: string
    error?: string
  }>
  downloadUpdate: (url?: string) => Promise<{
    success: boolean
    error?: string
  }>
  installUpdate: () => Promise<{ success: boolean }>
  openFile: (filePath: string) => Promise<{ success: boolean }>
  setProxy: (proxyUrl: string) => Promise<{ success: boolean; error?: string }>
  onDownloadProgress: (callback: (progress: number) => void) => void
  onUpdateDownloaded: (callback: () => void) => void
}

interface API {
  window: WindowAPI
  codeRunner: CodeRunnerAPI
  npm: NpmAPI
  dock: DockAPI
  notification: NotificationAPI
  domainLookup: DomainLookupAPI
  app: AppAPI
}

declare global {
  interface Window {
    electron: any
    api: API
  }
}
