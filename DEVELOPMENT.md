# 开发者工具箱 - 项目开发文档

> 本文档供 AI 或开发者继续开发时参考，详细记录了项目架构、功能模块和扩展指南。

---

## 📁 项目结构

```
unitMap/
├── src/
│   ├── main/                          # Electron 主进程
│   │   ├── index.ts                   # 主进程入口，窗口创建、IPC 通信
│   │   └── services/                  # 主进程服务
│   │       ├── codeRunner.ts          # 代码运行服务（JS/TS 执行）
│   │       └── npmManager.ts          # NPM 包管理服务
│   │
│   ├── preload/                       # 预加载脚本
│   │   ├── index.ts                   # 暴露安全 API 给渲染进程
│   │   └── index.d.ts                 # API 类型定义
│   │
│   └── renderer/                      # Vue 渲染进程
│       ├── index.html                 # HTML 入口
│       └── src/
│           ├── main.ts                # Vue 应用入口
│           ├── App.vue                # 根组件
│           ├── styles/
│           │   └── index.css          # 全局样式（TailwindCSS + DaisyUI）
│           ├── components/            # 通用组件
│           │   ├── TitleBar.vue       # 自定义标题栏
│           │   └── Sidebar.vue        # 左侧工具栏
│           └── views/
│               └── runjs/             # RunJS 模块
│                   ├── RunJS.vue      # RunJS 主视图
│                   └── components/
│                       ├── CodeEditor.vue   # Monaco Editor 封装
│                       ├── NpmPanel.vue     # NPM 包管理面板
│                       ├── FilePanel.vue    # 文件管理面板
│                       └── OutputPanel.vue  # 代码输出面板
│
├── resources/                         # 应用资源（图标等）
├── electron.vite.config.ts            # electron-vite 配置
├── tsconfig.json                      # TypeScript 配置
└── package.json                       # 项目配置
```

---

## 🔧 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 35.x | 桌面应用框架 |
| Vue 3 | 3.5.x | 前端框架 |
| TypeScript | 5.8.x | 类型安全 |
| electron-vite | 3.x | 构建工具 |
| TailwindCSS | 4.x | CSS 框架 |
| DaisyUI | 5.x | UI 组件库 |
| Monaco Editor | 0.52.x | 代码编辑器 |
| esbuild | 0.24.x | TypeScript 编译 |

---

## 🎯 已实现功能

### 1. 应用框架

- [x] **无边框窗口** - 自定义标题栏，支持拖动
- [x] **窗口控制** - 最小化、最大化/还原、关闭
- [x] **单实例锁** - 只允许运行一个实例
- [x] **左侧工具栏** - 可扩展的工具选择面板

### 2. RunJS 模块

- [x] **代码编辑器**
  - Monaco Editor 集成
  - 自定义暗色主题
  - 文件标签页管理
  - JavaScript/TypeScript 切换
  - **代码自动补全** - 内置代码片段和 NPM 包提示
  - **快捷键支持** - `Ctrl+Enter` 运行，`Ctrl+S` 保存，`Esc` 停止，`Ctrl+D` 复制行
  - **Express 支持** - 内置 Express 类型定义与自动补全
  - **TypeScript 类型支持** - ES5/ES6/ESNext 完整类型推断
  - **动态类型加载** - 从本地 NPM 包读取 `.d.ts` 类型定义，支持版本切换同步
  - **智能提示** - 数组、字符串、对象方法自动补全

- [x] **NPM 包管理**
  - **真实安装** - 包会被完整下载并解压到用户数据目录
  - **版本管理** - 支持查看历史版本并一键切换
  - **自动持久化** - 依赖关系自动保存到 package.json
  - **国内镜像** - 内置 npmmirror 源加速

