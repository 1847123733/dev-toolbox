# 开发者工具箱（Dev Toolbox）

一个基于 `Electron + Vue 3 + TypeScript` 的桌面开发工具集合，面向日常开发与运维场景。

## 项目简介

该项目将多种高频能力集中在一个客户端中，当前包含：

- 代码运行与调试（RunJS）
- NPM 包管理与类型提示
- 域名/IP 查询与端口扫描
- HTTP 请求调试
- 阿里云 OSS 上传管理
- MySQL + AI 的 SQL 分析助手（SQL Expert）
- 仿 macOS Dock 的悬浮快捷工具栏

## 功能模块

### 1. RunJS（代码运行器）

- 支持 JavaScript / TypeScript 运行
- Monaco Editor 编辑器
- 实时输出日志（stdout/stderr）
- 支持常驻服务代码（如 Express）并可清理资源
- 支持按端口终止 Electron 相关进程

### 2. NPM 包管理

- 搜索、安装、卸载、切换版本
- 包安装目录可配置
- 读取已安装包的类型定义（`.d.ts`）
- 自动尝试补全 `@types/*`

### 3. 域名/IP 查询

- DNS 解析（IPv4 / IPv6）
- IP 地理位置与运营商信息
- 反向 DNS 查询
- HTTP 头分析识别技术栈（Server / Framework / CDN）
- 端口扫描（优先使用 `nmap`，无 `nmap` 时回退 Socket 扫描）

### 4. HTTP 请求工具

- 支持常见 HTTP 方法
- 可自定义 Header / Body / Timeout
- 在 Electron 主进程发请求，规避前端 CORS 限制

### 5. OSS 管理

- 阿里云 OSS 文件/文件夹上传
- 多文件上传进度跟踪
- 支持上传任务取消

### 6. SQL Expert（分析专家）

- MySQL 连接测试与配置持久化
- 动态读取表结构（Schema）
- 只读 SQL 校验与执行（限制为 `SELECT/WITH`）
- 接入大模型进行多轮工具调用分析
- 支持图表渲染和 CSV 导出

### 7. Dock 模块

- 独立透明悬浮窗口，始终置顶
- 支持底部/左侧/右侧停靠
- 自定义应用项、拖拽排序、快捷动作

### 8. 应用级能力

- 自动更新（GitHub Releases）
- 系统托盘最小化
- 关闭行为可配置（询问/最小化/退出）
- 代理配置
- 开机自启动

## 技术栈

- Electron 35
- Vue 3
- TypeScript
- electron-vite / Vite
- TailwindCSS + DaisyUI
- Monaco Editor
- mysql2 / OpenAI SDK / ali-oss / axios

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发环境
npm run dev
```

## 常用命令

```bash
# 代码检查
npm run lint
npm run typecheck

# 格式化
npm run format

# 构建
npm run build
npm run build:win
npm run build:mac
npm run build:linux

# 版本号补丁升级（脚本）
npm run bump:patch
```

## 配置说明

### 1. 代理

在应用「设置」中可配置代理地址（例如 `http://127.0.0.1:7890`），用于网络请求与更新检查。

### 2. SQL Expert

需要在应用内配置：

- MySQL 连接信息（host / port / user / password / database）
- AI 服务参数（url / apiKey / model）

相关配置与缓存会保存在 Electron 用户目录中（`app.getPath('userData')`）。

### 3. OSS

使用前需准备：

- `accessKeyId`
- `accessKeySecret`
- `endpoint`
- `bucket`

## 项目结构

```text
dev-toolbox/
├── src/
│   ├── main/                 # Electron 主进程与 IPC 服务
│   │   └── services/         # codeRunner / npmManager / domainLookup / oss / http / sqlExpert / dock
│   ├── preload/              # 安全桥接 API
│   └── renderer/             # Vue 渲染进程
├── scripts/                  # 版本等脚本（如 bump-version.js）
├── resources/                # 图标与资源文件
├── DEVELOPMENT.md            # 详细开发文档
└── package.json
```

## 发布

项目已配置 `electron-builder`，默认输出目录为 `dist/`，并配置 GitHub 发布信息：

- owner: `1847123733`
- repo: `dev-toolbox`

打包后可通过应用内更新逻辑进行版本检测与下载。
