<script setup lang="ts">
import { ref, onMounted, computed, defineAsyncComponent, type Component } from 'vue'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import GlobalNotification from './components/GlobalNotification.vue'

// 当前选中的工具
const activeTool = ref('runjs')

// 工具列表
const tools = [
  { id: 'runjs', name: 'RunJS', icon: 'code' },
  { id: 'domain', name: '域名查询', icon: 'globe' },
  { id: 'dock', name: 'macOS Dock', icon: 'dock' }
  // 添加新工具：{ id: 'json', name: 'JSON工具', icon: 'json' }
]

// 工具组件映射（懒加载）
const toolComponents: Record<string, Component> = {
  runjs: defineAsyncComponent(() => import('./views/runjs/RunJS.vue')),
  domain: defineAsyncComponent(() => import('./views/domainlookup/DomainLookup.vue')),
  dock: defineAsyncComponent(() => import('./views/dock/DockSettings.vue')),
  settings: defineAsyncComponent(() => import('./views/settings/Settings.vue'))
  // 添加新工具：json: defineAsyncComponent(() => import('./views/json/JsonTool.vue'))
}

// 当前活跃的组件
const activeComponent = computed(() => toolComponents[activeTool.value] || toolComponents.runjs)

const handleToolSelect = (toolId: string) => {
  activeTool.value = toolId
}

onMounted(() => {
  console.log('App mounted')
})
</script>

<template>
  <div class="app-container flex flex-col h-screen bg-[var(--color-surface)]">
    <!-- 全局通知 -->
    <GlobalNotification />

    <!-- 标题栏 -->
    <TitleBar />

    <!-- 主体内容 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 左侧工具栏 -->
      <Sidebar :tools="tools" :active-tool="activeTool" @select="handleToolSelect" />

      <!-- 主内容区 -->
      <main class="flex-1 overflow-hidden">
        <KeepAlive>
          <component :is="activeComponent" :key="activeTool" />
        </KeepAlive>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}
</style>
