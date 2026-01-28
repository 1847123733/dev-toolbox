<script setup lang="ts">
import { ref, onMounted } from 'vue'
interface Tool {
  id: string
  name: string
  icon: string
}
defineProps<{
  tools: Tool[]
  activeTool: string
}>()
const emit = defineEmits<{
  select: [toolId: string]
  'go-home': []
}>()
// 版本号
const version = ref('')
const hasUpdate = ref(false)
const latestVersion = ref('')
const checking = ref(false)
const downloading = ref(false)
const downloadProgress = ref(0)
const updateDownloaded = ref(false)
onMounted(async () => {
  version.value = await window.api.app.getVersion()
  // 监听下载进度
  window.api.app.onDownloadProgress((progress) => {
    downloadProgress.value = progress
  })
  window.api.app.onUpdateDownloaded(() => {
    updateDownloaded.value = true
  })
  // 自动检查更新
  checkUpdate()
})
// 检查更新
const checkUpdate = async () => {
  if (checking.value) return
  checking.value = true
  try {
    const result = await window.api.app.checkUpdate()
    if (result.success) {
      hasUpdate.value = result.hasUpdate || false
      latestVersion.value = result.latestVersion || ''
    }
  } catch (e) {
    console.error('检查更新失败', e)
  } finally {
    checking.value = false
  }
}
// 下载更新
const downloadUpdate = async () => {
  if (downloading.value) return
  downloading.value = true
  downloadProgress.value = 0
  updateDownloaded.value = false

  try {
    const result = await window.api.app.downloadUpdate()
    if (result.success) {
      updateDownloaded.value = true
    }
  } catch (e) {
    console.error('Download failed', e)
  } finally {
    downloading.value = false
  }
}

const handleVersionClick = () => {
  if (downloading.value) return
  if (updateDownloaded.value) {
    window.api.app.installUpdate()
  } else if (hasUpdate.value) {
    downloadUpdate()
  } else {
    checkUpdate()
  }
}

const getIcon = (iconName: string) => {
  const icons: Record<string, string> = {
    code: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />`,
    globe: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />`,
    dock: `<rect x="2" y="16" width="20" height="5" rx="1" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" fill="none" /><circle cx="6" cy="18.5" r="1" fill="currentColor" /><circle cx="12" cy="18.5" r="1" fill="currentColor" /><circle cx="18" cy="18.5" r="1" fill="currentColor" />`
  }
  return icons[iconName] || icons.code
}
</script>
<template>
  <aside
    class="sidebar w-16 bg-[var(--color-surface-light)] border-r border-[var(--color-border)] flex flex-col items-center py-4"
  >
    <!-- Logo 区域 -->
    <div class="logo-area mb-6 cursor-pointer" @click="emit('go-home')">
      <div
        class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30"
      >
        <span class="text-white font-bold text-lg">U</span>
      </div>
      <span class="text-[10px] text-[var(--color-text-muted)] mt-1 block text-center">MyUnit</span>
    </div>
    <!-- 分隔线 -->
    <div class="w-8 h-px bg-[var(--color-border)] mb-4"></div>
    <!-- 工具列表 -->
    <nav class="tools-nav flex-1 w-full px-2 space-y-2">
      <button
        v-for="tool in tools"
        :key="tool.id"
        @click="emit('select', tool.id)"
        class="tool-btn w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200"
        :class="[
          activeTool === tool.id
            ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/50 text-indigo-400'
            : 'hover:bg-[var(--color-surface-lighter)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        ]"
        :title="tool.name"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          v-html="getIcon(tool.icon)"
        />
        <span class="text-[9px] font-medium">{{ tool.name }}</span>
      </button>
    </nav>
    <!-- 底部设置按钮 -->
    <div class="mt-auto px-2 w-full">
      <button
        @click="emit('select', 'settings')"
        class="w-full aspect-square rounded-xl flex items-center justify-center transition-all"
        :class="[
          activeTool === 'settings'
            ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/50 text-indigo-400'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-lighter)]'
        ]"
        title="设置"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
      <!-- 版本号 -->
      <div
        class="text-[9px] mt-2 text-center cursor-pointer group"
        :class="[
          downloading
            ? 'text-blue-400'
            : updateDownloaded
              ? 'text-green-400'
              : hasUpdate
                ? 'text-yellow-400'
                : 'text-[var(--color-text-muted)] opacity-60'
        ]"
        :title="
          downloading
            ? `下载中 ${downloadProgress}%`
            : updateDownloaded
              ? '点击运行安装程序'
              : hasUpdate
                ? `有新版本 v${latestVersion}，点击下载`
                : '点击检查更新'
        "
        @click="handleVersionClick"
      >
        <span v-if="checking" class="animate-pulse">检查中...</span>
        <span v-else-if="downloading" class="flex items-center justify-center gap-1">
          <svg class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {{ downloadProgress }}%
        </span>
        <span v-else-if="updateDownloaded" class="flex items-center justify-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          安装
        </span>
        <span v-else-if="hasUpdate" class="flex items-center justify-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          v{{ latestVersion }}
        </span>
        <span v-else class="group-hover:opacity-100 opacity-60">v{{ version }}</span>
      </div>
    </div>
  </aside>
</template>
<style scoped>
.tool-btn {
  position: relative;
}
.tool-btn::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: linear-gradient(to bottom, #6366f1, #8b5cf6);
  border-radius: 0 2px 2px 0;
  transition: height 0.2s ease;
}
.tool-btn.bg-gradient-to-br::before {
  height: 24px;
}
</style>