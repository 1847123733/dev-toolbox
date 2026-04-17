/**
 * Skill 定制服务
 * 主进程侧：扫描 Java+MyBatis 项目，提取 Mapper SQL + Service 语义，生成交付级 Skill 文件
 */
import { ipcMain, dialog, app } from 'electron'
import { join, basename, extname, relative, sep } from 'path'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync
} from 'fs'
import { randomUUID } from 'crypto'

// ============ 类型定义 ============

interface MapperSelectEntry {
  id: string
  sql: string
  parameterType: string
  resultMap: string
  fileName: string
  namespace: string
  tables: string[]
}

interface ServiceMethodInfo {
  methodName: string
  returnType: string
  comment: string
  mapperFieldName: string
  mapperMethodCall: string
  fileName: string
  className: string
}

interface SkillEntry {
  id: string
  name: string
  summary: string
  source: {
    mapperFile: string
    mapperMethod: string
    serviceFile: string
    serviceMethod: string
    serviceComment: string
  }
  sql: string
  tables: string[]
  joinPatterns: string[]
  tags: string[]
  isValid: boolean
  invalidReason: string
}

interface SkillFile {
  version: string
  projectName: string
  scanTime: string
  dbSchema: string
  sourcePath: string
  skillCount: number
  skills: SkillEntry[]
}

interface ScanProgress {
  phase: 'scanning' | 'parsing-mapper' | 'parsing-service' | 'cross-referencing' | 'generating' | 'done'
  message: string
  current: number
  total: number
}

// ============ 文件扫描 ============

function walkDir(dir: string, pattern: RegExp): string[] {
  const results: string[] = []

  // 跳过常见无关目录
  const skipDirs = new Set([
    'node_modules', '.git', '.svn', '.idea', '.vscode',
    'target', 'build', 'dist', 'out', 'bin',
    '__pycache__', '.gradle', '.mvn', '.settings'
  ])

  function walk(current: string): void {
    try {
      const entries = readdirSync(current, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (skipDirs.has(entry.name)) continue
          walk(join(current, entry.name))
        } else if (entry.isFile() && pattern.test(entry.name)) {
          results.push(join(current, entry.name))
        }
      }
    } catch {
      // 权限不足等，忽略
    }
  }

  walk(dir)
  return results
}

// ============ Mapper XML 解析 ============

/**
 * 从 Mapper XML 文件提取所有 <select> 节点
 */
function parseMapperXml(filePath: string): MapperSelectEntry[] {
  const content = readFileSync(filePath, 'utf-8')
  const entries: MapperSelectEntry[] = []
  const fileName = basename(filePath)

  // 提取 namespace
  const nsMatch = content.match(/<mapper\s+namespace="([^"]+)"/)
  const namespace = nsMatch?.[1] || ''

  // 匹配所有 <select> 标签（支持多行）
  const selectRegex = /<select\s+([^>]*?)>([\s\S]*?)<\/select>/g
  let match: RegExpExecArray | null

  while ((match = selectRegex.exec(content)) !== null) {
    const attrs = match[1]
    const sqlBody = match[2]

    // 提取属性
    const idMatch = attrs.match(/id="([^"]+)"/)
    const paramMatch = attrs.match(/parameterType="([^"]+)"/)
    const resultMapMatch = attrs.match(/resultMap="([^"]+)"/)

    if (!idMatch) continue

    const id = idMatch[1]
    const parameterType = paramMatch?.[1] || ''
    const resultMap = resultMapMatch?.[1] || ''

    // 清理 SQL：移除 XML 标签（<if>/<where>/<foreach> 等），保留结构
    const cleanedSql = cleanMapperSql(sqlBody)

    // 提取表名
    const tables = extractTablesFromSql(cleanedSql)

    entries.push({
      id,
      sql: cleanedSql,
      parameterType,
      resultMap,
      fileName,
      namespace,
      tables
    })
  }

  return entries
}

/**
 * 清理 Mapper XML 中的动态 SQL 标签，生成可读的 SQL 模板
 */
