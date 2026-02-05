<script setup lang="ts">
import { ref, onMounted, computed, defineAsyncComponent, type Component } from 'vue'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import GlobalNotification from './components/GlobalNotification.vue'
import CloseDialog from './components/CloseDialog.vue'

// 当前选中的工具
const activeTool = ref('home')

// 显示关闭对话框
const showCloseDialog = ref(false)

// 工具列表
const tools = [
  { id: 'runjs', name: 'RunJS', icon: 'code' },
  { id: 'domain', name: '域名查询', icon: 'globe' },
  { id: 'dock', name: 'macOS Dock', icon: 'dock' },
  { id: 'oss', name: 'OSS管理', icon: 'cloud' }
  // 添加新工具：{ id: 'json', name: 'JSON工具', icon: 'json' }
]

// 工具组件映射（懒加载）
const toolComponents: Record<string, Component> = {
  home: defineAsyncComponent(() => import('./views/home/Home.vue')),
  runjs: defineAsyncComponent(() => import('./views/runjs/RunJS.vue')),
  domain: defineAsyncComponent(() => import('./views/domainlookup/DomainLookup.vue')),
  dock: defineAsyncComponent(() => import('./views/dock/DockSettings.vue')),
  oss: defineAsyncComponent(() => import('./views/oss/OssManager.vue')),
  settings: defineAsyncComponent(() => import('./views/settings/Settings.vue'))
  // 添加新工具：json: defineAsyncComponent(() => import('./views/json/JsonTool.vue'))
}

// 当前活跃的组件
const activeComponent = computed(() => toolComponents[activeTool.value] || toolComponents.home)

const handleToolSelect = (toolId: string) => {
  activeTool.value = toolId
}

onMounted(async () => {
  console.log('App mounted')
  // 启动时自动加载保存的代理设置
  const savedProxy = localStorage.getItem('app_proxy_url')
  if (savedProxy) {
    try {
      await window.api.app.setProxy(savedProxy)
      console.log('Proxy loaded:', savedProxy)
    } catch (error) {
      console.error('Failed to load proxy:', error)
    }
  }

  // 监听显示关闭对话框事件
  window.api.app.onShowCloseDialog(() => {
    showCloseDialog.value = true
  })
})
</script>

<template>
  <div class="app-container flex flex-col h-screen">
    <!-- 全局通知 -->
    <GlobalNotification />

    <!-- 关闭对话框 -->
    <CloseDialog v-if="showCloseDialog" @close="showCloseDialog = false" />

    <!-- 标题栏 -->
    <TitleBar />

    <!-- 主体内容 -->
    <div class="app-body flex flex-1 overflow-hidden">
      <!-- 左侧工具栏 -->
      <Sidebar
        :tools="tools"
        :active-tool="activeTool"
        @select="handleToolSelect"
        @go-home="handleToolSelect('home')"
      />

      <!-- 主内容区 -->
      <main class="app-main flex-1 overflow-hidden">
        <KeepAlive>
          <component :is="activeComponent" :key="activeTool" @open-tool="handleToolSelect" />
        </KeepAlive>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  position: relative;
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  border-radius: 14px;
  overflow: hidden;
  background:
    radial-gradient(110% 140% at 10% -10%, rgba(99, 102, 241, 0.22), transparent 45%),
    radial-gradient(120% 120% at 90% 0%, rgba(6, 182, 212, 0.18), transparent 42%),
    radial-gradient(120% 140% at 50% 120%, rgba(139, 92, 246, 0.18), transparent 48%),
    linear-gradient(180deg, rgba(16, 18, 28, 0.98), rgba(20, 23, 35, 0.96));
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.35),
    0 2px 0 rgba(255, 255, 255, 0.02) inset;
}

.app-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.06), transparent 30%),
    linear-gradient(330deg, rgba(255, 255, 255, 0.03), transparent 45%);
  pointer-events: none;
  z-index: 0;
}

.app-body {
  background: linear-gradient(90deg, rgba(12, 14, 22, 0.7), rgba(18, 20, 30, 0.92));
}

.app-main {
  background: linear-gradient(135deg, rgba(26, 29, 42, 0.85), rgba(18, 20, 30, 0.92));
  box-shadow: -1px 0 0 rgba(255, 255, 255, 0.04);
}
</style>
