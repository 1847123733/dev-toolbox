import { ipcMain, app, dialog } from 'electron'
import axios from 'axios'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

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

interface NpmConfig {
  installPath: string | null
}

// 配置文件路径
const getConfigPath = (): string => path.join(app.getPath('userData'), 'npm-config.json')

// 读取配置
const loadConfig = (): NpmConfig => {
  const configPath = getConfigPath()
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch (error) {
    console.error('Failed to load npm config:', error)
  }
  return { installPath: null }
}

// 保存配置
const saveConfig = (config: NpmConfig): void => {
  const configPath = getConfigPath()
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  } catch (error) {
    console.error('Failed to save npm config:', error)
  }
}

// 获取默认 NPM 目录
const getDefaultNpmDir = (): string => path.join(app.getPath('userData'), 'npm_packages')

// 获取当前有效的 NPM 目录
const getNpmDir = (): string => {
  const config = loadConfig()
  const npmDir = config.installPath || getDefaultNpmDir()

  // 确保目录存在
  if (!fs.existsSync(npmDir)) {
    try {
      fs.mkdirSync(npmDir, { recursive: true })
      // 初始化 package.json
      const packageJson = {
        name: 'runjs-packages',
        version: '1.0.0',
        description: 'RunJS installed packages',
        private: true,
        dependencies: {}
      }
      fs.writeFileSync(path.join(npmDir, 'package.json'), JSON.stringify(packageJson, null, 2))
    } catch (error) {
      console.error(`Failed to create npm dir at ${npmDir}:`, error)
      // 如果创建失败且不是默认目录，尝试回退到默认目录
      if (npmDir !== getDefaultNpmDir()) {
        console.warn('Falling back to default npm directory')
        return getDefaultNpmDir()
      }
    }
  }
  return npmDir
}

// 从 package.json 读取已安装的包
const getInstalledFromDisk = (): Map<string, string> => {
  const npmDir = getNpmDir()
  const packageJsonPath = path.join(npmDir, 'package.json')

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content)
    const deps = pkg.dependencies || {}
    return new Map(Object.entries(deps))
  } catch {
    return new Map()
  }
}

// 保存到 package.json
const saveToPackageJson = (packages: Map<string, string>): void => {
  const npmDir = getNpmDir()
  const packageJsonPath = path.join(npmDir, 'package.json')

  const packageJson = {
    name: 'runjs-packages',
    version: '1.0.0',
    description: 'RunJS installed packages',
    private: true,
    dependencies: Object.fromEntries(packages)
  }

  try {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  } catch (error) {
    console.error('Failed to save package.json:', error)
  }
}

// 内存中的已安装包列表
let installedPackages: Map<string, string> = new Map()

// 获取所有已安装包名称（导出供 codeRunner 使用）
export function getInstalledPackageNames(): string[] {
  return Array.from(installedPackages.keys())
}

// 获取 npm 包安装目录
export function getNpmPackagesDir(): string {
  return getNpmDir()
}

// 初始化：从磁盘加载已安装的包
function initInstalledPackages(): void {
  installedPackages = getInstalledFromDisk()

  // 如果是空的，添加默认包（仅当使用默认目录或新目录为空时）
  if (installedPackages.size === 0) {
    installedPackages.set('lodash', '^4.17.21')
    installedPackages.set('dayjs', '^1.11.13')
    installedPackages.set('uuid', '^11.0.5')
    installedPackages.set('axios', '^1.7.9')
    installedPackages.set('express', '^4.18.2')
    saveToPackageJson(installedPackages)
  } else if (!installedPackages.has('express')) {
    // 补全 express (针对旧版本升级)
    installedPackages.set('express', '^4.18.2')
    saveToPackageJson(installedPackages)
    // 后台触发安装
    runNpmCommand(['install', 'express@^4.18.2', '--save'], getNpmDir())
      .then(() => console.log('Auto-installed express'))
      .catch(err => console.error('Failed to auto-install express:', err))
  }
}

// 执行 npm 命令
function runNpmCommand(
  args: string[],
  cwd: string
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32'
    const npmCmd = isWin ? 'npm.cmd' : 'npm'

    const child = spawn(npmCmd, args, {
      cwd,
      shell: true,
      env: { ...process.env, npm_config_registry: 'https://registry.npmmirror.com' }
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout })
      } else {
        resolve({ success: false, output: stderr || stdout })
      }
    })

    child.on('error', (err) => {
      resolve({ success: false, output: err.message })
    })

    // 超时处理（60秒）
    setTimeout(() => {
      child.kill()
      resolve({ success: false, output: '安装超时' })
    }, 60000)
  })
}

