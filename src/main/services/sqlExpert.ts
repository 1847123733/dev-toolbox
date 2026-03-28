/**
 * SQL 专家服务
 * 主进程侧：数据库连接管理、AI 请求、SQL 校验、Schema 动态生成
 */
import { ipcMain, app } from 'electron'
import * as mysql from 'mysql2/promise'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { createHash, randomUUID } from 'crypto'
import OpenAI from 'openai'

// ============ 类型定义 ============

interface DbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

interface AiConfig {
  url: string
  apiKey: string
  model: string
}

interface SqlExpertConfig {
  db: DbConfig
  ai: AiConfig
}

interface ToolCallRecord {
  id: string
  name: string
  args: Record<string, unknown>
  result?: Record<string, unknown>
  status?: string
  errorMessage?: string
}

interface AskAiMessage {
  role: 'user' | 'assistant'
  content: string
  status?: 'done' | 'loading' | 'error' | 'stopped'
  toolCalls?: ToolCallRecord[]
}

interface AskAiPayload {
  requestId?: string
  messages: AskAiMessage[]
  schema: string
  tools?: AiToolDefinition[]
  toolChoice?: string
}

interface AiToolDefinition {
  type: string
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

interface ToolCall {
  id: string
  type: string
  function: { name: string; arguments: string }
}

interface MemoryEntry {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  source: 'tool' | 'manual'
}

interface AgentUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  promptCacheHitTokens: number
  promptCacheMissTokens: number
}

// ============ 全局状态 ============

let connectionPool: mysql.Pool | null = null
let cachedSchema = ''
const activeAiRequests = new Map<string, AbortController>()

// ============ 配置持久化 ============

function getConfigDir(): string {
  const dir = join(app.getPath('userData'), 'sql-expert')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getConfigPath(): string {
  return join(getConfigDir(), 'config.json')
}

function getSchemaPath(): string {
  return join(getConfigDir(), 'schema.txt')
}

function getMemoriesDir(): string {
  const dir = join(getConfigDir(), 'memories')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '_').trim()
}

function buildApiKeyHash(apiKey: string): string {
  return createHash('sha256').update(String(apiKey || '').trim()).digest('hex').slice(0, 24)
}

function buildMemoryScope(database: string, apiKey: string): string {
  const db = sanitizeFileName(String(database || '').trim() || 'unknown_db')
  const apiKeyHash = buildApiKeyHash(apiKey)
  return `${db}__${apiKeyHash}`
}

function getMemoryFilePath(database: string, apiKey: string): string {
  const scope = buildMemoryScope(database, apiKey)
  return join(getMemoriesDir(), `${scope}.json`)
}

function loadConfigFromDisk(): SqlExpertConfig | null {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) return null
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf-8')) as Partial<SqlExpertConfig>
    if (!parsed?.db || !parsed?.ai) return null
    return {
      db: parsed.db,
      ai: parsed.ai
    }
  } catch {
    return null
  }
}

function saveConfigToDisk(config: SqlExpertConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

function saveSchemaToDisk(schema: string): void {
  writeFileSync(getSchemaPath(), schema, 'utf-8')
}

function loadSchemaFromDisk(): string {
  const schemaPath = getSchemaPath()
  if (!existsSync(schemaPath)) return ''
  try {
    return readFileSync(schemaPath, 'utf-8')
  } catch {
    return ''
  }
}

function loadMemories(database: string, apiKey: string) {
  const filePath = getMemoryFilePath(database, apiKey)
  if (!existsSync(filePath)) {
    writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8')
    return {
      memories: [] as MemoryEntry[],
      memoryPath: filePath,
      memoryScope: buildMemoryScope(database, apiKey)
    }
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'))
    const list = Array.isArray(parsed) ? parsed : parsed?.memories
    const memories = Array.isArray(list)
      ? list
          .filter(item => item && typeof item.content === 'string')
          .map(item => ({
            id: item.id || randomUUID(),
            content: String(item.content),
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
            source: (item.source === 'tool' ? 'tool' : 'manual') as 'tool' | 'manual'
          }))
      : []

    // 兼容手工编辑：统一写回标准结构，保证后续可直接增量追加。
    writeFileSync(filePath, JSON.stringify(memories, null, 2), 'utf-8')

    return {
      memories,
      memoryPath: filePath,
      memoryScope: buildMemoryScope(database, apiKey)
    }
  } catch {
    writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8')
    return {
      memories: [] as MemoryEntry[],
      memoryPath: filePath,
      memoryScope: buildMemoryScope(database, apiKey)
    }
  }
}

function appendMemory(database: string, apiKey: string, content: string) {
  const { memories, memoryPath } = loadMemories(database, apiKey)
  const now = new Date().toISOString()
  const entry: MemoryEntry = {
    id: randomUUID(),
    content,
    createdAt: now,
    updatedAt: now,
    source: 'tool'
  }

  memories.push(entry)
  writeFileSync(memoryPath, JSON.stringify(memories, null, 2), 'utf-8')
  return { entry, memoryPath }
}

// ============ SQL 校验（复用 agentRuntime.ts 核心逻辑） ============

function extractSelectClause(sql: string): string {
  const lowerSql = sql.toLowerCase()
  let selectIndex = -1
  let fromIndex = -1
  let depth = 0
  let quote: string | null = null

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const previousChar = index > 0 ? sql[index - 1] : ''

    if (quote) {
      if (char === quote && previousChar !== '\\') quote = null
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === '[') {
      quote = ']'
      continue
    }
    if (char === '(') {
      depth += 1
      continue
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1)
      continue
    }

    if (depth === 0 && selectIndex === -1 && lowerSql.startsWith('select ', index)) {
      selectIndex = index + 6
      index += 5
      continue
    }

    if (depth === 0 && selectIndex !== -1 && lowerSql.startsWith(' from ', index)) {
      fromIndex = index
      break
    }
  }

  if (selectIndex === -1 || fromIndex === -1 || fromIndex <= selectIndex) return ''
  return sql.slice(selectIndex, fromIndex).trim()
}

