<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

type NotificationType = 'info' | 'success' | 'warning' | 'error'

interface Notification {
  id: number
  message: string
  type: NotificationType
  copied?: boolean
}

const notifications = ref<Notification[]>([])
let notificationId = 0

function addNotification(message: string, type: NotificationType) {
  const id = ++notificationId
  notifications.value.push({ id, message, type, copied: false })

  setTimeout(() => {
    removeNotification(id)
  }, 5000)
}

function removeNotification(id: number) {
  const index = notifications.value.findIndex((n) => n.id === id)
  if (index !== -1) {
    notifications.value.splice(index, 1)
  }
}

async function copyNotification(notification: Notification, event: Event) {
  event.stopPropagation()
  try {
    await navigator.clipboard.writeText(notification.message)
    notification.copied = true
    setTimeout(() => {
      notification.copied = false
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

function getIcon(type: NotificationType) {
  switch (type) {
    case 'success': return '✓'
    case 'error': return '✕'
    case 'warning': return '⚠'
    default: return 'ℹ'
  }
}

onMounted(() => {
  window.api.notification.onNotify((message, type) => {
    addNotification(message, type)
  })
})

onUnmounted(() => {
  window.api.notification.removeListener()
})

defineExpose({
  addNotification
})
</script>

<template>
  <div class="notification-container">
    <TransitionGroup name="notification">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="notification-item"
        :class="notification.type"
        @click="removeNotification(notification.id)"
      >
        <span class="notif-icon">{{ getIcon(notification.type) }}</span>
        <span class="notif-message">{{ notification.message }}</span>
        <button
          class="notif-action"
          :title="notification.copied ? '已复制' : '复制'"
          @click="copyNotification(notification, $event)"
        >
          <span v-if="notification.copied">✓</span>
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="notif-action" @click.stop="removeNotification(notification.id)" aria-label="关闭">✕</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.notification-container {
  position: fixed;
  top: 56px;
  right: 16px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 360px;
}

.notification-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid;
  backdrop-filter: blur(12px);
  cursor: pointer;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
  box-shadow: var(--shadow-card);
}

.notification-item:hover {
  transform: scale(1.01);
}

.notification-item.info {
  background: rgba(129, 140, 248, 0.9);
  border-color: rgba(129, 140, 248, 0.6);
}

.notification-item.success {
  background: rgba(34, 197, 94, 0.9);
  border-color: rgba(34, 197, 94, 0.6);
}

.notification-item.warning {
  background: rgba(234, 179, 8, 0.9);
  border-color: rgba(234, 179, 8, 0.6);
}

.notification-item.error {
  background: rgba(239, 68, 68, 0.9);
  border-color: rgba(239, 68, 68, 0.6);
}

.notif-icon {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.notif-message {
  flex: 1;
  font-size: 13px;
  color: white;
  line-height: 1.4;
}

.notif-action {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 12px;
  transition: color var(--transition-fast);
}

.notif-action:hover {
  color: white;
}

.notif-action svg {
  width: 14px;
  height: 14px;
}

/* Transitions */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}
</style>
