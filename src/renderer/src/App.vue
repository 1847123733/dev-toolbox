<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import RunJS from './views/runjs/RunJS.vue'

// 当前选中的工具
const activeTool = ref('runjs')

// 工具列表
const tools = [
  { id: 'runjs', name: 'RunJS', icon: 'code' }
  // 未来可以添加更多工具
]

const handleToolSelect = (toolId: string) => {
  activeTool.value = toolId
}

onMounted(() => {
  console.log('App mounted')
})
</script>

<template>
  <div class="app-container flex flex-col h-screen bg-[var(--color-surface)]">
    <!-- 标题栏 -->
    <TitleBar />

    <!-- 主体内容 -->
    <div class="flex flex-1 overflow-hidden">
      <!-- 左侧工具栏 -->
      <Sidebar
        :tools="tools"
        :active-tool="activeTool"
        @select="handleToolSelect"
      />

      <!-- 主内容区 -->
      <main class="flex-1 overflow-hidden">
        <Transition name="fade" mode="out-in">
          <RunJS v-if="activeTool === 'runjs'" />
        </Transition>
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
