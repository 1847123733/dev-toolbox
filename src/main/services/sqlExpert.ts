/**
 * SQL 专家服务
 * 主进程侧：数据库连接管理、AI 请求、SQL 校验、Schema 动态生成
 */
import { ipcMain, app } from 'electron'
import * as mysql from 'mysql2/promise'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
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

interface AskAiPayload {
  messages: Array<{ role: string; content: string }>
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

// ============ 全局状态 ============

let connectionPool: mysql.Pool | null = null
let cachedSchema = ''

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

function loadConfigFromDisk(): SqlExpertConfig | null {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) return null
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'))
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

function getPromptPath(): string {
  return join(getConfigDir(), 'sql-prompt.md')
}

// 这里的 SQL_PROMPT_TEMPLATE 由后续定义，这里使用 loadPromptFromDisk 需要放在后面或者先声明
// 为避免作用域问题，稍后通过重构将其下移，或将 SQL_PROMPT_TEMPLATE 上移

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

    if (char === "'" || char === '"' || char === '`') { quote = char; continue }
    if (char === '[') { quote = ']'; continue }
    if (char === '(') { depth += 1; continue }
    if (char === ')') { depth = Math.max(0, depth - 1); continue }

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

    if (char === "'" || char === '"' || char === '`') { quote = char; current += char; continue }
    if (char === '[') { quote = ']'; current += char; continue }
    if (char === '(') { depth += 1; current += char; continue }
    if (char === ')') { depth = Math.max(0, depth - 1); current += char; continue }
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
    await connectionPool.end().catch(() => { /* ignore */ })
    connectionPool = null
  }
}

// ============ 内置 Prompt 模板（基于 sql-prompt.md） ============

const SQL_PROMPT_TEMPLATE = `#### 1. 全局查询原则（必须优先套用）

1. 先限定业务域：绝大多数查询都应先带 \`center_code\`，再按 \`store_code/user_code\` 收敛。
2. 逻辑删除：项目框架默认会自动过滤 \`mark=true\`。AI 直写 SQL 时，建议显式加 \`mark=1\`（若表有该字段）。
3. 商品可售不是看 \`product_sku\`：应以 \`center_product.enable=1\` 作为是否在当前配送中心可售的准入条件。
4. 库存口径不是单表：常用可售库存来自 \`location_batch_inventory.available_count\`，并且常带 \`sale_flag=1\`、\`shipper_code\` 对齐。
5. 价格口径优先级：门店成交价优先 \`center_product.multiple_price[priceLevel]\`，否则 \`center_product.market_price\`；不要直接拿 \`product_sku.price/market_price\` 当最终价。

#### 2. 核心业务关系（查询时按这个思路 join）

1. 商品主链路：\`product_spu -> product_sku -> center_product\`。
2. 库存主链路：\`center_product -> location_batch_inventory\`（批次场景再接 \`product_batch_info\`）。
3. 订单主链路：\`daily_master_orders(主单) -> daily_orders(子单) -> daily_orders_detail(明细)\`。
4. 活动主链路：\`product_activity_config -> activity_sku -> (product_activity_store/time_limit_activity_*)\`。
5. 门店与活动范围：\`store_info.store_code\` 是门店，\`store_info.store_type\` 常被当"渠道门店编码"。

#### 3. 订单查询口径（最容易查错）

1. 订单有两套状态，不可混用：
   - \`daily_master_orders.order_status\`：支付态（NOT_PAY/SUCCESS/CLOSED/REFUND...）
   - \`daily_master_orders.status\`：履约流转态（PAY_FINISH/STOCK_SERVICING/WAIT_DISTRIBUTION/.../RECEIVED/FINISH/CANCELED）
2. 订单维度字段要分清：主单号 \`master_order_code\`，子单号 \`order_code\`。
3. 预售订单与普通订单分表：预售主单在 \`pre_daily_master_orders\`。

#### 4. SQL 生成约束建议

1. 涉及"商品可售/价格/库存"的查询，必须从 \`center_product\` 起表，并携带 \`center_code\`。
2. 涉及"活动有效性"的查询，必须同时判断活动状态、时间窗口、门店范围。
3. 涉及"订单列表或统计"的查询，必须明确使用 \`order_status\` 还是 \`status\`，不得混淆。`

function loadPromptFromDisk(): string {
  const promptPath = getPromptPath()
  if (!existsSync(promptPath)) {
    writeFileSync(promptPath, SQL_PROMPT_TEMPLATE, 'utf-8')
    return SQL_PROMPT_TEMPLATE
  }
  try {
    return readFileSync(promptPath, 'utf-8')
  } catch {
    return SQL_PROMPT_TEMPLATE
  }
}

