<script setup lang="ts">
import { ref, computed } from 'vue'

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

const portScanResult = ref<{
  ports: { port: number; state: string; service: string; version?: string }[]
  useNmap: boolean
} | null>(null)

const copiedText = ref('')

const isIP = computed(() => {
  const val = input.value.trim()
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(val) || val.includes(':')
})

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

async function handleScanPorts() {
  if (!result.value?.basic?.ip || scanning.value) return

  scanning.value = true
  try {
    const data = await window.api.domainLookup.scanPorts(result.value.basic.ip)
    portScanResult.value = data
  } catch {
    portScanResult.value = { ports: [], useNmap: false }
  } finally {
    scanning.value = false
  }
}

function handleStop() {
  cancelled.value = true
  loading.value = false
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedText.value = text
    setTimeout(() => (copiedText.value = ''), 2000)
  } catch {
    // ignore
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') handleLookup()
}

const securityInfo = computed(() => {
  if (!result.value?.connection) return null
  const conn = result.value.connection
  const basic = result.value.basic

  let riskLevel = '低'
  let riskColor = 'risk-low'
  if (conn.proxy || conn.hosting) {
    riskLevel = '中等'
    riskColor = 'risk-medium'
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
  <div class="domain-page">
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">IP地址分析</h1>
      <p class="page-desc">分析IP地址的地理位置、ISP信息、连接类型等详细数据</p>
    </div>

    <div class="page-body">
      <!-- Search -->
      <div class="search-box">
        <div class="search-row">
          <input
            v-model="input"
            type="text"
            :placeholder="isIP ? '例如：8.8.8.8' : '输入域名或IP，例如：baidu.com 或 8.8.8.8'"
            class="search-input"
            @keydown="handleKeydown"
            :disabled="loading"
          />
          <button
            v-if="!loading"
            @click="handleLookup"
            :disabled="!input.trim()"
            class="search-btn"
          >
            <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>分析</span>
          </button>
          <button v-else @click="handleStop" class="stop-btn">
            <svg class="btn-icon spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>停止</span>
          </button>
        </div>
      </div>

      <!-- Error -->
      <div v-if="result?.error" class="error-banner">
        <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ result.error }}</span>
      </div>

      <!-- Results Grid -->
      <div v-if="result && !result.error" class="results-grid">
        <!-- Basic Info -->
        <div class="info-card">
          <div class="card-header">
            <div class="card-icon blue">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <h3 class="card-title">基础信息</h3>
          </div>
          <div v-if="result.basic" class="card-rows">
            <div class="row"><span class="row-label">IP地址</span><span class="row-value highlight clickable" @click="copyText(result.basic.ip)">{{ result.basic.ip }}</span></div>
            <div class="row"><span class="row-label">IP版本</span><span class="row-value">{{ result.basic.ipVersion }}</span></div>
            <div class="row"><span class="row-label">地址类型</span><span class="row-badge">{{ result.basic.addressType }}</span></div>
            <div class="row"><span class="row-label">全局地址</span><span class="row-value">{{ result.basic.isGlobal ? '是' : '否' }}</span></div>
            <div class="row"><span class="row-label">网络类别</span><span class="row-value">{{ result.basic.networkClass }}</span></div>
            <div class="row"><span class="row-label">子网信息</span><span class="row-value small">{{ result.basic.subnet }}</span></div>
          </div>
        </div>

        <!-- Location -->
        <div class="info-card">
          <div class="card-header">
            <div class="card-icon green">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 class="card-title">地理位置</h3>
          </div>
          <div v-if="result.location" class="card-rows">
            <div class="row"><span class="row-label">国家</span><span class="row-value highlight">{{ result.location.country }}</span></div>
            <div class="row"><span class="row-label">国家代码</span><span class="row-value">{{ result.location.countryCode }}</span></div>
            <div class="row"><span class="row-label">省份/州</span><span class="row-value">{{ result.location.region || '-' }}</span></div>
            <div class="row"><span class="row-label">城市</span><span class="row-value highlight">{{ result.location.city }}</span></div>
            <div class="row"><span class="row-label">邮政编码</span><span class="row-value">{{ result.location.zip || '-' }}</span></div>
            <div class="row"><span class="row-label">时区</span><span class="row-value">{{ result.location.timezone || '-' }}</span></div>
            <div v-if="result.location.lat && result.location.lon" class="row-coords">
              <span>({{ result.location.lat.toFixed(4) }}, {{ result.location.lon.toFixed(4) }})</span>
            </div>
          </div>
          <div v-else class="card-empty">无法获取位置信息</div>
        </div>

        <!-- ISP -->
        <div class="info-card">
          <div class="card-header">
            <div class="card-icon purple">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h3 class="card-title">ISP信息</h3>
          </div>
          <div v-if="result.isp" class="card-rows">
            <div class="row"><span class="row-label">ISP</span><span class="row-value highlight truncate" :title="result.isp.isp">{{ result.isp.isp }}</span></div>
            <div class="row"><span class="row-label">组织</span><span class="row-value truncate" :title="result.isp.org">{{ result.isp.org }}</span></div>
            <div class="row"><span class="row-label">AS号码</span><span class="row-value highlight">{{ result.isp.as?.split(' ')[0] || '-' }}</span></div>
            <div class="row"><span class="row-label">AS组织</span><span class="row-value truncate" :title="result.isp.asname">{{ result.isp.asname || '-' }}</span></div>
          </div>
          <div v-else class="card-empty">无法获取ISP信息</div>
        </div>

        <!-- Connection -->
        <div class="info-card">
          <div class="card-header">
            <div class="card-icon orange">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 class="card-title">连接信息</h3>
          </div>
          <div v-if="result.connection" class="card-rows">
            <div class="row"><span class="row-label">连接类型</span><span class="row-badge">{{ result.connection.connectionType }}</span></div>
            <div class="row"><span class="row-label">移动网络</span><span class="row-value" :class="{ 'text-green': result.connection.mobile }">{{ result.connection.mobile ? '是' : '否' }}</span></div>
            <div class="row"><span class="row-label">代理/VPN</span><span class="row-value" :class="{ 'text-yellow': result.connection.proxy }">{{ result.connection.proxy ? '是' : '否' }}</span></div>
            <div class="row"><span class="row-label">数据中心</span><span class="row-value" :class="{ 'text-purple': result.connection.hosting }">{{ result.connection.hosting ? '是' : '否' }}</span></div>
          </div>
          <div v-else class="card-empty">无法获取连接信息</div>
        </div>

        <!-- Domain -->
        <div class="info-card">
          <div class="card-header">
            <div class="card-icon cyan">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <h3 class="card-title">域名信息</h3>
          </div>
          <div class="card-rows">
            <div class="row"><span class="row-label">域名</span><span class="row-value highlight truncate">{{ result.domainDetails?.domain || '-' }}</span></div>
            <div class="row"><span class="row-label">反向DNS</span><span class="row-value small break-all">{{ result.domainDetails?.reverseDns || '-' }}</span></div>
            <div v-if="result.ips.length > 1" class="ip-list">
              <p class="ip-list-title">解析的IP地址:</p>
              <div class="ip-items">
                <div v-for="ip in result.ips" :key="ip.address" class="ip-item">
                  <span class="ip-type" :class="ip.type === 'IPv4' ? 'ipv4' : 'ipv6'">{{ ip.type }}</span>
                  <code class="ip-addr clickable" @click="copyText(ip.address)">{{ ip.address }}</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Security -->
        <div class="info-card">
          <div class="card-header">
            <div class="card-icon teal">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 class="card-title">安全信息</h3>
          </div>
          <div v-if="securityInfo" class="card-rows">
            <div class="row"><span class="row-label">风险等级</span><span class="row-badge" :class="securityInfo.riskColor">{{ securityInfo.riskLevel }}</span></div>
            <div class="row"><span class="row-label">私有地址</span><span class="row-value" :class="{ 'text-green': securityInfo.isPrivate === '是' }">{{ securityInfo.isPrivate }}</span></div>
            <div class="row"><span class="row-label">回环地址</span><span class="row-value" :class="{ 'text-yellow': securityInfo.isLoopback === '是' }">{{ securityInfo.isLoopback }}</span></div>
            <div class="row"><span class="row-label">多播地址</span><span class="row-value">{{ securityInfo.isMulticast }}</span></div>
            <div class="row"><span class="row-label">保留地址</span><span class="row-value">{{ securityInfo.isReserved }}</span></div>
          </div>
          <div v-else class="card-empty">无安全信息</div>
        </div>

        <!-- Tech & Ports - full width -->
        <div class="info-card full-width">
          <div class="card-header">
            <div class="card-header-left">
              <div class="card-icon violet">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 class="card-title">技术栈 & 端口扫描</h3>
                <p class="card-subtitle">检测服务器技术和开放端口</p>
              </div>
            </div>
            <button @click="handleScanPorts" :disabled="scanning || !result.basic?.ip" class="scan-btn">
              <svg v-if="scanning" class="btn-icon spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ scanning ? '扫描中...' : '扫描端口' }}</span>
            </button>
          </div>

          <div class="tech-grid">
            <div>
              <h4 class="sub-title">识别的技术</h4>
              <div v-if="result.tech && (result.tech.server || result.tech.framework || result.tech.cdn)" class="tech-tags">
                <span v-if="result.tech.server" class="tech-tag blue">服务器: {{ result.tech.server }}</span>
                <span v-if="result.tech.framework" class="tech-tag purple">框架: {{ result.tech.framework }}</span>
                <span v-if="result.tech.cdn" class="tech-tag orange">CDN: {{ result.tech.cdn }}</span>
              </div>
              <div v-else class="card-empty">未识别到明确的技术栈</div>
            </div>

            <div>
              <h4 class="sub-title">
                开放端口
                <span v-if="portScanResult" class="sub-tag">({{ portScanResult.useNmap ? 'Nmap' : 'Socket' }})</span>
              </h4>
              <div v-if="portScanResult && portScanResult.ports.length > 0" class="port-grid">
                <div v-for="port in portScanResult.ports" :key="port.port" class="port-item">
                  <div class="port-header">
                    <span class="port-dot"></span>
                    <span class="port-number">{{ port.port }}</span>
                  </div>
                  <p class="port-service">{{ port.service }}</p>
                  <p v-if="port.version" class="port-version">{{ port.version }}</p>
                </div>
              </div>
              <div v-else-if="portScanResult && portScanResult.ports.length === 0" class="card-empty">未发现开放端口</div>
              <div v-else class="card-empty">点击"扫描端口"按钮开始扫描</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!result && !loading" class="empty-state">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </div>
        <p class="empty-text">输入域名或IP地址开始分析</p>
        <p class="empty-hint">支持分析地理位置、ISP信息、端口扫描等</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.domain-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

.page-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.page-desc {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.page-body {
  flex: 1;
  overflow: auto;
  padding: 20px 24px;
}

/* Search */
.search-box {
  margin-bottom: 20px;
  padding: 16px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
}

.search-row {
  display: flex;
  gap: 10px;
}

.search-input {
  flex: 1;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.search-input:focus {
  border-color: rgba(129, 140, 248, 0.5);
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.1);
}

.search-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.6;
}

.search-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--color-primary);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.search-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stop-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  border: none;
  background: #ef4444;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-icon {
  width: 18px;
  height: 18px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error */
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.2);
  color: #f87171;
  font-size: 14px;
}