- [x] **代码运行**
  - JavaScript 直接执行
  - TypeScript 通过 esbuild 编译后执行
  - **异步支持** - 完美支持 async/await 和 Promise 等待
  - **实时日志** - console.log/error 实时流式传输到 UI
  - **ESM 兼容** - 自动处理 ESM 模块默认导出
  - **常驻服务** - 支持 Express/Koa/Http Server 运行
  - **资源清理** - 自动追踪并关闭未释放的 Server 端口
  - **端口终止** - 手动终止指定端口的 Electron 进程（使用 netstat + taskkill）
  - 沙箱隔离（使用 Node.js vm 模块）
  - 运行中断功能

- [x] **文件管理**
  - [x] 多标签页编辑
  - [x] 自动持久化保存（LocalStorage）
  - [x] 真实文件列表
  - [x] 新建/关闭/切换文件

---

## 🚀 如何添加新工具

### 步骤 1：在 Sidebar 注册工具

编辑 `src/renderer/src/App.vue`：

```typescript
const tools = [
  { id: 'runjs', name: 'RunJS', icon: 'code' },
  { id: 'newtool', name: '新工具', icon: 'wrench' }  // 添加新工具
]
```

### 步骤 2：创建工具视图

创建 `src/renderer/src/views/newtool/NewTool.vue`：

```vue
<script setup lang="ts">
// 工具逻辑
</script>

<template>
  <div class="newtool-container">
    <!-- 工具 UI -->
  </div>
</template>
```

### 步骤 3：在 App.vue 中引入

```vue
<script setup lang="ts">
import NewTool from './views/newtool/NewTool.vue'
</script>

<template>
  <main class="flex-1 overflow-hidden">
    <Transition name="fade" mode="out-in">
      <RunJS v-if="activeTool === 'runjs'" />
      <NewTool v-else-if="activeTool === 'newtool'" />
    </Transition>
  </main>
</template>
```

### 步骤 4：添加图标（可选）

编辑 `src/renderer/src/components/Sidebar.vue` 中的 `getIcon` 函数：

```typescript
const icons: Record<string, string> = {
  code: `<path ... />`,
  wrench: `<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />`
}
```

---

## 📡 IPC 通信

### 主进程 → 渲染进程

| 事件名 | 描述 |
|--------|------|
| `window:maximized-change` | 窗口最大化状态变化 |

### 渲染进程 → 主进程

| 事件名 | 类型 | 描述 |
|--------|------|------|
| `window:minimize` | send | 最小化窗口 |
| `window:maximize` | send | 最大化/还原窗口 |
| `window:close` | send | 关闭窗口 |
| `window:isMaximized` | invoke | 获取最大化状态 |
| `code:run` | invoke | 运行代码 |
| `code:stop` | send | 停止运行 |
| `code:clean` | invoke | 清理所有活跃的 Server |
| `code:killPort` | invoke | 终止占用指定端口的 Electron 进程 |
| `npm:search` | invoke | 搜索 NPM 包 |
| `npm:install` | invoke | 安装 NPM 包 |
| `npm:uninstall` | invoke | 卸载 NPM 包 |
| `npm:list` | invoke | 获取已安装包列表 |
| `npm:versions` | invoke | 获取包的所有版本 |
| `npm:changeVersion` | invoke | 切换包版本 |
| `code:log` | on | (主->渲) 实时日志流 |

---

## 🎨 UI 设计规范

### 颜色变量

```css
--color-primary: #6366f1;       /* 主色调 - 靛蓝 */
--color-secondary: #8b5cf6;     /* 次要色 - 紫色 */
--color-surface: #1e1e2e;       /* 背景色 */
--color-surface-light: #2a2a3e; /* 浅背景 */
--color-text: #e2e8f0;          /* 文字颜色 */
--color-text-muted: #94a3b8;    /* 次要文字 */
--color-border: #3f3f5a;        /* 边框颜色 */
```

### 组件样式类

- `.glass` - 玻璃态效果
- `.gradient-border` - 渐变边框
- `.btn-glow` - 按钮悬停发光效果
- `.drag-region` - 标题栏拖动区域
- `.no-drag` - 非拖动区域（按钮等）

