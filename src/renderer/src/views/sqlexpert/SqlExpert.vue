<template>
  <div class="sql-expert">
    <!-- 左侧历史记录 -->
    <aside class="sql-expert-sidebar">
      <button class="sidebar-new-btn" @click="startNewChat">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        新聊天
      </button>

      <div class="sidebar-history">
        <div v-for="(group, index) in historyList" :key="index" class="history-group">
          <div class="history-label">{{ group.label }}</div>
          <div
            v-for="item in group.items"
            :key="item.id"
            class="history-item"
            :class="{ active: activeChatId === item.id }"
            @click="selectChat(item.id)"
          >
            <span class="history-item-title">{{ item.title }}</span>
            <button class="history-item-delete" @click.stop="onDeleteChat(item.id)">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- 中间聊天区域 -->
    <main class="sql-expert-main">
      <!-- 顶部工具栏 -->
      <div class="main-topbar">
        <span class="topbar-title">企业级分析专家</span>
        <div class="topbar-actions">
          <button v-if="sessionFiles.length > 0" class="topbar-action-btn" @click="showSessionFilesModal = true" title="会话文件">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span class="badge">{{ sessionFiles.length }}</span>
          </button>
          <span v-if="balanceResult" class="topbar-balance-text" :class="balanceResult.success ? 'success' : 'error'" @click="checkBalance" title="点击刷新">
            {{ checkingBalance ? '查询余额...' : balanceResult.message }}
          </span>
          <span v-if="schema" class="topbar-schema-badge">
            已加载表结构
          </span>
          <button class="topbar-settings-btn" @click="showSettings = !showSettings" title="设置">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 空白欢迎页 -->
      <div v-if="chatMessages.length === 0" class="main-welcome">
        <div class="welcome-content">
          <h1 class="welcome-title">企业级分析专家</h1>
          <p class="welcome-subtitle">告别繁琐 SQL，用对话轻松获取数据洞察</p>
          <p v-if="!schema" class="welcome-hint">
            请先点击右上角 ⚙ 配置数据库和 AI 模型
          </p>
        </div>
      </div>

      <!-- 聊天记录 -->
      <div v-else class="main-messages" ref="chatScrollRef">
        <div v-for="msg in chatMessages" :key="msg.id" class="message-wrapper">
          <!-- 用户消息 -->
          <div v-if="msg.role === 'user'" class="message-user">
            <div class="message-user-bubble">{{ msg.content }}</div>
          </div>

          <!-- AI 消息 -->
          <div v-else class="message-assistant">
            <div class="message-assistant-icon">✨</div>
            <div class="message-assistant-body">
              <!-- 初始加载状态 -->
              <div v-if="msg.status === 'loading' && !msg.content && (!msg.toolCalls || msg.toolCalls.length === 0)" class="message-loading">
                <span>正在生成</span>
                <span class="loading-dots"><i /><i /><i /></span>
              </div>

              <!-- 分段跨越渲染：文本片段与工具调用按顺序交替显示 -->
              <template v-for="segment in getMessageSegments(msg)" :key="segment.key">
                <div v-if="segment.type === 'tool'" class="tool-calls" style="margin-bottom: 12px; max-width: 100%;">
                  <div v-if="segment.toolCall" class="tool-call-item" style="margin-bottom: 0;">
                    <div class="tool-call-header" @click="toggleTool(segment.toolCall.id)">
                      <div class="tool-call-status">
                        <span v-if="segment.toolCall.status === 'running'" class="tool-status-icon spinning">⏳</span>
                        <span v-else-if="segment.toolCall.status === 'success'" class="tool-status-icon success">✅</span>
                        <span v-else class="tool-status-icon error">❌</span>
                        <span class="tool-call-name">{{ getToolDisplayName(segment.toolCall.name) }}</span>
                      </div>
                      <span class="tool-call-toggle" :class="{ expanded: isToolExpanded(segment.toolCall.id) }">▼</span>
                    </div>

                    <div v-show="isToolExpanded(segment.toolCall.id)" class="tool-call-detail">
                      <div v-if="segment.toolCall.args?.reason" class="tool-detail-row">
                        <span class="tool-detail-label">使用目的：</span>{{ segment.toolCall.args.reason }}
                      </div>
                      <div v-if="getToolSql(segment.toolCall.args)">
                        <div class="tool-detail-label">执行 SQL：</div>
                        <pre class="tool-sql-block"><code>{{ getToolSql(segment.toolCall.args) }}</code></pre>
                      </div>
                      <div v-if="getToolTableNames(segment.toolCall.args)" class="tool-detail-row">
                        <span class="tool-detail-label">目标表：</span>{{ getToolTableNames(segment.toolCall.args) }}
                      </div>
                      <div v-if="segment.toolCall.result">
                        <div class="tool-detail-label" style="margin-top: 8px">执行结果：</div>
                        <div v-if="segment.toolCall.result.ok" class="tool-result-success">
                          <template v-if="segment.toolCall.name === 'export_data'">
                            导出成功（共 {{ segment.toolCall.result.totalRows }} 条）
                          </template>
                          <template v-else-if="segment.toolCall.name === 'render_chart'">
                            图表配置已生成
                          </template>
                          <template v-else-if="segment.toolCall.name === 'save_memory'">
                            记忆已保存（ID: {{ segment.toolCall.result.memoryId }}）
                          </template>
                          <template v-else>
                            成功 (共 {{ segment.toolCall.result.totalRows }} 条{{ segment.toolCall.result.truncated ? '，展示前 10 行' : '' }})
                          </template>
                        </div>
                        <div v-else class="tool-result-error">
                          失败: {{ segment.toolCall.result.error }}
                        </div>
                        <div
                          v-if="segment.toolCall.name === 'export_data' && segment.toolCall.result.filePath"
                          class="tool-detail-row"
                          style="margin-top: 8px;"
                        >
                          <span class="tool-detail-label">导出文件：</span>{{ segment.toolCall.result.filePath }}
                          <button class="btn btn-outline" style="margin-left: 8px; padding: 4px 10px;" @click="openExportedFile(segment.toolCall.result)">
                            打开
                          </button>
                        </div>
                        <div
                          v-if="segment.toolCall.name === 'render_chart' && getChartConfig(segment.toolCall)"
                          style="margin-top: 8px; border: 1px solid var(--color-border); border-radius: 8px; padding: 8px; background: var(--color-surface-light);"
                        >
                          <ChartRenderer :config="getChartConfig(segment.toolCall)!" :height="320" />
                        </div>
                      </div>
                      <div v-if="segment.toolCall.errorMessage && !segment.toolCall.result" class="tool-result-error">
                        {{ segment.toolCall.errorMessage }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Markdown 内容阶段 -->
                <div v-else-if="segment.content" class="message-markdown" v-html="renderMarkdown(segment.content)" />
              </template>

              <div v-if="msg.status === 'loading' && (msg.content || (msg.toolCalls && msg.toolCalls.length > 0))" class="message-loading-inline">
                <span>正在生成</span>
                <span class="loading-dots loading-dots-sm"><i /><i /><i /></span>
              </div>

              <!-- 操作栏 -->
              <div v-if="msg.status !== 'loading'" class="message-actions">
                <button class="message-action-btn" title="复制" @click="copyText(stripToolMarkers(msg.content))">📋</button>
                <button class="message-action-btn" title="重新生成" @click="regenerateMessage">🔄</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部输入框 -->
      <div class="main-input-area">
        <div v-if="usage.totalTokens > 0" class="input-disclaimer" style="margin-bottom: 8px;">
          {{ usageText }}
        </div>
        <div class="input-box" :class="{ focused: inputFocused }">
          <textarea
            ref="textareaRef"
            v-model="inputText"
            :placeholder="isSending ? '正在生成回复，请稍候...' : '有什么我能帮您的？'"
            :disabled="isSending"
            rows="2"
            @focus="inputFocused = true"
            @blur="inputFocused = false"
            @keydown.enter="handleEnter"
            @input="autoResize"
          />
          <div class="input-toolbar">
            <button
              v-if="isSending"
              class="btn btn-outline"
              style="padding: 6px 12px; margin-right: 8px;"
              @click="onStopMessage"
            >
              停止
            </button>
            <button
              class="send-btn"
              :class="{ active: canSend }"
              :disabled="!canSend"
              @click="sendMessage"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>
        </div>
        <div class="input-disclaimer">内容由 AI 生成，可能会产生不准确的情况。</div>
      </div>
    </main>

    <!-- 右侧设置面板 -->
    <aside v-if="showSettings" class="sql-expert-settings">
      <div class="settings-header">
        <h2>设置</h2>
        <button class="settings-close-btn" @click="showSettings = false">✕</button>
      </div>

      <div class="settings-body">
        <!-- 数据库配置 -->
        <div class="settings-section">
          <h3 class="section-title">链接数据库 MySQL</h3>
          <div class="form-group">
            <label>Host</label>
            <input v-model="dbForm.host" placeholder="localhost" />
          </div>
          <div class="form-group">
            <label>Port</label>
            <input v-model.number="dbForm.port" type="number" placeholder="3306" />
          </div>
          <div class="form-group">
            <label>用户名</label>
            <input v-model="dbForm.user" placeholder="root" />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input v-model="dbForm.password" type="password" placeholder="密码" />
          </div>
          <div class="form-group">
            <label>数据库</label>
            <input v-model="dbForm.database" placeholder="数据库名" />
          </div>
          <div class="form-actions-row">
            <button class="btn btn-outline" @click="testConnection" :disabled="testingDb">
              {{ testingDb ? '测试中...' : '测试链接' }}
            </button>
            <span v-if="dbTestResult" class="test-result" :class="dbTestResult.success ? 'success' : 'error'">
              {{ dbTestResult.message }}
            </span>
          </div>
        </div>

        <!-- AI 配置 -->
        <div class="settings-section">
          <h3 class="section-title">AI 智能体设置 <span class="section-tag">deepseek</span></h3>
          <div class="form-group">
            <label>URL</label>
            <input v-model="aiForm.url" disabled placeholder="https://api.deepseek.com/v1" />
          </div>
          <div class="form-group">
            <label>API Key</label>
            <input v-model="aiForm.apiKey" type="password" placeholder="sk-..." />
          </div>
          <div class="form-group">
            <label>Model</label>
            <input v-model="aiForm.model" placeholder="deepseek-chat" />
          </div>
        </div>

        <!-- 一键加载表结构 -->
        <div class="settings-section">
          <h3 class="section-title">数据库表结构</h3>
          <p class="section-desc">连接数据库后，自动获取所有表名和注释，作为 AI 的上下文。</p>
          <button
            class="btn btn-primary btn-full"
            @click="onLoadSchema"
            :disabled="schemaLoading || !dbForm.host"
          >
            {{ schemaLoading ? '加载中...' : '一键加载当前数据库表结构' }}
          </button>
          <div v-if="schemaStatus" class="schema-status" :class="schemaStatus.success ? 'success' : 'error'">
            {{ schemaStatus.message }}
          </div>
          <div v-if="schema" class="schema-preview">
            <div class="schema-preview-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span>当前表清单 ({{ schemaTableCount }} 张表)</span>
              <span style="font-size: 11px; opacity: 0.7; user-select: text;" title="此文件保存路径">{{ schemaPath }}</span>
            </div>
            <pre class="schema-preview-content">{{ schemaPreview }}</pre>
          </div>
          <div v-if="schema" class="schema-preview" style="margin-top: 10px;">
            <div class="schema-preview-header" style="display: flex; justify-content: space-between; align-items: center;">
              <span>当前记忆 ({{ memories.length }} 条)</span>
              <button class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;" @click="refreshLocalMemories">
                刷新
              </button>
            </div>
            <div class="schema-preview-header" style="margin-bottom: 8px; opacity: 0.75; word-break: break-all;">文件: {{ memoryPath || '-' }}</div>
            <div class="schema-preview-content" style="max-height: 240px;">
              <div style="margin-bottom: 8px; opacity: 0.75;">scope: {{ memoryScope || '-' }}</div>
              <div v-if="memories.length === 0">暂无本地记忆，可直接编辑该文件追加内容。</div>
              <div v-for="memory in memories" :key="memory.id" style="margin-bottom: 10px; border-top: 1px dashed var(--color-border); padding-top: 8px;">
                <div style="opacity: 0.65; margin-bottom: 4px;">{{ memory.id }} | {{ memory.source }}</div>
                <!-- <div style="white-space: pre-wrap;">{{ memory.content }}</div> -->
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-footer">
        <button class="btn btn-outline" @click="showSettings = false">取消</button>
        <button class="btn btn-primary" @click="saveSettings">保存</button>
      </div>
    </aside>

    <!-- 会话文件弹窗 -->
    <div v-if="showSessionFilesModal" class="modal-overlay" @click.self="showSessionFilesModal = false">
      <div class="modal-content session-files-modal">
        <div class="modal-header">
          <h3>📦 会话文件 ({{ sessionFiles.length }})</h3>
          <button class="modal-close" @click="showSessionFilesModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="session-files-list">
            <div v-for="(file, idx) in sessionFiles" :key="idx" class="session-file-item" @click="openExportedFile(file.result)">
              <div class="sfi-info">
                <div class="sfi-name">{{ file.name }}</div>
                <div class="sfi-desc">{{ file.desc }}</div>
              </div>
              <button class="btn btn-outline sfi-btn">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 4px;">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>下载
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import DOMPurify from 'dompurify'
import { useSqlExpertChat } from './useSqlExpertChat'
import ChartRenderer from './ChartRenderer.vue'

// ============ Markdown 渲染 ============

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        return `<pre class="hljs-block"><code>${highlighted}</code></pre>`
      } catch { /* ignore */ }
    }
    return `<pre class="hljs-block"><code>${md.utils.escapeHtml(str)}</code></pre>`
  }
})

