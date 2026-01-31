# 开发者工具箱

一个基于 Electron + Vue 3 + TypeScript 的桌面工具集合应用。

## 功能

- **RunJS** - JavaScript/TypeScript 代码运行器
  - Monaco Editor 代码编辑器
  - NPM 包管理（搜索、安装、卸载）
  - 代码执行与输出展示

- **域名查询** - 域名信息分析工具
  - DNS 解析（获取 IPv4/IPv6 地址）
  - IP 地理位置查询（国家、城市、运营商）
  - 技术栈识别（服务器、框架、CDN）

- **macOS Dock** - 仿 macOS Dock 窗口
  - 独立透明窗口，始终置顶
  - 动态应用管理（添加/删除/拖拽排序）
  - 支持自定义应用（打开网址或本地程序）
  - 鼠标悬停放大效果


## 技术栈

- Electron
- Vue 3
- TypeScript
- Vite (electron-vite)
- TailwindCSS + DaisyUI
- Monaco Editor

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建应用
npm run build:win
```

## 项目结构

```
unitMap/
├── src/
│   ├── main/           # Electron 主进程
│   ├── preload/        # 预加载脚本
│   └── renderer/       # Vue 渲染进程
├── resources/          # 应用资源
└── package.json
```
