<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Service } from '@/types/deployment'
import BaseButton from './BaseButton.vue'

const props = defineProps<{
  services: Service[]
}>()

const emit = defineEmits<{
  confirm: [serviceIds: string[]]
  cancel: []
}>()

const selected = ref<Set<string>>(new Set(props.services.map(s => s.id)))

const allSelected = computed(() => selected.value.size === props.services.length)
const noneSelected = computed(() => selected.value.size === 0)

function toggle(id: string) {
  if (selected.value.has(id)) {
    selected.value.delete(id)
  } else {
    selected.value.add(id)
  }
}

function toggleAll() {
  if (allSelected.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(props.services.map(s => s.id))
  }
}

function confirm() {
  emit('confirm', [...selected.value])
}
</script>

<template>
  <Teleport to="body">
    <div class="dialog-backdrop" @click.self="emit('cancel')">
      <div class="dialog" role="dialog" aria-label="Select Services">
        <h2 class="dialog-title">Select Services to Deploy</h2>
        <p class="dialog-sub">Choose which services to include in this deployment run.</p>

        <div class="service-list">
          <label
            v-for="svc in props.services"
            :key="svc.id"
            class="service-row"
            :class="{ checked: selected.has(svc.id) }"
          >
            <input
              type="checkbox"
              class="svc-checkbox"
              :checked="selected.has(svc.id)"
              @change="toggle(svc.id)"
            />
            <span class="svc-name">{{ svc.name }}</span>
            <span class="svc-jar">{{ svc.localJarPath.split(/[/\\]/).pop() }}</span>
          </label>
        </div>

        <div class="toggle-all">
          <button class="toggle-all-btn" @click="toggleAll">
            {{ allSelected ? 'Deselect All' : 'Select All' }}
          </button>
        </div>

        <div class="dialog-actions">
          <BaseButton variant="ghost" @click="emit('cancel')">Cancel</BaseButton>
          <BaseButton variant="primary" :disabled="noneSelected" @click="confirm">
            Deploy {{ selected.size }} Service{{ selected.size !== 1 ? 's' : '' }}
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
  max-width: 440px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slide-up 0.18s ease;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.dialog-sub {
  margin: -8px 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.service-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.service-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid var(--color-surface-3);
  background-color: var(--color-surface-2);
  cursor: pointer;
  transition: border-color 0.12s, background-color 0.12s;
  user-select: none;
}

.service-row.checked {
  border-color: var(--color-primary-500);
  background-color: color-mix(in srgb, var(--color-primary-500) 8%, var(--color-surface-2));
}

.svc-checkbox {
  width: 15px;
  height: 15px;
  accent-color: var(--color-primary-500);
  flex-shrink: 0;
  cursor: pointer;
}

.svc-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.svc-jar {
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: ui-monospace, monospace;
  flex-shrink: 0;
}

.toggle-all {
  display: flex;
}

.toggle-all-btn {
  background: none;
  border: none;
  color: var(--color-primary-500);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
}

.toggle-all-btn:hover {
  text-decoration: underline;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--color-surface-3);
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
