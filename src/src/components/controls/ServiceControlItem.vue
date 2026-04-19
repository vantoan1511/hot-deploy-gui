<script setup lang="ts">
import { computed } from 'vue'
import type { DetectedService, ControlConnection } from '@/types/deployment'
import BaseButton from '../ui/BaseButton.vue'

const props = defineProps<{
  service: DetectedService
  connection: ControlConnection
  isActionLoading?: boolean
}>()

const emit = defineEmits<{
  stop: [service: DetectedService]
  restart: [service: DetectedService]
  disable: [service: DetectedService]
  hotDeploy: [service: DetectedService]
  viewLog: [service: DetectedService]
}>()

const statusLabel = computed(() => {
  switch (props.service.status) {
    case 'running': return 'Running'
    case 'stopped': return 'Stopped'
    case 'disabled': return 'Disabled'
    default: return 'Error'
  }
})

const pidsLabel = computed(() => {
  if (props.service.pids.length === 0) return ''
  return `PID: ${props.service.pids.join(', ')}`
})

const hasOverride = computed(() => {
  return !!props.connection.serviceOverrides[props.service.id]
})
</script>

<template>
  <div class="service-item" :class="service.status">
    <div class="service-header">
      <div class="header-left">
        <span class="service-icon">{{ service.type === 'ui' ? '🖼️' : '⚙️' }}</span>
        <div class="name-box">
          <div class="service-name">
            {{ service.name }}
            <span v-if="service.type === 'ui'" class="type-badge">UI</span>
            <span v-if="hasOverride" class="override-marker" title="Has manual overrides">⭐</span>
          </div>
          <div class="service-meta">
            <span class="status-indicator"></span>
            {{ statusLabel }} {{ pidsLabel ? `• ${pidsLabel}` : '' }}
          </div>
        </div>
      </div>

      <div class="header-right">
        <div class="action-group">
          <BaseButton 
            v-if="service.status === 'running'" 
            variant="secondary" 
            size="sm" 
            :disabled="isActionLoading"
            @click="emit('stop', service)"
          >
            Stop
          </BaseButton>
          
          <BaseButton 
            v-if="service.status !== 'disabled'" 
            variant="primary" 
            size="sm" 
            :disabled="isActionLoading"
            @click="emit('restart', service)"
          >
            {{ service.status === 'running' ? 'Restart' : 'Start' }}
          </BaseButton>

          <BaseButton 
            v-if="service.status !== 'disabled' && service.status !== 'running'" 
            variant="secondary" 
            size="sm" 
            class="danger-hover"
            :disabled="isActionLoading"
            @click="emit('disable', service)"
          >
            Disable
          </BaseButton>
        </div>
      </div>
    </div>

    <div class="service-footer">
      <div class="path-display truncate" :title="service.path">
        {{ service.path }}
      </div>
      <div class="footer-actions">
        <button class="footer-btn" @click="emit('hotDeploy', service)">🚀 Hot Deploy</button>
        <button class="footer-btn" @click="emit('viewLog', service)">📜 View Log</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.service-item {
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-surface-3);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-left {
  display: flex;
  gap: 12px;
  align-items: center;
}

.service-icon {
  font-size: 20px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-surface-1);
  border-radius: 6px;
}

.name-box {
  display: flex;
  flex-direction: column;
}

.service-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.type-badge {
  font-size: 9px;
  padding: 1px 4px;
  background-color: var(--color-primary-500);
  color: white;
  border-radius: 3px;
  font-weight: 800;
}

.override-marker {
  font-size: 12px;
  color: var(--color-warning);
}

.service-meta {
  font-size: 11px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-text-muted);
}

.running .status-indicator { background-color: var(--color-success); }
.stopped .status-indicator { background-color: var(--color-warning); }
.disabled .status-indicator { background-color: var(--color-error); }

.action-group {
  display: flex;
  gap: 6px;
}

.danger-hover:hover {
  border-color: var(--color-error) !important;
  color: var(--color-error) !important;
}

.service-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid var(--color-surface-3);
}

.path-display {
  font-family: 'Roboto Mono', monospace;
  font-size: 11px;
  color: var(--color-text-muted);
  max-width: 60%;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.footer-btn {
  background: none;
  border: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-primary-500);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.1s;
}

.footer-btn:hover {
  background-color: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
}
</style>
