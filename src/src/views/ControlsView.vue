<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { filesystem } from '@neutralinojs/lib'
import { useControlsStore } from '@/stores/controls'
import type { ControlConnection, CollisionDecision } from '@/types/deployment'
import { parseImport, serializeExport } from '@/utils/exportImport'
import { useOpenDialog, useSaveDialog } from '@/composables/useFileDialog'
import ControlCard from '@/components/controls/ControlCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ImportCollisionDialog from '@/components/ui/ImportCollisionDialog.vue'

const router = useRouter()
const store = useControlsStore()

const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.sortedControls
  return store.sortedControls.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.host.toLowerCase().includes(q) ||
    (c.applicationName ?? '').toLowerCase().includes(q)
  )
})

onMounted(async () => {
  await store.load()
})

async function handleClone(id: string) {
  try {
    const newControl = await store.clone(id)
  } catch (err) {
    showFeedback('error', `Clone failed: ${err}`)
  }
}

async function handleDelete(id: string) {
  const control = store.getById(id)
  if (!control) return

  try {
    await store.remove(id)
  } catch (err) {
    console.error(`Failed to delete: ${err}`)
  }
}

// ── Feedback ─────────────────────────────────────────────
const feedback = ref<{ type: 'success' | 'error'; message: string } | null>(null)
let feedbackTimer: any = null

function showFeedback(type: 'success' | 'error', message: string) {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedback.value = { type, message }
  feedbackTimer = setTimeout(() => { feedback.value = null }, 4000)
}

// ── Export ───────────────────────────────────────────────
const isExporting = ref(false)

async function handleExportAll() {
  if (store.controls.length === 0) {
    showFeedback('error', 'No controls to export.')
    return
  }
  isExporting.value = true
  try {
    const path = await useSaveDialog({
      title: 'Export Controls',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: 'hot-deploy-controls.json',
    })
    if (!path) return
    const json = serializeExport({ controls: store.controls })
    await filesystem.writeFile(path, json)
    showFeedback('success', `Exported ${store.controls.length} control(s).`)
  } catch (err) {
    showFeedback('error', `Export failed: ${err}`)
  } finally {
    isExporting.value = false
  }
}

// ── Import ───────────────────────────────────────────────
const isImporting = ref(false)
const pendingImport = ref<ControlConnection[] | null>(null)
const importConflicts = ref<Array<{ incoming: ControlConnection; existing: ControlConnection }> | null>(null)

async function handleImport() {
  isImporting.value = true
  try {
    const path = await useOpenDialog({
      title: 'Import Controls',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path) return

    const raw = await filesystem.readFile(path)
    const { deployments, controls, errors } = parseImport(raw)

    if (errors.length > 0) {
      showFeedback('error', `Invalid file: ${errors[0]}`)
      return
    }

    if (controls.length === 0) {
      showFeedback('error', 'No controls found in the imported file.')
      return
    }

    const collisions = controls
      .filter(c => store.getById(c.id) !== undefined)
      .map(c => ({ incoming: c, existing: store.getById(c.id)! }))

    if (collisions.length > 0) {
      pendingImport.value = controls
      importConflicts.value = collisions
    } else {
      await applyImport(controls, [])
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

async function handleCollisionCancel() {
  importConflicts.value = null
  pendingImport.value = null
}

async function applyImport(items: ControlConnection[], decisions: CollisionDecision[]) {
  const { added, replaced, skipped } = await store.importMerge(items, decisions)
  const parts: string[] = []
  if (added > 0) parts.push(`${added} added`)
  if (replaced > 0) parts.push(`${replaced} replaced`)
  if (skipped > 0) parts.push(`${skipped} skipped`)
  showFeedback('success', `Import complete: ${parts.join(', ')}.`)
}
</script>

<template>
  <div class="controls-page">
    <header class="page-header">
      <div class="header-left">
        <h1 class="page-title">Controls</h1>
        <p class="page-sub">
          Manage remote server instances and monitor service health.
        </p>
      </div>
      <BaseButton variant="primary" @click="router.push('/controls/new')">
        <span class="plus-icon">+</span> New Control
      </BaseButton>
    </header>

    <div class="filter-bar">
      <div class="search-container">
        <span class="search-icon">🔍</span>
        <input v-model="search" type="text" class="search-input"
          placeholder="Search by name, host, or application..." />
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

    <div v-if="feedback" class="feedback-banner" :class="feedback.type">
      {{ feedback.message }}
    </div>

    <main class="content-area">
      <div v-if="store.isLoading" class="state-container">
        <div class="spinner"></div>
        <p>Loading configurations...</p>
      </div>

      <div v-else-if="store.controls.length === 0" class="state-container empty">
        <div class="empty-icon">🖥️</div>
        <h2 class="empty-title">No Server Controls</h2>
        <p class="empty-sub">
          Connect to a remote server to start monitoring and controlling services.
        </p>
        <BaseButton variant="primary" size="lg" @click="router.push('/controls/new')">
          Add Server Control
        </BaseButton>
      </div>

      <div v-else-if="filtered.length === 0" class="state-container empty">
        <div class="empty-icon">🔍</div>
        <h2 class="empty-title">No matches found</h2>
        <p class="empty-sub">We couldn't find any controls matching "{{ search }}"</p>
        <BaseButton variant="secondary" @click="search = ''">Clear Search</BaseButton>
      </div>

      <div v-else class="controls-grid">
        <ControlCard v-for="c in filtered" :key="c.id" :control="c" @clone="handleClone" @delete="handleDelete" />
      </div>
    </main>

    <ImportCollisionDialog
      v-if="importConflicts"
      :conflicts="importConflicts"
      @confirm="handleCollisionConfirm"
      @cancel="handleCollisionCancel"
    />
  </div>
</template>

<style scoped>
.controls-page {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

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
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
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
}

.bar-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

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

.controls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;
  gap: 16px;
  color: var(--color-text-muted);
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

.empty-icon {
  font-size: 48px;
}

.empty-title {
  color: var(--color-text-primary);
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
</style>
