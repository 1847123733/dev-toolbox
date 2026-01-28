<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// 通知类型
type NotificationType = 'info' | 'success' | 'warning' | 'error'

interface Notification {
  id: number
  message: string
  type: NotificationType
  copied?: boolean
}

const notifications = ref<Notification[]>([])
let notificationId = 0

// 添加通知
function addNotification(message: string, type: NotificationType) {
  const id = ++notificationId
  notifications.value.push({ id, message, type, copied: false })

  // 5秒后自动移除
  setTimeout(() => {
    removeNotification(id)
  }, 5000)
}

// 移除通知
function removeNotification(id: number) {
  const index = notifications.value.findIndex((n) => n.id === id)
  if (index !== -1) {
    notifications.value.splice(index, 1)
  }
}

// 复制通知内容
async function copyNotification(notification: Notification, event: Event) {
  event.stopPropagation()
  try {
    await navigator.clipboard.writeText(notification.message)
    notification.copied = true
    // 2秒后重置复制状态
    setTimeout(() => {
      notification.copied = false
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

// 获取通知图标
function getIcon(type: NotificationType) {
  switch (type) {
    case 'success':
      return '✓'
    case 'error':
      return '✕'
    case 'warning':
      return '⚠'
    default:
      return 'ℹ'
  }
}

// 获取通知样式类
function getTypeClass(type: NotificationType) {
  switch (type) {
    case 'success':
      return 'bg-green-500/90 border-green-400'
    case 'error':
      return 'bg-red-500/90 border-red-400'
    case 'warning':
      return 'bg-yellow-500/90 border-yellow-400'
    default:
      return 'bg-indigo-500/90 border-indigo-400'
  }
}

onMounted(() => {
  // 监听主进程通知
  window.api.notification.onNotify((message, type) => {
    addNotification(message, type)
  })
})

onUnmounted(() => {
  window.api.notification.removeListener()
})

// 暴露方法供外部使用
defineExpose({
  addNotification
})
</script>

<template>
  <div class="notification-container fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm">
    <TransitionGroup name="notification">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="notification-item p-3 rounded-xl border shadow-lg backdrop-blur-sm flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02]"
        :class="getTypeClass(notification.type)"
        @click="removeNotification(notification.id)"
      >
        <span
          class="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 text-white text-sm font-bold"
        >
          {{ getIcon(notification.type) }}
        </span>
        <span class="text-white text-sm flex-1">{{ notification.message }}</span>
        <!-- 复制按钮 -->
        <button
          class="w-5 h-5 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          :title="notification.copied ? '已复制' : '复制'"
          @click="copyNotification(notification, $event)"
        >
          <span v-if="notification.copied">✓</span>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <!-- 关闭按钮 -->
        <button class="w-5 h-5 flex items-center justify-center text-white/70 hover:text-white">
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
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
