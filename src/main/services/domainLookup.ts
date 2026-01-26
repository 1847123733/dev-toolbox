/**
 * 域名/IP 查询服务
 * 功能：DNS解析、IP地理位置、ISP信息、连接信息、反向DNS、端口扫描
 */
import { ipcMain } from 'electron'
import * as dns from 'dns'
import * as https from 'https'
import * as http from 'http'
import * as net from 'net'
import { exec } from 'child_process'

// ============ 接口定义 ============

// 基础信息
interface BasicInfo {
  ip: string
  ipVersion: 'IPv4' | 'IPv6'
  addressType: string
  isGlobal: boolean
  networkClass: string
  subnet: string
}

// 地理位置
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

// ISP信息
interface IspInfo {
  isp: string
  org: string
  as: string
  asname: string
}

// 连接信息
interface ConnectionInfo {
  connectionType: string
  mobile: boolean
  proxy: boolean
  hosting: boolean
}

// 域名信息
interface DomainDetails {
  domain: string
  reverseDns: string
}

// 端口信息
interface PortInfo {
  port: number
  state: 'open' | 'closed' | 'filtered'
  service: string
  version?: string
}

// 技术栈
interface TechInfo {
  server?: string
  framework?: string
  cdn?: string
  headers: Record<string, string>
  ports: PortInfo[]
}

// 完整查询结果
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

// ============ 工具函数 ============

// 判断是否为有效IP
function isValidIP(input: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^([0-9a-fA-F]{1,4}:)*:[0-9a-fA-F]{1,4}$/
  return ipv4Regex.test(input) || ipv6Regex.test(input)
}

// 判断是否为IPv4
function isIPv4(ip: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)
}

// 判断IP类型和网络类别
function analyzeIP(ip: string): BasicInfo {
  const isV4 = isIPv4(ip)
  const parts = ip.split('.').map(Number)

  let addressType = '公有地址'
  let isGlobal = true
  let networkClass = '未知'
  let subnet = ''

  if (isV4) {
    // 私有地址判断
    if (parts[0] === 10) {
      addressType = '私有地址'
      isGlobal = false
      subnet = '10.0.0.0/8'
    } else if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
      addressType = '私有地址'
      isGlobal = false
      subnet = '172.16.0.0/12'
    } else if (parts[0] === 192 && parts[1] === 168) {
      addressType = '私有地址'
      isGlobal = false
      subnet = '192.168.0.0/16'
    } else if (parts[0] === 127) {
      addressType = '回环地址'
      isGlobal = false
      subnet = '127.0.0.0/8'
    }

    // 网络类别
    if (parts[0] >= 1 && parts[0] <= 126) {
      networkClass = 'A类'
      if (!subnet) subnet = `默认子网掩码: 255.0.0.0 (/8)`
    } else if (parts[0] >= 128 && parts[0] <= 191) {
      networkClass = 'B类'
      if (!subnet) subnet = `默认子网掩码: 255.255.0.0 (/16)`
    } else if (parts[0] >= 192 && parts[0] <= 223) {
      networkClass = 'C类'
      if (!subnet) subnet = `默认子网掩码: 255.255.255.0 (/24)`
    } else if (parts[0] >= 224 && parts[0] <= 239) {
      networkClass = 'D类(多播)'
      isGlobal = false
    } else if (parts[0] >= 240) {
      networkClass = 'E类(保留)'
      isGlobal = false
    }
  } else {
    // IPv6
    networkClass = 'IPv6'
    subnet = '/64'
    if (ip.startsWith('fe80:')) {
      addressType = '链路本地'
      isGlobal = false
    } else if (ip.startsWith('fc') || ip.startsWith('fd')) {
      addressType = '唯一本地'
      isGlobal = false
    } else if (ip === '::1') {
      addressType = '回环地址'
      isGlobal = false
    }
  }

  return {
    ip,
    ipVersion: isV4 ? 'IPv4' : 'IPv6',
    addressType,
    isGlobal,
    networkClass,
    subnet
  }
}

// DNS解析获取IP
async function resolveIPs(domain: string): Promise<{ address: string; type: 'IPv4' | 'IPv6' }[]> {
  const result: { address: string; type: 'IPv4' | 'IPv6' }[] = []

  try {
    const ipv4s = await dns.promises.resolve4(domain)
    ipv4s.forEach((ip) => result.push({ address: ip, type: 'IPv4' }))
  } catch {
    // IPv4 解析失败
  }

  try {
    const ipv6s = await dns.promises.resolve6(domain)
    ipv6s.forEach((ip) => result.push({ address: ip, type: 'IPv6' }))
  } catch {
    // IPv6 解析失败
  }

  return result
}