function cleanMapperSql(sqlBody: string): string {
  let sql = sqlBody

  // 移除 CDATA
  sql = sql.replace(/<!\[CDATA\[\s*/g, '')
  sql = sql.replace(/\s*\]\]>/g, '')

  // <where> → WHERE
  sql = sql.replace(/<where>/gi, 'WHERE')
  sql = sql.replace(/<\/where>/gi, '')

  // <if test="..."> → 保留内容加注释
  sql = sql.replace(/<if\s+test="([^"]*)"\s*>/gi, '/* IF: $1 */')
  sql = sql.replace(/<\/if>/gi, '/* END IF */')

  // <foreach ...> → 保留占位说明
  sql = sql.replace(/<foreach\s+[^>]*>/gi, '/* FOREACH */')
  sql = sql.replace(/<\/foreach>/gi, '/* END FOREACH */')

  // <choose>/<when>/<otherwise>
  sql = sql.replace(/<choose>/gi, '/* CHOOSE */')
  sql = sql.replace(/<\/choose>/gi, '/* END CHOOSE */')
  sql = sql.replace(/<when\s+test="([^"]*)"\s*>/gi, '/* WHEN: $1 */')
  sql = sql.replace(/<\/when>/gi, '/* END WHEN */')
  sql = sql.replace(/<otherwise>/gi, '/* OTHERWISE */')
  sql = sql.replace(/<\/otherwise>/gi, '/* END OTHERWISE */')

  // <set> → SET
  sql = sql.replace(/<set>/gi, 'SET')
  sql = sql.replace(/<\/set>/gi, '')

  // <trim>
  sql = sql.replace(/<trim[^>]*>/gi, '')
  sql = sql.replace(/<\/trim>/gi, '')

  // <include refid="..."> → 标记引用
  sql = sql.replace(/<include\s+refid="([^"]*)"\s*\/>/gi, '/* INCLUDE: $1 */')

  // <sql id="..."> 片段定义忽略（它们在 <select> 外）

  // 移除其他未知标签
  sql = sql.replace(/<\/?\w+[^>]*>/g, '')

  // 清理多余空白
  sql = sql.replace(/\n\s*\n/g, '\n')
  sql = sql.trim()

  return sql
}

/**
 * 从 SQL 文本中提取表名
 */
function extractTablesFromSql(sql: string): string[] {
  const tables = new Set<string>()
  const lowerSql = sql.toLowerCase()

  // 匹配 FROM table / JOIN table
  const fromRegex = /\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
  let m: RegExpExecArray | null
  while ((m = fromRegex.exec(sql)) !== null) {
    const table = m[1]
    // 过滤掉 SQL 关键字
    const keywords = new Set([
      'select', 'where', 'and', 'or', 'on', 'as', 'in', 'not',
      'null', 'is', 'by', 'group', 'order', 'having', 'limit',
      'offset', 'union', 'all', 'distinct', 'set', 'into',
      'values', 'insert', 'update', 'delete', 'create', 'drop',
      'alter', 'table', 'index', 'view', 'if', 'exists', 'case',
      'when', 'then', 'else', 'end', 'between', 'like'
    ])
    if (!keywords.has(table.toLowerCase())) {
      tables.add(table)
    }
  }

  return Array.from(tables)
}

/**
 * 从 SQL 中提取 JOIN 模式
 */
function extractJoinPatterns(sql: string): string[] {
  const patterns: string[] = []
  const joinRegex = /((?:LEFT|RIGHT|INNER|CROSS|FULL)?\s*JOIN\s+.+?\s+ON\s+[\w.]+\s*=\s*[\w.]+)/gi
  let m: RegExpExecArray | null
  while ((m = joinRegex.exec(sql)) !== null) {
    patterns.push(m[1].trim().replace(/\s+/g, ' '))
  }
  return patterns
}

// ============ Service Java 解析 ============

/**
 * 从 ServiceImpl Java 文件提取方法信息
 */
