export { }

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

interface OssConfig {
  accessKeyId: string
  accessKeySecret: string
  endpoint: string
  bucket: string
  targetPath?: string
}

interface OssUploadFile {
  path: string
  name?: string
  relativePath?: string
  size?: number
}

interface OssUploadProgress {
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
}

interface OssUploadResult {
  success: boolean
  uploaded?: number
  failed?: number
  errors?: { file: string; message: string }[]
  error?: string
}

interface OssAPI {
  selectFiles: () => Promise<OssUploadFile[]>
  selectFolder: () => Promise<OssUploadFile[]>
  cancelUpload: (payload: { taskId: string }) => Promise<{ success: boolean; error?: string }>
  upload: (payload: { taskId: string; config: OssConfig; files: OssUploadFile[] }) => Promise<OssUploadResult>
  onUploadProgress: (callback: (progress: OssUploadProgress) => void) => void
  removeUploadListener: () => void
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
  getAutoLaunch: () => Promise<boolean>
  setAutoLaunch: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
  getCloseBehavior: () => Promise<'ask' | 'minimize' | 'quit'>
  setCloseBehavior: (behavior: 'ask' | 'minimize' | 'quit') => Promise<{ success: boolean }>
  sendCloseDialogResult: (result: { action: 'minimize' | 'quit'; remember: boolean }) => void
  quit: () => void
  onShowCloseDialog: (callback: () => void) => void
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
  oss: OssAPI
}

declare global {
  interface Window {
    electron: any
    api: API
  }
}
