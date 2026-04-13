# 开发者工具箱（Dev Toolbox）开发文档

> 面向两类读者：
> 1) 新同学快速上手（安装、运行、调试）
> 2) 持续维护与扩展（架构、IPC、模块边界、发布）

---

## 1. 项目定位

`dev-toolbox` 是一个基于 `Electron + Vue 3 + TypeScript` 的桌面开发工具集合，当前包含：

- RunJS（JS/TS 运行与调试）
- NPM 包管理与类型支持
- 域名/IP 查询与端口扫描
- HTTP 请求调试
- OSS 上传管理
- SQL Expert（MySQL + AI 分析）
- macOS Dock 风格悬浮工具栏
- 应用级能力（自动更新、托盘、代理、开机自启、关闭行为）

---

## 2. 快速上手（新同学必读）

### 2.1 环境要求

- Node.js 18+
- npm 9+
- Windows/macOS/Linux 任一（本仓库以 Windows 开发体验为主）

### 2.2 安装与运行

```bash
# 安装依赖
npm install

# 启动开发环境（Electron + Renderer HMR）
npm run dev
```

### 2.3 常用命令

```bash
# 代码质量
npm run lint
npm run typecheck
npm run format

# 构建
npm run build
npm run build:win
npm run build:mac
npm run build:linux

# 版本号补丁升级
npm run bump:patch
```

### 2.4 首次排错建议

- 启动失败先看终端报错，再看 Electron 主进程日志。
- 若更新检查/网络请求超时，先到应用设置里配置代理（`app:setProxy`）。
- 若 RunJS 包安装异常，检查 NPM 安装目录是否有写权限。

---

## 3. 项目结构（当前真实结构）

```text
dev-toolbox/
├─ src/
│  ├─ main/                        # Electron 主进程
│  │  ├─ index.ts                  # 主入口（窗口、托盘、更新、IPC 注册）
│  │  └─ services/
│  │     ├─ codeRunner.ts          # RunJS 执行与资源清理
│  │     ├─ npmManager.ts          # NPM 搜索/安装/版本/类型
│  │     ├─ domainLookup.ts        # DNS/IP/端口扫描/技术栈识别
│  │     ├─ httpClient.ts          # HTTP 请求代理执行
│  │     ├─ ossManager.ts          # OSS 上传与进度事件
│  │     ├─ sqlExpert.ts           # SQL Expert 主流程
│  │     ├─ dockService.ts         # Dock 悬浮窗服务
│  │     └─ notification.ts        # 全局通知
│  ├─ preload/
│  │  ├─ index.ts                  # 安全桥接 API（window.api）
│  │  ├─ index.d.ts                # API 类型声明
│  │  └─ dock.ts                   # Dock preload
│  └─ renderer/
│     ├─ index.html
│     ├─ dock.html
│     └─ src/
│        ├─ App.vue                # 工具路由/主布局
│        ├─ main.ts
│        ├─ components/
│        ├─ views/                 # 各工具页面
│        ├─ styles/
│        └─ utils/
├─ resources/                      # 图标与静态资源
├─ scripts/                        # 脚本（如 bump-version）
├─ DEVELOPMENT.md                  # 本文档
└─ package.json
```

---

## 4. 架构说明（维护同学重点）

### 4.1 分层模型

- Renderer（Vue）：只负责 UI 与交互，不直接触达 Node 能力。
- Preload（contextBridge）：暴露白名单 API（`window.api`）。
- Main（Electron）：实现系统能力、网络、文件、数据库、AI 调用等。

### 4.2 数据流

1. 页面触发操作（例如 RunJS 执行、SQL 查询）。
2. 调用 `window.api.xxx`。
3. Preload 转发为 `ipcRenderer.invoke/send`。
4. Main 对应 `ipcMain.handle/on` 执行业务。
5. 返回结果，或通过事件流式推送进度。

### 4.3 安全边界

- `contextIsolation: true`
- `nodeIntegration: false`
- 仅通过 preload 白名单 API 访问主进程能力
- RunJS 代码在 `vm` 沙箱执行，并限制可 `require` 范围

---

## 5. 功能模块总览

### 5.1 RunJS

能力：

- JS/TS 运行（TS 经 `esbuild` 转译）
- 日志流式推送（`code:log`）
- 支持常驻服务（Express/HTTP Server）追踪与清理
- 支持按端口终止 Electron 进程（Windows）

关键点：

- 全局劫持 `http/https/net` 的 `createServer` 以追踪活跃服务。
- 每次执行前自动清理上一轮残留 Server，避免端口占用。

### 5.2 NPM 管理

能力：

- 搜索/安装/卸载/版本切换
- 安装目录切换与重置
- 本地读取 `.d.ts`，必要时自动尝试安装 `@types/*`

关键点：

- 默认安装目录：`app.getPath('userData')/npm_packages`
- 使用 `npmmirror` 源加速：`https://registry.npmmirror.com`

### 5.3 域名查询

能力：

- DNS（IPv4/IPv6）解析
- IP 地理位置、ISP、连接类型
- 反向 DNS
- HTTP 头识别服务端技术栈
- 端口扫描（优先 Nmap，失败回退 Socket）

### 5.4 HTTP 请求工具

- 在主进程发起请求，规避前端 CORS 限制
- 支持方法、Headers、Body、Timeout

### 5.5 OSS 管理

- 文件/文件夹选择
- 多文件上传与实时进度
- 任务取消

### 5.6 SQL Expert

能力：

