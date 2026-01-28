<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// --- State & Logic ---
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

const isToDo = ref(false)
// 问询模式更新时间
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
  <div class="home-box relative overflow-hidden">
    <!-- 背景装饰 -->
    <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
      <div
        class="absolute top-[-20%] left-[-10%] w-150 h-150 rounded-full bg-primary/20 blur-[120px] animate-pulse-slow"
      ></div>
      <div
        class="absolute bottom-[-20%] right-[-10%] w-125 h-125 rounded-full bg-secondary/20 blur-[100px] animate-pulse-slow animation-delay-2000"
      ></div>
      <div class="grid-overlay absolute inset-0 opacity-20"></div>
    </div>

    <!-- 内容区域 -->
    <div class="relative z-10 flex flex-col items-center gap-6">
      <h1 class="text-4xl lg:text-6xl font-bold tracking-tight animate-fade-in-up">
        <span
          class="bg-clip-text text-transparent bg-linear-to-r from-white via-indigo-100 to-indigo-200 drop-shadow-lg"
        >
          {{ greeting }}，开发者
        </span>
      </h1>

      <div class="time-container relative p-4 group animate-fade-in-up animation-delay-200">
        <div
          class="absolute inset-0 bg-white/5 rounded-2xl blur-lg group-hover:bg-white/10 transition-colors duration-500 opacity-0 group-hover:opacity-100"
        ></div>
        <div
          class="relative text-5xl lg:text-6xl font-mono font-light text-white tracking-widest leading-none drop-shadow-2xl font-variant-numeric-tabular"
        >
          {{ timeDisplay }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-box {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: radial-gradient(
    circle at center,
    var(--color-surface-light) 0%,
    var(--color-surface) 100%
  );
}

.grid-overlay {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(circle at center, black 0%, transparent 80%);
}

/* 缓慢脉冲动画 */
@keyframes pulse-slow {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1);
  }
}

.animate-pulse-slow {
  animation: pulse-slow 8s ease-in-out infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

/* 淡入上浮动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  opacity: 0; /* 初始隐藏 */
}

.animation-delay-200 {
  animation-delay: 0.2s;
}

.font-variant-numeric-tabular {
  font-variant-numeric: tabular-nums;
}
</style>
