/**
 * Monaco Editor 代码片段和补全提供者
 * 从 CodeEditor.vue 提取，集中管理代码片段定义
 */

import { monaco } from './monacoSetup'

// 通用代码片段定义
export const commonSnippets = [
  { label: 'log', insertText: 'console.log($1);', detail: 'console.log 输出' },
  { label: 'logt', insertText: "console.log('$1:', $1);", detail: 'console.log 带标签' },
  { label: 'func', insertText: 'function ${1:name}($2) {\n  $3\n}', detail: '函数定义' },
  { label: 'arrow', insertText: 'const ${1:name} = ($2) => {\n  $3\n};', detail: '箭头函数' },
  { label: 'arrowShort', insertText: 'const ${1:name} = ($2) => $3;', detail: '箭头函数（单行）' },
  { label: 'for', insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n  $3\n}', detail: 'for 循环' },
  { label: 'forof', insertText: 'for (const ${1:item} of ${2:items}) {\n  $3\n}', detail: 'for...of 循环' },
  { label: 'forin', insertText: 'for (const ${1:key} in ${2:obj}) {\n  $3\n}', detail: 'for...in 循环' },
  { label: 'foreach', insertText: '${1:array}.forEach((${2:item}) => {\n  $3\n});', detail: 'forEach 循环' },
  { label: 'map', insertText: '${1:array}.map((${2:item}) => {\n  return $3;\n});', detail: 'map 映射' },
  { label: 'filter', insertText: '${1:array}.filter((${2:item}) => {\n  return $3;\n});', detail: 'filter 过滤' },
  { label: 'reduce', insertText: '${1:array}.reduce((${2:acc}, ${3:item}) => {\n  return $4;\n}, ${5:initialValue});', detail: 'reduce 归约' },
  { label: 'find', insertText: '${1:array}.find((${2:item}) => $3);', detail: 'find 查找' },
  { label: 'some', insertText: '${1:array}.some((${2:item}) => $3);', detail: 'some 判断' },
  { label: 'every', insertText: '${1:array}.every((${2:item}) => $3);', detail: 'every 判断' },
  { label: 'try', insertText: 'try {\n  $1\n} catch (error) {\n  console.error(error);\n}', detail: 'try-catch' },
  { label: 'tryf', insertText: 'try {\n  $1\n} catch (error) {\n  console.error(error);\n} finally {\n  $2\n}', detail: 'try-catch-finally' },
  { label: 'async', insertText: 'async function ${1:name}($2) {\n  $3\n}', detail: '异步函数' },
  { label: 'asyncArrow', insertText: 'const ${1:name} = async ($2) => {\n  $3\n};', detail: '异步箭头函数' },
  { label: 'await', insertText: 'const ${1:result} = await ${2:promise};', detail: 'await 表达式' },
  { label: 'promise', insertText: 'new Promise((resolve, reject) => {\n  $1\n});', detail: 'Promise 创建' },
  { label: 'require', insertText: "const ${1:module} = require('${2:package}');", detail: 'require 导入' },
  { label: 'import', insertText: "import ${1:module} from '${2:package}';", detail: 'import 导入' },
  { label: 'importd', insertText: "import { $1 } from '${2:package}';", detail: 'import 解构' },
  { label: 'class', insertText: 'class ${1:Name} {\n  constructor($2) {\n    $3\n  }\n}', detail: '类定义' },
  { label: 'timeout', insertText: 'setTimeout(() => {\n  $1\n}, ${2:1000});', detail: 'setTimeout' },
  { label: 'interval', insertText: 'setInterval(() => {\n  $1\n}, ${2:1000});', detail: 'setInterval' },
  { label: 'iife', insertText: '(function() {\n  $1\n})();', detail: '立即执行函数' },
  { label: 'iifeAsync', insertText: '(async () => {\n  $1\n})();', detail: '异步立即执行函数' },
  { label: 'destruct', insertText: 'const { $1 } = ${2:object};', detail: '对象解构' },
  { label: 'destructArr', insertText: 'const [$1] = ${2:array};', detail: '数组解构' },
  { label: 'spread', insertText: '...$1', detail: '展开运算符' },
  { label: 'ternary', insertText: '${1:condition} ? ${2:true} : ${3:false}', detail: '三元运算符' }
]

