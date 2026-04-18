<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDeploymentsStore } from '@/stores/deployments'
import { useDeployRunner } from '@/composables/useDeployRunner'
import { useSessionStore } from '@/stores/session'
import BaseButton from '@/components/ui/BaseButton.vue'
import StepList from '@/components/deploy/StepList.vue'
import TerminalPanel from '@/components/deploy/TerminalPanel.vue'

const route = useRoute()
const router = useRouter()
const deploymentsStore = useDeploymentsStore()
const sessionStore = useSessionStore()
const runner = useDeployRunner()

const id = route.params.id as string
const deployment = computed(() => deploymentsStore.getById(id))

onMounted(async () => {
  if (!id) return
  if (deploymentsStore.deployments.length === 0) {
    await deploymentsStore.load()
  }
  if (deployment.value) {
    sessionStore.startSession(id, deployment.value.services)
  }
})

async function handleDeployAll() {
  if (!id) return
  await runner.deployAll(id)
}

async function handleRunStep(stepIndex: number) {
  if (!id) return
  await runner.runSingleStep(id, stepIndex)
}
</script>

<template>
  <div class="deploy-cockpit">
    <div v-if="!deployment" class="not-found">
      <p>Deployment configuration not found.</p>
      <BaseButton @click="router.push('/')">← Back to Dashboard</BaseButton>
    </div>

    <template v-else>
      <!-- Page Header -->
      <header class="page-header">
        <div class="header-left">
          <button class="back-link" @click="router.push(`/deployments/${id}`)">
            ← Details
          </button>
          <h1 class="page-title">Deployment Engine</h1>
          <p class="page-sub">{{ deployment.name }} — {{ deployment.username }}@{{ deployment.host }}</p>
        </div>
        
        <div class="header-actions">
          <BaseButton 
            variant="primary" 
            size="lg" 
            :loading="runner.isDeploying.value"
            @click="handleDeployAll"
          >
            ⚡ Start Full Deployment
          </BaseButton>
        </div>
      </header>

      <!-- Main Layout -->
      <div class="cockpit-grid">
        <!-- Sidebar: Steps -->
        <aside class="steps-sidebar">
          <div class="section-label">Deployment Steps</div>
          <StepList @run-step="handleRunStep" />
          
          <div class="session-stats">
            <div class="stat-item">
              <span class="stat-label">Status</span>
              <span :class="['stat-value', sessionStore.sessionStatus]">
                {{ sessionStore.sessionStatus.toUpperCase() }}
              </span>
            </div>
          </div>
        </aside>

        <!-- Main: Terminal -->
        <main class="terminal-area">
          <TerminalPanel 
            :content="sessionStore.fullLog"
            :loading="runner.isDeploying.value"
            :title="`LOGS: ${deployment.name}`"
          />
        </main>
      </div>
    </template>
  </div>
</template>

<style scoped>
.deploy-cockpit {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 32px;
  gap: 24px;
  overflow: hidden;
}

/* ── Header ─────────────────────────────────────────────────── */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-shrink: 0;
}

.back-link {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  padding: 0;
  margin-bottom: 8px;
  display: block;
}

.back-link:hover {
  color: var(--color-primary-500);
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.page-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* ── Grid Layout ────────────────────────────────────────────── */
.cockpit-grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 32px;
  flex: 1;
  min-height: 0; /* Important for flex child scroll */
}

/* ── Sidebar ────────────────────────────────────────────────── */
.steps-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-right: 8px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}

.session-stats {
  margin-top: auto;
  padding-top: 24px;
  border-top: 1px solid var(--color-surface-3);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.stat-value {
  font-size: 11px;
  font-weight: 700;
  font-family: monospace;
}

.stat-value.idle { color: var(--color-text-muted); }
.stat-value.running { color: var(--color-primary-500); }
.stat-value.completed { color: var(--color-success); }
.stat-value.failed { color: var(--color-error); }

/* ── Main Area ──────────────────────────────────────────────── */
.terminal-area {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--color-text-muted);
}
</style>
