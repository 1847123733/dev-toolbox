<script setup lang="ts">
import { ref, computed } from 'vue'

// 查询状态
const input = ref('')
const loading = ref(false)
const scanning = ref(false)
const cancelled = ref(false)
const result = ref<{
  input: string
  ips: { address: string; type: 'IPv4' | 'IPv6' }[]
  basic?: {
    ip: string
    ipVersion: 'IPv4' | 'IPv6'
    addressType: string
    isGlobal: boolean
    networkClass: string
    subnet: string
  }
  location?: {
    country: string
    countryCode: string
    region: string
    city: string
    zip: string
    timezone: string
    lat: number
    lon: number
  }
  isp?: {
    isp: string
    org: string
    as: string
    asname: string
  }
  connection?: {
    connectionType: string
    mobile: boolean
    proxy: boolean
    hosting: boolean
  }
  domainDetails?: {
    domain: string
    reverseDns: string
  }
  tech?: {
    server?: string
    framework?: string
    cdn?: string
    headers: Record<string, string>
    ports: { port: number; state: string; service: string; version?: string }[]
  }
  error?: string
} | null>(null)

// 端口扫描结果
const portScanResult = ref<{
  ports: { port: number; state: string; service: string; version?: string }[]
  useNmap: boolean
} | null>(null)

// 复制状态
const copiedText = ref('')

// 判断是否为IP
const isIP = computed(() => {
  const val = input.value.trim()
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(val) || val.includes(':')
})

// 查询
async function handleLookup() {
  if (!input.value.trim() || loading.value) return

  loading.value = true
  cancelled.value = false
  result.value = null
  portScanResult.value = null

  try {
    const data = await window.api.domainLookup.lookup(input.value)
    if (cancelled.value) return
    result.value = data
  } catch (err) {
    if (cancelled.value) return
    result.value = {
      input: input.value,
      ips: [],
      error: err instanceof Error ? err.message : '查询失败'
    }
  } finally {
    loading.value = false
  }
}

// 端口扫描
async function handleScanPorts() {
  console.log("🚀 ~ handleScanPorts ~ handleScanPorts:", '11')
  if (!result.value?.basic?.ip || scanning.value) return

  scanning.value = true
  try {
    const data = await window.api.domainLookup.scanPorts(result.value.basic.ip)
    console.log("🚀 ~ handleScanPorts ~ data:", data)
    portScanResult.value = data
  } catch {
    portScanResult.value = { ports: [], useNmap: false }
  } finally {
    scanning.value = false
  }
}

// 停止查询
function handleStop() {
  cancelled.value = true
  loading.value = false
}

// 复制文本
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedText.value = text
    setTimeout(() => (copiedText.value = ''), 2000)
  } catch {
    // 忽略
  }
}

// 回车键查询
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') handleLookup()
}

// 安全信息计算
const securityInfo = computed(() => {
  if (!result.value?.connection) return null
  const conn = result.value.connection
  const basic = result.value.basic

  let riskLevel = '低'
  let riskColor = 'text-green-400'
  if (conn.proxy || conn.hosting) {
    riskLevel = '中等'
    riskColor = 'text-yellow-400'
  }

  return {
    riskLevel,
    riskColor,
    isPrivate: basic?.addressType === '私有地址' ? '是' : '否',
    isLoopback: basic?.addressType === '回环地址' ? '是' : '否',
    isMulticast: basic?.networkClass?.includes('D类') ? '是' : '否',
    isReserved: basic?.networkClass?.includes('E类') ? '是' : '否'
  }
})
</script>

