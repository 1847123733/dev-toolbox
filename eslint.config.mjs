import { defineConfig, globalIgnores } from 'eslint/config'
import { configs } from '@electron-toolkit/eslint-config-ts'
import eslintPluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

export default defineConfig([
  ...configs.recommended,
  globalIgnores(['**/node_modules', '**/out', '**/dist']),
  {
    files: ['**/*.vue'],
    plugins: {
      vue: eslintPluginVue
    },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: '@typescript-eslint/parser',
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      ...eslintPluginVue.configs['vue3-recommended'].rules,
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off'
    }
  }
])
