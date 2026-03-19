<script setup lang="ts">
import { ref, onMounted, computed, defineAsyncComponent, type Component } from 'vue'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import GlobalNotification from './components/GlobalNotification.vue'
import CloseDialog from './components/CloseDialog.vue'

const activeTool = ref('home')
const showCloseDialog = ref(false)

const tools = [
  { id: 'runjs', name: 'RunJS', icon: 'code' },
  { id: 'domain', name: '域名查询', icon: 'globe' },
  { id: 'dock', name: 'macOS Dock', icon: 'dock' },
  { id: 'oss', name: 'OSS管理', icon: 'cloud' },
  { id: 'httpclient', name: 'HTTP请求', icon: 'send' },
  { id: 'sqlexpert', name: 'SQL专家', icon: 'database' }
]

const toolComponents: Record<string, Component> = {
  home: defineAsyncComponent(() => import('./views/home/Home.vue')),
  runjs: defineAsyncComponent(() => import('./views/runjs/RunJS.vue')),
  domain: defineAsyncComponent(() => import('./views/domainlookup/DomainLookup.vue')),
  dock: defineAsyncComponent(() => import('./views/dock/DockSettings.vue')),
  oss: defineAsyncComponent(() => import('./views/oss/OssManager.vue')),
  httpclient: defineAsyncComponent(() => import('./views/httpclient/HttpClient.vue')),
  sqlexpert: defineAsyncComponent(() => import('./views/sqlexpert/SqlExpert.vue')),
  settings: defineAsyncComponent(() => import('./views/settings/Settings.vue'))
}

const activeComponent = computed(() => toolComponents[activeTool.value] || toolComponents.home)

const handleToolSelect = (toolId: string) => {
  activeTool.value = toolId
}

onMounted(async () => {
  console.log('App mounted')
  const savedProxy = localStorage.getItem('app_proxy_url')
  if (savedProxy) {
    try {
      await window.api.app.setProxy(savedProxy)
      console.log('Proxy loaded:', savedProxy)
    } catch (error) {
      console.error('Failed to load proxy:', error)
    }
  }

  window.api.app.onShowCloseDialog(() => {
    showCloseDialog.value = true
  })
})
</script>

<template>
  <div class="app-container">
    <GlobalNotification />
    <CloseDialog v-if="showCloseDialog" @close="showCloseDialog = false" />
    <TitleBar />

    <div class="app-body">
      <Sidebar
        :tools="tools"
        :active-tool="activeTool"
        @select="handleToolSelect"
        @go-home="handleToolSelect('home')"
      />
      <main class="app-main">
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
  display: flex;
  flex-direction: column;
  height: 100vh;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-surface);
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow: hidden;
  background: var(--color-surface);
  position: relative;
}
</style>