function parseServiceJava(filePath: string): ServiceMethodInfo[] {
  const content = readFileSync(filePath, 'utf-8')
  const methods: ServiceMethodInfo[] = []
  const fileName = basename(filePath)

  // 提取类名
  const classMatch = content.match(/class\s+(\w+)/)
  const className = classMatch?.[1] || ''

  // 提取 Mapper 字段引用（如 @Autowired private XxxMapper xxxMapper;）
  const mapperFieldMap = new Map<string, string>()
  const mapperFieldRegex = /private\s+(\w*Mapper)\s+(\w+)\s*[;=]/g
  let fieldMatch: RegExpExecArray | null
  while ((fieldMatch = mapperFieldRegex.exec(content)) !== null) {
    mapperFieldMap.set(fieldMatch[2], fieldMatch[1])
  }

  // 提取公共方法及其上方注释
  // 匹配 Javadoc 注释 + 方法签名
  const methodRegex = /(?:\/\*\*([\s\S]*?)\*\/\s*)?(?:@Override\s+)?(?:public|protected)\s+(\S+)\s+(\w+)\s*\(([^)]*)\)\s*\{?/g
  let mMatch: RegExpExecArray | null

  while ((mMatch = methodRegex.exec(content)) !== null) {
    const javadoc = mMatch[1] || ''
    const returnType = mMatch[2]
    const methodName = mMatch[3]

    // 清理 Javadoc
    const comment = cleanJavadoc(javadoc)

    // 在方法体中查找 Mapper 调用
    const methodBodyStart = mMatch.index + mMatch[0].length
    const methodBody = extractMethodBody(content, methodBodyStart)

    let mapperFieldName = ''
    let mapperMethodCall = ''

    for (const [fieldName, mapperType] of mapperFieldMap) {
      const callRegex = new RegExp(`${fieldName}\\.(\\w+)\\s*\\(`)
      const callMatch = methodBody.match(callRegex)
      if (callMatch) {
        mapperFieldName = fieldName
        mapperMethodCall = callMatch[1]
        break
      }
    }

    methods.push({
      methodName,
      returnType,
      comment,
      mapperFieldName,
      mapperMethodCall,
      fileName,
      className
    })
  }

  return methods
}

/**
 * 清理 Javadoc 注释
 */
function cleanJavadoc(javadoc: string): string {
  return javadoc
    .replace(/^\s*\*\s*/gm, '')
    .replace(/@param\s+\w+\s+/g, '')
    .replace(/@return\s+/g, '返回：')
    .replace(/@throws\s+\w+\s+/g, '')
    .replace(/@see\s+/g, '')
    .replace(/\n\s*\n/g, '\n')
    .trim()
}

/**
 * 提取方法体（简化版：找到匹配的大括号）
 */
function extractMethodBody(content: string, startIdx: number): string {
  let depth = 0
  let i = startIdx

  // 找到第一个 {
  while (i < content.length && content[i] !== '{') {
    i++
  }
  if (i >= content.length) return ''

  const bodyStart = i
  depth = 1
  i++

  while (i < content.length && depth > 0) {
    if (content[i] === '{') depth++
    else if (content[i] === '}') depth--
    i++
  }

  return content.slice(bodyStart, i)
}

// ============ 交叉关联 ============

/**
 * 将 Service 方法与 Mapper SQL 交叉关联
 */
function crossReference(
  mapperEntries: MapperSelectEntry[],
  serviceMethods: ServiceMethodInfo[],
  projectRoot: string
): SkillEntry[] {
  const skills: SkillEntry[] = []

  // 为 Mapper 方法建立索引（方法名 → 条目列表）
  const mapperIndex = new Map<string, MapperSelectEntry[]>()
  for (const entry of mapperEntries) {
    const list = mapperIndex.get(entry.id) || []
    list.push(entry)
    mapperIndex.set(entry.id, list)
  }

  // 为 Service 方法建立映射
  for (const method of serviceMethods) {
    let matchedMapper: MapperSelectEntry | null = null

    // 策略1：Service 中直接调用了 Mapper 方法
    if (method.mapperMethodCall) {
      const candidates = mapperIndex.get(method.mapperMethodCall)
      if (candidates && candidates.length > 0) {
        matchedMapper = candidates[0]
      }
    }

    // 策略2：方法名模糊匹配（getXxxList → selectXxxList / getXxx → selectXxx）
    if (!matchedMapper) {
      const normalizedName = method.methodName
        .replace(/^(get|find|query|list|fetch|search)/i, '')
        .replace(/List$/, '')

      for (const [mapperId, entries] of mapperIndex) {
        const normalizedMapper = mapperId
          .replace(/^(select|find|query|list|fetch|search)/i, '')
          .replace(/List$/, '')

        if (normalizedName && normalizedMapper &&
            normalizedName.toLowerCase() === normalizedMapper.toLowerCase()) {
          matchedMapper = entries[0]
          break
        }
      }
    }

    // 只生成有关联的 Skill（有 Mapper SQL 匹配）
    if (matchedMapper) {
      const sql = matchedMapper.sql
      const tables = matchedMapper.tables
      const joinPatterns = extractJoinPatterns(sql)

      // 从注释和类名中提取标签
      const tags = extractTags(method.comment, method.className, matchedMapper.namespace, tables)

      // 生成 Skill 名称
      const name = method.comment
        ? method.comment.split(/[。\n，,]/)[0].trim()
        : `${method.methodName} → ${matchedMapper.id}`

      // 生成自然语言摘要
      const summary = generateSkillSummary(name, method.comment, tables, method.className, matchedMapper.id)

      skills.push({
        id: randomUUID(),
        name: name || matchedMapper.id,
        summary,
        source: {
          mapperFile: matchedMapper.fileName,
          mapperMethod: matchedMapper.id,
          serviceFile: method.fileName,
          serviceMethod: method.methodName,
          serviceComment: method.comment
        },
        sql,
        tables,
        joinPatterns,
        tags,
        isValid: true,
        invalidReason: ''
      })
    }
  }

  // 也为没有 Service 关联的 Mapper 查询生成 Skill
  const matchedMapperIds = new Set(skills.map(s => s.source.mapperMethod))
  for (const entry of mapperEntries) {
    if (matchedMapperIds.has(entry.id)) continue

    const sql = entry.sql
    const tables = entry.tables
    const joinPatterns = extractJoinPatterns(sql)
    const tags = extractTags('', '', entry.namespace, tables)

    // 为无 Service 关联的 Mapper 生成摘要
    const summary = generateSkillSummary(entry.id, '', tables, '', entry.id)

    skills.push({
      id: randomUUID(),
      name: entry.id,
      summary,
      source: {
        mapperFile: entry.fileName,
        mapperMethod: entry.id,
        serviceFile: '',
        serviceMethod: '',
        serviceComment: ''
      },
      sql,
      tables,
      joinPatterns,
      tags,
      isValid: true,
      invalidReason: ''
    })
  }

  return skills
}