// TypeScript 专用代码片段
export const tsSnippets = [
  { label: 'interface', insertText: 'interface ${1:Name} {\n  $2\n}', detail: '接口定义' },
  { label: 'type', insertText: 'type ${1:Name} = $2;', detail: '类型别名' },
  { label: 'typeUnion', insertText: "type ${1:Name} = ${2:Type1} | ${3:Type2};", detail: '联合类型' },
  { label: 'typeIntersect', insertText: "type ${1:Name} = ${2:Type1} & ${3:Type2};", detail: '交叉类型' },
  { label: 'enum', insertText: 'enum ${1:Name} {\n  $2\n}', detail: '枚举定义' },
  { label: 'generic', insertText: 'function ${1:name}<T>($2: T): T {\n  return $3;\n}', detail: '泛型函数' },
  { label: 'readonly', insertText: 'readonly ${1:property}: ${2:Type};', detail: '只读属性' }
]

// NPM 包补全列表
export const npmPackages = [
  { label: 'lodash', detail: '实用工具库', doc: '常用的 JavaScript 工具函数库，提供数组、对象、字符串操作等功能' },
  { label: 'dayjs', detail: '日期处理库', doc: '轻量级日期处理库，API 类似 Moment.js' },
  { label: 'uuid', detail: 'UUID 生成器', doc: '生成 RFC 4122 标准的 UUID' },
  { label: 'axios', detail: 'HTTP 客户端', doc: '基于 Promise 的 HTTP 客户端，支持浏览器和 Node.js' },
  { label: 'express', detail: 'Web 框架', doc: '快速、开放、极简的 Web 开发框架' },
  { label: 'moment', detail: '日期处理库', doc: '功能全面的日期处理库' },
  { label: 'chalk', detail: '终端样式', doc: '美化终端输出，添加颜色和样式' },
  { label: 'fs-extra', detail: '文件系统扩展', doc: 'Node.js fs 模块的增强版本' }
]

/**
 * 注册代码片段补全提供者
 * 为 JavaScript 和 TypeScript 语言注册补全提供者
 */
export function registerSnippetProviders(): void {
  // JavaScript 补全
  monaco.languages.registerCompletionItemProvider('javascript', {
    triggerCharacters: ['.', "'", '"'],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }

      // 检查是否在 require/import 语句中
      const lineContent = model.getLineContent(position.lineNumber)
      const isInRequire = /require\s*\(\s*['"]/.test(lineContent) || /from\s*['"]/.test(lineContent)

      const suggestions: monaco.languages.CompletionItem[] = []

      if (isInRequire) {
        // 包名补全
        npmPackages.forEach((p) => {
          suggestions.push({
            label: p.label,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: p.label,
            detail: p.detail,
            documentation: p.doc,
            range
          })
        })
      } else {
        // 代码片段
        commonSnippets.forEach((s) => {
          suggestions.push({
            label: s.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: s.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: s.detail,
            range
          })
        })
      }

      return { suggestions }
    }
  })

  // TypeScript 补全
  monaco.languages.registerCompletionItemProvider('typescript', {
    triggerCharacters: ['.', "'", '"'],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }

      const lineContent = model.getLineContent(position.lineNumber)
      const isInImport = /from\s*['"]/.test(lineContent) || /import\s*['"]/.test(lineContent)

      const suggestions: monaco.languages.CompletionItem[] = []

      if (isInImport) {
        npmPackages.forEach((p) => {
          suggestions.push({
            label: p.label,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: p.label,
            detail: p.detail,
            documentation: p.doc,
            range
          })
        })
      } else {
        // TypeScript 专用片段 + 通用片段
        const allSnippets = [...commonSnippets, ...tsSnippets]

        allSnippets.forEach((s) => {
          suggestions.push({
            label: s.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: s.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: s.detail,
            range
          })
        })
      }

      return { suggestions }
    }
  })
}