const renderMarkdown = (text: string): string => {
  if (!text) return ''
  return DOMPurify.sanitize(md.render(text))
}

export interface MessageSegment {
  type: 'text' | 'tool'
  key: string
  content?: string
  toolCall?: any
}

const getMessageSegments = (msg: { content: string; toolCalls?: any[] }): MessageSegment[] => {
  const toolCallMap = new Map((msg.toolCalls || []).map(t => [t.id, t]))
  const parts = msg.content.split(/:::tool:([^:]+):::/g)
  const segments: MessageSegment[] = []

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i].trim()) {
        segments.push({ type: 'text', key: `text-${i}`, content: parts[i] })
      }
    } else {
      const toolId = parts[i]
      segments.push({ type: 'tool', key: `tool-${toolId}`, toolCall: toolCallMap.get(toolId) })
    }
  }

  return segments
}

const stripToolMarkers = (content: string) => content.replace(/:::tool:[^:]+:::/g, '').trim()

// ============ Chat composable ============

const {
  activeChatId,
  chatMessages,
  deleteChat,
  historyList,
  inputText,
  isSending,
  schema,
  schemaPath,
  memories,
  memoryPath,
  memoryScope,
  usage,
  schemaLoading,
  loadSchema,
  refreshMemories,
  sendMessage,
  stopMessage,
  regenerateMessage,
  selectChat,
  startNewChat,
  TOOL_DISPLAY_NAME_MAP
} = useSqlExpertChat()

