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
        <span class="topbar-title">SQL 专家</span>
        <div class="topbar-actions">
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
          <h1 class="welcome-title">SQL 专家</h1>
          <p class="welcome-subtitle">自然语言转 SQL，智能查询数据库</p>
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
                          成功 (共 {{ segment.toolCall.result.totalRows }} 条{{ segment.toolCall.result.truncated ? '，展示前 10 行' : '' }})
                        </div>
                        <div v-else class="tool-result-error">
                          失败: {{ segment.toolCall.result.error }}
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
            <input v-model="aiForm.url" placeholder="https://api.deepseek.com/v1/chat/completions" />
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
          <div v-if="schema || prompt" class="schema-preview" style="gap: 16px; display: flex; flex-direction: column;">
            <div v-if="schema">
              <div class="schema-preview-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span>当前表清单 ({{ schemaTableCount }} 张表)</span>
                <span style="font-size: 11px; opacity: 0.7; user-select: text;" title="此文件保存路径">{{ schemaPath }}</span>
              </div>
              <pre class="schema-preview-content">{{ schemaPreview }}</pre>
            </div>
            <div v-if="prompt">
              <div class="schema-preview-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span>AI Prompt (指导词)</span>
                <span style="font-size: 11px; opacity: 0.7; user-select: text;" title="此文件保存路径：可手动修改自定义">{{ promptPath }}</span>
              </div>
              <pre class="schema-preview-content" style="max-height: 200px;">{{ prompt }}</pre>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-footer">
        <button class="btn btn-outline" @click="showSettings = false">取消</button>
        <button class="btn btn-primary" @click="saveSettings">保存</button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import DOMPurify from 'dompurify'
import { useSqlExpertChat } from './useSqlExpertChat'

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
  prompt,
  promptPath,
  schemaLoading,
  loadSchema,
  sendMessage,
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

// 设置表单
const dbForm = ref({ host: 'localhost', port: 3306, user: 'root', password: '', database: '' })
const aiForm = ref({ url: 'https://api.deepseek.com/v1/chat/completions', apiKey: '', model: 'deepseek-chat' })
const testingDb = ref(false)
const dbTestResult = ref<{ success: boolean; message: string } | null>(null)
const schemaStatus = ref<{ success: boolean; message: string } | null>(null)

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

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(stripToolMarkers(text))
  } catch { /* ignore */ }
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
.sql-expert {
  display: flex;
  height: 100%;
  background: var(--color-surface);
  color: var(--color-text);
}

/* ============ 左侧历史 ============ */

.sql-expert-sidebar {
  width: 240px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface-light);
  flex-shrink: 0;
}

.sidebar-new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 12px;
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sidebar-new-btn:hover {
  background: var(--color-surface-lighter);
  border-color: var(--color-border-hover);
}

.sidebar-history {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 12px;
}

.history-group {
  margin-bottom: 16px;
}

.history-label {
  padding: 4px 8px;
  font-size: 11px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.history-item:hover {
  background: var(--color-surface-lighter);
}

.history-item.active {
  background: rgba(129, 140, 248, 0.15);
  color: var(--color-primary);
}

.history-item-title {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-item-delete {
  display: none;
  padding: 4px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all var(--transition-fast);
}

.history-item:hover .history-item-delete {
  display: flex;
}

.history-item-delete:hover {
  color: var(--color-error);
  background: rgba(248, 113, 113, 0.1);
}

/* ============ 中间聊天区 ============ */

.sql-expert-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.main-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.topbar-title {
  font-size: 15px;
  font-weight: 600;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topbar-schema-badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 99px;
  background: rgba(52, 211, 153, 0.15);
  color: var(--color-success);
}

.topbar-settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.topbar-settings-btn:hover {
  background: var(--color-surface-lighter);
  color: var(--color-text);
}

/* 欢迎页 */
.main-welcome {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-content {
  text-align: center;
}

.welcome-title {
  font-size: 36px;
  font-weight: 700;
  background: linear-gradient(135deg, #818cf8, #a78bfa, #22d3ee);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 12px;
}

.welcome-subtitle {
  font-size: 15px;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}

.welcome-hint {
  font-size: 13px;
  color: var(--color-warning);
}

/* 消息列表 */
.main-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px 120px;
}

.message-wrapper {
  max-width: 800px;
  margin: 0 auto 24px;
}

.message-user {
  display: flex;
  justify-content: flex-end;
}

.message-user-bubble {
  background: var(--color-surface-lighter);
  color: var(--color-text);
  padding: 12px 18px;
  border-radius: 18px 18px 4px 18px;
  max-width: 75%;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-assistant {
  display: flex;
  gap: 12px;
}

.message-assistant-icon {
  font-size: 22px;
  flex-shrink: 0;
  margin-top: 2px;
}

.message-assistant-body {
  flex: 1;
  min-width: 0;
}

/* 工具调用 */
.tool-calls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.tool-call-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-surface-light);
}

.tool-call-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.tool-call-header:hover {
  background: var(--color-surface-lighter);
}

.tool-call-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-status-icon {
  font-size: 14px;
}

.tool-status-icon.spinning {
  animation: spin 1s linear infinite;
}

.tool-call-name {
  font-size: 13px;
  font-weight: 500;
}

.tool-call-toggle {
  font-size: 10px;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.tool-call-toggle.expanded {
  transform: rotate(180deg);
}

.tool-call-detail {
  padding: 12px;
  border-top: 1px solid var(--color-border);
  font-size: 13px;
  background: var(--color-surface);
}

.tool-detail-row {
  margin-bottom: 6px;
  color: var(--color-text-muted);
}

.tool-detail-label {
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.tool-sql-block {
  margin: 4px 0 8px;
  padding: 10px;
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #93c5fd;
  white-space: pre;
}

.tool-result-success {
  padding: 8px 10px;
  background: rgba(52, 211, 153, 0.1);
  border: 1px solid rgba(52, 211, 153, 0.2);
  border-radius: 6px;
  color: var(--color-success);
  font-size: 13px;
}

.tool-result-error {
  padding: 8px 10px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: 6px;
  color: var(--color-error);
  font-size: 13px;
  white-space: pre-wrap;
}

/* 加载动画 */
.message-loading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--color-surface-lighter);
  border-radius: 16px 16px 16px 4px;
  font-size: 14px;
  color: var(--color-text-muted);
}

.message-loading-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-muted);
}

