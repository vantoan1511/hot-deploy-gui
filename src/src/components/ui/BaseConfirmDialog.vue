<script setup lang="ts">
import BaseButton from './BaseButton.vue'

const props = defineProps<{
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div class="dialog-backdrop" @click.self="emit('cancel')">
      <div class="dialog" role="dialog" :aria-label="props.title">
        <h2 class="dialog-title">{{ props.title }}</h2>
        <p class="dialog-message">{{ props.message }}</p>
        <div class="dialog-actions">
          <BaseButton variant="ghost" @click="emit('cancel')">
            {{ props.cancelLabel ?? 'Cancel' }}
          </BaseButton>
          <BaseButton :variant="props.variant ?? 'danger'" @click="emit('confirm')">
            {{ props.confirmLabel ?? 'Confirm' }}
          </BaseButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fade-in 0.15s ease;
}

.dialog {
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 10px;
  padding: 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slide-up 0.18s ease;
}

.dialog-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.dialog-message {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes slide-up {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}
</style>
