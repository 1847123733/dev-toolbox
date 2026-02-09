<script setup lang="ts">
import { ref, computed } from 'vue'
import type { HttpRequest, HttpMethod, BodyType } from '../types'
import KeyValueEditor from './KeyValueEditor.vue'

const props = defineProps<{
  modelValue: HttpRequest
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: HttpRequest]
  send: []
}>()

const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
const activeTab = ref<'params' | 'headers' | 'body'>('params')
const showMethodDropdown = ref(false)

const methodColors: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  DELETE: 'text-red-400',
  PATCH: 'text-purple-400',
  HEAD: 'text-cyan-400',
  OPTIONS: 'text-gray-400'
}

const hasBody = computed(() => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(props.modelValue.method))

function update(partial: Partial<HttpRequest>) {
  emit('update:modelValue', { ...props.modelValue, ...partial })
}

function selectMethod(method: HttpMethod) {
  update({ method })
  showMethodDropdown.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !props.loading) {
    emit('send')
  }
}

function formatJson() {
  try {
    const parsed = JSON.parse(props.modelValue.body)
    update({ body: JSON.stringify(parsed, null, 2) })
  } catch {
    // JSON 格式不正确，忽略
  }
}
</script>

<template>
  <div class="request-panel flex flex-col h-full">
    <!-- URL 栏 -->
    <div class="flex items-center gap-2 p-3 border-b border-[var(--color-border)]">
      <!-- 方法选择 -->
      <div class="relative">
        <button
          @click="showMethodDropdown = !showMethodDropdown"
          class="flex items-center gap-1 px-3 py-2 text-sm font-bold rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-indigo-500/50 transition-colors min-w-[90px]"
          :class="methodColors[modelValue.method]"
        >
          {{ modelValue.method }}
          <svg class="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div
          v-if="showMethodDropdown"
          class="absolute top-full left-0 mt-1 z-50 bg-[var(--color-surface-light)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden"
        >
          <button
            v-for="m in methods"
            :key="m"
            @click="selectMethod(m)"
            class="block w-full text-left px-4 py-1.5 text-sm font-bold hover:bg-[var(--color-surface-lighter)] transition-colors"
            :class="[methodColors[m], m === modelValue.method ? 'bg-[var(--color-surface-lighter)]' : '']"
          >
            {{ m }}
          </button>
        </div>
      </div>

      <!-- URL 输入 -->
      <input
        :value="modelValue.url"
        @input="update({ url: ($event.target as HTMLInputElement).value })"
        @keydown="handleKeydown"
        placeholder="输入请求 URL，例如 https://api.example.com/users"
        class="flex-1 px-3 py-2 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all font-mono"
      />

      <!-- 发送按钮 -->
      <button
        @click="emit('send')"
        :disabled="!modelValue.url.trim() || loading"
        class="px-5 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
      >
        <svg v-if="loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
        <span>{{ loading ? '发送中' : '发送' }}</span>
      </button>
    </div>

    <!-- Tab 栏 -->
    <div class="flex items-center border-b border-[var(--color-border)] px-3">
      <button
        v-for="tab in (['params', 'headers', 'body'] as const)"
        :key="tab"
        @click="activeTab = tab"
        class="px-4 py-2 text-xs font-medium border-b-2 transition-colors"
        :class="activeTab === tab
          ? 'border-indigo-500 text-indigo-400'
          : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'"
      >
        {{ tab === 'params' ? 'Params' : tab === 'headers' ? 'Headers' : 'Body' }}
        <span v-if="tab === 'params' && modelValue.queryParams.filter(p => p.enabled && p.key).length > 0"
          class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-indigo-500/20 text-indigo-400">
          {{ modelValue.queryParams.filter(p => p.enabled && p.key).length }}
        </span>
        <span v-if="tab === 'headers' && modelValue.headers.filter(h => h.enabled && h.key).length > 0"
          class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-indigo-500/20 text-indigo-400">
          {{ modelValue.headers.filter(h => h.enabled && h.key).length }}
        </span>
      </button>
    </div>

    <!-- Tab 内容 -->
    <div class="flex-1 overflow-auto p-3">
      <!-- Params -->
      <div v-if="activeTab === 'params'">
        <KeyValueEditor
          :modelValue="modelValue.queryParams"
          @update:modelValue="update({ queryParams: $event })"
          keyPlaceholder="参数名"
          valuePlaceholder="参数值"
        />
      </div>

      <!-- Headers -->
      <div v-if="activeTab === 'headers'">
        <KeyValueEditor
          :modelValue="modelValue.headers"
          @update:modelValue="update({ headers: $event })"
          keyPlaceholder="Header"
          valuePlaceholder="Value"
        />
      </div>

      <!-- Body -->
      <div v-if="activeTab === 'body'">
        <div v-if="!hasBody" class="text-center py-8 text-[var(--color-text-muted)] text-sm">
          {{ modelValue.method }} 请求不需要请求体
        </div>
        <div v-else>
          <!-- Body 类型选择 -->
          <div class="flex items-center gap-3 mb-3">
            <label
              v-for="bt in (['none', 'json', 'form', 'text'] as BodyType[])"
              :key="bt"
              class="flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <input
                type="radio"
                :value="bt"
                :checked="modelValue.bodyType === bt"
                @change="update({ bodyType: bt })"
                class="accent-indigo-500"
              />
              <span :class="modelValue.bodyType === bt ? 'text-indigo-400' : 'text-[var(--color-text-muted)]'">
                {{ bt === 'none' ? 'None' : bt === 'json' ? 'JSON' : bt === 'form' ? 'Form' : 'Text' }}
              </span>
            </label>
          </div>

          <!-- JSON Body -->
          <div v-if="modelValue.bodyType === 'json'" class="relative">
            <textarea
              :value="modelValue.body"
              @input="update({ body: ($event.target as HTMLTextAreaElement).value })"
              placeholder='{"key": "value"}'
              class="w-full h-40 px-3 py-2 text-xs font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-indigo-500/50 resize-y"
            ></textarea>
            <button
              @click="formatJson"
              class="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-[var(--color-surface-lighter)] text-[var(--color-text-muted)] hover:text-indigo-400 transition-colors"
              title="格式化 JSON"
            >
              格式化
            </button>
          </div>

          <!-- Form Data -->
          <div v-if="modelValue.bodyType === 'form'">
            <KeyValueEditor
              :modelValue="modelValue.formData"
              @update:modelValue="update({ formData: $event })"
              keyPlaceholder="字段名"
              valuePlaceholder="字段值"
            />
          </div>

          <!-- Text Body -->
          <div v-if="modelValue.bodyType === 'text'">
            <textarea
              :value="modelValue.body"
              @input="update({ body: ($event.target as HTMLTextAreaElement).value })"
              placeholder="输入请求体内容..."
              class="w-full h-40 px-3 py-2 text-xs font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-indigo-500/50 resize-y"
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
