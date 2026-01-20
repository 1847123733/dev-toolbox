<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef, reactive } from 'vue'
import { monaco, setupTypeScriptEnvironment } from '@/utils/monacoSetup'
import {
  loadTypesForCode,
  loadTypesForInstalledPackages,
  onTypeLoadStatusChange
} from '@/utils/typeLoader'
import { registerSnippetProviders } from '@/utils/snippets'
import type { CodeFile } from '../RunJS.vue'

const props = defineProps<{
  code: string
  language: 'javascript' | 'typescript'
  isRunning?: boolean
  files: CodeFile[]
  activeId: string
}>()

const emit = defineEmits<{
  'update:code': [code: string]
  'update:language': [language: 'javascript' | 'typescript']
  run: []
  'tab-click': [id: string]
  'tab-close': [id: string]
  'tab-add': []
}>()

const editorRef = ref<HTMLDivElement>()
const editor = shallowRef<monaco.editor.IStandaloneCodeEditor>()

// 类型加载状态
const typeLoadingStatus = reactive<{
  currentPackage: string
  status: string
  source?: string
  showToast: boolean
}>({
  currentPackage: '',
  status: '',
  source: '',
  showToast: false
})

// 状态显示定时器
let statusToastTimer: ReturnType<typeof setTimeout> | null = null

// 状态显示配置
const statusConfig = {
  loading: { icon: '⏳', text: '加载中', color: 'text-yellow-400' },
  local: { icon: '✅', text: '本地', color: 'text-green-400' },
  cdn: { icon: '☁️', text: 'CDN', color: 'text-blue-400' },
  failed: { icon: '❌', text: '失败', color: 'text-red-400' },
  cached: { icon: '💾', text: '缓存', color: 'text-gray-400' }
} as const

// 配置 Monaco Editor
const setupMonaco = () => {
  // 定义暗色主题
  monaco.editor.defineTheme('devToolboxDark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955' },
      { token: 'keyword', foreground: 'C586C0' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'type', foreground: '4EC9B0' }
    ],
    colors: {
      'editor.background': '#1e1e2e',
      'editor.foreground': '#e2e8f0',
      'editor.lineHighlightBackground': '#2a2a3e',
      'editor.selectionBackground': '#6366f150',
      'editorCursor.foreground': '#6366f1',
      'editorLineNumber.foreground': '#4a4a6a',
      'editorLineNumber.activeForeground': '#8b8bab',
      'editor.inactiveSelectionBackground': '#6366f130'
    }
  })

  // 配置 TypeScript/JavaScript 环境（包括 Worker）
  setupTypeScriptEnvironment()

  // 注册代码片段补全
  registerSnippetProviders()
}

onMounted(() => {
  if (!editorRef.value) return

  setupMonaco()

  // 初始加载模型
  updateEditorModel()

  editor.value = monaco.editor.create(editorRef.value, {
    // model 在 updateEditorModel 中设置，但 create 需要 model 选项或者稍后 setModel
    // 这里先给 null，然后由 updateEditorModel 设置
    model: null,
    theme: 'devToolboxDark',
    fontSize: 14,
    fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
    fontLigatures: true,
    lineHeight: 24,
    padding: { top: 20, bottom: 20 },
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    renderLineHighlight: 'all',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    bracketPairColorization: { enabled: true },
    // 启用自动补全
    suggestOnTriggerCharacters: true,
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true
    },
    acceptSuggestionOnEnter: 'on',
    snippetSuggestions: 'inline',
    suggest: {
      showMethods: true,
      showFunctions: true,
      showConstructors: true,
      showDeprecated: true,
      showFields: true,
      showVariables: true,
      showClasses: true,
      showStructs: true,
      showInterfaces: true,
      showModules: true,
      showProperties: true,
      showEvents: true,
      showOperators: true,
      showUnits: true,
      showValues: true,
      showConstants: true,
      showEnums: true,
      showEnumMembers: true,
      showKeywords: true,
      showWords: true,
      showColors: true,
      showFiles: true,
      showReferences: true,
      showFolders: true,
      showTypeParameters: true,
      showSnippets: true,
      preview: true,
      previewMode: 'subwordSmart',
      filterGraceful: true,
      localityBonus: true
    },
    // 参数提示
    parameterHints: {
      enabled: true,
      cycle: true
    },
    // 悬停提示
    hover: {
      enabled: true,
      delay: 300
    }
  })

  // 初始化模型 (确保 create 之后有 model)
  updateEditorModel()

  // 类型加载防抖定时器
  let typeLoadTimer: ReturnType<typeof setTimeout> | null = null

  // 监听内容变化
  editor.value.onDidChangeModelContent(() => {
    const code = editor.value?.getValue() || ''
    emit('update:code', code)

    // 防抖加载类型定义（500ms 后触发）
    if (typeLoadTimer) clearTimeout(typeLoadTimer)
    typeLoadTimer = setTimeout(() => {
      loadTypesForCode(code)
    }, 500)
  })

  // 初始化时也加载一次类型
  loadTypesForCode(props.code)

  // 加载所有已安装 NPM 包的类型定义
  loadTypesForInstalledPackages()

  // 添加快捷键：Ctrl+Enter 运行代码
  editor.value.addAction({
    id: 'run-code',
    label: '运行代码',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: () => {
      if (!props.isRunning) {
        emit('run')
      }
    }
  })

  // 添加快捷键：Ctrl+S 保存
  editor.value.addAction({
    id: 'save-code',
    label: '保存代码',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    run: () => {
      console.log('代码已保存')
      // 可以在这里触发额外的保存逻辑
    }
  })

  // 添加快捷键：Ctrl+D 复制当前行
  editor.value.addAction({
    id: 'duplicate-line',
    label: '复制当前行',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD],
    run: (ed) => {
      const selection = ed.getSelection()
      if (selection) {
        const line = ed.getModel()?.getLineContent(selection.startLineNumber)
        if (line !== undefined) {
          ed.executeEdits('duplicate', [
            {
              range: {
                startLineNumber: selection.startLineNumber,
                startColumn: 1,
                endLineNumber: selection.startLineNumber,
                endColumn: 1
              },
              text: line + '\n'
            }
          ])
        }
      }
    }
  })
  // 确保编辑器 resize
  window.addEventListener('resize', () => {
    editor.value?.layout()
  })
})

