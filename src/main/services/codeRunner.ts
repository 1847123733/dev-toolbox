import { ipcMain } from 'electron'
import * as esbuild from 'esbuild'
import * as vm from 'vm'
import * as path from 'path'
import * as net from 'net'
import * as http from 'http'
import * as https from 'https'
import { getInstalledPackageNames, getNpmPackagesDir } from './npmManager'

// 添加自定义模块路径
const Module = require('module')
const originalResolveFilename = Module._resolveFilename

interface RunResult {
  success: boolean
  output: string
  error?: string
  duration: number
}

// 存储活跃的 Server 实例，以便清理
const activeServers: Set<net.Server> = new Set()

// ====================================================================================
// 全局劫持 http/https/net 模块 - 在模块加载时立即执行
// 通过 Proxy + 替换 require.cache 实现，避免修改只读 getter 属性
// ====================================================================================

// Server 追踪函数
const trackServer = (server: net.Server): net.Server => {
  activeServers.add(server)
  server.on('close', () => {
    activeServers.delete(server)
  })
  console.log(`[CodeRunner] Server tracked, total active: ${activeServers.size}`)
  return server
}

// 创建代理模块并替换缓存
const patchModule = (moduleName: string, originalModule: object) => {
  const cacheKey = require.resolve(moduleName)

  // 创建代理对象，拦截 createServer 调用
  const proxiedModule = new Proxy(originalModule, {
    get(target: any, prop: string | symbol) {
      if (prop === 'createServer') {
        return function (...args: unknown[]) {
          const server = target.createServer(...args)
          return trackServer(server)
        }
      }
      // 对于 net.Server 构造函数也需要代理
      if (moduleName === 'net' && prop === 'Server') {
        const OriginalServer = target.Server
        return function (...args: unknown[]) {
          const server = new OriginalServer(...args)
          return trackServer(server)
        }
      }
      return target[prop]
    }
  })

  // 替换 require.cache 中的 exports
  if (require.cache[cacheKey]) {
    require.cache[cacheKey]!.exports = proxiedModule
  }
}

// 立即劫持 http/https/net 模块
patchModule('http', http)
patchModule('https', https)
patchModule('net', net)

console.log('[CodeRunner] Global http/https/net modules patched for server tracking')

// 清理所有活跃的 Server (支持异步等待)
const cleanupServers = async (): Promise<void> => {
  if (activeServers.size > 0) {
    console.log(`Cleaning up ${activeServers.size} active servers...`)
    const promises: Promise<void>[] = []

    for (const server of activeServers) {
      promises.push(new Promise((resolve) => {
        server.close((err) => {
          if (err) console.error('Error closing server:', err)
          resolve()
        })
      }))
    }

    await Promise.all(promises)
    activeServers.clear()
    console.log('All servers cleaned up')
  }
}

