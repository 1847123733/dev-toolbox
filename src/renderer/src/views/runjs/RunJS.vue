<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import NpmPanel from './components/NpmPanel.vue'
import FilePanel from './components/FilePanel.vue'
import CodeEditor from './components/CodeEditor.vue'
import OutputPanel from './components/OutputPanel.vue'

// 文件接口定义
export interface CodeFile {
  id: string
  name: string
  content: string
  language: 'javascript' | 'typescript'
  lastModified: number
}

// 默认代码
const defaultCode = `console.log("hello world");`

// 状态
const files = ref<CodeFile[]>([])
const activeFileId = ref<string>('')
const isRunning = ref(false)
const output = ref('')
const error = ref('')
const duration = ref(0)
const activePanel = ref<'npm' | 'files'>('files')

// 初始化文件数据 (迁移旧数据或读取持久化数据)
const initFiles = () => {
  const storedFiles = localStorage.getItem('runjs_files')
  const storedActiveId = localStorage.getItem('runjs_active_file_id')

  if (storedFiles) {
    try {
      files.value = JSON.parse(storedFiles)
      activeFileId.value = storedActiveId || (files.value.length > 0 ? files.value[0].id : '')
    } catch (e) {
      console.error('Failed to parse stored files', e)
    }
  }

  // 如果没有文件（可能是第一次运行，或者数据损坏，或者来自旧版本迁移）
  if (files.value.length === 0) {
    // 尝试迁移旧的单文件数据
    const oldCode = localStorage.getItem('runjs_last_code')
    const oldLang = localStorage.getItem('runjs_last_language')

    const initialFile: CodeFile = {
      id: uuidv4(),
      name: 'index.js',
      content: oldCode !== null ? oldCode : defaultCode,
      language: (oldLang as 'javascript' | 'typescript') || 'javascript',
      lastModified: Date.now()
    }

    files.value = [initialFile]
    activeFileId.value = initialFile.id
  }
}

// 初始化
initFiles()

// 当前激活的文件
const activeFile = computed(() => {
  return files.value.find((f) => f.id === activeFileId.value) || files.value[0]
})

// 确保 activeFileId 始终有效
watch(
  activeFileId,
  (newId) => {
    if (!files.value.find((f) => f.id === newId) && files.value.length > 0) {
      activeFileId.value = files.value[0].id
    }
  },
  { immediate: true }
)

// 持久化存储
watch(
  [files, activeFileId],
  () => {
    localStorage.setItem('runjs_files', JSON.stringify(files.value))
    localStorage.setItem('runjs_active_file_id', activeFileId.value)
  },
  { deep: true }
)

// 新建文件
const addFile = () => {
  const newFile: CodeFile = {
    id: uuidv4(),
    name: `Untitled-${files.value.length + 1}.js`,
    content: '',
    language: 'javascript',
    lastModified: Date.now()
  }
  files.value.push(newFile)
  activeFileId.value = newFile.id
}

// 关闭文件
const closeFile = (id: string) => {
  if (files.value.length <= 1) return // 至少保留一个文件

  const index = files.value.findIndex((f) => f.id === id)
  if (index === -1) return

  // 如果关闭的是当前激活的文件，需要切换到其他文件
  if (id === activeFileId.value) {
    const nextFile = files.value[index + 1] || files.value[index - 1]
    if (nextFile) {
      activeFileId.value = nextFile.id
    }
  }

  files.value.splice(index, 1)
}

// 切换文件
const switchFile = (id: string) => {
  activeFileId.value = id
}

// 更新激活文件内容
const handleCodeChange = (newCode: string) => {
  if (activeFile.value) {
    activeFile.value.content = newCode
    activeFile.value.lastModified = Date.now()
  }
}

// 更新激活文件语言
const handleLanguageChange = (newLanguage: 'javascript' | 'typescript') => {
  if (activeFile.value) {
    activeFile.value.language = newLanguage
    activeFile.value.lastModified = Date.now()
    // 自动更新扩展名
    const nameParts = activeFile.value.name.split('.')
    const ext = newLanguage === 'typescript' ? 'ts' : 'js'
    if (nameParts.length > 1) {
      nameParts.pop()
    }
    activeFile.value.name = `${nameParts.join('.')}.${ext}`
  }
}

// 运行代码
const runCode = async () => {
  if (isRunning.value || !activeFile.value) return

  isRunning.value = true
  output.value = ''
  error.value = ''

  try {
    const result = await window.api.codeRunner.run(
      activeFile.value.content,
      activeFile.value.language
    )
    output.value = result.output
    error.value = result.error || ''
    duration.value = result.duration
  } catch (err) {
    error.value = err instanceof Error ? err.message : '运行失败'
  } finally {
    isRunning.value = false
  }
}

// 停止运行
const stopCode = () => {
  if (isRunning.value) {
    window.api.codeRunner.stop()
    isRunning.value = false
    error.value = '运行已中断'
  }
}

// 清空输出
const clearOutput = () => {
  output.value = ''
  error.value = ''
  duration.value = 0
}

// 全局快捷键监听
const handleKeyDown = (e: KeyboardEvent) => {
  // Ctrl/Cmd + Enter 运行代码
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    if (!isRunning.value) {
      runCode()
    }
  }
  // Escape 停止运行
  if (e.key === 'Escape' && isRunning.value) {
    stopCode()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="runjs-container">
    <div class="left-panel">
      <div class="panel-tabs">
        <button
          @click="activePanel = 'npm'"
          class="panel-tab"
          :class="{ active: activePanel === 'npm' }"
        >
          NPM 包
        </button>
        <button
          @click="activePanel = 'files'"
          class="panel-tab"
          :class="{ active: activePanel === 'files' }"
        >
          最近文件
        </button>
      </div>

      <div class="panel-content">
        <Transition name="fade" mode="out-in">
          <NpmPanel v-if="activePanel === 'npm'" />
          <FilePanel
            v-else
            :files="files"
            :active-id="activeFileId"
            @file-select="(file) => switchFile(file.id)"
            @file-delete="(file) => closeFile(file.id)"
          />
        </Transition>
      </div>
    </div>

    <div class="editor-area">
      <CodeEditor
        v-if="activeFile"
        :code="activeFile.content"
        :language="activeFile.language"
        :is-running="isRunning"
        :files="files"
        :active-id="activeFileId"
        @update:code="handleCodeChange"
        @update:language="handleLanguageChange"
        @run="runCode"
        @tab-click="switchFile"
        @tab-close="closeFile"
        @tab-add="addFile"
      />
    </div>

    <div class="output-area">
      <OutputPanel
        :output="output"
        :error="error"
        :duration="duration"
        :is-running="isRunning"
        @run="runCode"
        @stop="stopCode"
        @clear="clearOutput"
      />
    </div>
  </div>
</template>

<style scoped>
.runjs-container {
  display: flex;
  height: 100%;
  background: var(--color-surface);
}

.left-panel {
  width: 256px;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.panel-tab {
  flex: 1;
  padding: 10px 0;
  font-size: 13px;
  font-weight: 500;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.panel-tab:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.02);
}

.panel-tab.active {
  color: var(--color-primary);
  background: rgba(129, 140, 248, 0.06);
  border-bottom-color: var(--color-primary);
}

.panel-content {
  flex: 1;
  overflow: hidden;
}

.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.output-area {
  width: 384px;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
