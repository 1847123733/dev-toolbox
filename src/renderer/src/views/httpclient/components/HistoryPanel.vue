<script setup lang="ts">
import type { HistoryItem } from '../types'

defineProps<{
  history: HistoryItem[]
  visible: boolean
}>()

const emit = defineEmits<{
  select: [item: HistoryItem]
  remove: [id: string]
  clear: []
  toggle: []
}>()

const methodColors: Record<string, string> = {
  GET: 'text-green-400 bg-green-500/10',
  POST: 'text-yellow-400 bg-yellow-500/10',
  PUT: 'text-blue-400 bg-blue-500/10',
  DELETE: 'text-red-400 bg-red-500/10',
  PATCH: 'text-purple-400 bg-purple-500/10',
  HEAD: 'text-cyan-400 bg-cyan-500/10',
  OPTIONS: 'text-gray-400 bg-gray-500/10'
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function getShortUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname + u.search
  } catch {
    return url
  }
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-400'
  if (status >= 300 && status < 400) return 'text-blue-400'
  if (status >= 400 && status < 500) return 'text-yellow-400'
  return 'text-red-400'
}
</script>

<template>
  <!-- 折叠按钮 -->
  <button
    @click="emit('toggle')"
    class="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-5 h-10 bg-[var(--color-surface-light)] border border-[var(--color-border)] border-l-0 rounded-r flex items-center justify-center text-[var(--color-text-muted)] hover:text-indigo-400 transition-colors"
    :class="visible ? 'left-[220px]' : 'left-0'"
  >
    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" :class="{ 'rotate-180': !visible }">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
  </button>

  <!-- 历史面板 -->
  <div
    v-if="visible"
    class="history-panel w-[220px] border-r border-[var(--color-border)] flex flex-col bg-[var(--color-surface-light)]/50 shrink-0"
  >
    <!-- 标题 -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
      <span class="text-xs font-medium text-[var(--color-text)]">历史记录</span>
      <button
        v-if="history.length > 0"
        @click="emit('clear')"
        class="text-[10px] text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
      >
        清空
      </button>
    </div>

    <!-- 列表 -->
    <div class="flex-1 overflow-auto">
      <div v-if="history.length === 0" class="p-4 text-center text-[var(--color-text-muted)] text-xs">
        暂无历史记录
      </div>
      <div
        v-for="item in history"
        :key="item.id"
        @click="emit('select', item)"
        class="group px-3 py-2 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-lighter)] transition-colors"
      >
        <div class="flex items-center gap-2 mb-1">
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded" :class="methodColors[item.request.method]">
            {{ item.request.method }}
          </span>
          <span class="text-[10px] font-mono" :class="getStatusColor(item.response.status)">
            {{ item.response.status }}
          </span>
          <span class="text-[10px] text-[var(--color-text-muted)] ml-auto">{{ item.response.time }}ms</span>
          <!-- 删除按钮 -->
          <button
            @click.stop="emit('remove', item.id)"
            class="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-red-400 transition-all"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p class="text-[10px] text-[var(--color-text-muted)] truncate font-mono" :title="item.request.url">
          {{ getShortUrl(item.request.url) }}
        </p>
        <p class="text-[9px] text-[var(--color-text-muted)] opacity-60 mt-0.5">
          {{ formatTime(item.timestamp) }}
        </p>
      </div>
    </div>
  </div>
</template>