.error-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Results Grid */
.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.info-card {
  padding: 20px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
  animation: cardIn 0.35s ease-out both;
}

.info-card:hover {
  border-color: var(--color-border-hover);
  box-shadow: 0 0 24px rgba(129, 140, 248, 0.06);
}

.info-card:nth-child(2) { animation-delay: 0.04s; }
.info-card:nth-child(3) { animation-delay: 0.08s; }
.info-card:nth-child(4) { animation-delay: 0.12s; }
.info-card:nth-child(5) { animation-delay: 0.16s; }
.info-card:nth-child(6) { animation-delay: 0.2s; }
.info-card:nth-child(7) { animation-delay: 0.24s; }

.full-width {
  grid-column: 1 / -1;
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.card-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.card-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon svg {
  width: 18px;
  height: 18px;
  color: white;
}

.card-icon.blue { background: linear-gradient(135deg, #3b82f6, #06b6d4); }
.card-icon.green { background: linear-gradient(135deg, #22c55e, #10b981); }
.card-icon.purple { background: linear-gradient(135deg, #a855f7, #ec4899); }
.card-icon.orange { background: linear-gradient(135deg, #f97316, #eab308); }
.card-icon.cyan { background: linear-gradient(135deg, #06b6d4, #3b82f6); }
.card-icon.teal { background: linear-gradient(135deg, #14b8a6, #22c55e); }
.card-icon.violet { background: linear-gradient(135deg, #8b5cf6, #a855f7); }

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.card-subtitle {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.card-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.row-label {
  color: var(--color-text-muted);
}

.row-value {
  color: var(--color-text);
  max-width: 160px;
  text-align: right;
}

.row-value.highlight {
  color: var(--color-primary);
}

.row-value.clickable {
  cursor: pointer;
  font-family: 'SF Mono', monospace;
}

.row-value.clickable:hover {
  color: var(--color-secondary);
}

.row-value.small {
  font-size: 11px;
}

.row-value.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-value.break-all {
  word-break: break-all;
}

.row-badge {
  padding: 2px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(129, 140, 248, 0.12);
  color: var(--color-primary);
}

.row-badge.risk-low {
  background: rgba(34, 197, 94, 0.12);
  color: #34d399;
}

.row-badge.risk-medium {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
}

.text-green { color: #34d399; }
.text-yellow { color: #fbbf24; }
.text-purple { color: #a78bfa; }

.row-coords {
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-muted);
}

.card-empty {
  font-size: 13px;
  color: var(--color-text-muted);
}

/* IP List */
.ip-list {
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.ip-list-title {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

.ip-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ip-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ip-type {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 99px;
  font-weight: 500;
}

.ip-type.ipv4 { background: rgba(59, 130, 246, 0.12); color: #60a5fa; }
.ip-type.ipv6 { background: rgba(168, 85, 247, 0.12); color: #c084fc; }

.ip-addr {
  font-size: 12px;
  font-family: 'SF Mono', monospace;
  color: var(--color-text);
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  color: var(--color-primary);
}

/* Tech & Ports */
.scan-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  border: none;
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.scan-btn:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.25);
}

.scan-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tech-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 768px) {
  .tech-grid {
    grid-template-columns: 1fr;
  }
}

.sub-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-muted);
  margin-bottom: 10px;
}

.sub-tag {
  font-size: 11px;
  margin-left: 4px;
  font-weight: 400;
}

.tech-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tech-tag {
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: white;
}

.tech-tag.blue { background: linear-gradient(135deg, #3b82f6, #06b6d4); }
.tech-tag.purple { background: linear-gradient(135deg, #a855f7, #ec4899); }
.tech-tag.orange { background: linear-gradient(135deg, #f97316, #eab308); }

.port-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.port-item {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.port-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.port-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
}

.port-number {
  font-size: 13px;
  font-family: 'SF Mono', monospace;
  color: var(--color-text);
}

.port-service {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.port-version {
  font-size: 11px;
  color: var(--color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-lg);
  background: rgba(129, 140, 248, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.empty-icon svg {
  width: 32px;
  height: 32px;
  color: var(--color-primary);
  opacity: 0.6;
}

.empty-text {
  font-size: 14px;
  color: var(--color-text-muted);
}

.empty-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  opacity: 0.6;
  margin-top: 4px;
}

.opacity-25 { opacity: 0.25; }
.opacity-75 { opacity: 0.75; }
</style>