@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.loading-dots {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.loading-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-text-muted);
  animation: dot-bounce 1.2s infinite ease-in-out;
}

.loading-dots i:nth-child(2) { animation-delay: 0.15s; }
.loading-dots i:nth-child(3) { animation-delay: 0.3s; }

.loading-dots-sm i { width: 4px; height: 4px; }

/* Markdown 样式 */
.message-markdown {
  font-size: 14px;
  line-height: 1.8;
  color: var(--color-text);
}

.message-markdown :deep(strong) { font-weight: 600; }
.message-markdown :deep(p) { margin: 0.5em 0; }
.message-markdown :deep(ul) { list-style: disc; margin-left: 1.5rem; margin: 0.5em 0 0.5em 1.5rem; }
.message-markdown :deep(ol) { list-style: decimal; margin-left: 1.5rem; margin: 0.5em 0 0.5em 1.5rem; }
.message-markdown :deep(li) { margin: 0.2em 0; }
.message-markdown :deep(h1), .message-markdown :deep(h2), .message-markdown :deep(h3) {
  margin: 1em 0 0.5em; font-weight: 600;
}

.message-markdown :deep(.hljs-block) {
  padding: 14px;
  overflow-x: auto;
  font-size: 13px;
  font-family: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', monospace;
  line-height: 1.5;
  margin: 0.5em 0;
  border-radius: var(--radius-sm);
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
}

.message-markdown :deep(code:not(pre code)) {
  background: var(--color-surface-lighter);
  color: #c084fc;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.message-markdown :deep(blockquote) {
  border-left: 3px solid var(--color-primary);
  padding-left: 12px;
  color: var(--color-text-muted);
  margin: 0.75em 0;
}

/* 操作栏 */
.message-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.message-action-btn {
  padding: 4px 8px;
  border: none;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}

.message-action-btn:hover {
  opacity: 1;
}

/* ============ 底部输入区 ============ */

.main-input-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 32px 20px;
  background: linear-gradient(to top, var(--color-surface) 60%, transparent);
}

.input-box {
  max-width: 800px;
  margin: 0 auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-light);
  overflow: hidden;
  transition: all var(--transition-fast);
}

.input-box.focused {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-glow);
}

.input-box textarea {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.6;
  padding: 14px 16px 0;
  resize: none;
  font-family: inherit;
  max-height: 200px;
}

.input-box textarea::placeholder {
  color: var(--color-text-muted);
}

.input-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px;
}

.send-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--color-surface-lighter);
  color: var(--color-text-muted);
  cursor: not-allowed;
  transition: all var(--transition-fast);
}

.send-btn.active {
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  box-shadow: 0 2px 12px var(--color-primary-glow);
}

.send-btn.active:hover {
  background: var(--color-primary-dark);
}

.input-disclaimer {
  text-align: center;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 10px;
  opacity: 0.6;
}

/* ============ 右侧设置面板 ============ */

.sql-expert-settings {
  width: 360px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface-light);
  flex-shrink: 0;
  overflow: hidden;
  z-index: 99;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.settings-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.settings-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 6px;
  font-size: 16px;
  transition: all var(--transition-fast);
}

.settings-close-btn:hover {
  background: var(--color-surface-lighter);
  color: var(--color-text);
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.settings-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(129, 140, 248, 0.15);
  color: var(--color-primary);
  font-weight: 500;
}

.section-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 12px;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.form-group input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.form-group input:focus {
  border-color: var(--color-primary);
}

.form-group input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.5;
}

.form-actions-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.test-result {
  font-size: 12px;
}

.test-result.success {
  color: var(--color-success);
}

.test-result.error {
  color: var(--color-error);
}

.schema-status {
  font-size: 12px;
  margin-top: 8px;
}

.schema-status.success {
  color: var(--color-success);
}

.schema-status.error {
  color: var(--color-error);
}

.schema-preview {
  margin-top: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.schema-preview-header {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.schema-preview-content {
  padding: 10px 12px;
  font-size: 11px;
  line-height: 1.6;
  max-height: 200px;
  overflow-y: auto;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  color: var(--color-text-muted);
  background: var(--color-surface);
  white-space: pre-wrap;
  margin: 0;
}

/* 按钮 */
.btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.btn-outline:hover:not(:disabled) {
  background: var(--color-surface-lighter);
  border-color: var(--color-border-hover);
}

.btn-full {
  width: 100%;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}

/* ============ 动画 ============ */

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