<template>
  <div class="domain-lookup h-full flex flex-col p-6 overflow-auto">
    <!-- 标题区域 -->
    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 flex items-center justify-center gap-2">
        🌐 IP地址分析
      </h1>
      <p class="text-[var(--color-text-muted)] text-sm mt-1">
        使用 MaxMind GeoIP 数据库分析IP地址的地理位置、ISP信息、连接类型等详细数据
      </p>
    </div>

    <!-- 搜索区域 -->
    <div class="search-area mb-6 p-4 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-2xl border border-indigo-500/30">
      <div class="flex items-center gap-2 mb-2">
        <span class="w-2 h-2 rounded-full bg-green-400"></span>
        <span class="text-sm font-medium text-[var(--color-text)]">IP地址查询</span>
      </div>
      <p class="text-xs text-[var(--color-text-muted)] mb-3">
        输入IP地址获取详细的地理位置、ISP信息和安全分析
      </p>
      <div class="flex gap-3">
        <input
          v-model="input"
          type="text"
          :placeholder="isIP ? '例如：8.8.8.8' : '输入域名或IP，例如：baidu.com 或 8.8.8.8'"
          class="flex-1 px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          @keydown="handleKeydown"
          :disabled="loading"
        />
        <button
          v-if="!loading"
          @click="handleLookup"
          :disabled="!input.trim()"
          class="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>分析IP</span>
        </button>
        <button
          v-else
          @click="handleStop"
          class="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-medium rounded-xl hover:from-red-600 hover:to-orange-600 transition-all flex items-center gap-2"
        >
          <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>停止</span>
        </button>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="result?.error" class="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
      <div class="flex items-center gap-2 text-red-400">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ result.error }}</span>
      </div>
    </div>

    <!-- 结果区域 - 6卡片布局 -->
    <div v-if="result && !result.error" class="results-area grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <!-- 基础信息卡片 -->
      <div class="card p-5 bg-[var(--color-surface-light)] border border-[var(--color-border)] rounded-2xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <div>
            <h3 class="font-semibold text-[var(--color-text)]">基础信息</h3>
          </div>
        </div>

        <div v-if="result.basic" class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">IP地址</span>
            <span class="text-indigo-400 font-mono cursor-pointer hover:text-indigo-300" @click="copyText(result.basic.ip)">
              {{ result.basic.ip }}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">IP版本</span>
            <span class="text-[var(--color-text)]">{{ result.basic.ipVersion }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">地址类型</span>
            <span class="px-2 py-0.5 text-xs rounded-full bg-indigo-500/20 text-indigo-400">{{ result.basic.addressType }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">全局地址</span>
            <span class="text-[var(--color-text)]">{{ result.basic.isGlobal ? '是' : '否' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">网络类别</span>
            <span class="text-[var(--color-text)]">{{ result.basic.networkClass }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">子网信息</span>
            <span class="text-[var(--color-text)] text-xs max-w-[150px] text-right">{{ result.basic.subnet }}</span>
          </div>
        </div>
      </div>

      <!-- 地理位置卡片 -->
      <div class="card p-5 bg-[var(--color-surface-light)] border border-[var(--color-border)] rounded-2xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 class="font-semibold text-[var(--color-text)]">地理位置</h3>
          </div>
        </div>

        <div v-if="result.location" class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">国家</span>
            <span class="text-indigo-400">{{ result.location.country }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">国家代码</span>
            <span class="text-[var(--color-text)]">{{ result.location.countryCode }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">省份/州</span>
            <span class="text-[var(--color-text)]">{{ result.location.region || '-' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">城市</span>
            <span class="text-indigo-400">{{ result.location.city }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">邮政编码</span>
            <span class="text-[var(--color-text)]">{{ result.location.zip || '-' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">时区</span>
            <span class="text-[var(--color-text)]">{{ result.location.timezone || '-' }}</span>
          </div>
          <div v-if="result.location.lat && result.location.lon" class="pt-2 border-t border-[var(--color-border)]">
            <div class="flex items-center gap-1 text-red-400 text-xs">
              <span>📍</span>
              <span>({{ result.location.lat.toFixed(4) }}, {{ result.location.lon.toFixed(4) }})</span>
            </div>
            <p class="text-[var(--color-text-muted)] text-xs mt-1">精度半径: 1000 公里</p>
          </div>
        </div>
        <div v-else class="text-[var(--color-text-muted)] text-sm">无法获取位置信息</div>
      </div>

      <!-- ISP信息卡片 -->
      <div class="card p-5 bg-[var(--color-surface-light)] border border-[var(--color-border)] rounded-2xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <div>
            <h3 class="font-semibold text-[var(--color-text)]">ISP信息</h3>
          </div>
        </div>

        <div v-if="result.isp" class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">ISP</span>
            <span class="text-indigo-400 max-w-[150px] text-right truncate" :title="result.isp.isp">{{ result.isp.isp }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">组织</span>
            <span class="text-[var(--color-text)] max-w-[150px] text-right truncate" :title="result.isp.org">{{ result.isp.org }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">AS号码</span>
            <span class="text-indigo-400">{{ result.isp.as?.split(' ')[0] || '-' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">AS组织</span>
            <span class="text-[var(--color-text)] max-w-[150px] text-right truncate" :title="result.isp.asname">{{ result.isp.asname || '-' }}</span>
          </div>
        </div>
        <div v-else class="text-[var(--color-text-muted)] text-sm">无法获取ISP信息</div>
      </div>

      <!-- 连接信息卡片 -->
      <div class="card p-5 bg-[var(--color-surface-light)] border border-[var(--color-border)] rounded-2xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h3 class="font-semibold text-[var(--color-text)]">连接信息</h3>
          </div>
        </div>

        <div v-if="result.connection" class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">连接类型</span>
            <span class="px-2 py-0.5 text-xs rounded-full bg-indigo-500/20 text-indigo-400">{{ result.connection.connectionType }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">移动网络</span>
            <span :class="result.connection.mobile ? 'text-green-400' : 'text-[var(--color-text)]'">{{ result.connection.mobile ? '是' : '否' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">代理/VPN</span>
            <span :class="result.connection.proxy ? 'text-yellow-400' : 'text-[var(--color-text)]'">{{ result.connection.proxy ? '是' : '否' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">数据中心</span>
            <span :class="result.connection.hosting ? 'text-purple-400' : 'text-[var(--color-text)]'">{{ result.connection.hosting ? '是' : '否' }}</span>
          </div>
        </div>
        <div v-else class="text-[var(--color-text-muted)] text-sm">无法获取连接信息</div>
      </div>

      <!-- 域名信息卡片 -->
      <div class="card p-5 bg-[var(--color-surface-light)] border border-[var(--color-border)] rounded-2xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <div>
            <h3 class="font-semibold text-[var(--color-text)]">域名信息</h3>
          </div>
        </div>

        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">域名</span>
            <span class="text-indigo-400 max-w-[180px] text-right truncate">{{ result.domainDetails?.domain || '-' }}</span>
          </div>
          <div class="flex justify-between items-start">
            <span class="text-[var(--color-text-muted)]">反向DNS</span>
            <span class="text-[var(--color-text)] max-w-[180px] text-right break-all text-xs">{{ result.domainDetails?.reverseDns || '-' }}</span>
          </div>
          <!-- 解析的IP列表 -->
          <div v-if="result.ips.length > 1" class="pt-2 border-t border-[var(--color-border)]">
            <p class="text-[var(--color-text-muted)] text-xs mb-2">解析的IP地址:</p>
            <div class="space-y-1">
              <div v-for="ip in result.ips" :key="ip.address" class="flex items-center gap-2">
                <span class="text-xs px-1.5 py-0.5 rounded-full" :class="ip.type === 'IPv4' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'">
                  {{ ip.type }}
                </span>
                <code class="text-xs font-mono text-[var(--color-text)] cursor-pointer hover:text-indigo-400" @click="copyText(ip.address)">{{ ip.address }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 安全信息卡片 -->
      <div class="card p-5 bg-[var(--color-surface-light)] border border-[var(--color-border)] rounded-2xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-green-500 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 class="font-semibold text-[var(--color-text)]">安全信息</h3>
          </div>
        </div>

        <div v-if="securityInfo" class="space-y-2 text-sm">
          <div class="flex justify-between items-center">
            <span class="text-[var(--color-text-muted)]">风险等级</span>
            <span class="px-2 py-0.5 text-xs rounded-full" :class="securityInfo.riskLevel === '低' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'">
              {{ securityInfo.riskLevel }}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">私有地址</span>
            <span :class="securityInfo.isPrivate === '是' ? 'text-green-400' : 'text-[var(--color-text)]'">{{ securityInfo.isPrivate }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">回环地址</span>
            <span :class="securityInfo.isLoopback === '是' ? 'text-yellow-400' : 'text-[var(--color-text)]'">{{ securityInfo.isLoopback }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">多播地址</span>
            <span class="text-[var(--color-text)]">{{ securityInfo.isMulticast }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[var(--color-text-muted)]">保留地址</span>
            <span class="text-[var(--color-text)]">{{ securityInfo.isReserved }}</span>
          </div>
        </div>
        <div v-else class="text-[var(--color-text-muted)] text-sm">无安全信息</div>
      </div>

      <!-- 技术栈/端口扫描卡片 - 占满整行 -->
      <div class="card p-5 bg-[var(--color-surface-light)] border border-[var(--color-border)] rounded-2xl md:col-span-2 xl:col-span-3">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-[var(--color-text)]">技术栈 & 端口扫描</h3>
              <p class="text-xs text-[var(--color-text-muted)]">检测服务器技术和开放端口</p>
            </div>
          </div>
          <button
            @click="handleScanPorts"
            :disabled="scanning || !result.basic?.ip"
            class="px-4 py-2 text-sm bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg hover:from-violet-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <svg v-if="scanning" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ scanning ? '扫描中...' : '扫描端口' }}</span>
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- 技术栈 -->
          <div>
            <h4 class="text-sm font-medium text-[var(--color-text-muted)] mb-3">识别的技术</h4>
            <div v-if="result.tech && (result.tech.server || result.tech.framework || result.tech.cdn)" class="flex flex-wrap gap-2">
              <span v-if="result.tech.server" class="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-500">
                服务器: {{ result.tech.server }}
              </span>
              <span v-if="result.tech.framework" class="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-pink-500">
                框架: {{ result.tech.framework }}
              </span>
              <span v-if="result.tech.cdn" class="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-yellow-500">
                CDN: {{ result.tech.cdn }}
              </span>
            </div>
            <div v-else class="text-[var(--color-text-muted)] text-sm">未识别到明确的技术栈</div>
          </div>

          <!-- 端口扫描结果 -->
          <div>
            <h4 class="text-sm font-medium text-[var(--color-text-muted)] mb-3">
              开放端口
              <span v-if="portScanResult" class="text-xs ml-2">
                ({{ portScanResult.useNmap ? 'Nmap' : 'Socket' }})
              </span>
            </h4>
            <div v-if="portScanResult && portScanResult.ports.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              <div
                v-for="port in portScanResult.ports"
                :key="port.port"
                class="p-2 bg-[var(--color-surface)] rounded-lg border border-green-500/30"
              >
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-green-400"></span>
                  <span class="text-sm font-mono text-[var(--color-text)]">{{ port.port }}</span>
                </div>
                <p class="text-xs text-[var(--color-text-muted)] mt-1">{{ port.service }}</p>
                <p v-if="port.version" class="text-xs text-indigo-400 truncate">{{ port.version }}</p>
              </div>
            </div>
            <div v-else-if="portScanResult && portScanResult.ports.length === 0" class="text-[var(--color-text-muted)] text-sm">
              未发现开放端口
            </div>
            <div v-else class="text-[var(--color-text-muted)] text-sm">
              点击"扫描端口"按钮开始扫描
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!result && !loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
          <svg class="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </div>
        <p class="text-[var(--color-text-muted)]">输入域名或IP地址开始分析</p>
        <p class="text-xs text-[var(--color-text-muted)] mt-1">支持分析地理位置、ISP信息、端口扫描等</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.domain-lookup {
  background: linear-gradient(180deg, var(--color-surface) 0%, rgba(30, 30, 46, 0.95) 100%);
}

.card {
  transition: all 0.3s ease;
}

.card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.1);
}

/* 结果渐入动画 */
.results-area > .card {
  animation: fadeInUp 0.4s ease-out;
}

.results-area > .card:nth-child(2) {
  animation-delay: 0.05s;
}

.results-area > .card:nth-child(3) {
  animation-delay: 0.1s;
}

.results-area > .card:nth-child(4) {
  animation-delay: 0.15s;
}

.results-area > .card:nth-child(5) {
  animation-delay: 0.2s;
}

.results-area > .card:nth-child(6) {
  animation-delay: 0.25s;
}

.results-area > .card:nth-child(7) {
  animation-delay: 0.3s;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