function splitTopLevelCsv(value: string): string[] {
  const items: string[] = []
  let current = ''
  let depth = 0
  let quote: string | null = null

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    const previousChar = index > 0 ? value[index - 1] : ''

    if (quote) {
      current += char
      if (char === quote && previousChar !== '\\') quote = null
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char
      current += char
      continue
    }
    if (char === '[') {
      quote = ']'
      current += char
      continue
    }
    if (char === '(') {
      depth += 1
      current += char
      continue
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1)
      current += char
      continue
    }
    if (char === ',' && depth === 0) {
      if (current.trim()) items.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  if (current.trim()) items.push(current.trim())
  return items
}

function validateSql(sql: string, options: { allowSystemSchema?: boolean } = {}): void {
  if (typeof sql !== 'string' || !sql.trim()) throw new Error('SQL 不能为空')

  const compactSql = sql.trim().replace(/\s+/g, ' ')
  if (compactSql.includes(';')) throw new Error('只允许单条 SQL')

  const lowerSql = compactSql.toLowerCase()
  if (!/^(select|with)\b/.test(lowerSql)) throw new Error('只允许 SELECT 查询')

  const forbiddenKeywords =
    /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|merge|replace|call|execute|exec|upsert|outfile|dumpfile|load\s+data|into\s+outfile|into\s+dumpfile|lock\s+tables|for\s+update)\b/i
  if (forbiddenKeywords.test(compactSql)) throw new Error('仅允许只读 SQL')

  if (!options.allowSystemSchema && /\binformation_schema\b|\bmysql\b\./i.test(compactSql)) {
    throw new Error('不允许访问系统库')
  }

  if (/\bselect\s+\*/i.test(compactSql)) {
    throw new Error('不允许 SELECT *，请为每个输出列显式使用 AS')
  }

  const selectClause = extractSelectClause(compactSql)
  if (!selectClause) throw new Error('无法解析 SELECT 子句')

  const selectExpressions = splitTopLevelCsv(selectClause)
  if (!selectExpressions.length) throw new Error('SELECT 子句不能为空')

  for (const expression of selectExpressions) {
    if (/^\s*\*\s*$/i.test(expression) || /\.\s*\*\s*$/i.test(expression)) {
      throw new Error('不允许使用通配列，请为每个输出列显式使用 AS')
    }
    if (!/\bas\s+["'`[\]A-Za-z0-9_\u4e00-\u9fa5]+\s*$/i.test(expression.trim())) {
      throw new Error('每个输出列都必须以 AS 别名结尾')
    }
  }
}

// ============ 数据库连接管理 ============

async function createPool(config: DbConfig): Promise<mysql.Pool> {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    connectTimeout: 10000
  })
}

async function ensurePool(config?: DbConfig): Promise<mysql.Pool> {
  if (connectionPool) return connectionPool

  const savedConfig = config || loadConfigFromDisk()?.db
  if (!savedConfig) throw new Error('未配置数据库连接')

  connectionPool = await createPool(savedConfig)
  return connectionPool
}

async function destroyPool(): Promise<void> {
  if (connectionPool) {
    await connectionPool.end().catch(() => {
      /* ignore */
    })
    connectionPool = null
  }
}

