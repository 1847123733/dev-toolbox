<script setup lang="ts">
import type { KeyValuePair } from '../types'

const props = defineProps<{
  modelValue: KeyValuePair[]
  keyPlaceholder?: string
  valuePlaceholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: KeyValuePair[]]
}>()

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function updateItem(index: number, field: keyof KeyValuePair, value: string | boolean) {
  const items = [...props.modelValue]
  items[index] = { ...items[index], [field]: value }
  emit('update:modelValue', items)
}

function removeItem(index: number) {
  const items = props.modelValue.filter((_, i) => i !== index)
  emit('update:modelValue', items)
}

function addItem() {
  emit('update:modelValue', [
    ...props.modelValue,
    { id: genId(), key: '', value: '', enabled: true }
  ])
}
</script>

<template>
  <div class="kv-editor">
    <!-- 表头 -->
    <div class="grid grid-cols-[32px_1fr_1fr_32px] gap-1 mb-1 px-1">
      <span></span>
      <span class="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{{ keyPlaceholder || 'Key' }}</span>
      <span class="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{{ valuePlaceholder || 'Value' }}</span>
      <span></span>
    </div>

    <!-- 列表 -->
    <div class="space-y-1">
      <div
        v-for="(item, index) in modelValue"
        :key="item.id"
        class="grid grid-cols-[32px_1fr_1fr_32px] gap-1 items-center group"
      >
        <!-- 启用复选框 -->
        <label class="flex items-center justify-center cursor-pointer">
          <input
            type="checkbox"
            :checked="item.enabled"
            @change="updateItem(index, 'enabled', !item.enabled)"
            class="w-3.5 h-3.5 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-indigo-500"
          />
        </label>

        <!-- Key -->
        <input
          :value="item.key"
          @input="updateItem(index, 'key', ($event.target as HTMLInputElement).value)"
          :placeholder="keyPlaceholder || 'Key'"
          class="px-2 py-1.5 text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-indigo-500/50 transition-colors"
          :class="{ 'opacity-50': !item.enabled }"
        />

        <!-- Value -->
        <input
          :value="item.value"
          @input="updateItem(index, 'value', ($event.target as HTMLInputElement).value)"
          :placeholder="valuePlaceholder || 'Value'"
          class="px-2 py-1.5 text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-indigo-500/50 transition-colors"
          :class="{ 'opacity-50': !item.enabled }"
        />

        <!-- 删除按钮 -->
        <button
          @click="removeItem(index)"
          class="flex items-center justify-center w-6 h-6 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 添加按钮 -->
    <button
      @click="addItem"
      class="mt-2 flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-indigo-400 transition-colors px-1"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      <span>添加</span>
    </button>
  </div>
</template>
