<script setup lang="ts">
import { useDeployRunner } from '@/composables/useDeployRunner'
import { useSessionStore } from '@/stores/session'
import StepItem from './StepItem.vue'

const runner = useDeployRunner()
const sessionStore = useSessionStore()

const emit = defineEmits<{
  runStep: [index: number]
}>()
</script>

<template>
  <div class="step-list">
    <StepItem
      v-for="(name, index) in runner.stepNames"
      :key="index"
      :index="index"
      :name="name"
      :status="sessionStore.stepResult(index)?.status || 'idle'"
      :is-active="sessionStore.currentStepIndex === index"
      :is-last="index === runner.stepNames.length - 1"
      @run="emit('runStep', index)"
    />
  </div>
</template>

<style scoped>
.step-list {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}
</style>