function buildSystemPrompt(schema: string, prompt: string): string {
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
7. 最终答复必须包含：结论、统计口径/筛选条件、是否截断。

### 绝对禁区
1. 严禁生成 INSERT、UPDATE、DELETE、DROP、ALTER、TRUNCATE、CREATE、GRANT 等修改性语句。
2. 严禁自行编写查询 information_schema 或 mysql 等系统库的 SQL；如需字段信息，只能调用 describe_table_schema 工具。

### 查询建议
${prompt}

### 数据库表清单（仅含表名和中文语义）
\`\`\`text
${schema}
\`\`\``
}

function getTools(): AiToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'query_database',
        description: '执行只读 SQL 查询。仅允许 SELECT 或 WITH...SELECT，且输出列必须使用 AS 指定表头。',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sql: { type: 'string', description: '待读取数据库的 SQL。必须是只读查询，并为输出列使用 AS 指定表头。' },
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
            tableNames: { type: 'array', items: { type: 'string' }, description: '要查询结构的多个表名列表。' },
            reason: { type: 'string', description: '为什么需要查看这张表的结构。' }
          },
          anyOf: [{ required: ['tableName'] }, { required: ['tableNames'] }]
        }
      }
    }
  ]
}

// ============ AI 请求（流式） ============

interface StreamCallbacks {
  onContent?: (accumulatedContent: string) => void
}

function upsertToolCall(toolCalls: ToolCall[], delta: any): void {
  const idx = typeof delta?.index === 'number' ? delta.index : toolCalls.length
  const existing = toolCalls[idx] || {
    id: delta?.id || `tool_call_${idx}`,
    type: 'function',
    function: { name: '', arguments: '' }
  } as ToolCall

  if (delta?.id) existing.id = delta.id
  if (delta?.function?.name) existing.function.name += delta.function.name
  if (delta?.function?.arguments) existing.function.arguments += delta.function.arguments
  toolCalls[idx] = existing
}

async function callAiApi(
  aiConfig: AiConfig,
  payload: any,
  callbacks: StreamCallbacks = {}
): Promise<{ content: string; toolCalls?: ToolCall[] }> {
  const openai = new OpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.url
  })

  const request: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
    ...(payload as Omit<OpenAI.Chat.ChatCompletionCreateParamsStreaming, 'stream'>),
    stream: true
  }

  const stream = await openai.chat.completions.create(request)

  let content = ''
  const toolCalls: ToolCall[] = []

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
  }

  return {
    content,
    toolCalls: toolCalls.length ? toolCalls : undefined
  }
}

// ============ 工具调度 ============

const TOOL_RESULT_ROW_LIMIT = 10

async function dispatchToolCall(
  pool: mysql.Pool,
  toolCall: ToolCall,
  schemaTableNames: Set<string>
): Promise<Record<string, unknown>> {
  const args = JSON.parse(toolCall.function.arguments || '{}')

  if (toolCall.function.name === 'query_database') {
    validateSql(args.sql)
    const [rows] = await pool.query(args.sql) as [Array<Record<string, unknown>>, unknown]
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
      : args.tableName ? [args.tableName] : []

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

    const [rows] = await pool.query(sql) as [Array<Record<string, unknown>>, unknown]
    return {
      ok: true,
      reason: args.reason || `查询表 ${validNames.join('、')} 的结构`,
      truncated: false,
      totalRows: rows.length,
      returnedRows: rows.length,
      rows
    }
  }

  return { ok: false, error: `未知工具: ${toolCall.function.name}` }
}

// ============ 解析 schema 表名集合 ============