// ============ UI 状态 ============

const showSettings = ref(false)
const inputFocused = ref(false)
const chatScrollRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const expandedTools = ref<Set<string>>(new Set())

const showSessionFilesModal = ref(false)

const sessionFiles = computed(() => {
  const files: { name: string, path: string, desc: string, result: any }[] = []
  chatMessages.value.forEach(msg => {
    if (msg.toolCalls) {
      msg.toolCalls.forEach(tool => {
        if (tool.name === 'export_data' && tool.result && tool.result.ok && tool.result.filePath) {
          const path = tool.result.filePath as string
          const name = path.split(/[/\\]/).pop() || '未命名文件'
          
          let dateStr = ''
          if (path.includes('_')) {
             const m = path.match(/_(\d{8})/)
             if (m) {
                 const y = m[1].substring(0, 4)
                 const mo = parseInt(m[1].substring(4, 6))
                 const d = parseInt(m[1].substring(6, 8))
                 dateStr = `（${y}年${mo}月${d}日）`
             }
          }
          if (!dateStr) {
             const now = new Date()
             dateStr = `（${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日）`
          }

          files.push({
            name,
            path,
            desc: `共 ${tool.result.totalRows} 条 | 导出今天${dateStr}的业务员拜访记录，包含业务员信息、门店信息和拜访详情`,
            result: tool.result
          })
        }
      })
    }
  })
  return files
})

