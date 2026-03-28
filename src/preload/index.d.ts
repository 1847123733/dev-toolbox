import { ElectronAPI } from '@electron-toolkit/preload'

// 通知类型
type NotificationType = 'info' | 'success' | 'warning' | 'error'

interface WindowAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => void
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
  downloadUpdate: (url?: string) => Promise<{ success: boolean; error?: string }>
  installUpdate: () => Promise<{ success: boolean }>
  openFile: (filePath: string) => Promise<{ success: boolean }>
  setProxy: (proxyUrl: string) => Promise<{ success: boolean; error?: string }>
  getAutoLaunch: () => Promise<boolean>
  setAutoLaunch: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
  onDownloadProgress: (callback: (progress: number) => void) => void
  onUpdateDownloaded: (callback: () => void) => void
}

// 全局通知 API
interface NotificationAPI {
  onNotify: (callback: (message: string, type: NotificationType) => void) => void
  removeListener: () => void
}

interface CodeRunnerAPI {
  run: (code: string, language: 'javascript' | 'typescript') => Promise<CodeRunResult>
  stop: () => void
  clean: () => Promise<boolean>
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
    files?: Record<string, string>
    entry?: string
    version?: string
  }>
  clearTypeCache: (packageName: string) => Promise<void>
}

// ============ 域名查询相关类型 ============

interface BasicInfo {
  ip: string
  ipVersion: 'IPv4' | 'IPv6'
  addressType: string
  isGlobal: boolean
  networkClass: string
  subnet: string
}

interface LocationInfo {
  country: string
  countryCode: string
  region: string
  city: string
  zip: string
  timezone: string
  lat: number
  lon: number
}

interface IspInfo {
  isp: string
  org: string
  as: string
  asname: string
}

interface ConnectionInfo {
  connectionType: string
  mobile: boolean
  proxy: boolean
  hosting: boolean
}

interface DomainDetails {
  domain: string
  reverseDns: string
}

interface PortInfo {
  port: number
  state: 'open' | 'closed' | 'filtered'
  service: string
  version?: string
}

interface TechInfo {
  server?: string
  framework?: string
  cdn?: string
  headers: Record<string, string>
  ports: PortInfo[]
}

interface DomainInfo {
  input: string
  ips: { address: string; type: 'IPv4' | 'IPv6' }[]
  basic?: BasicInfo
  location?: LocationInfo
  isp?: IspInfo
  connection?: ConnectionInfo
  domainDetails?: DomainDetails
  tech?: TechInfo
  error?: string
}

interface PortScanResult {
  success: boolean
  ports: PortInfo[]
  useNmap: boolean
}

interface DomainLookupAPI {
  lookup: (input: string) => Promise<DomainInfo>
  scanPorts: (ip: string) => Promise<PortScanResult>
}

// ============ Dock 相关类型 ============

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

// ============ OSS 上传相关类型 ============

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

// ============ HTTP 客户端相关类型 ============

interface HttpClientRequestPayload {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  timeout?: number
}

interface HttpClientResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  size: number
  time: number
  error?: string
}

interface HttpClientAPI {
  send: (payload: HttpClientRequestPayload) => Promise<HttpClientResponse>
}

// ============ 企业级分析专家相关类型 ============

interface SqlExpertDbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

interface SqlExpertAiConfig {
  url: string
  apiKey: string
  model: string
}

interface SqlExpertConfig {
  db: SqlExpertDbConfig
  ai: SqlExpertAiConfig
}

interface SqlExpertToolCallResult {
  id: string
  name: string
  args: Record<string, unknown>
  result: Record<string, unknown>
  status: string
  errorMessage?: string
}

interface SqlExpertAPI {
  testDb: (config: SqlExpertDbConfig) => Promise<{ success: boolean; message: string }>
  askAi: (payload: {
    requestId?: string
    messages: Array<{ role: string; content: string; status?: string; toolCalls?: any[] }>
    schema: string
  }) => Promise<{
    success: boolean
    requestId?: string
    reply?: string
    toolCalls?: SqlExpertToolCallResult[]
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
      promptCacheHitTokens: number
      promptCacheMissTokens: number
    }
    status?: 'done' | 'stopped'
    error?: string
  }>
  cancelAskAi: (payload: { requestId: string }) => Promise<{ success: boolean; message: string }>
  executeSql: (sql: string) => Promise<{
    success: boolean
    ok?: boolean
    truncated?: boolean
    totalRows?: number
    returnedRows?: number
    rows?: Array<Record<string, unknown>>
    error?: string
  }>
  saveConfig: (config: SqlExpertConfig) => Promise<{ success: boolean; error?: string }>
  loadConfig: () => Promise<{
    config: SqlExpertConfig | null
    schema: string
    schemaPath: string
    memories: Array<{ id: string; content: string; createdAt: string; updatedAt: string; source: 'tool' | 'manual' }>
    memoryPath: string
    memoryScope: string
    memoryCount: number
  }>
  loadSchema: (dbConfig?: SqlExpertDbConfig) => Promise<{
    success: boolean
    schema?: string
    schemaPath?: string
    tableCount?: number
    memories?: Array<{ id: string; content: string; createdAt: string; updatedAt: string; source: 'tool' | 'manual' }>
    memoryPath?: string
    memoryScope?: string
    memoryCount?: number
    error?: string
  }>
  loadMemories: (payload?: { database?: string; apiKey?: string }) => Promise<{
    success: boolean
    memories: Array<{ id: string; content: string; createdAt: string; updatedAt: string; source: 'tool' | 'manual' }>
    memoryPath: string
    memoryScope: string
    memoryCount: number
    error?: string
  }>
  describeTable: (tableNames: string[]) => Promise<{
    success: boolean
    rows?: Array<Record<string, unknown>>
    error?: string
  }>
  checkBalance: (config?: { url?: string; apiKey?: string }) => Promise<{
    success: boolean
    message: string
  }>
  // 流式进度事件监听
  onAiContent: (callback: (data: { requestId: string; content: string }) => void) => void
  onAiToolStart: (callback: (data: { requestId: string; id: string; name: string; args: Record<string, unknown> }) => void) => void
  onAiToolDone: (callback: (data: { requestId: string; id: string; name: string; args: Record<string, unknown>; status: string; result: Record<string, unknown>; errorMessage?: string }) => void) => void
  removeAiListeners: () => void
}

interface API {
  window: WindowAPI
  app: AppAPI
  notification: NotificationAPI
  codeRunner: CodeRunnerAPI
  npm: NpmAPI
  domainLookup: DomainLookupAPI
  dock: DockAPI
  httpClient: HttpClientAPI
  oss: OssAPI
  sqlExpert: SqlExpertAPI
}

interface CodeRunResult {
  success: boolean
  output: string
  error?: string
  duration: number
}

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

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
