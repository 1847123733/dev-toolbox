<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  output: string
  error: string
  duration: number
  isRunning: boolean
}>()

const emit = defineEmits<{
  run: []
  stop: []
  clear: []
}>()

// 端口输入
const portInput = ref('')
const killMessage = ref('')
const isKilling = ref(false)

// 活动的标签
const activeTab = computed(() => {
  if (props.error) return 'error'
  return 'output'
})

// 格式化运行时间
const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// 终止指定端口的进程
const killPort = async () => {
  const port = parseInt(portInput.value, 10)
  if (isNaN(port) || port <= 0 || port > 65535) {
    killMessage.value = '请输入有效的端口号 (1-65535)'
    return
  }

  isKilling.value = true
  killMessage.value = ''
  
  try {
    const result = await window.api.codeRunner.killPort(port)
    killMessage.value = result.message
    if (result.success) {
      portInput.value = ''
    }
  } catch (error) {
    killMessage.value = `错误: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    isKilling.value = false
  }
}
</script>

<template>
  <div class="output-panel flex flex-col h-full">
    <!-- 顶部标签栏 -->
    <div class="tabs flex items-center justify-between px-4 h-12 bg-[#2a2a3e] border-b border-[#3f3f5a]">
      <div class="flex items-center gap-3">
        <button
          class="tab px-4 py-2 text-sm font-medium rounded-lg transition-all"
          :class="activeTab === 'output' ? 'text-indigo-400 bg-indigo-500/15' : 'text-gray-400 hover:text-white'"
        >
          控制台
        </button>
        <button
          class="tab px-4 py-2 text-sm font-medium rounded-lg transition-all"
          :class="activeTab === 'error' ? 'text-red-400 bg-red-500/15' : 'text-gray-400 hover:text-white'"
        >
          错误
        </button>
      </div>

      <!-- 运行时间 -->
      <div v-if="duration > 0" class="flex items-center gap-2 text-sm text-gray-400">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ formatDuration(duration) }}
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions flex items-center gap-3 px-4 py-3 border-b border-[#3f3f5a]">
      <!-- 运行按钮 -->
      <button
        v-if="!isRunning"
        @click="emit('run')"
        class="run-btn flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        运行
      </button>

      <!-- 停止按钮 -->
      <button
        v-else
        @click="emit('stop')"
        class="stop-btn flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg shadow-red-500/30 transition-all hover:shadow-xl hover:shadow-red-500/40"
      >
        <svg class="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
        停止
      </button>

      <!-- 终止端口进程 -->
      <div class="port-killer flex items-center gap-2">
        <input
          v-model="portInput"
          type="text"
          placeholder="端口号"
          class="w-20 px-3 py-2 text-sm bg-[#2a2a3e] border border-[#3f3f5a] rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
          @keyup.enter="killPort"
        />
        <button
          @click="killPort"
          :disabled="isKilling || !portInput"
          class="kill-btn flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white bg-[#2a2a3e] hover:bg-[#363651] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="终止占用指定端口的进程"
        >
          <svg v-if="isKilling" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          终止端口
        </button>
      </div>

      <!-- 端口终止消息 -->
      <div v-if="killMessage" class="text-xs px-2 py-1 rounded" :class="killMessage.includes('已终止') ? 'text-green-400' : 'text-yellow-400'">
        {{ killMessage }}
      </div>

      <!-- 清空按钮 -->
      <button
        @click="emit('clear')"
        class="clear-btn flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white bg-[#2a2a3e] hover:bg-[#363651] rounded-lg transition-all"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        清空
      </button>

      <!-- 快捷键提示 -->
      <div class="ml-auto text-xs text-gray-500 hidden lg:block">
        <kbd class="px-1.5 py-0.5 bg-[#1e1e2e] rounded border border-[#3f3f5a]">Esc</kbd>
        <span class="ml-1">停止</span>
      </div>
    </div>

    <!-- 输出内容区域 -->
    <div class="output-content flex-1 overflow-auto p-4">
      <!-- 运行中状态 -->
      <div v-if="isRunning" class="running-state flex items-center gap-3 mb-4 p-4 bg-indigo-500/10 rounded-lg border border-indigo-500/30">
        <div class="spinner w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-indigo-400 text-sm font-medium">代码运行中...</span>
      </div>

      <!-- 代码运行成功 -->
      <div v-if="output" class="success-output">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span class="text-green-400 text-sm font-medium">代码运行成功</span>
        </div>
        <pre class="output-text font-mono text-sm whitespace-pre-wrap text-gray-200 bg-[#2a2a3e] rounded-xl p-4 border border-[#3f3f5a] leading-relaxed">{{ output }}</pre>
      </div>

      <!-- 错误输出 -->
      <div v-if="error" class="error-output mt-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <span class="text-red-400 text-sm font-medium">运行错误</span>
        </div>
        <pre class="error-text font-mono text-sm whitespace-pre-wrap text-red-400 bg-red-500/10 rounded-xl p-4 border border-red-500/30 leading-relaxed">{{ error }}</pre>
      </div>

      <!-- 空状态 -->
      <div v-if="!output && !error && !isRunning" class="empty-state flex flex-col items-center justify-center h-full text-gray-500">
        <div class="w-16 h-16 mb-4 rounded-2xl bg-[#2a2a3e] flex items-center justify-center">
          <svg class="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p class="text-sm font-medium">点击运行按钮执行代码</p>
        <p class="text-xs mt-2 opacity-70">
          或按
          <kbd class="px-1.5 py-0.5 bg-[#2a2a3e] rounded border border-[#3f3f5a] mx-1">Ctrl</kbd>
          +
          <kbd class="px-1.5 py-0.5 bg-[#2a2a3e] rounded border border-[#3f3f5a] mx-1">Enter</kbd>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.output-panel {
  background: #1e1e2e;
}

.output-text {
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
}

.error-text {
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
}

.run-btn {
  position: relative;
  overflow: hidden;
}

.run-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 0.5s ease;
}

.run-btn:hover::after {
  transform: translateX(100%);
}

kbd {
  font-family: 'Fira Code', monospace;
  font-size: 10px;
}
</style>
