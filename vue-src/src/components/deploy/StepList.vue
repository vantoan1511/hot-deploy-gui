<script setup lang="ts">
import { useSessionStore } from '@/stores/session'
import { GLOBAL_STEP_NAMES, SERVICE_STEP_NAMES } from '@/composables/useDeployRunner'
import { GLOBAL_STEPS, SERVICE_STEPS } from '@/stores/session'
import StepItem from './StepItem.vue'

const sessionStore = useSessionStore()

const emit = defineEmits<{
  runStep: [index: number]
}>()
</script>

<template>
  <div class="step-list">
    <!-- Global steps -->
    <StepItem
      v-for="(name, i) in GLOBAL_STEP_NAMES"
      :key="i"
      :index="i"
      :name="name"
      :status="sessionStore.stepResult(i)?.status || 'idle'"
      :is-active="sessionStore.currentStepIndex === i"
      :is-last="false"
      @run="emit('runStep', i)"
    />

    <!-- Per-service step groups -->
    <template
      v-for="(svc, si) in (sessionStore.session?.services ?? [])"
      :key="svc.id"
    >
      <div class="service-group-header">
        <span class="service-group-dot"></span>
        {{ svc.name }}
      </div>
      <StepItem
        v-for="(name, li) in SERVICE_STEP_NAMES"
        :key="li"
        :index="GLOBAL_STEPS + si * SERVICE_STEPS + li"
        :name="name"
        :status="sessionStore.stepResult(GLOBAL_STEPS + si * SERVICE_STEPS + li)?.status || 'idle'"
        :is-active="sessionStore.currentStepIndex === GLOBAL_STEPS + si * SERVICE_STEPS + li"
        :is-last="si === (sessionStore.session?.services.length ?? 1) - 1 && li === SERVICE_STEP_NAMES.length - 1"
        @run="emit('runStep', GLOBAL_STEPS + si * SERVICE_STEPS + li)"
      />
    </template>
  </div>
</template>

<style scoped>
.step-list {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.service-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 12px 0 4px 0;
  margin-left: 4px;
}

.service-group-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-surface-3);
  flex-shrink: 0;
}
</style>