export function setupNpmManager(): void {
  // 初始化
  initInstalledPackages()

  // 搜索 NPM 包
  ipcMain.handle('npm:search', async (_, query: string): Promise<NpmPackage[]> => {
    if (!query.trim()) return []

    try {
      const response = await axios.get(
        `https://registry.npmmirror.com/-/v1/search?text=${encodeURIComponent(query)}&size=10`,
        { timeout: 10000 }
      )

      return response.data.objects.map((obj: { package: NpmPackage }) => ({
        name: obj.package.name,
        version: obj.package.version,
        description: obj.package.description || ''
      }))
    } catch (error) {
      console.error('NPM search error:', error)
      return []
    }
  })

  // 安装包（真实安装到磁盘）
  ipcMain.handle(
    'npm:install',
    async (_, packageName: string): Promise<{ success: boolean; message: string }> => {
      const npmDir = getNpmDir()

      try {
        console.log(`Installing ${packageName} to ${npmDir}...`)

        // 使用 npm install 安装包
        const result = await runNpmCommand(['install', packageName, '--save'], npmDir)

        if (result.success) {
          // 重新读取 package.json 获取实际安装的版本
          installedPackages = getInstalledFromDisk()

          const version = installedPackages.get(packageName) || 'latest'

          return {
            success: true,
            message: `成功安装 ${packageName}@${version}`
          }
        } else {
          return {
            success: false,
            message: `安装失败: ${result.output}`
          }
        }
      } catch (error) {
        return {
          success: false,
          message: `安装失败: ${error instanceof Error ? error.message : String(error)}`
        }
      }
    }
  )

  // 卸载包（真实卸载）
  ipcMain.handle(
    'npm:uninstall',
    async (_, packageName: string): Promise<{ success: boolean; message: string }> => {
      const npmDir = getNpmDir()

      if (!installedPackages.has(packageName)) {
        return {
          success: false,
          message: `包 ${packageName} 未安装`
        }
      }

      try {
        const result = await runNpmCommand(['uninstall', packageName, '--save'], npmDir)

        if (result.success) {
          installedPackages.delete(packageName)
          return {
            success: true,
            message: `成功卸载 ${packageName}`
          }
        } else {
          return {
            success: false,
            message: `卸载失败: ${result.output}`
          }
        }
      } catch (error) {
        return {
          success: false,
          message: `卸载失败: ${error instanceof Error ? error.message : String(error)}`
        }
      }
    }
  )

  // 获取已安装的包列表
  ipcMain.handle('npm:list', async (): Promise<InstalledPackage[]> => {
    // 刷新列表
    installedPackages = getInstalledFromDisk()

    return Array.from(installedPackages.entries()).map(([name, version]) => ({
      name,
      version: version.replace(/^\^|~/, ''),
      installed: true
    }))
  })

  // 获取包安装目录
  ipcMain.handle('npm:getDir', async (): Promise<string> => {
    return getNpmDir()
  })

  // 设置包安装目录
  ipcMain.handle('npm:setDir', async (): Promise<{ success: boolean; path?: string }> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
      title: '选择 NPM 包安装目录',
      message: '请选择一个目录用于存储 RunJS 的 NPM 包'
    })

    if (canceled || filePaths.length === 0) {
      return { success: false }
    }

    const newPath = filePaths[0]

    // 简单验证写入权限
    try {
      const testFile = path.join(newPath, '.test_write_perm')
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
    } catch (error) {
      console.error('Directory not writable:', error)
      return { success: false } // 或者返回具体错误信息，这里简化处理
    }

    // 保存配置
    saveConfig({ installPath: newPath })

    // 重新初始化
    initInstalledPackages()

    return { success: true, path: newPath }
  })

  // 重置包安装目录
  ipcMain.handle('npm:resetDir', async (): Promise<{ success: boolean; path: string }> => {
    saveConfig({ installPath: null })
    initInstalledPackages()
    return { success: true, path: getNpmDir() }
  })

  // 获取包的所有可用版本
  ipcMain.handle(
    'npm:versions',
    async (_, packageName: string): Promise<string[]> => {
      try {
        const response = await axios.get(
          `https://registry.npmmirror.com/${packageName}`,
          { timeout: 15000 }
        )

        const versions = Object.keys(response.data.versions || {})
        // 按版本号排序（最新版本在前）
        return versions.reverse() // 只返回最近50个版本
      } catch (error) {
        console.error('获取版本列表失败:', error)
        return []
      }
    }
  )

  // 切换包版本（卸载旧版本，安装新版本）
  ipcMain.handle(
    'npm:changeVersion',
    async (
      _,
      packageName: string,
      newVersion: string
    ): Promise<{ success: boolean; message: string }> => {
      const npmDir = getNpmDir()

      if (!installedPackages.has(packageName)) {
        return {
          success: false,
          message: `包 ${packageName} 未安装`
        }
      }

      try {
        console.log(`Changing ${packageName} to version ${newVersion}...`)

        // 直接安装指定版本（npm 会自动替换旧版本）
        const result = await runNpmCommand(
          ['install', `${packageName}@${newVersion}`, '--save'],
          npmDir
        )

        if (result.success) {
          // 刷新列表
          installedPackages = getInstalledFromDisk()

          return {
            success: true,
            message: `成功将 ${packageName} 切换至 ${newVersion}`
          }
        } else {
          return {
            success: false,
            message: `切换版本失败: ${result.output}`
          }
        }
      } catch (error) {
        return {
          success: false,
          message: `切换版本失败: ${error instanceof Error ? error.message : String(error)}`
        }
      }
    }
  )

  // 获取包的类型定义
  ipcMain.handle(
    'npm:getTypes',
    async (_, packageName: string): Promise<{ success: boolean; content?: string; version?: string }> => {
      const npmDir = getNpmDir()
      const nodeModulesDir = path.join(npmDir, 'node_modules')
      const packageDir = path.join(nodeModulesDir, packageName)

      // 检查包是否存在
      if (!fs.existsSync(packageDir)) {
        return { success: false }
      }

      try {
        // 读取包的 package.json
        const pkgJsonPath = path.join(packageDir, 'package.json')
        if (!fs.existsSync(pkgJsonPath)) {
          return { success: false }
        }

        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
        const version = pkgJson.version || 'unknown'

        // 获取类型定义文件路径
        let typesPath = pkgJson.types || pkgJson.typings

        // 如果没有 types 字段，尝试常见路径
        if (!typesPath) {
          const commonPaths = [
            'index.d.ts',
            'dist/index.d.ts',
            'lib/index.d.ts',
            'types/index.d.ts',
            `dist/${packageName}.d.ts`
          ]
          for (const p of commonPaths) {
            const fullPath = path.join(packageDir, p)
            if (fs.existsSync(fullPath)) {
              typesPath = p
              break
            }
          }
        }

        // 如果找不到类型定义，尝试查找 @types 包
        if (!typesPath) {
          const atTypesDir = path.join(nodeModulesDir, '@types', packageName)
          if (fs.existsSync(atTypesDir)) {
            const atTypesPkgJson = path.join(atTypesDir, 'package.json')
            if (fs.existsSync(atTypesPkgJson)) {
              const atTypesPkg = JSON.parse(fs.readFileSync(atTypesPkgJson, 'utf-8'))
              typesPath = atTypesPkg.types || atTypesPkg.typings || 'index.d.ts'
              // 切换到 @types 目录
              const typesFullPath = path.join(atTypesDir, typesPath)
              if (fs.existsSync(typesFullPath)) {
                const content = readTypeFileWithDeps(atTypesDir, typesPath, new Set())
                return { success: true, content, version }
              }
            }
          }
          return { success: false }
        }

        // 读取类型文件，包括其依赖的相对路径文件
        const typesFullPath = path.join(packageDir, typesPath)
        if (!fs.existsSync(typesFullPath)) {
          return { success: false }
        }

        const content = readTypeFileWithDeps(packageDir, typesPath, new Set())
        return { success: true, content, version }
      } catch (error) {
        console.error(`Failed to read types for ${packageName}:`, error)
        return { success: false }
      }
    }
  )

  // 清除类型缓存（用于版本切换后重新加载）
  ipcMain.handle('npm:clearTypeCache', async (_, packageName: string): Promise<void> => {
    // 这个方法主要是通知渲染进程清除缓存
    // 实际的缓存在渲染进程的 typeLoader 中管理
    console.log(`[NPM] Type cache clear requested for: ${packageName}`)
  })
}

