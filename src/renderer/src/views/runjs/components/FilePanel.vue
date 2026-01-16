<script setup lang="ts">
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import type { CodeFile } from '../RunJS.vue'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

defineProps<{
  files: CodeFile[]
  activeId: string
}>()

const emit = defineEmits<{
  'file-select': [file: CodeFile]
  'file-delete': [file: CodeFile]
}>()

const handleFileClick = (file: CodeFile) => {
  emit('file-select', file)
}

const getLanguageIcon = (language: string) => {
  if (language === 'typescript') {
    return { bg: 'from-blue-500/20 to-cyan-500/20', text: 'text-blue-400', label: 'TS' }
  }
  return { bg: 'from-yellow-500/20 to-orange-500/20', text: 'text-yellow-400', label: 'JS' }
}

const formatTime = (timestamp: number) => {
  return dayjs(timestamp).fromNow()
}
</script>

<template>
  <div class="file-panel h-full flex flex-col bg-[#1e1e2e]">
    <!-- 标题 -->
    <div class="header px-4 py-3 border-b border-[#3f3f5a]">
      <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">最近文件</h3>
    </div>

    <!-- 文件列表 -->
    <div class="file-list flex-1 overflow-auto p-4">
      <div v-if="files.length === 0" class="text-center text-sm text-gray-500 py-8">
        <div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#2a2a3e] flex items-center justify-center">
          <svg class="w-6 h-6 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        暂无文件
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="file in files"
          :key="file.id"
          @click="handleFileClick(file)"
          class="file-item w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left group cursor-pointer border border-transparent"
          :class="file.id === activeId ? 'bg-[#2a2a3e] border-[#6366f1]/30 shadow-sm' : 'hover:bg-[#2a2a3e] hover:border-[#3f3f5a]'"
        >
          <!-- 文件图标 -->
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold bg-gradient-to-br flex-shrink-0"
            :class="[getLanguageIcon(file.language).bg, getLanguageIcon(file.language).text]"
          >
            {{ getLanguageIcon(file.language).label }}
          </div>

          <!-- 文件信息 -->
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate flex items-center gap-2" :class="file.id === activeId ? 'text-white' : 'text-gray-300'">
              {{ file.name }}
            </div>
            <div class="text-xs text-gray-500 mt-0.5">
              {{ formatTime(file.lastModified) }}
            </div>
          </div>

          <!-- 删除按钮 -->
          <button
            @click.stop="emit('file-delete', file)"
            class="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
            title="移除"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-item:hover {
  transform: translateX(2px);
}
</style>