/**
 * 从注释、类名、命名空间等提取业务标签
 */
function extractTags(
  comment: string,
  className: string,
  namespace: string,
  tables: string[]
): string[] {
  const tags = new Set<string>()

  // 从注释提取中文词汇
  const chineseWords = comment.match(/[\u4e00-\u9fa5]{2,4}/g)
  if (chineseWords) {
    chineseWords.forEach(w => tags.add(w))
  }

  // 从类名提取业务词（去掉 Impl/Service/Controller 后缀）
  const bizName = className
    .replace(/ServiceImpl$/, '')
    .replace(/Service$/, '')
    .replace(/Controller$/, '')
  if (bizName) tags.add(bizName)

  // 从 namespace 提取模块名
  const nsParts = namespace.split('.')
  const mapperName = nsParts[nsParts.length - 1]
  if (mapperName) {
    const mapperBiz = mapperName.replace(/Mapper$/, '')
    if (mapperBiz) tags.add(mapperBiz)
  }

  // 添加表名
  tables.forEach(t => tags.add(t))

  return Array.from(tags).slice(0, 10)
}

/**
 * 生成 Skill 的自然语言摘要
 * 将 SQL 查询翻译成业务语言描述
 */
function generateSkillSummary(
  name: string,
  comment: string,
  tables: string[],
  className: string,
  mapperMethod: string
): string {
  // 如果有业务注释，优先使用注释的第一句话
  if (comment) {
    const firstSentence = comment.split(/[。\n]/)[0].trim()
    if (firstSentence.length >= 5) {
      return firstSentence
    }
  }

  // 从方法名推断操作类型
  const methodLower = mapperMethod.toLowerCase()
  let operation = '查询'
  if (methodLower.includes('insert') || methodLower.includes('add') || methodLower.includes('create')) {
    operation = '新增'
  } else if (methodLower.includes('update') || methodLower.includes('modify') || methodLower.includes('edit')) {
    operation = '更新'
  } else if (methodLower.includes('delete') || methodLower.includes('remove')) {
    operation = '删除'
  } else if (methodLower.includes('count') || methodLower.includes('sum')) {
    operation = '统计'
  } else if (methodLower.includes('list') || methodLower.includes('page')) {
    operation = '分页查询'
  }

  // 从类名提取业务领域
  let domain = ''
  if (className) {
    domain = className
      .replace(/ServiceImpl$/, '')
      .replace(/Service$/, '')
      .replace(/Mapper$/, '')
  }

  // 构建表名描述
  const tableDesc = tables.length > 0
    ? (tables.length === 1 ? `【${tables[0]}】表` : `【${tables.slice(0, 2).join('、')}】等表`)
    : '相关数据'

  // 组合摘要
  if (domain) {
    return `${operation}${domain}相关的${tableDesc}数据`
  }

  // 使用方法名作为备选
  const cleanMethod = mapperMethod
    .replace(/^(select|get|find|query|list|fetch|search|insert|add|create|update|modify|edit|delete|remove|count|sum)_?/i, '')
    .replace(/[_-]/g, '')

  if (cleanMethod) {
    return `${operation}${cleanMethod}相关的${tableDesc}数据`
  }

  return `${operation}${tableDesc}数据`
}