function buildSystemPrompt(schema: string, memories: MemoryEntry[] = []): string {
  const memoryPrompt = memories.map(memory => memory.content).join('\n\n')
  return `你是一个专业、严谨的企业数据查询助手，服务于本系统的真实业务用户。
你只能通过工具访问数据库。query_database 工具最多返回 10 行样例；describe_table_schema 工具会返回完整字段清单。
你的目标是在合法、合规、最小必要权限、以及结果可解释的前提下，高效帮助用户查询、聚合和分析数据。

### 当前环境上下文
- 当前系统时间：${new Date().toLocaleString()}，请严格基于此时间理解"今天""最近一周"等动态时间概念。

### 核心工作流与规范
1. 当用户需求模糊、缺少必要筛选条件、或字段含义不明确时，先追问澄清，不要直接查询数据库。
2. 如需数据库数据，优先调用 query_database 工具，不要直接臆造结果。
3. 当你只知道表名含义、不确定字段名或字段口径时，先调用 describe_table_schema 工具查询表结构，再决定后续 SQL。该工具支持一次查询多个表。
4. SQL 只能使用只读查询语句：SELECT 或 WITH ... SELECT。
5. 输出列必须使用 AS 指定清晰的别名，不允许 SELECT *。
6. 若工具结果被截断，请在最终答复里明确说明，并判断是否建议用户缩小范围。
7. 当用户明确要求导出或下载时，必须调用 export_data 工具。
8. 当用户明确要求图表展示时，必须调用 render_chart 工具。
9. 当你确认了可复用经验时，可以调用 save_memory 工具保存为本地记忆。
10. 最终答复必须包含：结论、统计口径/筛选条件、是否截断。

### 历史记忆
${memoryPrompt || '当前暂无已沉淀的可复用记忆。'}

### 绝对禁区
1. 严禁生成 INSERT、UPDATE、DELETE、DROP、ALTER、TRUNCATE、CREATE、GRANT 等修改性语句。
2. 严禁自行编写查询 information_schema 或 mysql 等系统库的 SQL；如需字段信息，只能调用 describe_table_schema 工具。


### 数据库表清单（仅含表名和中文语义）
\`\`\`text
${schema}
\`\`\`
`
}

function getTools(): AiToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'query_database',
        description:
          '执行只读 SQL 查询。仅允许 SELECT 或 WITH...SELECT，且输出列必须使用 AS 指定表头。',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sql: {
              type: 'string',
              description: '待读取数据库的 SQL。必须是只读查询，并为输出列使用 AS 指定表头。'
            },
            reason: { type: 'string', description: '本次查询目的和预期用途。' }
          },
          required: ['sql', 'reason']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'describe_table_schema',
        description: '查询一个或多个表的字段结构。传表名或表名数组，工具会返回完整字段清单。',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            tableName: { type: 'string', description: '要查询结构的单个表名。' },
            tableNames: {
              type: 'array',
              items: { type: 'string' },
              description: '要查询结构的多个表名列表。'
            },
            reason: { type: 'string', description: '为什么需要查看这张表的结构。' }
          },
          anyOf: [{ required: ['tableName'] }, { required: ['tableNames'] }]
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'render_chart',
        description: '根据真实查询结果绘制图表。支持 line、bar、pie、line_bar',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: {
              type: 'string',
              enum: ['line', 'bar', 'pie', 'line_bar']
            },
            title: { type: 'string' },
            xAxisData: { type: 'array', items: { type: 'string' } },
            series: { type: 'array' },
            reason: { type: 'string' }
          },
          required: ['type', 'title', 'series']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'save_memory',
        description: '保存可复用经验到本地记忆文件',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            content: { type: 'string' },
            reason: { type: 'string' }
          },
          required: ['content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'export_data',
        description: '执行只读 SQL 查询并导出完整结果为 CSV 文件',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sql: { type: 'string' },
            reason: { type: 'string' },
            fileName: { type: 'string' }
          },
          required: ['sql']
        }
      }
    }
  ]
}

function stripToolMarkers(content: string): string {
  return String(content || '').replace(/:::tool:[^:]+:::/g, '').trim()
}

function buildToolResultSummary(toolCall: ToolCallRecord): string {
  if (toolCall.status === 'error' || toolCall.status === 'cancelled') {
    return JSON.stringify({ ok: false, error: toolCall.errorMessage || '工具调用失败' })
  }

  if (!toolCall.result) {
    return JSON.stringify({ ok: false, error: '未获取到结果' })
  }

  const summary: Record<string, unknown> = { ok: toolCall.result.ok }
  if (toolCall.result.reason) summary.reason = toolCall.result.reason
  if (typeof toolCall.result.totalRows === 'number') summary.totalRows = toolCall.result.totalRows
  if (typeof toolCall.result.returnedRows === 'number') summary.returnedRows = toolCall.result.returnedRows
  if (toolCall.result.truncated) summary.truncated = true
  if (toolCall.result.error) summary.error = toolCall.result.error
  if (toolCall.result.fileName) summary.fileName = toolCall.result.fileName
  if (toolCall.result.chartConfig) summary.chartRendered = true
  return JSON.stringify(summary)
}