/**
 * 递归读取类型文件及其依赖
 * 将相对路径的 import/export 语句中引用的文件内联
 */
function readTypeFileWithDeps(
  baseDir: string,
  relPath: string,
  visited: Set<string>
): string {
  // 规范化路径
  const normalizedPath = relPath.replace(/^\.\//, '')
  const fullPath = path.join(baseDir, normalizedPath)

  // 防止循环引用
  if (visited.has(fullPath)) {
    return ''
  }
  visited.add(fullPath)

  // 尝试添加 .d.ts 扩展名
  let actualPath = fullPath
  if (!fs.existsSync(actualPath) && !actualPath.endsWith('.d.ts')) {
    if (fs.existsSync(actualPath + '.d.ts')) {
      actualPath = actualPath + '.d.ts'
    } else if (fs.existsSync(path.join(actualPath, 'index.d.ts'))) {
      actualPath = path.join(actualPath, 'index.d.ts')
    }
  }

  if (!fs.existsSync(actualPath)) {
    return ''
  }

  let content = fs.readFileSync(actualPath, 'utf-8')

  // 查找相对路径的 import/export 语句
  // 匹配: import ... from './xxx' 或 export ... from './xxx'
  const importExportRegex = /(?:import|export)\s+.*?\s+from\s+['"](\.[^'"]+)['"]/g
  const deps: string[] = []
  let match

  while ((match = importExportRegex.exec(content)) !== null) {
    const depPath = match[1]
    deps.push(depPath)
  }

  // 递归读取依赖文件
  const currentDir = path.dirname(actualPath)
  for (const dep of deps) {
    const depFullPath = path.resolve(currentDir, dep)
    const depRelPath = path.relative(baseDir, depFullPath)
    const depContent = readTypeFileWithDeps(baseDir, depRelPath, visited)
    if (depContent) {
      // 将依赖内容添加到开头
      content = depContent + '\n' + content
    }
  }

  return content
}