// 反向DNS查询
async function reverseDNS(ip: string): Promise<string> {
  try {
    const hostnames = await dns.promises.reverse(ip)
    return hostnames[0] || ''
  } catch {
    return ''
  }
}

// 获取完整IP信息 (使用ip-api.com)
async function getFullIpInfo(
  ip: string
): Promise<{ location: LocationInfo; isp: IspInfo; connection: ConnectionInfo } | null> {
  return new Promise((resolve) => {
    const fields =
      'status,country,countryCode,regionName,city,zip,timezone,lat,lon,isp,org,as,asname,mobile,proxy,hosting'
    const url = `http://ip-api.com/json/${ip}?lang=zh-CN&fields=${fields}`

    http
      .get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (json.status === 'success') {
              resolve({
                location: {
                  country: json.country || '未知',
                  countryCode: json.countryCode || '',
                  region: json.regionName || '',
                  city: json.city || '未知',
                  zip: json.zip || '',
                  timezone: json.timezone || '',
                  lat: json.lat || 0,
                  lon: json.lon || 0
                },
                isp: {
                  isp: json.isp || '未知',
                  org: json.org || '未知',
                  as: json.as || '',
                  asname: json.asname || ''
                },
                connection: {
                  connectionType: json.hosting ? 'IDC/云服务' : json.mobile ? '移动网络' : '住宅/企业网络',
                  mobile: json.mobile || false,
                  proxy: json.proxy || false,
                  hosting: json.hosting || false
                }
              })
            } else {
              resolve(null)
            }
          } catch {
            resolve(null)
          }
        })
      })
      .on('error', () => resolve(null))
  })
}

// 分析HTTP响应头识别技术栈
async function analyzeTechStack(domain: string): Promise<Omit<TechInfo, 'ports'>> {
  const headers: Record<string, string> = {}
  let server: string | undefined
  let framework: string | undefined
  let cdn: string | undefined

  const cdnPatterns: Record<string, string[]> = {
    Cloudflare: ['cf-ray', 'cf-cache-status'],
    Vercel: ['x-vercel-id', 'x-vercel-cache'],
    Akamai: ['x-akamai-transformed'],
    Fastly: ['x-served-by', 'x-cache'],
    阿里云CDN: ['ali-swift-global-savetime', 'eagleid'],
    腾讯云CDN: ['x-nws-log-uuid'],
    又拍云: ['x-upyun-'],
    七牛云: ['x-qnm-cache']
  }

  const frameworkPatterns: Record<string, string> = {
    'x-powered-by: express': 'Express.js',
    'x-powered-by: php': 'PHP',
    'x-powered-by: asp.net': 'ASP.NET',
    'x-powered-by: next.js': 'Next.js',
    'x-powered-by: nuxt': 'Nuxt.js',
    'x-drupal-cache': 'Drupal',
    'x-generator: wordpress': 'WordPress',
    'x-shopify-stage': 'Shopify'
  }

  return new Promise((resolve) => {
    const options = {
      hostname: domain,
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 10000,
      rejectUnauthorized: false
    }

    const req = https.request(options, (res) => {
      Object.entries(res.headers).forEach(([key, value]) => {
        if (value) {
          headers[key] = Array.isArray(value) ? value.join(', ') : value
        }
      })

      if (headers['server']) server = headers['server']

      const headersLower = Object.entries(headers)
        .map(([k, v]) => `${k.toLowerCase()}: ${v.toLowerCase()}`)
        .join('\n')

      for (const [pattern, name] of Object.entries(frameworkPatterns)) {
        if (headersLower.includes(pattern)) {
          framework = name
          break
        }
      }

      for (const [name, patterns] of Object.entries(cdnPatterns)) {
        for (const pattern of patterns) {
          if (Object.keys(headers).some((h) => h.toLowerCase().includes(pattern.toLowerCase()))) {
            cdn = name
            break
          }
        }
        if (cdn) break
      }

      resolve({ server, framework, cdn, headers })
    })

    req.on('error', () => {
      const httpOptions = { ...options, port: 80 }
      delete (httpOptions as { rejectUnauthorized?: boolean }).rejectUnauthorized

      const httpReq = http.request(httpOptions, (res) => {
        Object.entries(res.headers).forEach(([key, value]) => {
          if (value) {
            headers[key] = Array.isArray(value) ? value.join(', ') : value
          }
        })
        if (headers['server']) server = headers['server']
        resolve({ server, framework, cdn, headers })
      })

      httpReq.on('error', () => resolve({ headers }))
      httpReq.on('timeout', () => {
        httpReq.destroy()
        resolve({ headers })
      })
      httpReq.end()
    })

    req.on('timeout', () => {
      req.destroy()
      resolve({ headers })
    })

    req.end()
  })
}