export function setupCodeRunner(): void {
  ipcMain.handle(
    'code:run',
    async (event, code: string, language: 'javascript' | 'typescript'): Promise<RunResult> => {
      const startTime = Date.now()
      const initialOutputs: string[] = []
      const webContents = event.sender

      // 1. 清理旧的服务 (等待清理完成，防止端口占用)
      await cleanupServers()

      // 发送日志的辅助函数
      const sendLog = (type: 'stdout' | 'stderr', ...args: unknown[]) => {
        const message = args.map((arg) => formatOutput(arg)).join(' ')
        // 实时发送到前端
        webContents.send('code:log', { type, message })
        // 同时收集到初始输出中（用于兼容旧逻辑）
        initialOutputs.push(message)
      }

      try {
        let jsCode = code

        // 如果是 TypeScript，先编译成 JavaScript
        if (language === 'typescript') {
          const result = await esbuild.transform(code, {
            loader: 'ts',
            target: 'es2020',
            format: 'cjs'
          })
          jsCode = result.code
        }

        // 创建自定义的 console 对象来捕获输出
        const customConsole = {
          log: (...args: unknown[]) => sendLog('stdout', ...args),
          error: (...args: unknown[]) => sendLog('stderr', ...args),
          warn: (...args: unknown[]) => sendLog('stderr', '[Warn]', ...args),
          info: (...args: unknown[]) => sendLog('stdout', '[Info]', ...args),
          dir: (obj: unknown) => sendLog('stdout', formatOutput(obj)),
          table: (data: unknown) => sendLog('stdout', formatOutput(data))
        }

        // 创建沙箱环境
        const sandbox = {
          console: customConsole,
          setTimeout,
          setInterval,
          clearTimeout,
          clearInterval,
          setImmediate,
          clearImmediate,
          process: {
            env: { ...process.env },
            cwd: process.cwd,
            nextTick: process.nextTick,
            platform: process.platform,
            version: process.version,
            arch: process.arch,
            stdout: { write: (msg: string) => sendLog('stdout', msg) },
            stderr: { write: (msg: string) => sendLog('stderr', msg) }
          },
          Date,
          Math,
          JSON,
          Array,
          Object,
          String,
          Number,
          Boolean,
          RegExp,
          Error,
          Promise,
          Map,
          Set,
          WeakMap,
          WeakSet,
          Symbol,
          BigInt,
          Proxy,
          Reflect,
          Buffer,
          require: createSafeRequire()
        }

        // 创建上下文并运行代码
        const context = vm.createContext(sandbox)

        // 关键更改：对于 Express 这种长时间运行的服务，我们不能等待它结束
        // 但我们仍然希望捕获同步错误和顶层 Promise 错误
        const script = new vm.Script(jsCode)

        let result = script.runInContext(context, { timeout: 30000 })

        // 如果结果是 Promise (或 Thenable)，等待它完成
        // 注意：对于 Express，app.listen() 返回的是 Server 对象，不是 Promise
        if (result && typeof result === 'object' && typeof result.then === 'function') {
          try {
            result = await result
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e)
            sendLog('stderr', `[Error] Unhandled Rejection: ${errorMessage}`)
          }
        }

        // 如果有返回值，且不是 undefined，输出它
        if (result !== undefined) {
          // 对于 Server 对象，我们不需要输出它庞大的 JSON，只需提示服务已启动
          if (result && result.constructor && result.constructor.name === 'Server') {
            sendLog('stdout', 'Server started.')
          } else {
            sendLog('stdout', `=> ${formatOutput(result)}`)
          }
        }

        const duration = Date.now() - startTime

        return {
          success: true,
          output: initialOutputs.join('\n'), // 仅返回同步执行期间的输出
          duration
        }
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)

        // 实时发送错误
        webContents.send('code:log', { type: 'stderr', message: errorMessage })

        return {
          success: false,
          output: initialOutputs.join('\n'),
          error: errorMessage,
          duration
        }
      }
    }
  )

  ipcMain.on('code:stop', () => {
    console.log('Code execution stop requested')
    cleanupServers()
  })

  // 手动清理资源的 handler
  ipcMain.handle('code:clean', async () => {
    await cleanupServers()
    return true
  })

  // 根据端口号终止进程
  ipcMain.handle('code:killPort', async (_event, port: number): Promise<{ success: boolean; message: string }> => {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    try {
      // 1. 使用 netstat 查找占用端口的进程 PID
      const { stdout: netstatOutput } = await execAsync(`netstat -ano | findstr :${port}`)

      // 解析输出，找到 LISTENING 状态的 PID
      const lines = netstatOutput.trim().split('\n')
      const pids = new Set<string>()

      for (const line of lines) {
        // 格式: TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 5) {
          const localAddress = parts[1]
          const state = parts[3]
          const pid = parts[4]

          // 检查是否是目标端口且处于 LISTENING 状态
          if (localAddress.endsWith(`:${port}`) && state === 'LISTENING' && pid !== '0') {
            pids.add(pid)
          }
        }
      }

      if (pids.size === 0) {
        return { success: false, message: `未找到占用端口 ${port} 的进程` }
      }

      // 2. 终止找到的进程（只终止 electron.exe）
      const results: string[] = []
      for (const pid of pids) {
        try {
          // 先查询进程名称
          const { stdout: tasklistOutput } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`)
          const processName = tasklistOutput.split(',')[0]?.replace(/"/g, '').toLowerCase() || ''

          // 只终止 electron.exe 进程，避免误杀其他服务
          if (processName !== 'electron.exe') {
            results.push(`跳过 ${processName} (PID: ${pid}) - 非 Electron 进程`)
            continue
          }

          // 终止进程
          await execAsync(`taskkill /PID ${pid} /F`)
          results.push(`已终止 ${processName} (PID: ${pid})`)
        } catch (killError) {
          results.push(`终止 PID ${pid} 失败: ${killError instanceof Error ? killError.message : String(killError)}`)
        }
      }

      return {
        success: true,
        message: results.join('\n')
      }
    } catch (error) {
      // netstat 没有找到任何结果时会报错
      if ((error as any)?.stderr?.includes('findstr') || (error as any)?.stdout === '') {
        return { success: false, message: `端口 ${port} 未被占用` }
      }
      return {
        success: false,
        message: `查找进程失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  })
}

function formatOutput(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'symbol') return value.toString()
  if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`
  if (Buffer.isBuffer(value)) return `<Buffer ${value.toString('hex').slice(0, 50)}...>`
  if (Array.isArray(value)) {
    if (value.length > 100) {
      return `[${value.slice(0, 100).map((v) => formatOutput(v)).join(', ')}... (${value.length} items)]`
    }
    return `[${value.map((v) => formatOutput(v)).join(', ')}]`
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (value instanceof RegExp) {
    return value.toString()
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`
  }
  // 特殊处理 Net Server 对象，避免输出巨大的 JSON
  if (value && typeof value === 'object' && (value as any).constructor && (value as any).constructor.name === 'Server') {
    return '[Server Object]'
  }

  if (typeof value === 'object') {
    try {
      const str = JSON.stringify(value, null, 2)
      // 限制输出长度
      if (str.length > 5000) {
        return str.slice(0, 5000) + '... (truncated)'
      }
      return str
    } catch {
      return Object.prototype.toString.call(value)
    }
  }
  return String(value)
}

