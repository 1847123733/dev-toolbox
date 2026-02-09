<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { HttpRequest, HttpResponse, HistoryItem, KeyValuePair } from './types'
import RequestPanel from './components/RequestPanel.vue'
import ResponsePanel from './components/ResponsePanel.vue'
import HistoryPanel from './components/HistoryPanel.vue'

const HISTORY_KEY = 'httpclient_history'
const MAX_HISTORY = 100

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function createEmptyRequest(): HttpRequest {
  return {
    method: 'GET',
    url: '',
    headers: [{ id: genId(), key: '', value: '', enabled: true }],
    queryParams: [{ id: genId(), key: '', value: '', enabled: true }],
    bodyType: 'none',
    body: '',
    formData: [{ id: genId(), key: '', value: '', enabled: true }]
  }
}

const currentRequest = ref<HttpRequest>(createEmptyRequest())
const response = ref<HttpResponse | null>(null)
const loading = ref(false)
const history = ref<HistoryItem[]>([])
const showHistory = ref(true)

// 加载历史记录
onMounted(() => {
  try {
    const saved = localStorage.getItem(HISTORY_KEY)
    if (saved) {
      history.value = JSON.parse(saved)
    }
  } catch {
    // 忽略
  }
})

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value.slice(0, MAX_HISTORY)))
  } catch {
    // 忽略
  }
}

// 构建最终 URL（合并 query params）
function buildUrl(request: HttpRequest): string {
  let url = request.url.trim()
  if (!url) return ''

  // 自动补全协议
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }

  const enabledParams = request.queryParams.filter(p => p.enabled && p.key)
  if (enabledParams.length > 0) {
    try {
      const urlObj = new URL(url)
      enabledParams.forEach(p => urlObj.searchParams.set(p.key, p.value))
      return urlObj.toString()
    } catch {
      // URL 不合法，附加 query string
      const qs = enabledParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
      return url + (url.includes('?') ? '&' : '?') + qs
    }
  }

  return url
}

// 构建请求头
function buildHeaders(request: HttpRequest): Record<string, string> {
  const headers: Record<string, string> = {}
  request.headers.filter(h => h.enabled && h.key).forEach(h => {
    headers[h.key] = h.value
  })

  // 根据 body type 自动设置 Content-Type（如果未手动设置）
  const hasContentType = Object.keys(headers).some(k => k.toLowerCase() === 'content-type')
  if (!hasContentType && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    if (request.bodyType === 'json') {
      headers['Content-Type'] = 'application/json'
    } else if (request.bodyType === 'form') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    } else if (request.bodyType === 'text') {
      headers['Content-Type'] = 'text/plain'
    }
  }

  return headers
}

// 构建请求体
function buildBody(request: HttpRequest): string | undefined {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return undefined
  if (request.bodyType === 'none') return undefined

  if (request.bodyType === 'json' || request.bodyType === 'text') {
    return request.body || undefined
  }

  if (request.bodyType === 'form') {
    const params = request.formData
      .filter((f: KeyValuePair) => f.enabled && f.key)
      .map((f: KeyValuePair) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
      .join('&')
    return params || undefined
  }

  return undefined
}

// 发送请求
async function sendRequest() {
  if (!currentRequest.value.url.trim() || loading.value) return

  loading.value = true
  response.value = null

  try {
    const url = buildUrl(currentRequest.value)
    const headers = buildHeaders(currentRequest.value)
    const body = buildBody(currentRequest.value)

    const result = await window.api.httpClient.send({
      method: currentRequest.value.method,
      url,
      headers,
      body
    })

    response.value = result

    // 添加到历史记录
    const historyItem: HistoryItem = {
      id: genId(),
      request: JSON.parse(JSON.stringify(currentRequest.value)),
      response: result,
      timestamp: Date.now()
    }
    history.value.unshift(historyItem)
    if (history.value.length > MAX_HISTORY) {
      history.value = history.value.slice(0, MAX_HISTORY)
    }
    saveHistory()
  } catch (err) {
    response.value = {
      status: 0,
      statusText: 'Error',
      headers: {},
      body: '',
      size: 0,
      time: 0,
      error: err instanceof Error ? err.message : '请求失败'
    }
  } finally {
    loading.value = false
  }
}

// 历史记录操作
function selectHistory(item: HistoryItem) {
  currentRequest.value = JSON.parse(JSON.stringify(item.request))
  response.value = item.response
}

function removeHistory(id: string) {
  history.value = history.value.filter(h => h.id !== id)
  saveHistory()
}

function clearHistory() {
  history.value = []
  saveHistory()
}
</script>

<template>
  <div class="http-client h-full flex flex-col overflow-hidden">
    <!-- 标题 -->
    <div class="px-4 py-3 border-b border-[var(--color-border)] shrink-0">
      <h1 class="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
        HTTP 请求工具
      </h1>
      <p class="text-[var(--color-text-muted)] text-xs mt-0.5">
        发送 HTTP 请求，支持自定义 Headers、Body、Query Params，自动使用应用代理
      </p>
    </div>

    <!-- 主体 -->
    <div class="flex flex-1 overflow-hidden relative">
      <!-- 历史记录面板 -->
      <HistoryPanel
        :history="history"
        :visible="showHistory"
        @select="selectHistory"
        @remove="removeHistory"
        @clear="clearHistory"
        @toggle="showHistory = !showHistory"
      />

      <!-- 请求/响应区域 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- 请求面板 -->
        <div class="flex-1 min-h-0 border-b border-[var(--color-border)]">
          <RequestPanel
            v-model="currentRequest"
            :loading="loading"
            @send="sendRequest"
          />
        </div>

        <!-- 响应面板 -->
        <div class="flex-1 min-h-0">
          <ResponsePanel
            :response="response"
            :loading="loading"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.http-client {
  background: linear-gradient(180deg, var(--color-surface) 0%, rgba(30, 30, 46, 0.95) 100%);
}
</style>
