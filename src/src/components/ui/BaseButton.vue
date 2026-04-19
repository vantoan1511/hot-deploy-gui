<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'secondary',
  size: 'md',
  disabled: false,
  loading: false,
  type: 'button',
})

const isStalled = ref(false)
let stallTimer: any = null

watch(() => props.loading, (newVal) => {
  if (stallTimer) clearTimeout(stallTimer)
  isStalled.value = false
  if (newVal) {
    stallTimer = setTimeout(() => {
      isStalled.value = true
    }, 10000) // 10s warning
  }
})

onUnmounted(() => {
  if (stallTimer) clearTimeout(stallTimer)
})
</script>

<template>
  <button
    :type="props.type"
    :disabled="props.disabled || (props.loading && !isStalled)"
    :class="['btn', `btn--${props.variant}`, `btn--${props.size}`, { 'btn--loading': props.loading, 'btn--stalled': isStalled }]"
    :title="isStalled ? 'This is taking longer than expected. Click again to override or refresh the page.' : undefined"
  >
    <span v-if="props.loading" class="btn-spinner" aria-hidden="true" />
    <slot v-if="!isStalled" />
    <span v-else>Taking too long?</span>
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: 6px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s, opacity 0.15s, box-shadow 0.15s;
  white-space: nowrap;
  outline: none;
}

.btn:focus-visible {
  box-shadow: 0 0 0 2px var(--color-primary-500);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Sizes ─────────────────────────────────────────────────── */
.btn--sm { padding: 4px 10px; font-size: 12px; height: 28px; }
.btn--md { padding: 6px 14px; font-size: 13px; height: 34px; }
.btn--lg { padding: 8px 18px; font-size: 14px; height: 40px; }

/* ── Variants ──────────────────────────────────────────────── */
.btn--primary {
  background-color: var(--color-primary-600);
  color: #fff;
}
.btn--primary:hover:not(:disabled) {
  background-color: var(--color-primary-700);
}

.btn--secondary {
  background-color: var(--color-surface-2);
  color: var(--color-text-primary);
  border: 1px solid var(--color-surface-3);
}
.btn--secondary:hover:not(:disabled) {
  background-color: var(--color-surface-3);
}

.btn--danger {
  background-color: transparent;
  color: var(--color-error);
  border: 1px solid var(--color-error);
}
.btn--danger:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-error) 12%, transparent);
}

.btn--ghost {
  background-color: transparent;
  color: var(--color-text-secondary);
}
.btn--ghost:hover:not(:disabled) {
  background-color: var(--color-surface-2);
  color: var(--color-text-primary);
}

/* ── Spinner ───────────────────────────────────────────────── */
.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