function getSchemaTableNames(schema: string): Set<string> {
  return new Set(
    schema.split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.match(/^(\S+)/)?.[1] || '')
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
      if (conn) await conn.end().catch(() => { /* ignore */ })
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
    const prompt = loadPromptFromDisk()
    return { 
      config, 
      schema, 
      schemaPath: getSchemaPath(), 
      prompt, 
      promptPath: getPromptPath() 
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

      const [rows] = await conn.query(
        'SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
        [config.database]
      ) as [Array<{ TABLE_NAME: string; TABLE_COMMENT: string }>, unknown]

      // 生成与 daily_orange_schema.txt 同格式的文本
      const schemaText = rows
        .map(row => `${row.TABLE_NAME} ${row.TABLE_COMMENT || ''}`.trim())
        .join('\n\n')

      cachedSchema = schemaText
      saveSchemaToDisk(schemaText)
      
      const prompt = loadPromptFromDisk()

      return { 
        success: true, 
        schema: schemaText, 
        tableCount: rows.length,
        schemaPath: getSchemaPath(),
        prompt,
        promptPath: getPromptPath()
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '加载表结构失败' }
    } finally {
      if (conn) await conn.end().catch(() => { /* ignore */ })
    }
  })

  // 查询指定表的字段结构
  ipcMain.handle('sql-expert:describe-table', async (_event, tableNames: string[]) => {
    try {
      const pool = await ensurePool()
      const names = (Array.isArray(tableNames) ? tableNames : [tableNames])
        .map(n => String(n).trim())
        .filter(Boolean)

      if (!names.length) throw new Error('请传入至少一个表名')

      const quoted = names.map(n => `'${n.replace(/'/g, "''")}'`).join(', ')
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

      const [rows] = await pool.query(sql) as [Array<Record<string, unknown>>, unknown]
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
      const [rows] = await pool.query(sql) as [Array<Record<string, unknown>>, unknown]
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
      return { success: false, ok: false, error: error instanceof Error ? error.message : '查询失败' }
    }
  })

  // AI 对话（支持多轮工具调用，流式推送进度）
  ipcMain.handle('sql-expert:ask-ai', async (event, payload: AskAiPayload) => {
    const sender = event.sender
    try {
      const savedConfig = loadConfigFromDisk()
      if (!savedConfig?.ai?.url || !savedConfig?.ai?.apiKey) {
        throw new Error('请先配置 AI 模型参数')
      }

      const schema = payload.schema || cachedSchema || loadSchemaFromDisk()
      if (!schema) throw new Error('请先加载数据库表结构')

      const schemaTableNames = getSchemaTableNames(schema)
      const pool = await ensurePool()
      const messages = [...payload.messages]
      const prompt = loadPromptFromDisk()
      const systemMessage = { role: 'system', content: buildSystemPrompt(schema, prompt) }
      const allMessages: Array<{ role: string; content: string; tool_calls?: ToolCall[]; tool_call_id?: string }> = [
        systemMessage,
        ...messages
      ]

      const MAX_ROUNDS = 15
      let finalReply = ''
      const toolCallResults: Array<{ id: string; name: string; args: Record<string, unknown>; result: Record<string, unknown>; status: string; errorMessage?: string }> = []

      const mergeReply = (prev: string, next: string) => {
        const p = prev.trimEnd()
        const n = next.trim()
        if (!n) return p
        if (!p) return n
        return `${p}\n\n${n}`
      }

      for (let round = 0; round < MAX_ROUNDS; round++) {
        const finalPayload = {
          model: savedConfig.ai.model,
          temperature: 0.1,
          messages: allMessages,
          tools: getTools(),
          tool_choice: 'auto'
        } as any

        const aiResponse = await callAiApi(savedConfig.ai, finalPayload, {
          onContent: (accContent) => {
            // 实时推送 AI 回复内容给渲染进程
            if (!sender.isDestroyed()) {
              sender.send('sql-expert:ai-content', mergeReply(finalReply, accContent))
            }
          }
        })

        if (aiResponse.content) {
          finalReply = mergeReply(finalReply, aiResponse.content)
        }

        if (!aiResponse.toolCalls?.length) {
          return { success: true, reply: finalReply || '未生成有效回复', toolCalls: toolCallResults }
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
            sender.send('sql-expert:ai-content', finalReply)
          }

          let toolResult: Record<string, unknown>
          let parsedArgs: Record<string, unknown> = {}
          try { parsedArgs = JSON.parse(toolCall.function.arguments || '{}') } catch { /* ignore */ }

          const callRecord: { id: string; name: string; args: Record<string, unknown>; result: Record<string, unknown>; status: string; errorMessage?: string } = {
            id: toolCall.id,
            name: toolCall.function.name,
            args: parsedArgs,
            result: {},
            status: 'running'
          }
          toolCallResults.push(callRecord)

          // 通知渲染进程：工具调用开始
          if (!sender.isDestroyed()) {
            sender.send('sql-expert:ai-tool-start', { id: toolCall.id, name: toolCall.function.name, args: parsedArgs })
          }

          try {
            toolResult = await dispatchToolCall(pool, toolCall, schemaTableNames)
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
        reply: '本轮查询已达到工具调用上限。请进一步明确筛选条件、缩小时间范围，或分步骤提问。',
        toolCalls: toolCallResults
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'AI 请求失败' }
    }
  })
}
