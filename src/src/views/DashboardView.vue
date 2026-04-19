<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { filesystem } from '@neutralinojs/lib'
import { useDeploymentsStore } from '@/stores/deployments'
import type { Deployment, CollisionDecision } from '@/types/deployment'
import { parseImport, serializeExport } from '@/utils/exportImport'
import { useOpenDialog, useSaveDialog } from '@/composables/useFileDialog'
import DeploymentCard from '@/components/deployments/DeploymentCard.vue'
import BaseConfirmDialog from '@/components/ui/BaseConfirmDialog.vue'
import ImportCollisionDialog from '@/components/ui/ImportCollisionDialog.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const router = useRouter()
const store = useDeploymentsStore()

// ── Search ───────────────────────────────────────────────
const search = ref('')
const deleteTarget = ref<string | null>(null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.sortedDeployments
  return store.sortedDeployments.filter(d =>
    d.name.toLowerCase().includes(q) ||
    d.host.toLowerCase().includes(q) ||
    d.username.toLowerCase().includes(q) ||
    d.services.some(s => s.name.toLowerCase().includes(q)) ||
    d.tags.some(t => t.toLowerCase().includes(q))
  )
})

onMounted(async () => {
  await store.load()
})

// ── Delete ───────────────────────────────────────────────
async function handleClone(id: string) {
  try {
    await store.clone(id)
  } catch (err) {
    showFeedback('error', `Clone failed: ${err}`)
  }
}

function handleDeleteRequest(id: string) {
  deleteTarget.value = id
}

async function confirmDelete() {
  if (deleteTarget.value) {
    try {
      await store.remove(deleteTarget.value)
      deleteTarget.value = null
    } catch (err) {
      showFeedback('error', `Delete failed: ${err}`)
    }
  }
}

// ── Feedback banner ──────────────────────────────────────
const feedback = ref<{ type: 'success' | 'error'; message: string } | null>(null)
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

function showFeedback(type: 'success' | 'error', message: string) {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedback.value = { type, message }
  feedbackTimer = setTimeout(() => { feedback.value = null }, 4000)
}

// ── Export ───────────────────────────────────────────────
const isExporting = ref(false)

async function handleExportAll() {
  if (store.deployments.length === 0) {
    showFeedback('error', 'No deployments to export.')
    return
  }
  isExporting.value = true
  try {
    const path = await useSaveDialog({
      title: 'Export Deployments',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: 'hot-deploy-export.json',
    })
    if (!path) return
    const json = serializeExport({ deployments: store.deployments })
    await filesystem.writeFile(path, json)
    showFeedback('success', `Exported ${store.deployments.length} deployment(s) to file.`)
  } catch (err) {
    showFeedback('error', `Export failed: ${err}`)
  } finally {
    isExporting.value = false
  }
}

// ── Import ───────────────────────────────────────────────
const isImporting = ref(false)
const pendingImport = ref<Deployment[] | null>(null)
const importConflicts = ref<Array<{ incoming: Deployment; existing: Deployment }> | null>(null)