// 常用端口和服务映射
const commonPorts: Record<number, string> = {
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  443: 'HTTPS',
  445: 'SMB',
  993: 'IMAPS',
  995: 'POP3S',
  1433: 'MSSQL',
  1521: 'Oracle',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  5900: 'VNC',
  6379: 'Redis',
  8080: 'HTTP-Proxy',
  8443: 'HTTPS-Alt',
  27017: 'MongoDB'
}

// 检测Nmap是否可用
async function isNmapAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('nmap --version', (error) => {
      resolve(!error)
    })
  })
}

// 使用Nmap扫描端口
// 使用Nmap扫描端口
// 解码 Nmap 输出的 Hex 转义字符 (如 \xe6\x8e\xa5 -> 接)
function decodeNmapEscape(str: string): string {
  // 匹配 \xHH 格式
  return str.replace(/(\\x[0-9a-fA-F]{2})+/g, (match) => {
    try {
      const bytes = match.split('\\x').filter(Boolean).map(b => parseInt(b, 16))
      return Buffer.from(bytes).toString('utf-8')
    } catch {
      return match
    }
  })
}

// 从指纹信息中提取关键内容 (Title, Description, Content)
function extractKeyInfo(content: string): string | null {
  // 提取 Title
  const titleMatch = content.match(/<title>(.*?)<\/title>/i)
  if (titleMatch && titleMatch[1]) {
    return `Title: ${decodeNmapEscape(titleMatch[1].trim())}`
  }

  // 提取 meta description
  const descMatch = content.match(/name="description"[^>]*content="([^"]*)"/i)
  if (descMatch && descMatch[1]) {
    return `Desc: ${decodeNmapEscape(descMatch[1].trim())}`
  }

  // 提取 meta content (如果没找到 description)
  if (!descMatch) {
    const contentMatch = content.match(/content="([^"]{10,})"/i) // 至少10个字符才认为是有效内容
    if (contentMatch && contentMatch[1]) {
      return `Info: ${decodeNmapEscape(contentMatch[1].trim())}`
    }
  }

  return null
}

// 使用Nmap扫描端口
async function scanWithNmap(ip: string): Promise<PortInfo[]> {
  return new Promise((resolve) => {
    // 优化命令参数：
    // -F: 快速模式，仅扫描常用端口
    // -sV: 版本探测
    // --version-intensity 0: 降低探测强度
    // --unprivileged: 非特权模式
    // -T4: 加速扫描
    const command = `nmap -F -sV --version-intensity 0 --unprivileged -T4 ${ip}`

    // 设置编码为 buffer
    exec(command, { encoding: 'buffer', timeout: 60000 }, (error, stdout) => {
      if (error) {
        resolve([])
        return
      }

      const output = stdout.toString('utf-8')
      const results: PortInfo[] = []
      const lines = output.split('\n')

      let currentSfPort: number | null = null
      let sfBuffer = ''

      // 端口映射，用于更新扫描结果
      const portMap = new Map<number, PortInfo>()

      for (const line of lines) {
        let cleanLine = line.trim()

        // 1. 处理端口行
        const portMatch = cleanLine.match(/^(\d+)\/tcp\s+(\w+)\s+([^\s]+)\s*(.*)$/)
        if (portMatch) {
          const port = parseInt(portMatch[1])
          const state = portMatch[2] as 'open' | 'closed' | 'filtered'
          const serviceName = portMatch[3]
          let version = portMatch[4]?.trim()

          const service = (serviceName === 'unknown' || serviceName === '?')
            ? (commonPorts[port] || 'unknown')
            : serviceName

          // 初步版本清理
          if (version) {
            if ((version.match(/[^\x00-\x7F]/g) || []).length > 5) {
              version = ''
            } else {
              version = version.split('(')[0].trim()
            }
          }

          const portInfo: PortInfo = { port, state, service, version }
          results.push(portInfo)
          portMap.set(port, portInfo)
          continue
        }

        // 2. 识别 SF 指纹块开始
        // 格式: SF-Port3000-TCP:V=7.94%I=0%D=1/23...
        const sfStartMatch = cleanLine.match(/^SF-Port(\d+)-TCP:/)
        if (sfStartMatch) {
          currentSfPort = parseInt(sfStartMatch[1])
          sfBuffer = '' // 重置缓冲区
          continue
        }

        // 3. 收集 SF 指纹内容
        if (currentSfPort && cleanLine.startsWith('SF:')) {
          // SF 行可能被截断或包含乱码，我们需要解码
          sfBuffer += cleanLine

          // 尝试提取信息
          // 由于 Nmap 输出可能跨行，我们每次追加后都尝试匹配
          const info = extractKeyInfo(sfBuffer)
          if (info) {
            const portInfo = portMap.get(currentSfPort)
            if (portInfo) {
              // 更新版本信息为更具描述性的内容（如果原版本信息为空或较短）
              // 或者追加信息
              if (!portInfo.version || portInfo.version.length < 5) {
                portInfo.version = info
              } else if (!portInfo.version.includes(info)) {
                // 避免重复
                portInfo.version = `${portInfo.version} (${info})`
              }
            }
          }
        }
      }

      resolve(results)
    })
  })
}

