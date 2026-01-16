<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isMaximized = ref(false)

const minimize = () => window.api.window.minimize()
const maximize = () => window.api.window.maximize()
const close = () => window.api.window.close()

onMounted(async () => {
  isMaximized.value = await window.api.window.isMaximized()
  window.api.window.onMaximizedChange((maximized) => {
    isMaximized.value = maximized
  })
})
</script>

<template>
  <header class="title-bar drag-region flex items-center justify-between h-10 px-4 bg-[var(--color-surface-light)] border-b border-[var(--color-border)]">
    <!-- 左侧 Logo -->
    <div class="flex items-center gap-3">
      <div class="logo flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <span class="text-sm font-semibold text-[var(--color-text)]">开发者工具箱</span>
    </div>

    <!-- 右侧窗口控制按钮 -->
    <div class="window-controls no-drag flex items-center gap-1">
      <button
        @click="minimize"
        class="control-btn flex items-center justify-center w-10 h-8 rounded-md hover:bg-[var(--color-surface-lighter)] transition-colors"
        title="最小化"
      >
        <svg class="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
        </svg>
      </button>
      <button
        @click="maximize"
        class="control-btn flex items-center justify-center w-10 h-8 rounded-md hover:bg-[var(--color-surface-lighter)] transition-colors"
        :title="isMaximized ? '还原' : '最大化'"
      >
        <svg v-if="!isMaximized" class="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" stroke-width="2" />
        </svg>
        <svg v-else class="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="1" stroke-width="2" />
          <path stroke-linecap="round" stroke-width="2" d="M9 6V5a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2h-1" />
        </svg>
      </button>
      <button
        @click="close"
        class="control-btn close-btn flex items-center justify-center w-10 h-8 rounded-md hover:bg-red-500 transition-colors group"
        title="关闭"
      >
        <svg class="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.title-bar {
  user-select: none;
}
</style>
