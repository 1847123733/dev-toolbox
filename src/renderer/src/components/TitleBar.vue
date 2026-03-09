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
  <header class="title-bar drag-region">
    <button
      class="no-drag title-brand"
      title="首页"
      style="-webkit-app-region: no-drag"
    >
      <div class="brand-icon">
        <svg class="brand-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>
      <span class="brand-text">开发者工具箱</span>
    </button>

    <div class="window-controls no-drag">
      <button @click="minimize" class="control-btn" title="最小化">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
        </svg>
      </button>
      <button @click="maximize" class="control-btn" :title="isMaximized ? '还原' : '最大化'">
        <svg v-if="!isMaximized" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" stroke-width="2" />
        </svg>
        <svg v-else fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="1" stroke-width="2" />
          <path stroke-linecap="round" stroke-width="2" d="M9 6V5a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2h-1" />
        </svg>
      </button>
      <button @click="close" class="control-btn control-close" title="关闭">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  background: var(--color-surface-light);
  border-bottom: 1px solid var(--color-border);
  user-select: none;
  flex-shrink: 0;
}

.title-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.brand-icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: linear-gradient(135deg, #818cf8, #a78bfa);
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-svg {
  width: 14px;
  height: 14px;
  color: white;
}

.brand-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.01em;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 2px;
}

.control-btn {
  width: 36px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.control-btn svg {
  width: 14px;
  height: 14px;
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.control-btn:hover svg {
  color: var(--color-text);
}

.control-close:hover {
  background: #ef4444;
}

.control-close:hover svg {
  color: white;
}
</style>