function toModelMessages(uiMessages: AskAiMessage[]) {
  const modelMessages: Array<{
    role: string
    content: string | null
    tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
    tool_call_id?: string
  }> = []

  for (const message of uiMessages) {
    if (message.status === 'loading' || message.status === 'error') continue

    const cleanContent = stripToolMarkers(message.content)

    if (message.role === 'user') {
      if (cleanContent) {
        modelMessages.push({ role: 'user', content: cleanContent })
      }
      continue
    }

    const toolCalls = (message.toolCalls || []).filter(tc => tc.id && tc.name)

    if (toolCalls.length) {
      modelMessages.push({
        role: 'assistant',
        content: cleanContent || null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args || {})
          }
        }))
      })

      for (const tc of toolCalls) {
        modelMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: buildToolResultSummary(tc)
        })
      }

      continue
    }

    if (cleanContent) {
      modelMessages.push({ role: 'assistant', content: cleanContent })
    }
  }

  return modelMessages
}

// ============ AI 请求（流式） ============

interface StreamCallbacks {
  onContent?: (accumulatedContent: string) => void
  signal?: AbortSignal
}

function upsertToolCall(toolCalls: ToolCall[], delta: any): void {
  const idx = typeof delta?.index === 'number' ? delta.index : toolCalls.length
  const existing =
    toolCalls[idx] ||
    ({
      id: delta?.id || `tool_call_${idx}`,
      type: 'function',
      function: { name: '', arguments: '' }
    } as ToolCall)

  if (delta?.id) existing.id = delta.id
  if (delta?.function?.name) existing.function.name += delta.function.name
  if (delta?.function?.arguments) existing.function.arguments += delta.function.arguments
  toolCalls[idx] = existing
}

async function callAiApi(
  aiConfig: AiConfig,
  payload: any,
  callbacks: StreamCallbacks = {}
): Promise<{ content: string; toolCalls?: ToolCall[]; usage?: AgentUsage }> {
  const openai = new OpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.url
  })

  const request: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
    ...(payload as Omit<OpenAI.Chat.ChatCompletionCreateParamsStreaming, 'stream'>),
    stream: true,
    stream_options: {
      include_usage: true
    }
  }

  const stream = await openai.chat.completions.create(request, { signal: callbacks.signal })

  let content = ''
  const toolCalls: ToolCall[] = []
  let usage: AgentUsage | undefined

  for await (const chunk of stream) {
    const delta = (chunk as any).choices?.[0]?.delta
    if (!delta) continue

    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content
      callbacks.onContent?.(content)
    }

    if (Array.isArray(delta.tool_calls)) {
      delta.tool_calls.forEach((tc: any) => upsertToolCall(toolCalls, tc))
    }

    if ((chunk as any).usage) {
      const chunkUsage = (chunk as any).usage
      const promptTokens = Number(chunkUsage?.prompt_tokens || 0)
      const completionTokens = Number(chunkUsage?.completion_tokens || 0)
      const totalTokens = Number(chunkUsage?.total_tokens || promptTokens + completionTokens)
      const promptCacheHitTokens = Number(
        chunkUsage?.prompt_cache_hit_tokens || chunkUsage?.prompt_tokens_details?.cached_tokens || 0
      )
      const promptCacheMissTokens = Number(
        chunkUsage?.prompt_cache_miss_tokens || Math.max(promptTokens - promptCacheHitTokens, 0)
      )
      usage = {
        promptTokens,
        completionTokens,
        totalTokens,
        promptCacheHitTokens,
        promptCacheMissTokens
      }
    }
  }

  return {
    content,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    usage
  }
}

// ============ 工具调度 ============

const TOOL_RESULT_ROW_LIMIT = 10
const SQL_QUERY_TIMEOUT_MS = 60_000

function buildChartOption(args: Record<string, any>): Record<string, unknown> {
  if (args.type === 'pie') {
    return {
      title: { text: args.title, left: 'center', top: 8 },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, type: 'scroll' },
      series: (Array.isArray(args.series) ? args.series : []).map((s: any) => ({
        name: s.name,
        type: 'pie',
        radius: ['35%', '65%'],
        center: ['50%', '48%'],
        data: s.data,
        label: { formatter: '{b}\n{d}%' }
      }))
    }
  }

  const series = Array.isArray(args.series) ? args.series : []
  const hasRightAxis = series.some((s: any) => s.yAxisIndex === 1)
  const yAxis = hasRightAxis
    ? [{ type: 'value' }, { type: 'value', splitLine: { show: false } }]
    : [{ type: 'value' }]

  return {
    title: { text: args.title, left: 'center', top: 8 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { bottom: 0, type: 'scroll' },
    grid: { top: 48, bottom: 60, left: 50, right: hasRightAxis ? 50 : 20, containLabel: true },
    xAxis: { type: 'category', data: Array.isArray(args.xAxisData) ? args.xAxisData : [] },
    yAxis,
    series: series.map((s: any) => ({
      name: s.name,
      type: s.type,
      data: s.data,
      yAxisIndex: s.yAxisIndex || 0,
      smooth: s.type === 'line',
      barMaxWidth: 50
    }))
  }
}