---

## 📋 待开发功能

### RunJS 模块增强

- [x] ~~实际的文件保存/加载功能~~ ✅ 已完成
- [x] ~~代码自动补全~~ ✅ 已完成
- [x] ~~键盘快捷键（Ctrl+Enter 运行）~~ ✅ 已完成
- [ ] 代码片段管理
- [x] ~~实际的 NPM 包安装（到本地目录）~~ ✅ 已完成
- [x] ~~运行中代码的中断功能~~ ✅ 已完成

### 新工具建议

- [ ] **JSON 工具** - JSON 格式化、压缩、转换
- [ ] **正则工具** - 正则表达式测试
- [ ] **Base64 工具** - 编码/解码
- [ ] **时间戳工具** - 时间转换
- [ ] **颜色工具** - 颜色选择和转换
- [ ] **API 测试** - 类似 Postman 的 HTTP 请求工具

---

## 🔐 安全注意事项

1. **代码沙箱**：使用 `vm` 模块执行用户代码，限制了可访问的模块
2. **Require 劫持**：自定义 `createSafeRequire` 函数，只允许加载：
   - 所有的 Node.js 内置模块（`fs`, `path`, `http`, `net` 等）
   - 用户显式安装的 NPM 包
3. **资源管理**：劫持 `http.createServer` 和 `net.Server` 来追踪并自动释放端口
4. **执行超时**：代码执行限时 30 秒
5. **contextIsolation**：启用上下文隔离，渲染进程无法直接访问 Node.js API

---

## 📝 开发命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 类型检查
npm run typecheck

# 代码格式化
npm run format

# 构建 Windows 版本
npm run build:win

# 构建 macOS 版本
npm run build:mac

# 构建 Linux 版本
npm run build:linux
```

---

## 🔄 版本历史

### v1.6.0 (2026-01-15)

- **动态本地类型加载** - 从已安装的 NPM 包读取类型定义
  - 自动从 `node_modules` 读取 `.d.ts` 文件
  - 支持递归解析相对路径依赖
  - 本地没有类型时回退到 CDN 获取
  - **版本切换同步** - 切换包版本后自动更新类型定义
  - **编辑器初始化预加载** - 启动时加载所有已安装包的类型
- 重构 `typeLoader.ts`：从 1130 行减少到 270 行（删除硬编码类型）

### v1.5.0 (2026-01-14)

- 新增动态 NPM 包类型加载功能
  - 自动检测代码中的 `require`/`import` 语句
  - 从 unpkg/jsdelivr CDN 获取类型定义
  - 缓存已加载类型，避免重复请求

### v1.4.0 (2026-01-14)

- 新增手动端口终止功能
  - 输入端口号，使用 `netstat` 查找占用端口的 PID
  - 使用 `tasklist` 验证进程名称为 `electron.exe`
  - 使用 `taskkill` 终止目标进程
- 优化 Server 追踪机制，使用 Proxy + require.cache 实现全局劫持

### v1.3.0 (2026-01-14)

- 新增 Express 框架内置支持
- 优化代码编辑器类型提示

### v1.2.0 (2026-01-14)

- 实现真实 NPM 包安装与版本管理
- 增强代码运行器：支持异步/Promise/ESM
- 支持 Express/Http Server 等常驻服务运行
- 实现实时日志流式输出
- 自动清理网络端口资源

### v1.1.0 (2026-01-14)

- 新增代码自动补全功能（JS/TS 代码片段、NPM 包提示）
- 新增快捷键支持（Ctrl+Enter 运行、Esc 停止）
- 新增运行中断功能
- 优化 UI 样式，增加面板间距
- 优化输出面板，添加运行状态指示

### v1.0.0 (2026-01-14)

- 初始版本
- 实现 RunJS 代码运行功能
- Monaco Editor 集成
- NPM 包管理（模拟）
- 自定义窗口和深色主题