function createSafeRequire(): (moduleName: string) => unknown {
  // 获取用户安装包的目录
  const npmDir = getNpmPackagesDir()
  const nodeModulesDir = path.join(npmDir, 'node_modules')

  // http/https/net 模块已在模块顶层全局劫持，此处直接返回原生模块即可
  return (moduleName: string) => {
    const allowedModules = new Set(getInstalledPackageNames())

    // 内置模块白名单
    const builtinModules = new Set([
      'fs',
      'path',
      'url',
      'querystring',
      'crypto',
      'util',
      'buffer',
      'stream',
      'events',
      'os',
      'assert',
      'zlib',
      'http',
      'https',
      'net'
    ])

    // 处理 ESM 模块的默认导出
    const getDefaultExport = (mod: unknown): unknown => {
      if (mod && (typeof mod === 'object' || typeof mod === 'function') && 'default' in mod) {
        return (mod as { default: unknown }).default
      }
      return mod
    }

    // 检查是否是允许的内置模块
    if (builtinModules.has(moduleName)) {
      // http/https/net 模块已在模块顶层全局劫持，直接 require 即可
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(moduleName)
    }

    // 检查是否是已安装的包
    if (allowedModules.has(moduleName)) {
      try {
        // 首先尝试从应用内置目录加载（预装包，更可靠）
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mod = require(moduleName)
          return getDefaultExport(mod)
        } catch {
          // 内置加载失败，继续尝试用户目录
        }

        // 尝试从用户安装目录加载
        const modulePath = path.join(nodeModulesDir, moduleName)

        // 临时修改模块解析，添加用户安装目录
        Module._resolveFilename = function (request: string, parent: NodeModule) {
          if (request === moduleName || request.startsWith(moduleName + '/')) {
            const customPath = path.join(nodeModulesDir, request)
            try {
              require.resolve(customPath)
              return customPath
            } catch {
              // 继续尝试默认解析
            }
          }
          return originalResolveFilename.call(this, request, parent)
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mod = require(modulePath)
          return getDefaultExport(mod)
        } finally {
          // 恢复原始解析
          Module._resolveFilename = originalResolveFilename
        }
      } catch (e) {
        throw new Error(
          `模块 "${moduleName}" 加载失败。\n` +
          `请确保包已正确安装。如果刚安装，请重启应用后再试。\n` +
          `错误: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    throw new Error(
      `模块 "${moduleName}" 未安装。\n` +
      `请在左侧 NPM 包面板中搜索并安装该包。\n` +
      `已安装的模块: ${[...allowedModules].join(', ')}\n` +
      `内置模块: ${[...builtinModules].join(', ')}`
    )
  }
}
