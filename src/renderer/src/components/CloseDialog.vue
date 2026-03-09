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
  <div class="dialog-overlay" @click.self="handleCancel">
    <div class="dialog-box">
      <div class="dialog-header">
        <h3 class="dialog-title">关闭提示</h3>
        <button @click="handleCancel" class="dialog-close" aria-label="关闭">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="dialog-body">
        <div class="option-list">
          <label class="option-item" :class="{ active: selectedAction === 'minimize' }">
            <input type="radio" v-model="selectedAction" value="minimize" class="option-radio" />
            <span class="option-text">最小化到系统托盘</span>
          </label>
          <label class="option-item" :class="{ active: selectedAction === 'quit' }">
            <input type="radio" v-model="selectedAction" value="quit" class="option-radio" />
            <span class="option-text">退出 Dev Toolbox</span>
          </label>
        </div>

        <label class="remember-check">
          <input type="checkbox" v-model="remember" class="check-input" />
          <span class="check-text">不再提醒</span>
        </label>
      </div>

      <div class="dialog-footer">
        <button @click="handleConfirm" class="confirm-btn">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.dialog-box {
  width: 380px;
  border-radius: var(--radius-lg);
  background: var(--color-surface-light);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-elevated);
  overflow: hidden;
  animation: dialogIn 0.2s ease-out;
}

@keyframes dialogIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.dialog-close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.dialog-close svg {
  width: 14px;
  height: 14px;
  color: var(--color-text-muted);
}

.dialog-close:hover {
  background: rgba(255, 255, 255, 0.06);
}

.dialog-body {
  padding: 20px;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.option-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.option-item.active {
  background: rgba(129, 140, 248, 0.08);
  border-color: rgba(129, 140, 248, 0.25);
}

.option-radio {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.option-text {
  font-size: 14px;
  color: var(--color-text);
}

.remember-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  cursor: pointer;
}

.check-input {
  width: 15px;
  height: 15px;
  accent-color: var(--color-primary);
}

.check-text {
  font-size: 12px;
  color: var(--color-text-muted);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border);
  background: rgba(15, 17, 23, 0.3);
}

.confirm-btn {
  padding: 8px 24px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--color-primary);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.confirm-btn:hover {
  background: var(--color-primary-dark);
}
</style>
