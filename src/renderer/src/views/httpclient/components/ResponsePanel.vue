<script setup lang="ts">
import { ref, computed } from 'vue'
import type { HttpResponse } from '../types'

const props = defineProps<{
  response: HttpResponse | null
  loading: boolean
}>()

const activeTab = ref<'body' | 'headers'>('body')
const copied = ref(false)

const statusClass = computed(() => {
  if (!props.response) return ''
  const s = props.response.status
  if (s >= 200 && s < 300) return 'text-green-400 bg-green-500/10'
  if (s >= 300 && s < 400) return 'text-blue-400 bg-blue-500/10'
  if (s >= 400 && s < 500) return 'text-yellow-400 bg-yellow-500/10'
  if (s >= 500) return 'text-red-400 bg-red-500/10'
  return 'text-red-400 bg-red-500/10'
})

const formattedBody = computed(() => {
  if (!props.response?.body) return ''
  // 尝试格式化 JSON
  try {
    const parsed = JSON.parse(props.response.body)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return props.response.body
  }
})

const isJson = computed(() => {
  if (!props.response?.body) return false
  try {
    JSON.parse(props.response.body)
    return true
  } catch {
    return false
  }
})

const headerEntries = computed(() => {
  if (!props.response?.headers) return []
  return Object.entries(props.response.headers)
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function copyBody() {
  if (!formattedBody.value) return
  try {
    await navigator.clipboard.writeText(formattedBody.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // 忽略
  }
}
</script>

<template>
  <div class="response-panel flex flex-col h-full">
    <!-- 状态栏 -->
    <div class="flex items-center gap-3 px-3 py-2 border-b border-[var(--color-border)]">
      <template v-if="loading">
        <div class="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
          <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>请求中...</span>
        </div>
      </template>
      <template v-else-if="response">
        <!-- 状态码 -->
        <span class="px-2 py-0.5 text-xs font-bold rounded" :class="statusClass">
          {{ response.status }} {{ response.statusText }}
        </span>
        <!-- 耗时 -->
        <span class="text-xs text-[var(--color-text-muted)]">{{ response.time }}ms</span>
        <!-- 大小 -->
        <span class="text-xs text-[var(--color-text-muted)]">{{ formatSize(response.size) }}</span>
        <!-- 错误 -->
        <span v-if="response.error" class="text-xs text-red-400 ml-auto truncate max-w-[300px]" :title="response.error">
          {{ response.error }}
        </span>
      </template>
      <template v-else>
        <span class="text-xs text-[var(--color-text-muted)]">Response</span>
      </template>
    </div>

    <!-- Tab 栏 -->
    <div class="flex items-center border-b border-[var(--color-border)] px-3" v-if="response && !response.error">
      <button
        v-for="tab in (['body', 'headers'] as const)"
        :key="tab"
        @click="activeTab = tab"
        class="px-4 py-2 text-xs font-medium border-b-2 transition-colors"
        :class="activeTab === tab
          ? 'border-indigo-500 text-indigo-400'
          : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'"
      >
        {{ tab === 'body' ? 'Body' : 'Headers' }}
        <span v-if="tab === 'headers'" class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-indigo-500/20 text-indigo-400">
          {{ headerEntries.length }}
        </span>
      </button>

      <!-- 复制按钮 -->
      <button
        v-if="activeTab === 'body'"
        @click="copyBody"
        class="ml-auto px-2 py-1 text-[10px] rounded bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-indigo-400 transition-colors flex items-center gap-1"
      >
        <svg v-if="!copied" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>
        <svg v-else class="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        {{ copied ? '已复制' : '复制' }}
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-auto">
      <template v-if="response && !response.error">
        <!-- Body -->
        <div v-if="activeTab === 'body'" class="p-3">
          <pre
            class="text-xs font-mono leading-relaxed text-[var(--color-text)] whitespace-pre-wrap break-all"
            :class="{ 'text-green-300': isJson }"
          >{{ formattedBody }}</pre>
        </div>

        <!-- Headers -->
        <div v-if="activeTab === 'headers'" class="p-3">
          <div class="space-y-1">
            <div
              v-for="[key, value] in headerEntries"
              :key="key"
              class="flex items-start gap-3 py-1.5 border-b border-[var(--color-border)] last:border-0"
            >
              <span class="text-xs font-medium text-indigo-400 min-w-[140px] shrink-0">{{ key }}</span>
              <span class="text-xs text-[var(--color-text)] break-all">{{ value }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <div v-else-if="!loading && !response" class="flex items-center justify-center h-full">
        <div class="text-center">
          <svg class="w-12 h-12 mx-auto mb-3 text-[var(--color-text-muted)] opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <p class="text-sm text-[var(--color-text-muted)]">发送请求查看响应</p>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="response?.error" class="flex items-center justify-center h-full">
        <div class="text-center px-6">
          <svg class="w-12 h-12 mx-auto mb-3 text-red-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm text-red-400">{{ response.error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