onUnmounted(() => {
  editor.value?.dispose()
  // 清理所有模型
  const models = monaco.editor.getModels()
  models.forEach((model) => model.dispose())
  // 清理类型加载状态定时器
  if (statusToastTimer) clearTimeout(statusToastTimer)
  // 取消订阅
  if (unsubscribeTypeStatus) unsubscribeTypeStatus()
})

// 类型加载状态订阅
let unsubscribeTypeStatus: (() => void) | null = null

const setupTypeLoadStatusListener = () => {
  unsubscribeTypeStatus = onTypeLoadStatusChange((event) => {
    typeLoadingStatus.currentPackage = event.packageName
    typeLoadingStatus.status = event.status
    typeLoadingStatus.source = event.source || ''
    typeLoadingStatus.showToast = true

    // 清除之前的定时器
    if (statusToastTimer) clearTimeout(statusToastTimer)

    // 根据状态决定显示时间
    // cached 状态显示时间短一点
    const duration = event.status === 'loading' ? 10000 : event.status === 'cached' ? 1500 : 2500
    statusToastTimer = setTimeout(() => {
      typeLoadingStatus.showToast = false
    }, duration)
  })
}

// 在 onMounted 后调用
setupTypeLoadStatusListener()

// 获取当前文件的 URI
const getFileUri = (id: string, language: string) => {
  const ext = language === 'typescript' ? 'ts' : 'js'
  return monaco.Uri.parse(`file:///workspace/${id}.${ext}`)
}

// 切换或创建模型
const updateEditorModel = () => {
  if (!editor.value || !props.activeId) return

  const file = props.files.find((f) => f.id === props.activeId)
  if (!file) return

  const uri = getFileUri(file.id, file.language)
  let model = monaco.editor.getModel(uri)

  if (!model) {
    model = monaco.editor.createModel(file.content, file.language, uri)
  } else {
    // 同步内容 (如果差异较大，说明是外部更新或重新加载)
    if (model.getValue() !== file.content) {
      // 避免光标跳动，只有当内容完全不同时才全量设置
      // 实际上这里主要是为了处理 tab 切换时的同步
      model.setValue(file.content)
    }
    // 确保语言模式正确
    monaco.editor.setModelLanguage(model, file.language)
  }

  // 只有当当前模型不是目标模型时才通过 setModel 切换
  if (editor.value.getModel() !== model) {
    editor.value.setModel(model)
  }
}

// 监听 activeId 变化，切换文件
watch(
  () => props.activeId,
  () => {
    updateEditorModel()
  }
)

// 监听 files 变化 (处理关闭文件的情况，清理模型)
watch(
  () => props.files,
  (newFiles) => {
    const currentIds = new Set(newFiles.map((f) => f.id))
    // 获取所有 file:///workspace/ 开头的模型
    const models = monaco.editor.getModels()
    models.forEach((model) => {
      const path = model.uri.path
      if (path.startsWith('/workspace/')) {
        // 提取 ID (/workspace/ID.ext)
        const filename = path.split('/').pop() || ''
        const id = filename.split('.')[0]
        if (id && !currentIds.has(id)) {
          model.dispose()
        }
      }
    })
  },
  { deep: true }
)