// 设置表单
const dbForm = ref({ host: 'localhost', port: 3306, user: 'root', password: '', database: '' })
const aiForm = ref({ url: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat' })
const testingDb = ref(false)
const dbTestResult = ref<{ success: boolean; message: string } | null>(null)
const schemaStatus = ref<{ success: boolean; message: string } | null>(null)

const checkingBalance = ref(false)
const balanceResult = ref<{ success: boolean; message: string } | null>(null)

const checkBalance = async () => {
  if (!aiForm.value.url || !aiForm.value.apiKey) return
  checkingBalance.value = true
  try {
    const result = await window.api.sqlExpert.checkBalance({
      url: aiForm.value.url,
      apiKey: aiForm.value.apiKey
    })
    balanceResult.value = result
  } catch (err: any) {
    balanceResult.value = { success: false, message: `查询失败: ${err.message}` }
  } finally {
    checkingBalance.value = false
  }
}

// 自动在 API Key 就绪时查询一次余额
watch(() => aiForm.value.apiKey, (val) => {
  if (val) checkBalance()
}, { immediate: true })

// 监听会话发送状态：由发送中(true)变成空闲(false)时，触发余额查询
watch(isSending, (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    checkBalance()
  }
})

const canSend = computed(() => Boolean(inputText.value.trim()) && !isSending.value)

const schemaTableCount = computed(() => {
  if (!schema.value) return 0
  return schema.value.split(/\r?\n/).filter(l => l.trim()).length
})

const schemaPreview = computed(() => {
  if (!schema.value) return ''
  const lines = schema.value.split(/\r?\n/).filter(l => l.trim())
  if (lines.length <= 20) return lines.join('\n')
  return lines.slice(0, 20).join('\n') + `\n... 还有 ${lines.length - 20} 张表`
})

const tokenPricing = {
  promptCacheHitPerMillion: 0.2,
  promptCacheMissPerMillion: 2,
  completionPerMillion: 3
}

const estimatedCost = computed(() => {
  const promptCacheHitCost =
    ((usage.value.promptCacheHitTokens || 0) / 1_000_000) * tokenPricing.promptCacheHitPerMillion
  const promptCacheMissCost =
    ((usage.value.promptCacheMissTokens || 0) / 1_000_000) * tokenPricing.promptCacheMissPerMillion
  const completionCost =
    ((usage.value.completionTokens || 0) / 1_000_000) * tokenPricing.completionPerMillion

  return promptCacheHitCost + promptCacheMissCost + completionCost
})

const formatCurrency = (value: number) => {
  if (value >= 1) return `¥${value.toFixed(2)}`
  if (value >= 0.01) return `¥${value.toFixed(4)}`
  return `¥${value.toFixed(6)}`
}

const usageText = computed(() => {
  const total = usage.value.totalTokens || 0
  const completion = usage.value.completionTokens || 0
  const hit = usage.value.promptCacheHitTokens || 0
  const miss = usage.value.promptCacheMissTokens || 0
  return `累计 ${total} tokens（输出 ${completion}，缓存命中 ${hit}，未命中 ${miss}） | 估计费用 ${formatCurrency(estimatedCost.value)}`
})

// ============ 事件处理 ============

const handleEnter = (e: KeyboardEvent) => {
  if (e.shiftKey || e.isComposing) return
  e.preventDefault()
  sendMessage()
}

const autoResize = () => {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

watch(inputText, (newVal) => {
  if (!newVal) {
    nextTick(() => {
      if (textareaRef.value) {
        textareaRef.value.style.height = 'auto'
      }
    })
  }
})

const toggleTool = (toolId: string) => {
  const next = new Set(expandedTools.value)
  if (next.has(toolId)) { next.delete(toolId) } else { next.add(toolId) }
  expandedTools.value = next
}

const isToolExpanded = (toolId: string) => expandedTools.value.has(toolId)

const getToolDisplayName = (toolName: string) => TOOL_DISPLAY_NAME_MAP[toolName] || toolName
const getToolSql = (args?: Record<string, unknown>) => (typeof args?.sql === 'string' ? args.sql : '')
const getToolTableNames = (args?: Record<string, unknown>) => {
  if (Array.isArray(args?.tableNames)) {
    return (args.tableNames as string[]).filter(s => typeof s === 'string').join('、')
  }
  return typeof args?.tableName === 'string' ? args.tableName : ''
}

const getChartConfig = (toolCall?: { result?: Record<string, unknown> }) => {
  const config = toolCall?.result?.chartConfig
  return config && typeof config === 'object' ? (config as Record<string, unknown>) : null
}

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(stripToolMarkers(text))
  } catch { /* ignore */ }
}

