import { ElectronAPI } from '@electron-toolkit/preload'

interface WindowAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => void
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
  // 类型定义相关
  getTypes: (
    packageName: string
  ) => Promise<{
    success: boolean
    content?: string
    files?: Record<string, string>
    entry?: string
    version?: string
  }>
  clearTypeCache: (packageName: string) => Promise<void>
}

interface API {
  window: WindowAPI
  codeRunner: CodeRunnerAPI
  npm: NpmAPI
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
