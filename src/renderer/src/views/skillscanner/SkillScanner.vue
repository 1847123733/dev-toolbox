<template>
  <div class="skill-scanner">
    <!-- 左侧：Skill 列表 -->
    <aside class="skill-sidebar">
      <div class="sidebar-header">
        <h2>Skill 定制</h2>
        <div class="sidebar-actions">
          <button class="icon-btn" @click="onImportSkill" title="导入 Skill">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
        </div>
      </div>

      <button class="scan-btn" @click="onSelectDirectory" :disabled="scanning">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        {{ scanning ? '扫描中...' : '扫描项目' }}
      </button>

      <div class="sidebar-list">
        <div v-if="skillFiles.length === 0" class="sidebar-empty">
          <p>暂无 Skill 文件</p>
          <p class="sidebar-empty-hint">点击上方"扫描项目"开始</p>
        </div>
        <div
          v-for="file in skillFiles"
          :key="file.filePath"
          class="skill-file-item"
          :class="{ active: selectedFilePath === file.filePath }"
          @click="onSelectFile(file.filePath)"
        >
          <div class="file-item-info">
            <div class="file-item-name">{{ file.projectName }}</div>
            <div class="file-item-meta">{{ file.skillCount }} 条 Skill · {{ formatTime(file.scanTime) }}</div>
          </div>
          <button class="file-item-delete" @click.stop="onDeleteFile(file.filePath)" title="删除">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- 右侧：内容区 -->
    <main class="skill-main">
      <!-- 空白状态 -->
      <div v-if="!currentSkillFile" class="main-empty">
        <div class="empty-content">
          <div class="empty-icon">🛠️</div>
          <h2 class="empty-title">Skill 定制</h2>
          <p class="empty-subtitle">扫描 Java + MyBatis 项目，提取真实 SQL 查询模式，生成可复用的 Skill 知识库</p>
          <div class="empty-features">
            <div class="feature-item">
              <span class="feature-icon">📁</span>
              <span>扫描 Mapper XML + Service Java</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔗</span>
              <span>自动关联 Service ↔ Mapper</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">📦</span>
              <span>导出 .skill.json 供外部使用</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">📋</span>
              <span>生成 .cursorrules / .windsurfrules</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 扫描进度 -->
      <div v-else-if="scanning" class="main-scanning">
        <div class="scanning-spinner"></div>
        <p>正在扫描项目，请稍候...</p>
      </div>

      <!-- Skill 详情 -->
      <div v-else class="main-content">
        <!-- 顶部信息栏 -->
        <div class="content-header">
          <div class="header-info">
            <h2>{{ currentSkillFile.projectName }}</h2>
            <div class="header-meta">
              <span>{{ currentSkillFile.skillCount }} 条 Skill</span>
              <span>·</span>
              <span>{{ validSkills.length }} 条有效</span>
              <span v-if="invalidSkills.length > 0" class="meta-invalid">· {{ invalidSkills.length }} 条无效</span>
              <span>·</span>
              <span>{{ formatTime(currentSkillFile.scanTime) }}</span>
            </div>
            <div class="header-path" :title="selectedFilePath">
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>{{ selectedFilePath }}</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="btn btn-outline" @click="onExportSkill" title="导出 Skill JSON">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              导出 JSON
            </button>
            <button class="btn btn-outline" @click="onExportRules('cursorrules')" title="生成 .cursorrules">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              .cursorrules
            </button>
            <button class="btn btn-outline" @click="onExportRules('markdown')" title="导出 Markdown 文档">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Markdown
            </button>
          </div>
        </div>

        <!-- 筛选栏 -->
        <div class="content-filter">
          <input
            v-model="filterText"
            class="filter-input"
            placeholder="搜索 Skill（名称、表名、标签...）"
          />
          <select v-model="filterStatus" class="filter-select">
            <option value="all">全部</option>
            <option value="valid">有效</option>
            <option value="invalid">无效</option>
          </select>
          <select v-model="filterTable" class="filter-select" v-if="allTables.length > 0">
            <option value="">所有表</option>
            <option v-for="table in allTables" :key="table" :value="table">{{ table }}</option>
          </select>
        </div>

        <!-- Skill 列表 -->
        <div class="content-list">
          <div v-if="filteredSkills.length === 0" class="list-empty">
            <p>没有匹配的 Skill</p>
          </div>
          <div
            v-for="skill in filteredSkills"
            :key="skill.id"
            class="skill-card"
            :class="{ invalid: !skill.isValid }"
          >
            <div class="skill-card-header" @click="toggleSkillDetail(skill.id)">
              <div class="skill-card-title-row">
                <span class="skill-card-status" :class="skill.isValid ? 'valid' : 'invalid'">
                  {{ skill.isValid ? '✓' : '✗' }}
                </span>
                <span class="skill-card-name">{{ skill.name }}</span>
                <span v-if="!skill.isValid" class="skill-card-invalid-reason">{{ skill.invalidReason }}</span>
              </div>
              <div v-if="skill.summary" class="skill-card-summary">{{ skill.summary }}</div>
              <div class="skill-card-tags">
                <span v-for="tag in skill.tags.slice(0, 5)" :key="tag" class="skill-tag">{{ tag }}</span>
              </div>
              <span class="skill-card-toggle" :class="{ expanded: expandedSkills.has(skill.id) }">▼</span>
            </div>

            <div v-show="expandedSkills.has(skill.id)" class="skill-card-detail">
              <div class="detail-section">
                <div class="detail-label">来源</div>
                <div class="detail-source">
                  <span v-if="skill.source.serviceFile" class="source-item">
                    <span class="source-label">Service:</span>
                    {{ skill.source.serviceFile }}::{{ skill.source.serviceMethod }}
                  </span>
                  <span class="source-item">
                    <span class="source-label">Mapper:</span>
                    {{ skill.source.mapperFile }}::{{ skill.source.mapperMethod }}
                  </span>
                </div>
              </div>

              <div v-if="skill.source.serviceComment" class="detail-section">
                <div class="detail-label">业务说明</div>
                <div class="detail-comment">{{ skill.source.serviceComment }}</div>
              </div>

              <div class="detail-section">
                <div class="detail-label">涉及表</div>
                <div class="detail-tables">
                  <span v-for="table in skill.tables" :key="table" class="table-badge">{{ table }}</span>
                </div>
              </div>

              <div v-if="skill.joinPatterns.length > 0" class="detail-section">
                <div class="detail-label">JOIN 模式</div>
                <div v-for="jp in skill.joinPatterns" :key="jp" class="detail-join">{{ jp }}</div>
              </div>

              <div class="detail-section">
                <div class="detail-label">SQL 模板</div>
                <pre class="detail-sql"><code>{{ skill.sql }}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// ============ 状态 ============