function csvEscape(value: unknown) {
  const str = value == null ? '' : String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowsToCsv(rows: Array<Record<string, unknown>>) {
  const columnSet = new Set<string>()
  rows.forEach(row => {
    Object.keys(row || {}).forEach(key => columnSet.add(key))
  })
  const columns = Array.from(columnSet)
  const lines = [columns.map(csvEscape).join(',')]

  rows.forEach(row => {
    lines.push(columns.map(column => csvEscape(row?.[column])).join(','))
  })

  return lines.join('\r\n')
}

function buildExportFilePath(fileName?: string) {
  const exportsDir = join(getConfigDir(), 'exports')
  if (!existsSync(exportsDir)) {
    mkdirSync(exportsDir, { recursive: true })
  }

  const normalized = sanitizeFileName((fileName || `AI导出_${new Date().toISOString().slice(0, 10)}`).trim())
  const finalName = /\.csv$/i.test(normalized) ? normalized : `${normalized}.csv`
  return {
    fileName: finalName,
    filePath: join(exportsDir, `${Date.now()}_${finalName}`)
  }
}

async function queryWithTimeout(
  executor: mysql.Pool | mysql.Connection,
  sql: string,
  values?: Array<string | number | boolean | null>
): Promise<[unknown, unknown]> {
  return executor.query({
    sql,
    timeout: SQL_QUERY_TIMEOUT_MS,
    values: values || []
  })
}

async function dispatchToolCall(
  pool: mysql.Pool,
  toolCall: ToolCall,
  schemaTableNames: Set<string>,
  context: { database: string; apiKey: string }
): Promise<Record<string, unknown>> {
  const args = JSON.parse(toolCall.function.arguments || '{}')

  if (toolCall.function.name === 'query_database') {
    validateSql(args.sql)
    const [rows] = (await queryWithTimeout(pool, args.sql)) as [
      Array<Record<string, unknown>>,
      unknown
    ]
    const totalRows = rows.length
    const truncated = totalRows > TOOL_RESULT_ROW_LIMIT
    return {
      ok: true,
      reason: args.reason,
      truncated,
      totalRows,
      returnedRows: truncated ? TOOL_RESULT_ROW_LIMIT : totalRows,
      rows: truncated ? rows.slice(0, TOOL_RESULT_ROW_LIMIT) : rows
    }
  }

  if (toolCall.function.name === 'describe_table_schema') {
    const tableNames: string[] = Array.isArray(args.tableNames)
      ? args.tableNames
      : args.tableName
        ? [args.tableName]
        : []

    const validNames = tableNames
      .map((n: string) => String(n).trim())
      .filter((n: string) => n && schemaTableNames.has(n))

    if (!validNames.length) throw new Error('至少需要提供一个合法表名')

    const quoted = validNames.map((n: string) => `'${n.replace(/'/g, "''")}'`).join(', ')
    const sql = [
      'SELECT TABLE_NAME AS 表名, ORDINAL_POSITION AS 字段顺序,',
      '  COLUMN_NAME AS 字段名, COLUMN_TYPE AS 字段类型,',
      '  IS_NULLABLE AS 是否可空, COLUMN_DEFAULT AS 默认值,',
      '  COLUMN_KEY AS 索引类型, EXTRA AS 额外信息, COLUMN_COMMENT AS 字段注释',
      'FROM information_schema.COLUMNS',
      'WHERE TABLE_SCHEMA = DATABASE()',
      `  AND TABLE_NAME IN (${quoted})`,
      'ORDER BY TABLE_NAME, ORDINAL_POSITION'
    ].join('\n')

    const [rows] = (await queryWithTimeout(pool, sql)) as [Array<Record<string, unknown>>, unknown]
    return {
      ok: true,
      reason: args.reason || `查询表 ${validNames.join('、')} 的结构`,
      truncated: false,
      totalRows: rows.length,
      returnedRows: rows.length,
      rows
    }
  }

  if (toolCall.function.name === 'render_chart') {
    const type = String(args.type || '')
    const validTypes = ['line', 'bar', 'pie', 'line_bar']
    if (!validTypes.includes(type)) {
      throw new Error(`不支持的图表类型: ${type}`)
    }
    if (!Array.isArray(args.series) || args.series.length === 0) {
      throw new Error('series 不能为空')
    }
    if (type !== 'pie' && (!Array.isArray(args.xAxisData) || args.xAxisData.length === 0)) {
      throw new Error('折线图、柱状图、组合图必须提供 xAxisData')
    }

    return {
      ok: true,
      reason: args.reason || '按用户要求绘制图表',
      chartConfig: buildChartOption(args)
    }
  }

  if (toolCall.function.name === 'save_memory') {
    const content = String(args.content || '').trim()
    if (!content) {
      throw new Error('记忆内容不能为空')
    }
    const memory = appendMemory(context.database, context.apiKey, content)
    return {
      ok: true,
      reason: args.reason || '沉淀可复用经验',
      memoryId: memory.entry.id,
      memoryPath: memory.memoryPath,
      rows: [{ id: memory.entry.id, content }]
    }
  }

  if (toolCall.function.name === 'export_data') {
    validateSql(args.sql)
    const [rows] = (await queryWithTimeout(pool, args.sql)) as [Array<Record<string, unknown>>, unknown]
    const exportFile = buildExportFilePath(typeof args.fileName === 'string' ? args.fileName : undefined)
    writeFileSync(exportFile.filePath, rowsToCsv(rows), 'utf-8')

    return {
      ok: true,
      reason: args.reason || '按用户要求导出数据',
      truncated: false,
      totalRows: rows.length,
      returnedRows: rows.length,
      fileName: exportFile.fileName,
      filePath: exportFile.filePath
    }
  }

  return { ok: false, error: `未知工具: ${toolCall.function.name}` }
}

// ============ 解析 schema 表名集合 ============

function getSchemaTableNames(schema: string): Set<string> {
  return new Set(
    schema
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.match(/^(\S+)/)?.[1] || '')
      .filter(Boolean)
  )
}

