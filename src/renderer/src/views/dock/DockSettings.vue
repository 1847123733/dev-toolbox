<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Dock 窗口是否已打开
const isDockOpen = ref(false)

// Dock 设置
const dockSettings = ref({
  position: 'bottom' as 'bottom' | 'left' | 'right',
  iconSize: 48,
  autoHide: false,
  magnification: true
})

// 检查 Dock 窗口状态
const checkDockStatus = async () => {
  isDockOpen.value = await window.api.dock.isOpen()
}

// 打开 Dock 窗口
const openDock = async () => {
  // 将响应式对象转换为普通对象以便 IPC 传输
  const settings = {
    position: dockSettings.value.position,
    iconSize: dockSettings.value.iconSize,
    autoHide: dockSettings.value.autoHide,
    magnification: dockSettings.value.magnification
  }
  const result = await window.api.dock.open(settings)
  if (result.success) {
    isDockOpen.value = true
  }
}

// 关闭 Dock 窗口
const closeDock = async () => {
  const result = await window.api.dock.close()
  if (result.success) {
    isDockOpen.value = false
  }
}

onMounted(() => {
  checkDockStatus()
})
</script>

<template>
  <div class="dock-settings h-full flex flex-col p-6 overflow-auto">
    <!-- 标题 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-[var(--color-text)] flex items-center gap-3">
        <svg
          class="w-8 h-8 text-[var(--color-primary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="2" y="16" width="20" height="5" rx="1" stroke-width="2" />
          <circle cx="6" cy="18.5" r="1.5" fill="currentColor" />
          <circle cx="12" cy="18.5" r="1.5" fill="currentColor" />
          <circle cx="18" cy="18.5" r="1.5" fill="currentColor" />
        </svg>
        macOS Dock
      </h1>
      <p class="text-[var(--color-text-muted)] mt-2">
        模仿 macOS 底部任务栏，创建一个独立的 Dock 窗口
      </p>
    </div>

    <!-- 状态卡片 -->
    <div class="card bg-[var(--color-surface-light)] border border-[var(--color-border)] mb-6">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-3 h-3 rounded-full',
                isDockOpen ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
              ]"
            ></div>
            <span class="text-[var(--color-text)]">
              Dock 窗口状态: <strong>{{ isDockOpen ? '运行中' : '未启动' }}</strong>
            </span>
          </div>
          <button v-if="!isDockOpen" @click="openDock" class="btn btn-primary btn-sm gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            启动 Dock
          </button>
          <button v-else @click="closeDock" class="btn btn-error btn-sm gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
              />
            </svg>
            关闭 Dock
          </button>
        </div>
      </div>
    </div>

    <!-- 设置区域 -->
    <div class="card bg-[var(--color-surface-light)] border border-[var(--color-border)]">
      <div class="card-body">
        <h2 class="card-title text-[var(--color-text)] mb-4">Dock 设置</h2>

        <!-- 位置选择 -->
        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text text-[var(--color-text)]">Dock 位置</span>
          </label>
          <div class="flex gap-2">
            <button
              v-for="pos in ['bottom', 'left', 'right']"
              :key="pos"
              @click="dockSettings.position = pos as 'bottom' | 'left' | 'right'"
              :class="[
                'btn btn-sm',
                dockSettings.position === pos
                  ? 'btn-primary'
                  : 'btn-ghost border border-[var(--color-border)]'
              ]"
            >
              {{ pos === 'bottom' ? '底部' : pos === 'left' ? '左侧' : '右侧' }}
            </button>
          </div>
        </div>

        <!-- 图标大小 -->
        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text text-[var(--color-text)]"
              >图标大小: {{ dockSettings.iconSize }}px</span
            >
          </label>
          <input
            type="range"
            v-model.number="dockSettings.iconSize"
            min="32"
            max="128"
            class="range range-primary range-sm"
          />
          <div class="flex justify-between text-xs text-[var(--color-text-muted)] px-1">
            <span>32px</span>
            <span>128px</span>
          </div>
        </div>

        <!-- 自动隐藏 -->
        <div class="form-control mb-4">
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              v-model="dockSettings.autoHide"
              class="checkbox checkbox-primary checkbox-sm"
            />
            <span class="label-text text-[var(--color-text)]">自动隐藏</span>
          </label>
        </div>

        <!-- 放大效果 -->
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              v-model="dockSettings.magnification"
              class="checkbox checkbox-primary checkbox-sm"
            />
            <span class="label-text text-[var(--color-text)]">鼠标悬停放大效果</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <div
      class="mt-6 p-4 bg-[var(--color-surface-light)] rounded-lg border border-[var(--color-border)]"
    >
      <h3 class="text-[var(--color-text)] font-medium mb-2 flex items-center gap-2">
        <svg
          class="w-5 h-5 text-[var(--color-primary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        使用说明
      </h3>
      <ul class="text-sm text-[var(--color-text-muted)] space-y-1 list-disc list-inside">
        <li>点击「启动 Dock」将打开一个独立的 Dock 窗口并隐藏主窗口</li>
        <li>在 Dock 窗口中点击应用图标可以打开相应程序</li>
        <li>点击 Dock 上的设置图标可以重新打开主窗口</li>
        <li>返回主窗口后可以点击「关闭 Dock」来关闭 Dock 窗口</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.dock-settings {
  background: var(--color-surface);
}
</style>
