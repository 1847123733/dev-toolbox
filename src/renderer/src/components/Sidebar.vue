<script setup lang="ts">
interface Tool {
  id: string
  name: string
  icon: string
}

defineProps<{
  tools: Tool[]
  activeTool: string
}>()

const emit = defineEmits<{
  select: [toolId: string]
}>()

// 图标映射
const getIcon = (iconName: string) => {
  const icons: Record<string, string> = {
    code: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />`
  }
  return icons[iconName] || icons.code
}
</script>

<template>
  <aside class="sidebar w-16 bg-[var(--color-surface-light)] border-r border-[var(--color-border)] flex flex-col items-center py-4">
    <!-- Logo 区域 -->
    <div class="logo-area mb-6">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
        <span class="text-white font-bold text-lg">U</span>
      </div>
      <span class="text-[10px] text-[var(--color-text-muted)] mt-1 block text-center">MyUnit</span>
    </div>

    <!-- 分隔线 -->
    <div class="w-8 h-px bg-[var(--color-border)] mb-4"></div>

    <!-- 工具列表 -->
    <nav class="tools-nav flex-1 w-full px-2 space-y-2">
      <button
        v-for="tool in tools"
        :key="tool.id"
        @click="emit('select', tool.id)"
        class="tool-btn w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200"
        :class="[
          activeTool === tool.id
            ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/50 text-indigo-400'
            : 'hover:bg-[var(--color-surface-lighter)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        ]"
        :title="tool.name"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          v-html="getIcon(tool.icon)"
        />
        <span class="text-[9px] font-medium">{{ tool.name }}</span>
      </button>
    </nav>

    <!-- 底部设置按钮 -->
    <div class="mt-auto px-2 w-full">
      <button
        class="w-full aspect-square rounded-xl flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-lighter)] transition-all"
        title="设置"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.tool-btn {
  position: relative;
}

.tool-btn::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: linear-gradient(to bottom, #6366f1, #8b5cf6);
  border-radius: 0 2px 2px 0;
  transition: height 0.2s ease;
}

.tool-btn.bg-gradient-to-br::before {
  height: 24px;
}
</style>