// 使用纯JS扫描端口（备选方案）
async function scanWithSocket(ip: string): Promise<PortInfo[]> {
  const portsToScan = Object.keys(commonPorts).map(Number)
  const results: PortInfo[] = []
  const timeout = 2000

  const scanPort = (port: number): Promise<PortInfo | null> => {
    return new Promise((resolve) => {
      const socket = new net.Socket()
      let resolved = false

      const cleanup = () => {
        if (!resolved) {
          resolved = true
          socket.destroy()
        }
      }

      socket.setTimeout(timeout)

      socket.on('connect', () => {
        cleanup()
        resolve({
          port,
          state: 'open',
          service: commonPorts[port] || 'unknown'
        })
      })

      socket.on('timeout', () => {
        cleanup()
        resolve(null) // 超时视为关闭
      })

      socket.on('error', () => {
        cleanup()
        resolve(null)
      })

      socket.connect(port, ip)
    })
  }

  // 并发扫描（限制并发数为10）
  const batchSize = 10
  for (let i = 0; i < portsToScan.length; i += batchSize) {
    const batch = portsToScan.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(scanPort))
    results.push(...batchResults.filter((r): r is PortInfo => r !== null))
  }

  return results
}

// 扫描端口（自动选择方案）
import { notify } from './notification'

// 扫描端口（自动选择方案）
async function scanPorts(ip: string): Promise<PortInfo[]> {
  const hasNmap = await isNmapAvailable()
  notify.info(`hasNmap ${hasNmap}`)

  if (hasNmap) {
    notify.info(`正在使用 Nmap 扫描 IP: ${ip}，这可能需要一些时间...`)
    return scanWithNmap(ip)
  } else {
    notify.warning(`未检测到 Nmap，正在使用 Socket 扫描 IP: ${ip}，扫描范围有限`)
    return scanWithSocket(ip)
  }
}

// ============ 主查询函数 ============

// 统一查询入口（支持域名和IP）
async function lookupDomain(input: string): Promise<DomainInfo> {
  const cleanInput = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')

  if (!cleanInput) {
    return { input, ips: [], error: '请输入有效的域名或IP地址' }
  }

  const result: DomainInfo = { input: cleanInput, ips: [] }

  try {
    let targetIP: string

    // 判断输入是域名还是IP
    if (isValidIP(cleanInput)) {
      targetIP = cleanInput
      result.ips = [{ address: cleanInput, type: isIPv4(cleanInput) ? 'IPv4' : 'IPv6' }]
      result.domainDetails = { domain: '', reverseDns: '' }
    } else {
      // 是域名，先解析IP
      const ips = await resolveIPs(cleanInput)
      result.ips = ips

      if (ips.length === 0) {
        return { input: cleanInput, ips: [], error: '无法解析域名' }
      }

      targetIP = ips.find((ip) => ip.type === 'IPv4')?.address || ips[0].address
      result.domainDetails = { domain: cleanInput, reverseDns: '' }

      // 获取技术栈（仅域名查询时）
      const techBase = await analyzeTechStack(cleanInput)
      result.tech = { ...techBase, ports: [] }
    }

    // 获取基础信息
    result.basic = analyzeIP(targetIP)

    // 获取IP详细信息（地理位置、ISP、连接信息）
    const ipInfo = await getFullIpInfo(targetIP)
    if (ipInfo) {
      result.location = ipInfo.location
      result.isp = ipInfo.isp
      result.connection = ipInfo.connection
    }

    // 获取反向DNS
    if (result.domainDetails) {
      result.domainDetails.reverseDns = await reverseDNS(targetIP)
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : '查询失败'
  }

  return result
}

// 单独扫描端口
async function scanPortsHandler(ip: string): Promise<{ success: boolean; ports: PortInfo[]; useNmap: boolean }> {
  notify.info(`正在使用 Nmap 扫描 IP: ${ip}，这可能需要一些时间...`)
  const hasNmap = await isNmapAvailable()
  notify.info(`hasNmap: ${hasNmap}`)
  const ports = await scanPorts(ip)
  return { success: true, ports, useNmap: hasNmap }
}

// ============ IPC 处理器 ============

export function setupDomainLookup(): void {
  // 统一查询（域名或IP）
  ipcMain.handle('domain:lookup', async (_, input: string) => {
    return await lookupDomain(input)
  })

  // 端口扫描
  ipcMain.handle('domain:scanPorts', async (_, ip: string) => {
    return await scanPortsHandler(ip)
  })
}