- MySQL 测试连接/连接池
- Schema 动态加载
- 只读 SQL 执行与校验
- AI 多轮工具调用（查询/表结构/图表/导出/记忆）
- 记忆库增删改查

关键约束：

- 仅允许 `SELECT/WITH` 只读语句
- 禁止 `SELECT *`
- 禁止修改性 SQL 与系统库越权访问

### 5.7 Dock 模块

- 独立透明窗口
- 支持停靠位置、缩放、自动隐藏
- 快捷动作调用

### 5.8 应用级能力

- 自动更新（GitHub Releases）
- 托盘最小化/退出策略
- 代理设置
- 开机自启动
- 关闭行为（询问/最小化/退出）

---

## 6. IPC 接口分组（以 preload 为准）

### 6.1 window

- `window:minimize`
- `window:maximize`
- `window:close`
- `window:isMaximized`
- 事件：`window:maximized-change`

### 6.2 app

- `app:getVersion`
- `app:checkUpdate`
- `app:downloadUpdate`
- `app:installUpdate`
- `app:openFile`
- `app:setProxy`
- `app:getAutoLaunch` / `app:setAutoLaunch`
- `app:getCloseBehavior` / `app:setCloseBehavior`
- `app:closeDialogResult`
- `app:quit`
- 事件：`app:showCloseDialog` / `app:downloadProgress` / `app:updateDownloaded`

### 6.3 业务模块

- codeRunner：`code:run` / `code:stop` / `code:clean` / `code:killPort` + 事件 `code:log`
- npm：`npm:search` / `npm:install` / `npm:uninstall` / `npm:list` / `npm:versions` / `npm:changeVersion` / `npm:getDir` / `npm:setDir` / `npm:resetDir` / `npm:getTypes` / `npm:clearTypeCache`
- domain：`domain:lookup` / `domain:scanPorts`
- dock：`dock:open` / `dock:close` / `dock:isOpen` / `dock:action`
- http：`http:send`
- oss：`oss:selectFiles` / `oss:selectFolder` / `oss:upload` / `oss:cancelUpload` + 事件 `oss:uploadProgress`
- sqlExpert：`sql-expert:*`（连接测试、配置、schema、执行、AI、记忆管理等）+ 流式事件

---

## 7. 本地数据与配置落地

均位于 Electron `app.getPath('userData')` 目录下。

主要文件/目录：

- `npm-config.json`：RunJS 的 npm 安装目录配置
- `npm_packages/`：RunJS 动态安装包目录（默认）
- `sql-expert/config.json`：SQL Expert 配置
- `sql-expert/schema.txt`：最近一次 schema 缓存
- `sql-expert/memories/*.json`：按数据库 + API Key hash 隔离的记忆文件

说明：

- 不建议把包含敏感信息的 userData 直接提交到仓库。
- 调试问题时优先确认这里的配置与缓存是否符合预期。

---

## 8. 如何新增一个工具模块

以新增 `JsonTool` 为例：

1. 新建渲染页面

- 路径：`src/renderer/src/views/jsontool/JsonTool.vue`

2. 注册侧边栏入口

- 文件：`src/renderer/src/App.vue`
- 在 `tools` 增加：`{ id: 'jsontool', name: 'JSON 工具', icon: '...' }`

3. 注册异步组件映射

- 文件：`src/renderer/src/App.vue`
- 在 `toolComponents` 增加：
  - `jsontool: defineAsyncComponent(() => import('./views/jsontool/JsonTool.vue'))`

4. 若需要系统能力，新增 IPC

- Main：在 `src/main/services/` 新建服务并注册 `ipcMain.handle/on`
- Preload：在 `src/preload/index.ts` 暴露 API
- 类型：在 `src/preload/index.d.ts` 补充接口声明

5. 自测与验收

- `npm run lint`
- `npm run typecheck`
- `npm run dev` 手动验证交互与边界场景

---

## 9. 开发规范与建议

- 单向依赖：`renderer -> preload -> main`，不要反向耦合。
- IPC 命名建议：`<domain>:<action>`，例如 `oss:upload`。
- 所有新增 preload API 必须同步更新 `index.d.ts`。
- 尽量让主进程服务模块职责单一，避免大而全文件继续膨胀。
- 对外部资源调用（网络/数据库）统一加超时与错误兜底。

---

## 10. 发布说明

`electron-builder` 已配置在 `package.json#build`：

- `appId`: `com.devtoolbox.app`
- 输出目录：`dist/`
- 发布源：GitHub Releases（owner: `1847123733`, repo: `dev-toolbox`）

常见流程：

1. `npm run typecheck`
2. `npm run build:win`（或对应平台）
3. 验证安装包与自动更新链路

---

## 11. 常见问题（FAQ）

1. RunJS 安装包后 `require` 失败

- 检查包是否安装到当前配置目录。
- 尝试重启应用并重新加载类型。

2. 端口扫描慢或结果少

- 优先安装 `nmap` 提升扫描效果。
- 无 `nmap` 时会回退 Socket 扫描，仅覆盖常见端口。

3. SQL Expert 无法回答

- 先检查 DB 配置与 schema 是否加载成功。
- 再检查 AI URL/API Key/Model 是否有效。

4. 更新检查失败

- 多数为网络问题，先配置代理后重试。

---

## 12. 维护记录（文档）

- 2026-04-13：重构开发文档结构，修正旧版模块缺失与目录不一致问题，改为“快速上手 + 深度维护”双层文档。