// ============ Schema 校验 ============

/**
 * 用数据库 Schema 校验 Skill 中引用的表是否有效
 */
function validateSkillsWithSchema(skills: SkillEntry[], schemaTableNames: Set<string>): SkillEntry[] {
  return skills.map(skill => {
    if (schemaTableNames.size === 0) return skill // 没有 Schema 时不校验

    const invalidTables = skill.tables.filter(t => !schemaTableNames.has(t))
    if (invalidTables.length > 0) {
      return {
        ...skill,
        isValid: false,
        invalidReason: `表不存在于当前数据库: ${invalidTables.join(', ')}`
      }
    }
    return { ...skill, isValid: true, invalidReason: '' }
  })
}

// ============ Skill 持久化 ============

function getSkillDir(): string {
  const dir = join(app.getPath('userData'), 'skill-scanner')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getSkillFilePath(projectName: string): string {
  const safeName = projectName.replace(/[\\/:*?"<>|]+/g, '_').trim()
  return join(getSkillDir(), `${safeName}.skill.json`)
}

function loadSkillFile(filePath: string): SkillFile | null {
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as SkillFile
  } catch {
    return null
  }
}

function listSkillFiles(): Array<{ projectName: string; filePath: string; scanTime: string; skillCount: number }> {
  const dir = getSkillDir()
  if (!existsSync(dir)) return []

  const results: Array<{ projectName: string; filePath: string; scanTime: string; skillCount: number }> = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    if (!entry.endsWith('.skill.json')) continue
    const filePath = join(dir, entry)
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as SkillFile
      results.push({
        projectName: data.projectName || entry.replace('.skill.json', ''),
        filePath,
        scanTime: data.scanTime || '',
        skillCount: data.skills?.length || 0
      })
    } catch {
      // 忽略损坏文件
    }
  }

  return results.sort((a, b) => +new Date(b.scanTime) - +new Date(a.scanTime))
}

// ============ IPC 注册 ============