interface SkillFileInfo {
  projectName: string
  filePath: string
  scanTime: string
  skillCount: number
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

const skillFiles = ref<SkillFileInfo[]>([])
const selectedFilePath = ref('')
const currentSkillFile = ref<SkillFile | null>(null)
const scanning = ref(false)
const filterText = ref('')
const filterStatus = ref<'all' | 'valid' | 'invalid'>('all')
const filterTable = ref('')
const expandedSkills = ref<Set<string>>(new Set())

// ============ 计算属性 ============

const validSkills = computed(() => currentSkillFile.value?.skills.filter(s => s.isValid) || [])
const invalidSkills = computed(() => currentSkillFile.value?.skills.filter(s => !s.isValid) || [])

const allTables = computed(() => {
  if (!currentSkillFile.value) return []
  const tables = new Set<string>()
  currentSkillFile.value.skills.forEach(s => s.tables.forEach(t => tables.add(t)))
  return Array.from(tables).sort()
})

const filteredSkills = computed(() => {
  if (!currentSkillFile.value) return []
  let skills = currentSkillFile.value.skills

  if (filterStatus.value === 'valid') {
    skills = skills.filter(s => s.isValid)
  } else if (filterStatus.value === 'invalid') {
    skills = skills.filter(s => !s.isValid)
  }

  if (filterTable.value) {
    skills = skills.filter(s => s.tables.includes(filterTable.value))
  }

  if (filterText.value.trim()) {
    const keyword = filterText.value.trim().toLowerCase()
    skills = skills.filter(s =>
      s.name.toLowerCase().includes(keyword) ||
      s.tables.some(t => t.toLowerCase().includes(keyword)) ||
      s.tags.some(t => t.toLowerCase().includes(keyword)) ||
      s.sql.toLowerCase().includes(keyword) ||
      s.source.serviceComment.toLowerCase().includes(keyword)
    )
  }

  return skills
})

// ============ 方法 ============

const loadSkillFiles = async () => {
  const result = await window.api.skillScanner.listSkills()
  if (result.success && result.files) {
    skillFiles.value = result.files
  }
}

const formatTime = (iso?: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const toggleSkillDetail = (id: string) => {
  const next = new Set(expandedSkills.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedSkills.value = next
}

const onSelectDirectory = async () => {
  const result = await window.api.skillScanner.selectDirectory()
  if (!result.success || result.canceled) return

  scanning.value = true
  try {
    const scanResult = await window.api.skillScanner.scanProject({
      projectPath: result.path!,
    })
    if (scanResult.success && scanResult.skillFile) {
      currentSkillFile.value = scanResult.skillFile
      selectedFilePath.value = scanResult.savePath || ''
      await loadSkillFiles()
    } else if (!scanResult.success) {
      alert(scanResult.error || '扫描失败')
    }
  } catch (e: any) {
    alert(`扫描出错: ${e.message}`)
  } finally {
    scanning.value = false
  }
}

const onSelectFile = async (filePath: string) => {
  selectedFilePath.value = filePath
  const result = await window.api.skillScanner.loadSkill({ filePath })
  if (result.success && result.skillFile) {
    currentSkillFile.value = result.skillFile
    expandedSkills.value = new Set()
  }
}

const onDeleteFile = async (filePath: string) => {
  if (!confirm('确定删除此 Skill 文件？')) return
  await window.api.skillScanner.deleteSkill({ filePath })
  if (selectedFilePath.value === filePath) {
    currentSkillFile.value = null
    selectedFilePath.value = ''
  }
  await loadSkillFiles()
}

const onExportSkill = async () => {
  if (!selectedFilePath.value) return
  const result = await window.api.skillScanner.exportSkill({ filePath: selectedFilePath.value })
  if (result.success) {
    alert(`已导出到: ${result.exportPath}`)
  }
}

const onExportRules = async (format: 'cursorrules' | 'windsurfrules' | 'markdown') => {
  if (!selectedFilePath.value) return
  const result = await window.api.skillScanner.exportRules({ filePath: selectedFilePath.value, format })
  if (result.success) {
    alert(`已导出到: ${result.exportPath}`)
  }
}

const onImportSkill = async () => {
  const result = await window.api.skillScanner.importSkill()
  if (result.success) {
    await loadSkillFiles()
    if (result.skillFile && result.savePath) {
      currentSkillFile.value = result.skillFile
      selectedFilePath.value = result.savePath
    }
  }
}

onMounted(() => {
  loadSkillFiles()
})
</script>

<style scoped>
.skill-scanner { display: flex; height: 100%; background: var(--color-surface); color: var(--color-text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

/* ============ 左侧边栏 ============ */
.skill-sidebar { width: 280px; display: flex; flex-direction: column; border-right: 1px solid var(--color-border); background: var(--color-surface); flex-shrink: 0; }
.sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 16px 12px; }
.sidebar-header h2 { font-size: 16px; font-weight: 700; margin: 0; }
.sidebar-actions { display: flex; gap: 4px; }
.icon-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: 8px; background: transparent; color: var(--color-text-muted); cursor: pointer; transition: all 0.2s; }
.icon-btn:hover { background: var(--color-surface-lighter); color: var(--color-text); border-color: var(--color-primary); }

.scan-btn { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 16px 16px; padding: 12px 16px; border: none; border-radius: 12px; background: linear-gradient(135deg, var(--color-primary, #6366f1), #8b5cf6); color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 2px 8px rgba(99,102,241,0.25); transition: all 0.3s; }
.scan-btn:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(99,102,241,0.4); transform: translateY(-1px); }
.scan-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.sidebar-list { flex: 1; overflow-y: auto; padding: 0 12px 16px; }
.sidebar-empty { text-align: center; padding: 40px 16px; color: var(--color-text-muted); }
.sidebar-empty p { margin: 4px 0; }
.sidebar-empty-hint { font-size: 12px; opacity: 0.7; }

.skill-file-item { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-radius: 10px; margin-bottom: 4px; cursor: pointer; transition: all 0.2s; }
.skill-file-item:hover { background: var(--color-surface-lighter); }
.skill-file-item.active { background: rgba(99,102,241,0.08); border-left: 3px solid var(--color-primary); }
.file-item-info { flex: 1; min-width: 0; }
.file-item-name { font-size: 13.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-item-meta { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.file-item-delete { display: none; width: 28px; height: 28px; align-items: center; justify-content: center; border: none; background: transparent; color: var(--color-text-muted); cursor: pointer; border-radius: 6px; transition: all 0.2s; flex-shrink: 0; }
.skill-file-item:hover .file-item-delete { display: flex; }
.file-item-delete:hover { color: #ef4444; background: rgba(239,68,68,0.1); }

/* ============ 主内容区 ============ */
.skill-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--color-surface-light); }

.main-empty { flex: 1; display: flex; align-items: center; justify-content: center; }
.empty-content { text-align: center; animation: fadeIn 0.6s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.empty-icon { font-size: 48px; margin-bottom: 16px; }
.empty-title { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin: 0 0 12px; }
.empty-subtitle { font-size: 15px; color: var(--color-text-muted); margin-bottom: 24px; }
.empty-features { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 400px; margin: 0 auto; }
.feature-item { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; font-size: 13px; }
.feature-icon { font-size: 16px; }

.main-scanning { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--color-text-muted); }
.scanning-spinner { width: 36px; height: 36px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ============ 内容详情 ============ */
.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.content-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); flex-shrink: 0; }
.header-info h2 { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
.header-meta { font-size: 12px; color: var(--color-text-muted); display: flex; gap: 6px; }
.meta-invalid { color: #ef4444; }
.header-path { font-size: 11px; color: var(--color-text-muted); display: flex; align-items: center; gap: 4px; margin-top: 6px; opacity: 0.8; }
.header-path svg { flex-shrink: 0; }
.header-path span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }
.header-actions { display: flex; gap: 8px; }

.btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; display: inline-flex; align-items: center; gap: 6px; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: linear-gradient(135deg, var(--color-primary, #6366f1), #8b5cf6); color: white; }
.btn-primary:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
.btn-outline { background: transparent; border: 1px solid var(--color-border); color: var(--color-text); }
.btn-outline:hover:not(:disabled) { background: var(--color-surface-lighter); border-color: var(--color-primary); color: var(--color-primary); }

.content-filter { display: flex; gap: 8px; padding: 12px 24px; border-bottom: 1px solid var(--color-border); background: var(--color-surface); flex-shrink: 0; }
.filter-input { flex: 1; padding: 8px 14px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-light); color: var(--color-text); font-size: 13px; outline: none; transition: border-color 0.2s; }
.filter-input:focus { border-color: var(--color-primary); }
.filter-input::placeholder { color: var(--color-text-muted); opacity: 0.6; }
.filter-select { padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-light); color: var(--color-text); font-size: 13px; outline: none; cursor: pointer; }
.filter-select:focus { border-color: var(--color-primary); }

.content-list { flex: 1; overflow-y: auto; padding: 16px 24px; }
.list-empty { text-align: center; padding: 40px; color: var(--color-text-muted); }

/* ============ Skill 卡片 ============ */
.skill-card { border: 1px solid var(--color-border); border-radius: 12px; margin-bottom: 12px; background: var(--color-surface); overflow: hidden; transition: all 0.2s; }
.skill-card:hover { border-color: rgba(99,102,241,0.4); box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.skill-card.invalid { border-color: rgba(239,68,68,0.3); }
.skill-card-header { padding: 14px 16px; cursor: pointer; position: relative; }
.skill-card-header:hover { background: var(--color-surface-lighter); }
.skill-card-title-row { display: flex; align-items: center; gap: 8px; }
.skill-card-status { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.skill-card-status.valid { background: rgba(16,185,129,0.1); color: #10b981; }
.skill-card-status.invalid { background: rgba(239,68,68,0.1); color: #ef4444; }
.skill-card-name { font-size: 14px; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.skill-card-invalid-reason { font-size: 11px; color: #ef4444; background: rgba(239,68,68,0.08); padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
.skill-card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.skill-tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(99,102,241,0.08); color: #818cf8; font-weight: 500; }
.skill-card-summary { font-size: 12px; color: var(--color-text-muted); margin-top: 6px; line-height: 1.5; padding: 6px 10px; background: rgba(99,102,241,0.04); border-radius: 6px; border-left: 2px solid rgba(99,102,241,0.3); }
.skill-card-toggle { position: absolute; right: 16px; top: 16px; font-size: 10px; color: var(--color-text-muted); transition: transform 0.3s; }
.skill-card-toggle.expanded { transform: rotate(180deg); }

.skill-card-detail { padding: 16px; border-top: 1px solid var(--color-border); background: var(--color-surface-light); }
.detail-section { margin-bottom: 14px; }
.detail-section:last-child { margin-bottom: 0; }
.detail-label { font-size: 12px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
.detail-source { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.source-item { display: flex; align-items: center; gap: 6px; }
.source-label { font-weight: 600; font-size: 11px; color: var(--color-text-muted); min-width: 52px; }
.detail-comment { font-size: 13px; color: var(--color-text); line-height: 1.6; background: rgba(99,102,241,0.04); padding: 8px 12px; border-radius: 8px; border-left: 3px solid var(--color-primary); }
.detail-tables { display: flex; flex-wrap: wrap; gap: 6px; }
.table-badge { font-size: 12px; padding: 3px 10px; border-radius: 6px; background: rgba(16,185,129,0.08); color: #10b981; border: 1px solid rgba(16,185,129,0.2); font-weight: 500; }
.detail-join { font-size: 12px; padding: 4px 10px; background: rgba(245,158,11,0.08); color: #f59e0b; border-radius: 6px; margin-bottom: 4px; font-family: 'SF Mono', 'Cascadia Code', monospace; }
.detail-sql { margin: 0; padding: 14px; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow-x: auto; font-family: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', monospace; font-size: 12.5px; line-height: 1.6; color: #38bdf8; white-space: pre-wrap; word-break: break-word; }
</style>