// 监听语言变化 (主要处理当前文件的语言变更)
watch(
  () => props.language,
  (newLang) => {
    if (!editor.value || !props.activeId) return

    const currentModel = editor.value.getModel()
    if (currentModel) {
      // 更新语言
      monaco.editor.setModelLanguage(currentModel, newLang)

      // 我们不需要因为语言改变而销毁模型重建，Monaco 支持直接修改语言
      // 但是如果要改变 URI 后缀 (js -> ts)，我们需要重建模型
      // 为了 TypeScript 智能提示正常工作，文件扩展名很重要

      const content = currentModel.getValue()
      const oldUri = currentModel.uri

      // 只有当扩展名不匹配时才重建
      const expectedUri = getFileUri(props.activeId, newLang)
      if (oldUri.toString() !== expectedUri.toString()) {
        currentModel.dispose()
        const newModel = monaco.editor.createModel(content, newLang, expectedUri)
        editor.value.setModel(newModel)
      }
    }
  }
)

// 监听代码内容变化（处理外部重置等情况）
// 注意：这可能会与 onDidChangeModelContent 冲突，需要判断
watch(
  () => props.code,
  (newCode) => {
    const model = editor.value?.getModel()
    if (model && model.getValue() !== newCode) {
      model.setValue(newCode)
    }
  }
)

// 切换语言
const handleLanguageChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:language', target.value as 'javascript' | 'typescript')
}
</script>

<template>
  <div class="code-editor flex flex-col h-full bg-[#1e1e2e]">
    <!-- 顶部工具栏 -->
    <div
      class="toolbar flex items-center justify-between px-4 h-12 bg-[#2a2a3e] border-b border-[#3f3f5a]"
    >
      <!-- 文件标签 -->
      <div
        class="file-tabs flex items-center gap-2 overflow-x-auto no-scrollbar max-w-[calc(100%-250px)]"
      >
        <div
          v-for="file in files"
          :key="file.id"
          class="tab flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer border border-transparent select-none min-w-[100px] max-w-[160px] group"
          :class="
            file.id === activeId
              ? 'bg-[#1e1e2e] text-white border-[#3f3f5a]'
              : 'text-gray-400 hover:text-white hover:bg-[#363651]'
          "
          @click="emit('tab-click', file.id)"
        >
          <!-- 文件图标 -->
          <div
            class="w-3 h-3 rounded-full flex-shrink-0"
            :class="file.language === 'typescript' ? 'bg-blue-400' : 'bg-yellow-400'"
          ></div>

          <span class="font-medium truncate flex-1" :title="file.name">{{ file.name }}</span>

          <!-- 关闭按钮 -->
          <button
            class="p-0.5 rounded-md hover:bg-[#4a4a6a] transition-colors opacity-0 group-hover:opacity-100"
            :class="{ 'opacity-100': file.id === activeId }"
            @click.stop="emit('tab-close', file.id)"
            title="关闭"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <!-- 新建标签按钮 -->
        <button
          class="p-1.5 text-gray-400 hover:text-white hover:bg-[#363651] rounded-lg transition-all flex-shrink-0"
          @click="emit('tab-add')"
          title="新建文件"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>

      <!-- 右侧控制 -->
      <div class="flex items-center gap-4">
        <!-- 快捷键提示 -->
        <div class="hidden md:flex items-center gap-2 text-xs text-gray-500">
          <kbd class="px-2 py-1 bg-[#1e1e2e] rounded text-gray-400 border border-[#3f3f5a]"
            >Ctrl</kbd
          >
          <span>+</span>
          <kbd class="px-2 py-1 bg-[#1e1e2e] rounded text-gray-400 border border-[#3f3f5a]"
            >Enter</kbd
          >
          <span class="ml-1">运行</span>
        </div>

        <!-- 语言选择器 -->
        <div
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1e1e2e] border border-[#3f3f5a]"
        >
          <div
            class="w-2.5 h-2.5 rounded-full"
            :class="language === 'typescript' ? 'bg-blue-400' : 'bg-yellow-400'"
          ></div>
          <select
            :value="language"
            @change="handleLanguageChange"
            class="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
          >
            <option value="javascript" class="bg-[#1e1e2e]">JavaScript</option>
            <option value="typescript" class="bg-[#1e1e2e]">TypeScript</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 编辑器容器 -->
    <div ref="editorRef" class="editor-container flex-1 relative">
      <!-- 类型加载状态提示 -->
      <Transition name="toast">
        <div
          v-if="typeLoadingStatus.showToast"
          class="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a3e] border border-[#3f3f5a] text-sm shadow-lg"
        >
          <span>{{
            statusConfig[typeLoadingStatus.status as keyof typeof statusConfig]?.icon
          }}</span>
          <span class="text-gray-300">{{ typeLoadingStatus.currentPackage }}</span>
          <span :class="statusConfig[typeLoadingStatus.status as keyof typeof statusConfig]?.color">
            {{ statusConfig[typeLoadingStatus.status as keyof typeof statusConfig]?.text }}
          </span>
          <span
            v-if="typeLoadingStatus.source && typeLoadingStatus.status !== 'loading'"
            class="text-gray-500 text-xs truncate max-w-[150px]"
          >
            ({{ typeLoadingStatus.source }})
          </span>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.editor-container {
  overflow: hidden;
}

.tab {
  position: relative;
}

kbd {
  font-family: 'Fira Code', monospace;
  font-size: 11px;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Toast 动画 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