// ============ IPC 注册 ============

export function setupSqlExpert(): void {
  // 测试数据库连接
  ipcMain.handle('sql-expert:test-db', async (_event, config: DbConfig) => {
    let conn: mysql.Connection | null = null
    try {
      conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectTimeout: 10000
      })
      await conn.ping()
      return { success: true, message: '连接成功' }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '连接失败' }
    } finally {
      if (conn)
        await conn.end().catch(() => {
          /* ignore */
        })
    }
  })

  // 保存配置
  ipcMain.handle('sql-expert:save-config', async (_event, config: SqlExpertConfig) => {
    try {
      saveConfigToDisk(config)
      // 配置变更后重建连接池
      await destroyPool()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '保存失败' }
    }
  })

  // 加载配置
  ipcMain.handle('sql-expert:load-config', async () => {
    const config = loadConfigFromDisk()
    const schema = loadSchemaFromDisk()
    const memoryState =
      config?.db?.database && config?.ai?.apiKey
        ? loadMemories(config.db.database, config.ai.apiKey)
        : { memories: [] as MemoryEntry[], memoryPath: '', memoryScope: '' }
    return {
      config,
      schema,
      schemaPath: getSchemaPath(),
      memories: memoryState.memories,
      memoryPath: memoryState.memoryPath,
      memoryScope: memoryState.memoryScope,
      memoryCount: memoryState.memories.length
    }
  })

  ipcMain.handle('sql-expert:load-memories', async (_event, payload?: { database?: string; apiKey?: string }) => {
    try {
      const saved = loadConfigFromDisk()
      const database = payload?.database || saved?.db?.database || ''
      const apiKey = payload?.apiKey || saved?.ai?.apiKey || ''
      if (!database || !apiKey) {
        throw new Error('缺少数据库名或 API Key，无法加载记忆')
      }

      const memoryState = loadMemories(database, apiKey)
      return {
        success: true,
        memories: memoryState.memories,
        memoryPath: memoryState.memoryPath,
        memoryScope: memoryState.memoryScope,
        memoryCount: memoryState.memories.length
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '加载记忆失败',
        memories: [],
        memoryPath: '',
        memoryScope: '',
        memoryCount: 0
      }
    }
  })

  // 动态加载 Schema（从数据库 information_schema 查询）
  ipcMain.handle('sql-expert:load-schema', async (_event, dbConfig?: DbConfig) => {
    let conn: mysql.Connection | null = null
    try {
      const config = dbConfig || loadConfigFromDisk()?.db
      if (!config) throw new Error('未配置数据库连接')
      if (!config.database) throw new Error('请先填写具体的要查询的数据库名称')

      conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        connectTimeout: 10000
      })

      const [rows] = (await queryWithTimeout(
        conn,
        'SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
        [config.database]
      )) as [Array<{ TABLE_NAME: string; TABLE_COMMENT: string }>, unknown]

      // 生成与 daily_orange_schema.txt 同格式的文本
      const schemaText = rows
        .map((row) => `${row.TABLE_NAME} ${row.TABLE_COMMENT || ''}`.trim())
        .join('\n\n')

      cachedSchema = schemaText
      saveSchemaToDisk(schemaText)
      const savedConfig = loadConfigFromDisk()
      const memoryState =
        config.database && savedConfig?.ai?.apiKey
          ? loadMemories(config.database, savedConfig.ai.apiKey)
          : { memories: [] as MemoryEntry[], memoryPath: '', memoryScope: '' }

      return {
        success: true,
        schema: schemaText,
        tableCount: rows.length,
        schemaPath: getSchemaPath(),
        memories: memoryState.memories,
        memoryPath: memoryState.memoryPath,
        memoryScope: memoryState.memoryScope,
        memoryCount: memoryState.memories.length
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '加载表结构失败' }
    } finally {
      if (conn)
        await conn.end().catch(() => {
          /* ignore */
        })
    }
  })

  // 查询指定表的字段结构
  ipcMain.handle('sql-expert:describe-table', async (_event, tableNames: string[]) => {
    try {
      const pool = await ensurePool()
      const names = (Array.isArray(tableNames) ? tableNames : [tableNames])
        .map((n) => String(n).trim())
        .filter(Boolean)

      if (!names.length) throw new Error('请传入至少一个表名')

      const quoted = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(', ')
      const sql = [
        'SELECT TABLE_NAME AS 表名, ORDINAL_POSITION AS 字段顺序,',
        '  COLUMN_NAME AS 字段名, COLUMN_TYPE AS 字段类型,',
        '  IS_NULLABLE AS 是否可空, COLUMN_DEFAULT AS 默认值,',
        '  COLUMN_KEY AS 索引类型, EXTRA AS 额外信息, COLUMN_COMMENT AS 字段注释',
        'FROM information_schema.COLUMNS',
        'WHERE TABLE_SCHEMA = DATABASE()',
        `  AND TABLE_NAME IN (${quoted})`,
        'ORDER BY TABLE_NAME, ORDINAL_POSITION'
      ].join('\n')

      const [rows] = (await queryWithTimeout(pool, sql)) as [Array<Record<string, unknown>>, unknown]
      return { success: true, rows }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '查询表结构失败' }
    }
  })

  // 执行只读 SQL
  ipcMain.handle('sql-expert:execute-sql', async (_event, sql: string) => {
    try {
      validateSql(sql)
      const pool = await ensurePool()
      const [rows] = (await queryWithTimeout(pool, sql)) as [Array<Record<string, unknown>>, unknown]
      const totalRows = rows.length
      const truncated = totalRows > TOOL_RESULT_ROW_LIMIT
      return {
        success: true,
        ok: true,
        truncated,
        totalRows,
        returnedRows: truncated ? TOOL_RESULT_ROW_LIMIT : totalRows,
        rows: truncated ? rows.slice(0, TOOL_RESULT_ROW_LIMIT) : rows
      }
    } catch (error) {
      return {
        success: false,
        ok: false,
        error: error instanceof Error ? error.message : '查询失败'
      }
    }
  })

  ipcMain.handle('sql-expert:cancel-ask-ai', async (_event, payload: { requestId: string }) => {
    const requestId = String(payload?.requestId || '')
    const controller = activeAiRequests.get(requestId)
    if (!controller) {
      return { success: false, message: '当前没有可取消的请求' }
    }

    controller.abort()
    activeAiRequests.delete(requestId)
    return { success: true, message: '已停止生成' }
  })

  // AI 对话（支持多轮工具调用，流式推送进度）
  ipcMain.handle('sql-expert:ask-ai', async (event, payload: AskAiPayload) => {
    const sender = event.sender
    const requestId = String(payload?.requestId || randomUUID())
    const abortController = new AbortController()
    activeAiRequests.set(requestId, abortController)

    try {
      const savedConfig = loadConfigFromDisk()
      if (!savedConfig?.ai?.url || !savedConfig?.ai?.apiKey) {
        throw new Error('请先配置 AI 模型参数')
      }

      const schema = payload.schema || cachedSchema || loadSchemaFromDisk()
      if (!schema) throw new Error('请先加载数据库表结构')

      const memoryState = loadMemories(savedConfig.db.database, savedConfig.ai.apiKey)
      const schemaTableNames = getSchemaTableNames(schema)
      const pool = await ensurePool()
      const messages = toModelMessages(payload.messages || [])
      const systemMessage = { role: 'system', content: buildSystemPrompt(schema, memoryState.memories) }
      const allMessages: Array<{
        role: string
        content: string | null
        tool_calls?: ToolCall[]
        tool_call_id?: string
      }> = [systemMessage, ...messages]

      const MAX_ROUNDS = 15
      let finalReply = ''
      let usage: AgentUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        promptCacheHitTokens: 0,
        promptCacheMissTokens: 0
      }
      const toolCallResults: Array<{
        id: string
        name: string
        args: Record<string, unknown>
        result: Record<string, unknown>
        status: string
        errorMessage?: string
      }> = []

      const mergeReply = (prev: string, next: string) => {
        const p = prev.trimEnd()
        const n = next.trim()
        if (!n) return p
        if (!p) return n
        return `${p}\n\n${n}`
      }

      for (let round = 0; round < MAX_ROUNDS; round++) {
        if (abortController.signal.aborted) {
          return {
            success: true,
            requestId,
            reply: finalReply,
            toolCalls: toolCallResults,
            usage,
            status: 'stopped'
          }
        }

        const finalPayload = {
          model: savedConfig.ai.model,
          temperature: 0.1,
          messages: allMessages,
          tools: getTools(),
          tool_choice: 'auto'
        } as any

        const aiResponse = await callAiApi(savedConfig.ai, finalPayload, {
          signal: abortController.signal,
          onContent: (accContent) => {
            // 实时推送 AI 回复内容给渲染进程
            if (!sender.isDestroyed()) {
              sender.send('sql-expert:ai-content', {
                requestId,
                content: mergeReply(finalReply, accContent)
              })
            }
          }
        })
        if (aiResponse.usage) {
          usage = aiResponse.usage
        }

        if (aiResponse.content) {
          finalReply = mergeReply(finalReply, aiResponse.content)
        }

        if (!aiResponse.toolCalls?.length) {
          return {
            success: true,
            requestId,
            reply: finalReply || '未生成有效回复',
            toolCalls: toolCallResults,
            usage,
            status: 'done'
          }
        }

        // 将 assistant 消息（含 tool_calls）加入历史
        allMessages.push({
          role: 'assistant',
          content: aiResponse.content || '',
          tool_calls: aiResponse.toolCalls
        })

        // 执行工具调用
        for (const toolCall of aiResponse.toolCalls) {
          finalReply = mergeReply(finalReply, `:::tool:${toolCall.id}:::`)
          if (!sender.isDestroyed()) {
            sender.send('sql-expert:ai-content', {
              requestId,
              content: finalReply
            })
          }

          let toolResult: Record<string, unknown>
          let parsedArgs: Record<string, unknown> = {}
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments || '{}')
          } catch {
            /* ignore */
          }

          const callRecord: {
            id: string
            name: string
            args: Record<string, unknown>
            result: Record<string, unknown>
            status: string
            errorMessage?: string
          } = {
            id: toolCall.id,
            name: toolCall.function.name,
            args: parsedArgs,
            result: {},
            status: 'running'
          }
          toolCallResults.push(callRecord)

          // 通知渲染进程：工具调用开始
          if (!sender.isDestroyed()) {
            sender.send('sql-expert:ai-tool-start', {
              requestId,
              id: toolCall.id,
              name: toolCall.function.name,
              args: parsedArgs
            })
          }

          try {
            toolResult = await dispatchToolCall(pool, toolCall, schemaTableNames, {
              database: savedConfig.db.database,
              apiKey: savedConfig.ai.apiKey
            })
            callRecord.status = (toolResult.ok as boolean) ? 'success' : 'error'
            callRecord.result = { ...toolResult, rows: undefined }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            toolResult = { ok: false, error: message }
            callRecord.status = 'error'
            callRecord.errorMessage = message
          }

          // 通知渲染进程：工具调用完成
          if (!sender.isDestroyed()) {
            sender.send('sql-expert:ai-tool-done', {
              requestId,
              id: toolCall.id,
              name: toolCall.function.name,
              args: parsedArgs,
              status: callRecord.status,
              result: callRecord.result,
              errorMessage: callRecord.errorMessage
            })
          }

          allMessages.push({
            role: 'tool' as string,
            content: JSON.stringify(toolResult, null, 2),
            tool_call_id: toolCall.id
          })
        }
      }

      return {
        success: true,
        requestId,
        reply: '本轮查询已达到工具调用上限。请进一步明确筛选条件、缩小时间范围，或分步骤提问。',
        toolCalls: toolCallResults,
        usage,
        status: 'done'
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        return {
          success: true,
          requestId,
          reply: '',
          toolCalls: [],
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            promptCacheHitTokens: 0,
            promptCacheMissTokens: 0
          },
          status: 'stopped'
        }
      }

      return { success: false, requestId, error: error instanceof Error ? error.message : 'AI 请求失败' }
    } finally {
      activeAiRequests.delete(requestId)
    }
  })
}