const openExportedFile = async (result?: Record<string, unknown>) => {
  const filePath = typeof result?.filePath === 'string' ? result.filePath : ''
  if (!filePath) return
  await window.api.app.openFile(filePath)
}

const refreshLocalMemories = async () => {
  const result = await refreshMemories({
    database: dbForm.value.database,
    apiKey: aiForm.value.apiKey
  })
  if (!result.success) {
    schemaStatus.value = { success: false, message: result.error || '刷新记忆失败' }
  }
}

const onStopMessage = async () => {
  await stopMessage()
}

const onDeleteChat = (id: string) => {
  if (confirm('删除后不可恢复，是否继续？')) {
    deleteChat(id)
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (!chatScrollRef.value) return
    chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
  })
}

// ============ 设置操作 ============

const testConnection = async () => {
  testingDb.value = true
  dbTestResult.value = null
  try {
    const result = await window.api.sqlExpert.testDb({
      host: dbForm.value.host,
      port: dbForm.value.port,
      user: dbForm.value.user,
      password: dbForm.value.password,
      database: dbForm.value.database
    })
    dbTestResult.value = result
  } catch (e) {
    dbTestResult.value = { success: false, message: e instanceof Error ? e.message : '连接失败' }
  } finally {
    testingDb.value = false
  }
}

const onLoadSchema = async () => {
  schemaStatus.value = null
  const result = await loadSchema({
    host: dbForm.value.host,
    port: dbForm.value.port,
    user: dbForm.value.user,
    password: dbForm.value.password,
    database: dbForm.value.database
  })
  if (result.success) {
    await refreshMemories({
      database: dbForm.value.database,
      apiKey: aiForm.value.apiKey
    })
    schemaStatus.value = { success: true, message: `加载成功，共 ${result.tableCount} 张表` }
  } else {
    schemaStatus.value = { success: false, message: result.error || '加载失败' }
  }
}

const saveSettings = async () => {
  try {
    await window.api.sqlExpert.saveConfig({
      db: { ...dbForm.value },
      ai: { ...aiForm.value }
    })
    showSettings.value = false
  } catch (e) {
    console.error('保存设置失败', e)
  }
}

// 加载已保存的配置
onMounted(async () => {
  try {
    const result = await window.api.sqlExpert.loadConfig()
    if (result.config) {
      const { db, ai } = result.config
      if (db) {
        dbForm.value = { ...dbForm.value, ...db }
      }
      if (ai) {
        aiForm.value = { ...aiForm.value, ...ai }
      }
    }
  } catch (e) {
    console.warn('加载配置失败', e)
  }
})

// 监听消息变化自动滚动
watch(
  () => {
    const lastMessage = chatMessages.value[chatMessages.value.length - 1]
    return [activeChatId.value, chatMessages.value.length, isSending.value, lastMessage?.id, lastMessage?.content, lastMessage?.status]
  },
  () => { scrollToBottom() },
  { flush: 'post' }
)
</script>

