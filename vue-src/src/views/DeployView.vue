<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDeploymentsStore } from '@/stores/deployments'
import BaseButton from '@/components/ui/BaseButton.vue'
import StepList from '@/components/deploy/StepList.vue'

const route = useRoute()
const router = useRouter()
const store = useDeploymentsStore()

const id = route.params.id as string
const deployment = computed(() => store.getById(id))
</script>

<template>
  <div class="view-page">
    <div v-if="!deployment" class="not-found">
      <p>Deployment not found.</p>
      <BaseButton @click="router.push('/')">← Back</BaseButton>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="deploy-header">
        <button class="back-btn" @click="router.push(`/deployments/${id}`)">← Back</button>
        <h1 class="deploy-title">Deploy: {{ deployment.name }}</h1>
      </div>

      <p class="deploy-host">{{ deployment.username }}@{{ deployment.host }}:{{ deployment.sshPort }}</p>

      <!-- Actions -->
      <div class="deploy-actions">
        <BaseButton variant="primary" size="lg">
          ⚡ Deploy All
        </BaseButton>
      </div>

      <!-- Step list placeholder -->
      <StepList />

      <p class="m4-note">
        Full deploy workflow (live step execution, terminal output) — coming in M4.
      </p>
    </template>
  </div>
</template>

<style scoped>
.view-page { padding: 28px 32px; max-width: 800px; }

.deploy-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 4px;
}

.back-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: color 0.12s, background-color 0.12s;
  white-space: nowrap;
}

.back-btn:hover {
  color: var(--color-text-primary);
  background-color: var(--color-surface-2);
}

.deploy-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.deploy-host {
  margin: 0 0 20px;
  font-size: 12px;
  color: var(--color-text-muted);
  font-family: monospace;
}

.deploy-actions {
  margin-bottom: 24px;
}

.m4-note {
  margin-top: 24px;
  font-size: 12px;
  color: var(--color-text-muted);
  font-style: italic;
}

.not-found {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--color-text-muted);
  font-size: 13px;
}
</style>
