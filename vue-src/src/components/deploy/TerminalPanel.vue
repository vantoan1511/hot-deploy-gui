<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import AnsiUp from 'ansi-to-html'

const props = defineProps<{
  content: string
  title?: string
  loading?: boolean
}>()

const terminalRef = ref<HTMLElement | null>(null)
const autoScroll = ref(true)
const ansi = new AnsiUp({
  fg: '#A1A1AA',
  bg: '#09090B',
  colors: {
    0: '#09090B',
    1: '#EF4444',
    2: '#22C55E',
    3: '#F59E0B',
    4: '#3B82F6',
    5: '#A855F7',
    6: '#06B6D4',
    7: '#F4F4F5'
  }
})

const htmlContent = computed(() => {
  return ansi.toHtml(props.content || 'Waiting for output...')
})

// Auto-scroll logic
watch(() => props.content, () => {
  if (autoScroll.value && terminalRef.value) {
    setTimeout(() => {
      if (terminalRef.value) {
        terminalRef.value.scrollTop = terminalRef.value.scrollHeight
      }
    }, 0)
  }
})

function handleScroll(e: Event) {
  const el = e.target as HTMLElement
  // If user scrolls up significantly, disable auto-scroll
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  autoScroll.value = atBottom
}

function copyOutput() {
  navigator.clipboard.writeText(props.content)
}
</script>

<template>
  <div class="terminal-container">
    <div class="terminal-header">
      <div class="header-left">
        <span class="terminal-dot red"></span>
        <span class="terminal-dot yellow"></span>
        <span class="terminal-dot green"></span>
        <span class="terminal-title">{{ title || 'Terminal Output' }}</span>
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="copyOutput" title="Copy output">
          📋 Copy
        </button>
        <button 
          class="action-btn" 
          :class="{ active: autoScroll }" 
          @click="autoScroll = !autoScroll"
          title="Toggle auto-scroll"
        >
          ⬇ Follow
        </button>
      </div>
    </div>
    
    <div 
      ref="terminalRef" 
      class="terminal-body" 
      @scroll="handleScroll"
    >
      <pre class="terminal-content" v-html="htmlContent"></pre>
      <div v-if="loading" class="terminal-cursor">█</div>
    </div>
  </div>
</template>

<style scoped>
.terminal-container {
  display: flex;
  flex-direction: column;
  background-color: #09090b;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-surface-3);
  height: 100%;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
}

/* ── Header ─────────────────────────────────────────────────── */
.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background-color: var(--color-surface-1);
  border-bottom: 1px solid var(--color-surface-3);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.terminal-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.red { background-color: #ff5f56; }
.yellow { background-color: #ffbd2e; }
.green { background-color: #27c93f; }

.terminal-title {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--color-text-secondary);
  margin-left: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: none;
  border: 1px solid var(--color-surface-3);
  color: var(--color-text-muted);
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background-color: var(--color-surface-2);
  color: var(--color-text-primary);
}

.action-btn.active {
  background-color: var(--color-primary-500);
  border-color: var(--color-primary-500);
  color: white;
}

/* ── Body ───────────────────────────────────────────────────── */
.terminal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--color-surface-3) transparent;
}

.terminal-body::-webkit-scrollbar {
  width: 6px;
}

.terminal-body::-webkit-scrollbar-thumb {
  background-color: var(--color-surface-3);
  border-radius: 3px;
}

.terminal-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #a1a1aa;
}

.terminal-cursor {
  display: inline-block;
  color: var(--color-primary-500);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}
</style>