<style scoped>
.sql-expert { display: flex; height: 100%; background: var(--color-surface); color: var(--color-text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.sql-expert-sidebar { width: 260px; display: flex; flex-direction: column; border-right: 1px solid var(--color-border); background: var(--color-surface); flex-shrink: 0; }
.sidebar-new-btn { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 16px; padding: 12px 16px; border: none; border-radius: 12px; background: linear-gradient(135deg, var(--color-primary, #6366f1), #8b5cf6); color: #ffffff; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.sidebar-new-btn:hover { box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4); transform: translateY(-1px); }
.sidebar-new-btn:active { transform: translateY(1px); box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2); }
.sidebar-history { flex: 1; overflow-y: auto; padding: 0 12px 16px; }
.sidebar-history::-webkit-scrollbar { width: 4px; }
.sidebar-history::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; }
.sidebar-history:hover::-webkit-scrollbar-thumb { background: var(--color-border); }
.history-group { margin-bottom: 20px; }
.history-label { padding: 4px 8px; font-size: 11px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.history-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 10px; margin-bottom: 2px; cursor: pointer; transition: all 0.2s ease; color: var(--color-text); }
.history-item:hover { background: var(--color-surface-lighter); }
.history-item.active { background: var(--color-surface-lighter); color: var(--color-primary); font-weight: 500; position: relative; }
.history-item.active::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); height: 16px; width: 3px; background: var(--color-primary); border-radius: 0 4px 4px 0; }
.history-item-title { flex: 1; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-item-delete { display: none; padding: 4px; border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; border-radius: 6px; transition: all 0.2s ease; }
.history-item:hover .history-item-delete { display: flex; }
.history-item-delete:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
.sql-expert-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; background: var(--color-surface-light); }
.main-topbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); flex-shrink: 0; z-index: 10; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
.topbar-title { font-size: 16px; font-weight: 600; letter-spacing: 0.02em; }
.topbar-actions { display: flex; align-items: center; gap: 16px; }
.topbar-balance-text { font-size: 12px; padding: 4px 12px; border-radius: 20px; font-weight: 500; cursor: pointer; user-select: none; transition: all 0.2s ease; }
.topbar-balance-text.success { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
.topbar-balance-text.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
.topbar-balance-text:hover { opacity: 0.8; }
.topbar-schema-badge { font-size: 12px; padding: 4px 12px; border-radius: 20px; background: rgba(16, 185, 129, 0.1); color: #10b981; font-weight: 500; border: 1px solid rgba(16, 185, 129, 0.2); }

.topbar-settings-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--color-text-muted); cursor: pointer; transition: all 0.2s ease; }
.topbar-settings-btn:hover { background: var(--color-surface-lighter); color: var(--color-text); border-color: var(--color-border); }
.main-welcome { flex: 1; display: flex; align-items: center; justify-content: center; }
.welcome-content { text-align: center; animation: fadeIn 0.8s ease-out forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.welcome-title { font-size: 42px; font-weight: 800; background: linear-gradient(135deg, #818cf8, #c084fc, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 16px; letter-spacing: -0.02em; }
.welcome-subtitle { font-size: 16px; color: var(--color-text-muted); margin-bottom: 12px; }
.welcome-hint { font-size: 14px; color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 8px 16px; border-radius: 20px; display: inline-block; }
.main-messages { flex: 1; overflow-y: auto; padding: 24px 32px; scroll-behavior: smooth; }
.message-wrapper { max-width: 840px; margin: 0 auto 32px; animation: messageSlideIn 0.3s ease-out forwards; }
@keyframes messageSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.message-user { display: flex; justify-content: flex-end; }
.message-user-bubble { background: linear-gradient(135deg, var(--color-primary, #6366f1), #8b5cf6); color: #ffffff; padding: 14px 20px; border-radius: 20px 20px 4px 20px; max-width: 75%; font-size: 15px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.2); }
.message-assistant { display: flex; gap: 16px; }
.message-assistant-icon { font-size: 24px; flex-shrink: 0; margin-top: 2px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: var(--color-surface); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid var(--color-border); }
.message-assistant-body { flex: 1; min-width: 0; padding-top: 6px; }
.tool-calls { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.tool-call-item { border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; background: var(--color-surface); box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: all 0.3s ease; }
.tool-call-item:hover { border-color: rgba(99, 102, 241, 0.4); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.tool-call-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; cursor: pointer; background: rgba(0,0,0,0.01); }
.tool-call-header:hover { background: var(--color-surface-lighter); }
.tool-call-status { display: flex; align-items: center; gap: 10px; }
.tool-status-icon { font-size: 15px; }
.tool-status-icon.success { filter: drop-shadow(0 0 2px rgba(16, 185, 129, 0.4)); }
.tool-status-icon.error { filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.4)); }
.tool-status-icon.spinning { animation: spin 1s linear infinite; }
.tool-call-name { font-size: 14px; font-weight: 500; color: var(--color-text); }
.tool-call-toggle { font-size: 10px; color: var(--color-text-muted); transition: transform 0.3s ease; }
.tool-call-toggle.expanded { transform: rotate(180deg); }
.tool-call-detail { padding: 16px; border-top: 1px solid var(--color-border); font-size: 13.5px; background: var(--color-surface); }
.tool-detail-row { margin-bottom: 8px; color: var(--color-text-muted); line-height: 1.5; }
.tool-detail-label { font-weight: 600; color: var(--color-text); margin-bottom: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8; }
.tool-sql-block { margin: 6px 0 12px; padding: 14px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; overflow-x: auto; font-family: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', monospace; font-size: 12.5px; line-height: 1.6; color: #38bdf8; white-space: pre; }
.tool-result-success { padding: 10px 14px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; color: #10b981; font-size: 13.5px; display: flex; align-items: center; gap: 8px; }
.tool-result-success::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981; }
.tool-result-error { padding: 10px 14px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; color: #ef4444; font-size: 13.5px; white-space: pre-wrap; display: flex; align-items: flex-start; gap: 8px; }
.tool-result-error::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ef4444; margin-top: 6px; }
.message-loading { display: inline-flex; align-items: center; gap: 10px; padding: 12px 18px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 18px 18px 18px 4px; font-size: 14px; color: var(--color-text-muted); box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
.message-loading-inline { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px; color: var(--color-text-muted); background: var(--color-surface-lighter); padding: 6px 12px; border-radius: 12px; width: fit-content; }
@keyframes dot-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
.loading-dots { display: inline-flex; align-items: center; gap: 4px; }
.loading-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--color-primary); animation: dot-bounce 1.4s infinite ease-in-out; }
.loading-dots i:nth-child(2) { animation-delay: 0.2s; }
.loading-dots i:nth-child(3) { animation-delay: 0.4s; }
.loading-dots-sm i { width: 4px; height: 4px; background: var(--color-text-muted); }
.message-markdown { font-size: 15px; line-height: 1.7; color: var(--color-text); }
.message-markdown :deep(strong) { font-weight: 600; color: var(--color-text); }
.message-markdown :deep(p) { margin: 0.75em 0; }
.message-markdown :deep(ul) { list-style: disc; margin-left: 1.5rem; margin: 0.75em 0; padding-left: 0.5rem; }
.message-markdown :deep(ol) { list-style: decimal; margin-left: 1.5rem; margin: 0.75em 0; padding-left: 0.5rem; }
.message-markdown :deep(li) { margin: 0.3em 0; }
.message-markdown :deep(li::marker) { color: var(--color-primary); }
.message-markdown :deep(h1), .message-markdown :deep(h2), .message-markdown :deep(h3), .message-markdown :deep(h4) { margin: 1.5em 0 0.75em; font-weight: 600; line-height: 1.3; }
.message-markdown :deep(h1) { font-size: 1.5em; border-bottom: 1px solid var(--color-border); padding-bottom: 0.3em; }
.message-markdown :deep(h2) { font-size: 1.3em; border-bottom: 1px solid var(--color-border); padding-bottom: 0.3em; }
.message-markdown :deep(h3) { font-size: 1.1em; }
.message-markdown :deep(.hljs-block) { padding: 16px; overflow-x: auto; font-size: 13.5px; font-family: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', monospace; line-height: 1.5; margin: 1em 0; border-radius: 10px; background: #0f172a; border: 1px solid rgba(255,255,255,0.1); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05); }
.message-markdown :deep(code:not(pre code)) { background: rgba(139, 92, 246, 0.15); color: #c084fc; padding: 2px 6px; border-radius: 6px; font-size: 13.5px; font-family: 'SF Mono', 'Cascadia Code', monospace; }
.message-markdown :deep(blockquote) { border-left: 4px solid var(--color-primary); background: var(--color-surface-lighter); padding: 12px 16px; border-radius: 0 8px 8px 0; color: var(--color-text-muted); margin: 1em 0; font-style: italic; }
.message-actions { display: flex; gap: 8px; margin-top: 12px; opacity: 0; transform: translateY(4px); transition: all 0.2s ease; }
.message-wrapper:hover .message-actions { opacity: 1; transform: translateY(0); }
.message-action-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--color-border); background: var(--color-surface); font-size: 13px; cursor: pointer; border-radius: 6px; color: var(--color-text-muted); transition: all 0.2s ease; }
.message-action-btn:hover { background: var(--color-surface-lighter); color: var(--color-text); border-color: var(--color-primary); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.main-input-area { flex-shrink: 0; padding: 16px 32px 24px; background: var(--color-surface-light); border-top: 1px solid var(--color-border); z-index: 10; }
.input-box { max-width: 840px; margin: 0 auto; border: 1px solid var(--color-border); border-radius: 16px; background: var(--color-surface); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.input-box.focused { border-color: var(--color-primary); box-shadow: 0 12px 32px rgba(99, 102, 241, 0.15); transform: translateY(-2px); }
.input-box textarea { width: 100%; border: none; outline: none; background: transparent; color: var(--color-text); font-size: 15px; line-height: 1.6; padding: 16px 20px 0; resize: none; font-family: inherit; max-height: 240px; }
.input-box textarea::placeholder { color: var(--color-text-muted); opacity: 0.7; }
.input-toolbar { display: flex; justify-content: flex-end; padding: 10px 16px; align-items: center; }
.send-btn { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 12px; background: var(--color-surface-lighter); color: var(--color-text-muted); cursor: not-allowed; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.send-btn.active { background: linear-gradient(135deg, var(--color-primary, #6366f1), #8b5cf6); color: white; cursor: pointer; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
.send-btn.active:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4); }
.send-btn.active:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3); }
.input-disclaimer { text-align: center; font-size: 12px; color: var(--color-text-muted); margin-top: 12px; opacity: 0.7; }
.sql-expert-settings { position: absolute;right: 0; width: 380px; height: 100%; display: flex; flex-direction: column; border-left: 1px solid var(--color-border); background: var(--color-surface); flex-shrink: 0; overflow: hidden; z-index: 99; box-shadow: -4px 0 24px rgba(0,0,0,0.05); }
.settings-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
.settings-header h2 { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
.settings-close-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: var(--color-surface-lighter); color: var(--color-text-muted); cursor: pointer; border-radius: 8px; font-size: 14px; transition: all 0.2s ease; }
.settings-close-btn:hover { background: var(--color-border); color: var(--color-text); transform: rotate(90deg); }
.settings-body { flex: 1; overflow-y: auto; padding: 24px; }
.settings-section { margin-bottom: 32px; background: var(--color-surface-light); padding: 20px; border-radius: 16px; border: 1px solid var(--color-border); }
.section-title { font-size: 15px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; color: var(--color-text); }
.section-tag { font-size: 11px; padding: 3px 8px; border-radius: 6px; background: rgba(99, 102, 241, 0.15); color: #8b5cf6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.section-desc { font-size: 13px; color: var(--color-text-muted); margin-bottom: 16px; line-height: 1.6; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 6px; }
.form-group input { width: 100%; padding: 10px 14px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); color: var(--color-text); font-size: 14px; outline: none; transition: all 0.2s ease; }
.form-group input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }
.form-group input:disabled { background: var(--color-surface-lighter); color: var(--color-text-muted); cursor: not-allowed; }
.form-group input::placeholder { color: var(--color-text-muted); opacity: 0.5; }
.form-actions-row { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.test-result { font-size: 13px; font-weight: 500; }
.test-result.success { color: #10b981; }
.test-result.error { color: #ef4444; }
.schema-status { font-size: 13px; margin-top: 10px; font-weight: 500; text-align: center; }
.schema-status.success { color: #10b981; }
.schema-status.error { color: #ef4444; }
.schema-preview { margin-top: 16px; border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; background: var(--color-surface); }
.schema-preview-header { padding: 10px 14px; font-size: 13px; font-weight: 500; color: var(--color-text-muted); background: rgba(0,0,0,0.02); border-bottom: 1px solid var(--color-border); }
.schema-preview-content { padding: 12px 14px; font-size: 12px; line-height: 1.6; max-height: 240px; overflow-y: auto; font-family: 'SF Mono', 'Cascadia Code', monospace; color: var(--color-text-muted); background: var(--color-surface); white-space: pre-wrap; margin: 0; }
.schema-preview-content::-webkit-scrollbar { width: 6px; height: 6px; }
.schema-preview-content::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 6px; }
.btn { padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
.btn-primary { background: linear-gradient(135deg, var(--color-primary, #6366f1), #8b5cf6); color: white; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2); }
.btn-primary:hover:not(:disabled) { box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3); transform: translateY(-1px); }
.btn-primary:active:not(:disabled) { transform: translateY(1px); box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2); }
.btn-outline { background: transparent; border: 1px solid var(--color-border); color: var(--color-text); }
.btn-outline:hover:not(:disabled) { background: var(--color-surface-lighter); border-color: var(--color-primary); color: var(--color-primary); }
.btn-full { width: 100%; }
.settings-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 20px 24px; border-top: 1px solid var(--color-border); background: var(--color-surface); }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* 会话文件弹窗与入口样式 */
.topbar-action-btn { position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); color: var(--color-text-muted); cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.topbar-action-btn:hover { background: var(--color-surface-lighter); border-color: var(--color-primary); color: var(--color-primary); }
.topbar-action-btn .badge { position: absolute; top: -6px; right: -6px; background: #ef4444; color: white; font-size: 10px; font-weight: bold; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 4px; border: 2px solid var(--color-surface); z-index: 2; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(2px); animation: fadeIn 0.2s; }
.modal-content { background: var(--color-surface); border-radius: 16px; width: 640px; max-width: 90vw; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 40px rgba(0,0,0,0.2); animation: modalScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
.modal-header { padding: 18px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-border); }
.modal-header h3 { font-size: 16px; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 8px; }
.modal-close { background: var(--color-surface-light); border: 1px solid var(--color-border); font-size: 14px; color: var(--color-text-muted); cursor: pointer; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.modal-close:hover { background: var(--color-surface-lighter); color: var(--color-text); }
.modal-body { padding: 16px; overflow-y: auto; }
.session-file-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; margin-bottom: 8px; background: var(--color-surface-light); border: 1px solid var(--color-border); border-radius: 12px; transition: all 0.2s; cursor: pointer; }
.session-file-item:last-child { margin-bottom: 0; }
.session-file-item:hover { border-color: rgba(99, 102, 241, 0.4); box-shadow: 0 4px 12px rgba(99,102,241,0.06); transform: translateY(-1px); }
.sfi-name { font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 6px; }
.sfi-desc { font-size: 12.5px; color: var(--color-text-muted); line-height: 1.5; }
.sfi-btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; flex-shrink: 0; margin-left: 16px; white-space: nowrap; pointer-events: none; }
</style>
