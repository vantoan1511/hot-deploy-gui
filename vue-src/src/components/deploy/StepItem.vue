<script setup lang="ts">
import type { StepStatus, StepResult } from '@/types/deployment'

const props = defineProps<{
  name: string
  index: number
  status: StepStatus
  isActive: boolean
  isLast: boolean
}>()

const emit = defineEmits<{
  run: [index: number]
}>()
</script>

<template>
  <div :class="['step-item', { active: isActive }, status]">
    <div class="step-indicator">
      <div class="step-line" v-if="!isLast"></div>
      <div class="step-icon">
        <template v-if="status === 'running'">
          <div class="spinner"></div>
        </template>
        <template v-else-if="status === 'success'">
          <span>✓</span>
        </template>
        <template v-else-if="status === 'error'">
          <span>✕</span>
        </template>
        <template v-else-if="status === 'warning'">
          <span>!</span>
        </template>
        <template v-else-if="status === 'skipped'">
          <span>—</span>
        </template>
        <template v-else>
          <span>{{ index + 1 }}</span>
        </template>
      </div>
    </div>
    
    <div class="step-content">
      <span class="step-name">{{ name }}</span>
      <button 
        v-if="status !== 'running'" 
        class="run-btn" 
        @click="emit('run', index)"
        title="Run this step manually"
      >
        Run
      </button>
    </div>
  </div>
</template>

<style scoped>
.step-item {
  display: flex;
  gap: 16px;
  min-height: 50px;
  position: relative;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24px;
  flex-shrink: 0;
}

.step-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-surface-3);
  color: var(--color-text-muted);
  z-index: 1;
  transition: all 0.2s ease;
}

.step-line {
  position: absolute;
  top: 24px;
  bottom: -24px;
  left: 11px;
  width: 2px;
  background-color: var(--color-surface-3);
  z-index: 0;
}

.step-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 24px;
  flex: 1;
}

.step-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.run-btn {
  background: none;
  border: 1px solid var(--color-surface-3);
  color: var(--color-text-muted);
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.15s;
  cursor: pointer;
}

.step-item:hover .run-btn {
  opacity: 1;
}

.run-btn:hover {
  border-color: var(--color-primary-500);
  color: var(--color-primary-500);
  background-color: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
}

/* ── Status Variants ────────────────────────────────────────── */

.active .step-name {
  color: var(--color-text-primary);
  font-weight: 600;
}

.active .step-icon {
  border-color: var(--color-primary-500);
  color: var(--color-primary-500);
}

.running .step-icon {
  background-color: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
  border-color: var(--color-primary-500);
}

.success .step-icon {
  background-color: color-mix(in srgb, var(--color-success) 15%, transparent);
  border-color: var(--color-success);
  color: var(--color-success);
}

.success .step-line {
  background-color: var(--color-success);
}

.error .step-icon {
  background-color: color-mix(in srgb, var(--color-error) 15%, transparent);
  border-color: var(--color-error);
  color: var(--color-error);
}

.warning .step-icon {
  background-color: color-mix(in srgb, var(--color-warning) 15%, transparent);
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.skipped .step-icon {
  background-color: var(--color-surface-2);
  border-color: var(--color-surface-3);
  color: var(--color-text-muted);
}

.skipped .step-name {
  color: var(--color-text-muted);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-surface-3);
  border-top-color: var(--color-primary-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
