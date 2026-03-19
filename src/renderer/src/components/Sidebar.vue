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

const version = ref('')
const hasUpdate = ref(false)
const latestVersion = ref('')
const checking = ref(false)
const downloading = ref(false)
const downloadProgress = ref(0)
const updateDownloaded = ref(false)

onMounted(async () => {
  version.value = await window.api.app.getVersion()
  window.api.app.onDownloadProgress((progress) => {
    downloadProgress.value = progress
  })
  window.api.app.onUpdateDownloaded(() => {
    updateDownloaded.value = true
  })
  checkUpdate()
})

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
    code: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />`,
    globe: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />`,
    dock: `<rect x="2" y="16" width="20" height="5" rx="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" fill="none" /><circle cx="6" cy="18.5" r="1" fill="currentColor" /><circle cx="12" cy="18.5" r="1" fill="currentColor" /><circle cx="18" cy="18.5" r="1" fill="currentColor" />`,
    cloud: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 15a4 4 0 014-4h1.5a4.5 4.5 0 018.9-.9A3.5 3.5 0 0118 18H7a4 4 0 01-4-3z" />`,
    send: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />`,
    database: `<ellipse cx="12" cy="5" rx="9" ry="3" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" fill="none" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />`
  }
  return icons[iconName] || icons.code
}
</script>

<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="sidebar-logo" @click="emit('go-home')">
      <div class="logo-icon">
        <span>U</span>
      </div>
      <span class="logo-label">MyUnit</span>
    </div>

    <div class="sidebar-divider"></div>

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <button
        v-for="tool in tools"
        :key="tool.id"
        @click="emit('select', tool.id)"
        class="nav-item"
        :class="{ active: activeTool === tool.id }"
        :title="tool.name"
      >
        <div class="nav-indicator"></div>
        <svg
          class="nav-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          v-html="getIcon(tool.icon)"
        />
        <span class="nav-label">{{ tool.name }}</span>
      </button>
    </nav>

    <!-- Bottom -->
    <div class="sidebar-bottom">
      <button
        @click="emit('select', 'settings')"
        class="nav-item"
        :class="{ active: activeTool === 'settings' }"
        title="设置"
      >
        <div class="nav-indicator"></div>
        <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      <!-- Version -->
      <div
        class="version-badge"
        :class="{
          downloading: downloading,
          downloaded: updateDownloaded,
          'has-update': hasUpdate && !downloading && !updateDownloaded
        }"
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
        <span v-if="checking" class="version-checking">检查中...</span>
        <template v-else-if="downloading">
          <svg class="spin-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{{ downloadProgress }}%</span>
        </template>
        <template v-else-if="updateDownloaded">
          <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>安装</span>
        </template>
        <template v-else-if="hasUpdate">
          <svg class="download-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>v{{ latestVersion }}</span>
        </template>
        <span v-else class="version-text">v{{ version }}</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  background: var(--color-surface-light);
  border-right: 1px solid var(--color-border);
  position: relative;
  z-index: 10;
}

.sidebar-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  margin-bottom: 16px;
}

.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #818cf8, #a78bfa, #c084fc);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(129, 140, 248, 0.3);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.sidebar-logo:hover .logo-icon {
  transform: scale(1.05);
  box-shadow: 0 6px 24px rgba(129, 140, 248, 0.4);
}

.logo-icon span {
  color: white;
  font-weight: 700;
  font-size: 16px;
}

.logo-label {
  font-size: 9px;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}

.sidebar-divider {
  width: 28px;
  height: 1px;
  background: var(--color-border);
  margin-bottom: 12px;
}

.sidebar-nav {
  flex: 1;
  width: 100%;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-item:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.04);
}

.nav-item.active {
  color: var(--color-primary);
  background: rgba(129, 140, 248, 0.1);
}

.nav-indicator {
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: linear-gradient(180deg, var(--color-primary), var(--color-secondary));
  border-radius: 0 3px 3px 0;
  transition: height var(--transition-fast);
}

.nav-item.active .nav-indicator {
  height: 20px;
}

.nav-icon {
  width: 20px;
  height: 20px;
}

.nav-label {
  font-size: 9px;
  font-weight: 500;
  white-space: nowrap;
}

.sidebar-bottom {
  margin-top: auto;
  padding: 0 8px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.version-badge {
  margin-top: 8px;
  font-size: 9px;
  color: var(--color-text-muted);
  opacity: 0.5;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  transition: opacity var(--transition-fast), color var(--transition-fast);
}

.version-badge:hover {
  opacity: 1;
}

.version-badge.downloading {
  color: #60a5fa;
  opacity: 1;
}

.version-badge.downloaded {
  color: var(--color-success);
  opacity: 1;
}

.version-badge.has-update {
  color: var(--color-warning);
  opacity: 1;
}

.version-checking {
  animation: pulse 1.5s ease-in-out infinite;
}

.spin-icon {
  width: 12px;
  height: 12px;
  animation: spin 1s linear infinite;
}

.check-icon,
.download-icon {
  width: 12px;
  height: 12px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>