export function setupSkillScanner(): void {
  // 选择项目目录
  ipcMain.handle('skill-scanner:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择 Java 项目根目录'
    })
    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true }
    }
    return { success: true, path: result.filePaths[0] }
  })

  // 扫描项目
  ipcMain.handle(
    'skill-scanner:scan-project',
    async (_event, payload: { projectPath: string; schemaTableNames?: string[] }) => {
      try {
        const { projectPath } = payload
        if (!projectPath || !existsSync(projectPath)) {
          throw new Error('项目路径不存在')
        }

        const projectName = basename(projectPath)
        const schemaTableSet = new Set(payload.schemaTableNames || [])

        // Step 1: 扫描 Mapper XML 文件
        const mapperFiles = walkDir(projectPath, /Mapper\.xml$/i)

        // Step 2: 扫描 ServiceImpl Java 文件
        const serviceFiles = walkDir(projectPath, /ServiceImpl\.java$/i)

        if (mapperFiles.length === 0 && serviceFiles.length === 0) {
          throw new Error('未找到任何 Mapper XML 或 ServiceImpl Java 文件，请确认项目路径正确')
        }

        // Step 3: 解析 Mapper XML
        const allMapperEntries: MapperSelectEntry[] = []
        for (const file of mapperFiles) {
          try {
            const entries = parseMapperXml(file)
            allMapperEntries.push(...entries)
          } catch {
            // 跳过解析失败的文件
          }
        }

        // 只保留 SELECT 查询（过滤掉 insert/update/delete）
        const selectEntries = allMapperEntries.filter(e =>
          /^\s*SELECT\b/i.test(e.sql) || /^\s*WITH\b/i.test(e.sql)
        )

        // Step 4: 解析 Service Java
        const allServiceMethods: ServiceMethodInfo[] = []
        for (const file of serviceFiles) {
          try {
            const methods = parseServiceJava(file)
            allServiceMethods.push(...methods)
          } catch {
            // 跳过解析失败的文件
          }
        }

        // Step 5: 交叉关联
        const skills = crossReference(selectEntries, allServiceMethods, projectPath)

        // Step 6: Schema 校验
        const validatedSkills = validateSkillsWithSchema(skills, schemaTableSet)

        // Step 7: 生成 Skill 文件
        const skillFile: SkillFile = {
          version: '1.0',
          projectName,
          scanTime: new Date().toISOString(),
          dbSchema: '',
          sourcePath: projectPath,
          skillCount: validatedSkills.length,
          skills: validatedSkills
        }

        // 保存到本地
        const savePath = getSkillFilePath(projectName)
        writeFileSync(savePath, JSON.stringify(skillFile, null, 2), 'utf-8')

        return {
          success: true,
          projectName,
          mapperFileCount: mapperFiles.length,
          serviceFileCount: serviceFiles.length,
          selectCount: selectEntries.length,
          serviceMethodCount: allServiceMethods.length,
          skillCount: validatedSkills.length,
          validSkillCount: validatedSkills.filter(s => s.isValid).length,
          invalidSkillCount: validatedSkills.filter(s => !s.isValid).length,
          savePath,
          skillFile
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '扫描失败'
        }
      }
    }
  )

  // 列出所有已保存的 Skill 文件
  ipcMain.handle('skill-scanner:list-skills', async () => {
    try {
      const files = listSkillFiles()
      return { success: true, files }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '加载失败' }
    }
  })

  // 加载指定 Skill 文件
  ipcMain.handle('skill-scanner:load-skill', async (_event, payload: { filePath: string }) => {
    try {
      const data = loadSkillFile(payload.filePath)
      if (!data) throw new Error('Skill 文件不存在或已损坏')
      return { success: true, skillFile: data }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '加载失败' }
    }
  })

  // 删除指定 Skill 文件
  ipcMain.handle('skill-scanner:delete-skill', async (_event, payload: { filePath: string }) => {
    try {
      if (!existsSync(payload.filePath)) throw new Error('文件不存在')
      const { unlinkSync } = await import('fs')
      unlinkSync(payload.filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '删除失败' }
    }
  })

  // 导出 Skill 文件到指定目录
  ipcMain.handle(
    'skill-scanner:export-skill',
    async (_event, payload: { filePath: string; exportDir?: string }) => {
      try {
        const data = loadSkillFile(payload.filePath)
        if (!data) throw new Error('Skill 文件不存在')

        let exportPath: string
        if (payload.exportDir) {
          if (!existsSync(payload.exportDir)) {
            mkdirSync(payload.exportDir, { recursive: true })
          }
          exportPath = join(payload.exportDir, `${data.projectName}.skill.json`)
        } else {
          // 使用系统文件保存对话框
          const result = await dialog.showSaveDialog({
            title: '导出 Skill 文件',
            defaultPath: `${data.projectName}.skill.json`,
            filters: [{ name: 'Skill JSON', extensions: ['skill.json', 'json'] }]
          })
          if (result.canceled) return { success: false, canceled: true }
          exportPath = result.filePath || ''
        }

        writeFileSync(exportPath, JSON.stringify(data, null, 2), 'utf-8')
        return { success: true, exportPath }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '导出失败' }
      }
    }
  )

  // 导入外部 Skill 文件
  ipcMain.handle('skill-scanner:import-skill', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '导入 Skill 文件',
        filters: [{ name: 'Skill JSON', extensions: ['skill.json', 'json'] }],
        properties: ['openFile']
      })
      if (result.canceled || !result.filePaths.length) {
        return { success: false, canceled: true }
      }

      const sourcePath = result.filePaths[0]
      const content = readFileSync(sourcePath, 'utf-8')
      const data = JSON.parse(content) as SkillFile

      if (!data.version || !Array.isArray(data.skills)) {
        throw new Error('无效的 Skill 文件格式')
      }

      // 保存到本地 Skill 目录
      const savePath = getSkillFilePath(data.projectName || basename(sourcePath, '.skill.json'))
      writeFileSync(savePath, JSON.stringify(data, null, 2), 'utf-8')

      return {
        success: true,
        savePath,
        skillFile: data
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '导入失败' }
    }
  })

  // 生成 .cursorrules / .windsurfrules 片段（供外部编辑器使用）
  ipcMain.handle(
    'skill-scanner:export-rules',
    async (_event, payload: { filePath: string; format: 'cursorrules' | 'windsurfrules' | 'markdown' }) => {
      try {
        const data = loadSkillFile(payload.filePath)
        if (!data) throw new Error('Skill 文件不存在')

        let content: string

        if (payload.format === 'markdown') {
          content = generateMarkdownDoc(data)
        } else {
          content = generateRulesContent(data)
        }

        const ext = payload.format === 'markdown' ? '.md' : ''
        const defaultName = payload.format === 'markdown'
          ? `${data.projectName}-sql-skills.md`
          : `.${payload.format}`

        const result = await dialog.showSaveDialog({
          title: '导出 Rules 文件',
          defaultPath: defaultName,
          filters: [{ name: payload.format === 'markdown' ? 'Markdown' : 'Rules', extensions: [ext || payload.format] }]
        })

        if (result.canceled) return { success: false, canceled: true }

        writeFileSync(result.filePath || '', content, 'utf-8')
        return { success: true, exportPath: result.filePath }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : '导出失败' }
      }
    }
  )
}