async function handleImport() {
  isImporting.value = true
  try {
    const path = await useOpenDialog({
      title: 'Import Deployments',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path) return

    const raw = await filesystem.readFile(path)
    const { deployments, errors, converted } = parseImport(raw)

    if (errors.length > 0) {
      showFeedback('error', `Invalid file: ${errors[0]}`)
      return
    }

    if (deployments.length === 0) {
      showFeedback('error', 'No deployments found in the imported file.')
      return
    }

    if (converted) {
      showFeedback('success', `Legacy format detected — converted ${converted} deployment(s) to multi-service format.`)
      await new Promise(r => setTimeout(r, 1800))
    }

    const collisions = deployments
      .filter(d => store.getById(d.id) !== undefined)
      .map(d => ({ incoming: d, existing: store.getById(d.id)! }))

    if (collisions.length > 0) {
      pendingImport.value = deployments
      importConflicts.value = collisions
    } else {
      await applyImport(deployments, [])
    }
  } catch (err) {
    showFeedback('error', `Import failed: ${err}`)
  } finally {
    isImporting.value = false
  }
}

async function handleCollisionConfirm(decisions: CollisionDecision[]) {
  if (!pendingImport.value) return
  try {
    await applyImport(pendingImport.value, decisions)
  } finally {
    importConflicts.value = null
    pendingImport.value = null
  }
}

function handleCollisionCancel() {
  importConflicts.value = null
  pendingImport.value = null
}

async function applyImport(deployments: Deployment[], decisions: CollisionDecision[]) {
  const { added, replaced, skipped } = await store.importMerge(deployments, decisions)
  const parts: string[] = []
  if (added > 0) parts.push(`${added} added`)
  if (replaced > 0) parts.push(`${replaced} replaced`)
  if (skipped > 0) parts.push(`${skipped} skipped`)
  showFeedback('success', `Import complete: ${parts.join(', ')}.`)
}
</script>

<template>
  <div class="dashboard">
    <!-- Page Header -->
    <header class="page-header">
      <div class="header-left">
        <h1 class="page-title">Deployments</h1>
        <p class="page-sub">
          {{ store.deployments.length }} configured target{{ store.deployments.length !== 1 ? 's' : '' }}
        </p>
      </div>
      <BaseButton variant="primary" @click="router.push('/deployments/new')">
        <span class="plus-icon">+</span> New Deployment
      </BaseButton>
    </header>

    <!-- Search / Filter bar -->
    <div class="filter-bar">
      <div class="search-container">
        <span class="search-icon">🔍</span>
        <input
          v-model="search"
          type="text"
          class="search-input"
          placeholder="Search by name, host, service, or tag..."
          aria-label="Search deployments"
        />
        <button v-if="search" class="clear-search" @click="search = ''">×</button>
      </div>
      <div class="bar-actions">
        <BaseButton variant="secondary" :loading="isImporting" @click="handleImport">
          Import
        </BaseButton>
        <BaseButton variant="secondary" :loading="isExporting" @click="handleExportAll">
          Export All
        </BaseButton>
      </div>
    </div>

    <!-- Feedback Banner -->
    <div v-if="feedback" class="feedback-banner" :class="feedback.type">
      {{ feedback.message }}
    </div>

    <!-- Main Content -->
    <main class="content-area">
      <!-- Loading State -->
      <div v-if="store.isLoading" class="state-container">
        <div class="spinner"></div>
        <p>Loading configurations...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="store.deployments.length === 0" class="state-container empty">
        <div class="empty-icon">🚀</div>
        <h2 class="empty-title">Welcome to Hot Deploy</h2>
        <p class="empty-sub">
          Start by creating a deployment configuration for your remote Java service.
        </p>
        <BaseButton variant="primary" size="lg" @click="router.push('/deployments/new')">
          Create First Deployment
        </BaseButton>
      </div>

      <!-- No Results State -->
      <div v-else-if="filtered.length === 0" class="state-container empty">
        <div class="empty-icon">🔍</div>
        <h2 class="empty-title">No matches found</h2>
        <p class="empty-sub">
          We couldn't find any deployments matching "{{ search }}"
        </p>
        <BaseButton variant="secondary" @click="search = ''">Clear Search</BaseButton>
      </div>

      <!-- Deployments Grid -->
      <div v-else class="deployments-grid">
        <DeploymentCard
          v-for="d in filtered"
          :key="d.id"
          :deployment="d"
          @clone="handleClone"
          @delete="handleDeleteRequest"
        />
      </div>
    </main>

    <!-- Confirm Delete Dialog -->
    <BaseConfirmDialog
      v-if="deleteTarget"
      title="Delete Configuration"
      :message="`Are you sure you want to delete '${store.getById(deleteTarget)?.name}'? This action cannot be undone.`"
      confirm-label="Delete"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />

    <!-- Import Collision Dialog -->
    <ImportCollisionDialog
      v-if="importConflicts"
      :conflicts="importConflicts"
      @confirm="handleCollisionConfirm"
      @cancel="handleCollisionCancel"
    />
  </div>
</template>

<style scoped>
.dashboard {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Header ─────────────────────────────────────────────────── */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.page-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.plus-icon {
  margin-right: 4px;
  font-size: 16px;
  font-weight: 700;
}

/* ── Filter Bar ────────────────────────────────────────────── */
.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-container {
  position: relative;
  flex: 1;
  max-width: 480px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 38px;
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 8px;
  padding: 0 36px;
  color: var(--color-text-primary);
  font-size: 13px;
  transition: all 0.15s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  background-color: var(--color-surface-2);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary-500) 20%, transparent);
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.clear-search {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.clear-search:hover {
  color: var(--color-text-primary);
}

.bar-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

/* ── Feedback Banner ────────────────────────────────────────── */
.feedback-banner {
  padding: 10px 16px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  animation: fade-in 0.15s ease;
}

.feedback-banner.success {
  background-color: color-mix(in srgb, var(--color-success) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-success) 40%, transparent);
  color: var(--color-success);
}

.feedback-banner.error {
  background-color: color-mix(in srgb, var(--color-error) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-error) 40%, transparent);
  color: var(--color-error);
}

/* ── Grid ─────────────────────────────────────────────────── */
.deployments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

/* ── States ─────────────────────────────────────────────────── */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;
  gap: 16px;
  color: var(--color-text-muted);
}

.empty {
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.empty-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.empty-sub {
  margin: 0 0 8px;
  font-size: 14px;
  max-width: 400px;
  line-height: 1.5;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-surface-3);
  border-top-color: var(--color-primary-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
