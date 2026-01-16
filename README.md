# 开发者工具箱

一个基于 Electron + Vue 3 + TypeScript 的桌面工具集合应用。

## 功能

- **RunJS** - JavaScript/TypeScript 代码运行器
  - Monaco Editor 代码编辑器
  - NPM 包管理（搜索、安装、卸载）
  - 代码执行与输出展示

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
