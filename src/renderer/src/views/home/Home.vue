<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const currentTime = ref(new Date())

const greeting = computed(() => {
  const hour = currentTime.value.getHours()
  if (hour < 5) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 13) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const timeDisplay = computed(() => {
  return currentTime.value.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
})

const dateDisplay = computed(() => {
  return currentTime.value.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
})

const isToDo = ref(false)

const inquiryMode = () => {
  requestAnimationFrame(() => {
    currentTime.value = new Date()
    if (isToDo.value) {
      inquiryMode()
    }
  })
}

onMounted(() => {
  isToDo.value = true
  inquiryMode()
})

onUnmounted(() => {
  isToDo.value = false
})
</script>

<template>
  <div class="home">
    <!-- Background effects -->
    <div class="home-bg">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
      <div class="grid-overlay"></div>
    </div>

    <!-- Content -->
    <div class="home-content">
      <h1 class="greeting animate-in">
        {{ greeting }}，开发者
      </h1>

      <div class="time-block animate-in delay-1">
        <div class="time-display">{{ timeDisplay }}</div>
      </div>

      <p class="date-display animate-in delay-2">{{ dateDisplay }}</p>
    </div>
  </div>
</template>

<style scoped>
.home {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  background: var(--color-surface);
}

.home-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  animation: float 10s ease-in-out infinite;
}

.orb-1 {
  width: 500px;
  height: 500px;
  top: -15%;
  left: -5%;
  background: rgba(129, 140, 248, 0.12);
}

.orb-2 {
  width: 400px;
  height: 400px;
  bottom: -15%;
  right: -5%;
  background: rgba(167, 139, 250, 0.1);
  animation-delay: 3s;
  animation-direction: reverse;
}

.orb-3 {
  width: 300px;
  height: 300px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(34, 211, 238, 0.06);
  animation-delay: 5s;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at center, black 0%, transparent 75%);
}

.home-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.greeting {
  font-size: clamp(28px, 5vw, 52px);
  font-weight: 700;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 50%, #c7d2fe 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
}

.time-block {
  position: relative;
  padding: 12px 24px;
  border-radius: var(--radius-xl);
}

.time-display {
  font-size: clamp(40px, 6vw, 64px);
  font-family: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', monospace;
  font-weight: 300;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.95);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.date-display {
  font-size: 14px;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}

/* Animations */
.animate-in {
  animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
}

.delay-1 { animation-delay: 0.15s; }
.delay-2 { animation-delay: 0.3s; }

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1) translate(0, 0);
  }
  33% {
    opacity: 0.8;
    transform: scale(1.05) translate(10px, -10px);
  }
  66% {
    opacity: 0.5;
    transform: scale(0.95) translate(-10px, 10px);
  }
}
</style>