// ============ Rules 生成 ============

function generateRulesContent(data: SkillFile): string {
  const lines: string[] = []
  lines.push(`# ${data.projectName} SQL 查询技能库`)
  lines.push(`# 生成时间: ${data.scanTime}`)
  lines.push(`# 技能数量: ${data.skillCount}`)
  lines.push('')
  lines.push('## 项目 SQL 查询模式')
  lines.push('以下是项目中已有的 SQL 查询模式，生成 SQL 时请参考这些真实查询。')
  lines.push('')

  for (const skill of data.skills) {
    if (!skill.isValid) continue
    lines.push(`### ${skill.name}`)
    if (skill.source.serviceComment) {
      lines.push(`业务说明: ${skill.source.serviceComment}`)
    }
    lines.push(`涉及表: ${skill.tables.join(', ')}`)
    if (skill.joinPatterns.length > 0) {
      lines.push(`JOIN 模式: ${skill.joinPatterns.join('; ')}`)
    }
    lines.push('```sql')
    lines.push(skill.sql)
    lines.push('```')
    lines.push('')
  }

  return lines.join('\n')
}

function generateMarkdownDoc(data: SkillFile): string {
  const lines: string[] = []
  lines.push(`# ${data.projectName} - SQL 查询技能文档`)
  lines.push('')
  lines.push(`- **生成时间**: ${data.scanTime}`)
  lines.push(`- **技能数量**: ${data.skillCount}`)
  lines.push(`- **来源项目**: ${data.sourcePath}`)
  lines.push('')

  const validSkills = data.skills.filter(s => s.isValid)
  const invalidSkills = data.skills.filter(s => !s.isValid)

  lines.push('## 目录')
  lines.push('')
  for (let i = 0; i < validSkills.length; i++) {
    lines.push(`${i + 1}. [${validSkills[i].name}](#${validSkills[i].id})`)
  }
  lines.push('')

  for (const skill of validSkills) {
    lines.push(`## ${skill.name} {#${skill.id}}`)
    lines.push('')
    lines.push('| 属性 | 值 |')
    lines.push('|------|----|')
    lines.push(`| Mapper 文件 | ${skill.source.mapperFile} |`)
    lines.push(`| Mapper 方法 | ${skill.source.mapperMethod} |`)
    if (skill.source.serviceFile) {
      lines.push(`| Service 文件 | ${skill.source.serviceFile} |`)
      lines.push(`| Service 方法 | ${skill.source.serviceMethod} |`)
    }
    if (skill.source.serviceComment) {
      lines.push(`| 业务说明 | ${skill.source.serviceComment} |`)
    }
    lines.push(`| 涉及表 | ${skill.tables.join(', ')} |`)
    if (skill.joinPatterns.length > 0) {
      lines.push(`| JOIN 模式 | ${skill.joinPatterns.join('; ')} |`)
    }
    lines.push(`| 标签 | ${skill.tags.join(', ')} |`)
    lines.push('')
    lines.push('```sql')
    lines.push(skill.sql)
    lines.push('```')
    lines.push('')
  }

  if (invalidSkills.length > 0) {
    lines.push('---')
    lines.push('')
    lines.push('## 未通过校验的查询')
    lines.push('')
    for (const skill of invalidSkills) {
      lines.push(`- **${skill.name}**: ${skill.invalidReason}`)
    }
  }

  return lines.join('\n')
}
