<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { execSSH } from '@/composables/useSSH'
import type { ControlConnection } from '@/types/deployment'
import AnsiUp from 'ansi_up'

const props = defineProps<{
  connection: ControlConnection
  logPath: string
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()

const ansi = new AnsiUp()
const content = ref('')
const isFollowing = ref(true)
const refreshInterval = ref(1) // seconds
const isLoading = ref(false)
const terminalRef = ref<HTMLElement | null>(null)

let timer: ReturnType<typeof setTimeout> | null = null

async function fetchLog() {
  if (isLoading.value) return
  isLoading.value = true
  
  try {
    // We fetch the last 200 lines to keep it performant
    const res = await execSSH(props.connection, `tail -n 200 "${props.logPath}"`)
    content.value = ansi.ansi_to_html(res.output)
    
    if (isFollowing.value) {
      scrollToBottom()
    }
  } catch (err) {
    content.value = `<span style="color: var(--color-error)">Failed to read log: ${err}</span>`
  } finally {
    isLoading.value = false
    if (isFollowing.value) {
      startTimer()
    }
  }
}

function startTimer() {
  stopTimer()
  const ms = Math.max(props.refreshInterval * 1000, 1000)
  timer = setTimeout(fetchLog, ms)
}

function stopTimer() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

function scrollToBottom() {
  setTimeout(() => {
    if (terminalRef.value) {
      terminalRef.value.scrollTop = terminalRef.value.scrollHeight
    }
  }, 50)
}

function toggleFollow() {
  isFollowing.value = !isFollowing.value
  if (isFollowing.value) {
    fetchLog()
  } else {
    stopTimer()
  }
}

watch(() => props.logPath, () => {
  content.value = ''
  fetchLog()
})

onMounted(() => {
  fetchLog()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<template>
  <div class="log-viewer">
    <div class="viewer-header">
      <div class="header-left">
        <span class="header-icon">📜</span>
        <h3 class="header-title">{{ title }}</h3>
        <span class="path-hint truncate">{{ logPath }}</span>
      </div>
      
      <div class="header-actions">
        <div class="refresh-config">
          <label>Interval (s):</label>
          <input 
            v-model.number="refreshInterval" 
            type="number" 
            min="1" 
            class="interval-input"
          />
        </div>
        
        <button 
          class="action-btn" 
          :class="{ active: isFollowing }" 
          @click="toggleFollow"
        >
          {{ isFollowing ? '⏸ Pause' : '▶ Follow' }}
        </button>
        
        <button class="action-btn" @click="fetchLog">🔄 Refresh</button>
        <button class="close-btn" @click="emit('close')">×</button>
      </div>
    </div>

    <div ref="terminalRef" class="viewer-body">
      <pre v-html="content"></pre>
      <div v-if="isLoading" class="loader">Loading...</div>
    </div>
  </div>
</template>

<style scoped>
.log-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-surface-0);
  border: 1px solid var(--color-surface-3);
  border-radius: 12px;
  overflow: hidden;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background-color: var(--color-surface-1);
  border-bottom: 1px solid var(--color-surface-3);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.header-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.path-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: 'Roboto Mono', monospace;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.refresh-config {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.interval-input {
  width: 40px;
  height: 24px;
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-surface-3);
  color: var(--color-text-primary);
  border-radius: 4px;
  padding: 0 4px;
  font-size: 11px;
}

.action-btn {
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-surface-3);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.1s;
}

.action-btn:hover {
  background-color: var(--color-surface-3);
  color: var(--color-text-primary);
}

.action-btn.active {
  border-color: var(--color-primary-500);
  color: var(--color-primary-500);
  background-color: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 22px;
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover {
  color: var(--color-error);
}

.viewer-body {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  position: relative;
}

pre {
  margin: 0;
  font-family: 'Roboto Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #ddd;
  white-space: pre-wrap;
  word-break: break-all;
}

.loader {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 10px;
  color: var(--color-primary-500);
  background-color: var(--color-surface-0);
  padding: 2px 6px;
  border-radius: 4px;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
