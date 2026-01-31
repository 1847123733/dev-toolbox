<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const selectedAction = ref<'minimize' | 'quit'>('minimize')
const remember = ref(false)

const handleConfirm = () => {
  window.api.app.sendCloseDialogResult({
    action: selectedAction.value,
    remember: remember.value
  })
  emit('close')
}

const handleCancel = () => {
  emit('close')
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div
      class="bg-[var(--color-surface)] rounded-2xl shadow-2xl border border-[var(--color-border)] w-[380px] overflow-hidden"
    >
      <!-- 标题栏 -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h3 class="text-base font-semibold text-[var(--color-text)]">关闭提示</h3>
        <button
          @click="handleCancel"
          class="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)] transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 内容区 -->
      <div class="px-5 py-5">
        <!-- 选项列表 -->
        <div class="space-y-3">
          <label
            class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
            :class="
              selectedAction === 'minimize'
                ? 'bg-indigo-500/10 border border-indigo-500/30'
                : 'hover:bg-[var(--color-surface-light)] border border-transparent'
            "
          >
            <input
              type="radio"
              v-model="selectedAction"
              value="minimize"
              class="w-4 h-4 accent-indigo-500"
            />
            <span class="text-sm text-[var(--color-text)]">最小化到系统托盘</span>
          </label>

          <label
            class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
            :class="
              selectedAction === 'quit'
                ? 'bg-indigo-500/10 border border-indigo-500/30'
                : 'hover:bg-[var(--color-surface-light)] border border-transparent'
            "
          >
            <input
              type="radio"
              v-model="selectedAction"
              value="quit"
              class="w-4 h-4 accent-indigo-500"
            />
            <span class="text-sm text-[var(--color-text)]">退出 Dev Toolbox</span>
          </label>
        </div>

        <!-- 不再提醒 -->
        <label class="flex items-center gap-2 mt-5 cursor-pointer">
          <input
            type="checkbox"
            v-model="remember"
            class="w-4 h-4 rounded border-[var(--color-border)] accent-indigo-500"
          />
          <span class="text-xs text-[var(--color-text-muted)]">不再提醒</span>
        </label>
      </div>

      <!-- 底部按钮 -->
      <div class="flex justify-end gap-3 px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-light)]">
        <button
          @click="handleConfirm"
          class="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          确定
        </button>
      </div>
    </div>
  </div>
</template>
