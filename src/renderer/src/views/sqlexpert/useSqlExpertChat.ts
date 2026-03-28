/**
 * 企业级分析专家会话管理 composable
 * 适配自 lancheng_dailyB2B_admin 的 useAiAgentChat.ts
 * 核心改动：通过 IPC (window.api.sqlExpert) 调用主进程服务
 */
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'

// ============ 类型定义 ============

type ChatRole = 'user' | 'assistant'
type ChatStatus = 'done' | 'loading' | 'error' | 'stopped'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  thinking?: string
  showThinking?: boolean
  toolCalls?: ToolCallItem[]
  status: ChatStatus
  createdAt: string
}

export interface ToolCallItem {
  id: string
  name: string
  args: Record<string, unknown>
  result?: Record<string, unknown>
  status: string
  errorMessage?: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

interface HistoryGroupItem {
  id: string
  title: string
  updatedAt: string
}

export interface HistoryGroup {
  label: string
  items: HistoryGroupItem[]
}

// ============ 常量 ============

const STORAGE_KEY = 'sql-expert-chat-sessions'

const TOOL_DISPLAY_NAME_MAP: Record<string, string> = {
  query_database: '查询数据库',
  describe_table_schema: '查询表结构',
  render_chart: '绘制图表',
  export_data: '导出数据',
  save_memory: '保存记忆'
}

// ============ 辅助函数 ============

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function createSession(title = '新对话'): ChatSession {
  const now = new Date().toISOString()
  return { id: createId(), title, messages: [], createdAt: now, updatedAt: now }
}

function createMessage(role: ChatRole, content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: createId(),
    role,
    content,
    status: 'done',
    createdAt: new Date().toISOString(),
    ...extra
  }
}

function buildSessionTitle(message: string): string {
  const title = message.replace(/\s+/g, ' ').trim()
  return title.length > 24 ? `${title.slice(0, 24)}...` : title
}

function buildHistoryLabel(updatedAt: string): string {
  const now = dayjs()
  const target = dayjs(updatedAt)
  const diffDays = now.startOf('day').diff(target.startOf('day'), 'day')
  if (diffDays <= 0) return '今天'
  if (diffDays <= 30) return '过去 30 天'
  return target.format('YYYY')
}

function persistSessions(sessions: ChatSession[]): void {
  try {
    // 持久化前清理 toolCalls.result.rows 等大数据
    const cleaned = sessions.map(session => ({
      ...session,
      messages: session.messages.map(msg => ({
        ...msg,
        toolCalls: msg.toolCalls?.map(tc => ({
          ...tc,
          result: tc.result ? { ...tc.result, rows: undefined } : undefined
        }))
      }))
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
  } catch (error) {
    console.warn('保存会话失败', error)
  }
}

function loadSessions(): ChatSession[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s: ChatSession) => s?.id && Array.isArray(s.messages)
    ) as ChatSession[]
  } catch {
    return []
  }
}

function replaceSessionMessage(
  session: ChatSession,
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage
): void {
  const index = session.messages.findIndex(m => m.id === messageId)
  if (index < 0) return
  const next = session.messages.slice()
  next[index] = updater(next[index])
  session.messages = next
}

function buildToolNotice(toolName: string): string {
  const displayName = TOOL_DISPLAY_NAME_MAP[toolName] || toolName
  return `【已调用${displayName}工具】`
}

function toPlainObject<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}


// ============ Composable ============

