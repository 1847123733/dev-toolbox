/**
 * NPM 包类型定义加载器
 * 仅加载通过 builtinTypes 定义的静态类型
 */

import { monaco } from './monacoSetup'
import { BUILTIN_TYPES } from './builtinTypes'

// 类型加载状态
export type TypeLoadStatus = 'loading' | 'local' | 'cdn' | 'builtin' | 'failed' | 'cached'

// 类型加载事件
export interface TypeLoadEvent {
  packageName: string
  status: TypeLoadStatus
  source?: string
}

// 事件监听器
type TypeLoadListener = (event: TypeLoadEvent) => void
const listeners: TypeLoadListener[] = []

/**
 * 订阅类型加载状态变化
 */
export function onTypeLoadStatusChange(listener: TypeLoadListener): () => void {
  listeners.push(listener)
  return () => {
    const index = listeners.indexOf(listener)
    if (index > -1) listeners.splice(index, 1)
  }
}

/**
 * 通知所有监听器状态变化
 */
function notifyStatusChange(event: TypeLoadEvent): void {
  listeners.forEach(listener => listener(event))
}

// 已加载的类型定义缓存 (包名 -> 版本号)
const loadedTypes = new Map<string, string>()

// 自动注入 Node.js 类型
if (BUILTIN_TYPES['node']) {
  // 注入 @types/node
  const nodeLibPath = 'file:///node_modules/@types/node/index.d.ts'
  monaco.languages.typescript.typescriptDefaults.addExtraLib(BUILTIN_TYPES['node'], nodeLibPath)
  monaco.languages.typescript.javascriptDefaults.addExtraLib(BUILTIN_TYPES['node'], nodeLibPath)
  loadedTypes.set('@types/node', 'builtin')
  loadedTypes.set('node', 'builtin')
}

/**
 * 将类型定义添加到 Monaco Editor
 */
function addTypeToMonaco(packageName: string, content: string): void {
  // 使用模拟的 node_modules 路径，这样 require('package') 才能正确解析
  const libPath = `file:///node_modules/${packageName}/index.d.ts`
  monaco.languages.typescript.typescriptDefaults.addExtraLib(content, libPath)
  monaco.languages.typescript.javascriptDefaults.addExtraLib(content, libPath)
}

/**
 * 加载单个包的类型定义
 * 优先级：1. 本地 node_modules 2. 内置类型
 */
export async function loadTypeDefinition(packageName: string, forceReload = false): Promise<boolean> {
  // 如果强制重新加载，先清除缓存
  if (forceReload) {
    loadedTypes.delete(packageName)
  }

  // 跳过已加载的包
  if (loadedTypes.has(packageName)) {
    return true
  }

  // 通知开始加载
  notifyStatusChange({ packageName, status: 'loading' })
  console.log(`[TypeLoader] Loading types for: ${packageName}`)

  // 1. 优先从本地 node_modules 加载
  try {
    const localResult = await window.api.npm.getTypes(packageName)
    if (localResult.success && localResult.content) {
      addTypeToMonaco(packageName, localResult.content)
      loadedTypes.set(packageName, localResult.version || 'local')
      notifyStatusChange({ packageName, status: 'local', source: localResult.version })
      console.log(`[TypeLoader] ✓ Loaded local types for: ${packageName} (v${localResult.version})`)
      return true
    }
  } catch (error) {
    console.log(`[TypeLoader] Local types not available for: ${packageName}`, error)
  }

  // 2. 回退到内置类型定义
  const builtinType = BUILTIN_TYPES[packageName]
  if (builtinType) {
    addTypeToMonaco(packageName, builtinType)
    loadedTypes.set(packageName, 'builtin')
    notifyStatusChange({ packageName, status: 'builtin' })
    console.log(`[TypeLoader] ✓ Loaded builtin types for: ${packageName}`)
    return true
  }

  // 失败
  console.log(`[TypeLoader] ✗ No types found for: ${packageName}`)
  return false
}

/**
 * 重新加载指定包的类型定义
 */
export async function reloadTypeDefinition(packageName: string): Promise<boolean> {
  return loadTypeDefinition(packageName, true)
}

/**
 * 清除包的类型缓存
 */
export function clearTypeCache(packageName: string): void {
  loadedTypes.delete(packageName)
}

/**
 * 加载所有已安装 NPM 包的类型定义
 */
export async function loadTypesForInstalledPackages(): Promise<void> {
  try {
    // 获取已安装包列表
    const installedPackages = await window.api.npm.list()
    console.log(`[TypeLoader] Loading types for ${installedPackages.length} installed packages...`)

    // 并行加载所有包的类型（限制并发数为 3）
    const batchSize = 3
    for (let i = 0; i < installedPackages.length; i += batchSize) {
      const batch = installedPackages.slice(i, i + batchSize)
      await Promise.all(batch.map(pkg => loadTypeDefinition(pkg.name)))
    }

    console.log(`[TypeLoader] Finished loading types for installed packages`)
  } catch (error) {
    console.error('[TypeLoader] Failed to load types for installed packages:', error)
  }
}

/**
 * 从代码中提取 require/import 的包名
 */
export function extractPackageNames(code: string): string[] {
  const packages = new Set<string>()

  // 匹配 require('xxx') 或 require("xxx")
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let match
  while ((match = requireRegex.exec(code)) !== null) {
    const pkg = match[1]
    if (!pkg.startsWith('.') && !pkg.startsWith('/')) {
      const pkgName = pkg.startsWith('@')
        ? pkg.split('/').slice(0, 2).join('/')
        : pkg.split('/')[0]
      packages.add(pkgName)
    }
  }

  // 匹配 import
  const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g
  while ((match = importRegex.exec(code)) !== null) {
    const pkg = match[1]
    if (!pkg.startsWith('.') && !pkg.startsWith('/')) {
      const pkgName = pkg.startsWith('@')
        ? pkg.split('/').slice(0, 2).join('/')
        : pkg.split('/')[0]
      packages.add(pkgName)
    }
  }

  return Array.from(packages)
}

/**
 * 分析代码并加载所有依赖的类型定义
 */
export async function loadTypesForCode(code: string): Promise<void> {
  const packages = extractPackageNames(code)

  // 过滤已加载的
  const toLoad = packages.filter(pkg => !loadedTypes.has(pkg))

  if (toLoad.length === 0) return

  // 并行加载
  await Promise.all(toLoad.map(pkg => loadTypeDefinition(pkg)))
}

/**
 * 检查包是否已加载类型
 */
export function hasLoadedTypes(packageName: string): boolean {
  return loadedTypes.has(packageName)
}

/**
 * 获取已加载的类型列表
 */
export function getLoadedTypes(): string[] {
  return Array.from(loadedTypes.keys())
}

/**
 * 获取包的已加载版本
 */
export function getLoadedVersion(packageName: string): string | undefined {
  return loadedTypes.get(packageName)
}