export function useSqlExpertChat() {
  const sessions = ref<ChatSession[]>(
    loadSessions().sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
  )
  const activeChatId = ref<string | null>(null)
  const inputText = ref('')
  const isSending = ref(false)
  const schema = ref('')
  const schemaPath = ref('')
  const schemaLoading = ref(false)
  const memories = ref<Array<{ id: string; content: string; createdAt: string; updatedAt: string; source: 'tool' | 'manual' }>>([])
  const memoryPath = ref('')
  const memoryScope = ref('')
  const currentRequestId = ref('')
  const usage = ref({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    promptCacheHitTokens: 0,
    promptCacheMissTokens: 0
  })

  const activeSession = computed(() =>
    sessions.value.find(s => s.id === activeChatId.value) || null
  )
  const chatMessages = computed(() => activeSession.value?.messages || [])

  const historyList = computed<HistoryGroup[]>(() => {
    const groupMap = new Map<string, HistoryGroupItem[]>()
    sessions.value
      .slice()
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      .forEach(session => {
        const label = buildHistoryLabel(session.updatedAt)
        const items = groupMap.get(label) || []
        items.push({ id: session.id, title: session.title || '新对话', updatedAt: session.updatedAt })
        groupMap.set(label, items)
      })
    return Array.from(groupMap.entries()).map(([label, items]) => ({ label, items }))
  })

  const resolveSession = (session: ChatSession) =>
    sessions.value.find(s => s.id === session.id) || session

  watch(sessions, (value) => { persistSessions(value) }, { deep: true })

  const syncSessionOrder = () => {
    sessions.value = sessions.value
      .slice()
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
  }

  const getOrCreateActiveSession = (message: string): ChatSession => {
    let session = activeSession.value
    if (!session) {
      session = createSession(buildSessionTitle(message) || '新对话')
      sessions.value.unshift(session)
      activeChatId.value = session.id
      return resolveSession(session)
    }
    if (!session.messages.length) {
      session.title = buildSessionTitle(message) || session.title
    }
    return resolveSession(session)
  }

  const updateSessionTimestamp = (session: ChatSession) => {
    const target = resolveSession(session)
    target.updatedAt = new Date().toISOString()
    syncSessionOrder()
  }

  // 初始化：加载已保存的 schema 与 prompt
  const initSchema = async () => {
    try {
      const result = await window.api.sqlExpert.loadConfig()
      schema.value = result.schema || ''
      schemaPath.value = result.schemaPath || ''
      memories.value = Array.isArray(result.memories) ? result.memories : []
      memoryPath.value = result.memoryPath || ''
      memoryScope.value = result.memoryScope || ''
    } catch (e) {
      console.warn('加载配置失败', e)
    }
  }

  // 加载/刷新 schema
  const loadSchema = async (dbConfig?: { host: string; port: number; user: string; password: string; database: string }) => {
    schemaLoading.value = true
    try {
      const result = await window.api.sqlExpert.loadSchema(dbConfig)
      if (result.success) {
        schema.value = result.schema || ''
        schemaPath.value = result.schemaPath || ''
        memories.value = Array.isArray(result.memories) ? result.memories : []
        memoryPath.value = result.memoryPath || ''
        memoryScope.value = result.memoryScope || ''
        return { success: true, tableCount: result.tableCount }
      }
      return { success: false, error: result.error || '加载失败' }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : '加载失败' }
    } finally {
      schemaLoading.value = false
    }
  }

  const refreshMemories = async (payload?: { database?: string; apiKey?: string }) => {
    const result = await window.api.sqlExpert.loadMemories(payload)
    if (result.success) {
      memories.value = result.memories || []
      memoryPath.value = result.memoryPath || ''
      memoryScope.value = result.memoryScope || ''
    }
    return result
  }

  // AI 对话（流式进度）
  const runAssistantReply = async (session: ChatSession) => {
    const targetSession = resolveSession(session)
    const requestId = createId()
    currentRequestId.value = requestId
    const loadingMessage = createMessage('assistant', '', {
      status: 'loading',
      thinking: '正在思考...',
      showThinking: true,
      toolCalls: []
    })
    targetSession.messages.push(loadingMessage)
    updateSessionTimestamp(targetSession)

    // 注册流式事件监听，实时更新 loading 消息
    const activeToolCalls: ToolCallItem[] = []

    window.api.sqlExpert.onAiContent((data: { requestId: string; content: string }) => {
      if (data.requestId !== requestId) {
        return
      }
      replaceSessionMessage(targetSession, loadingMessage.id, msg => ({
        ...msg,
        content: data.content
      }))
    })

    window.api.sqlExpert.onAiToolStart((data: { requestId: string; id: string; name: string; args: Record<string, unknown> }) => {
      if (data.requestId !== requestId) {
        return
      }
      activeToolCalls.push({
        id: data.id,
        name: data.name,
        args: data.args,
        status: 'running'
      })
      replaceSessionMessage(targetSession, loadingMessage.id, msg => ({
        ...msg,
        toolCalls: [...activeToolCalls]
      }))
    })

    window.api.sqlExpert.onAiToolDone((data: { requestId: string; id: string; status: string; result: Record<string, unknown>; errorMessage?: string }) => {
      if (data.requestId !== requestId) {
        return
      }
      const target = activeToolCalls.find(tc => tc.id === data.id)
      if (target) {
        target.status = data.status
        target.result = data.result
        target.errorMessage = data.errorMessage
      }
      replaceSessionMessage(targetSession, loadingMessage.id, msg => ({
        ...msg,
        toolCalls: [...activeToolCalls]
      }))
    })

    try {
      const conversationMessages = targetSession.messages
        .filter(m => m.id !== loadingMessage.id)
        .filter(m => m.status !== 'loading' && m.status !== 'error')
        .filter(m => m.content.trim())
        .map(m => ({
          role: m.role,
          content: m.content,
          status: m.status,
          toolCalls: Array.isArray(m.toolCalls)
            ? m.toolCalls.map(tc => ({
              id: tc.id,
              name: tc.name,
              status: tc.status,
              errorMessage: tc.errorMessage,
              args: toPlainObject(tc.args || {}),
              result: toPlainObject(tc.result || {})
            }))
            : []
        }))

      const result = await window.api.sqlExpert.askAi({
        requestId,
        messages: conversationMessages,
        schema: schema.value
      })

      if (!result.success) {
        throw new Error(result.error || 'AI 请求失败')
      }

      usage.value = result.usage || usage.value

      if (result.status === 'stopped') {
        replaceSessionMessage(targetSession, loadingMessage.id, msg => ({
          ...msg,
          content: msg.content || '已停止生成',
          thinking: '',
          showThinking: false,
          status: 'stopped',
          toolCalls: msg.toolCalls
        }))
        return
      }

      replaceSessionMessage(targetSession, loadingMessage.id, msg => ({
        ...msg,
        content: result.reply || msg.content || '未返回有效内容',
        status: 'done',
        thinking: '',
        showThinking: false,
        toolCalls: result.toolCalls?.map(tc => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
          result: tc.result,
          status: tc.status,
          errorMessage: tc.errorMessage
        })) || msg.toolCalls
      }))
    } catch (error) {
      console.error('AI Request failed:', error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      replaceSessionMessage(targetSession, loadingMessage.id, msg => ({
        ...msg,
        content: msg.content || `请求失败: ${errorMsg}`,
        thinking: '',
        showThinking: false,
        status: 'error'
      }))
    } finally {
      // 清理 IPC 事件监听
      window.api.sqlExpert.removeAiListeners()
      if (currentRequestId.value === requestId) {
        currentRequestId.value = ''
      }
      updateSessionTimestamp(targetSession)
      isSending.value = false
    }
  }

  const stopMessage = async () => {
    if (!isSending.value || !currentRequestId.value) {
      return false
    }

    const result = await window.api.sqlExpert.cancelAskAi({ requestId: currentRequestId.value })
    return Boolean(result.success)
  }

  const sendMessage = async () => {
    const message = inputText.value.trim()
    if (!message || isSending.value) return

    isSending.value = true
    const session = getOrCreateActiveSession(message)
    session.messages.push(createMessage('user', message))
    inputText.value = ''
    updateSessionTimestamp(session)
    await runAssistantReply(session)
  }

  const regenerateMessage = async () => {
    if (isSending.value || !activeSession.value) return

    const session = activeSession.value
    const lastUserIndex = [...session.messages]
      .map((m, i) => ({ m, i }))
      .reverse()
      .find(item => item.m.role === 'user')?.i

    if (lastUserIndex === undefined) return

    session.messages = session.messages.slice(0, lastUserIndex + 1)
    isSending.value = true
    updateSessionTimestamp(session)
    await runAssistantReply(session)
  }

  const startNewChat = () => {
    activeChatId.value = null
    inputText.value = ''
  }

  const selectChat = (id: string) => {
    activeChatId.value = id
  }

  const deleteChat = (id: string) => {
    const currentIndex = sessions.value.findIndex(s => s.id === id)
    if (currentIndex < 0) return

    const nextSessions = sessions.value.filter(s => s.id !== id)
    sessions.value = nextSessions
    if (activeChatId.value === id) {
      activeChatId.value = nextSessions[currentIndex]?.id || nextSessions[currentIndex - 1]?.id || null
    }
  }

  // 初始化
  initSchema()

  return {
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
    buildToolNotice,
    TOOL_DISPLAY_NAME_MAP
  }
}
