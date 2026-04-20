<script setup lang="ts">
import { useControlRunner } from '@/composables/useControlRunner'
import { useOpenDialog } from '@/composables/useFileDialog'
import { useControlsStore } from '@/stores/controls'
import { useControlSessionStore } from '@/stores/controlSession'
import type { ControlConnection, DetectedService } from '@/types/deployment'
import { resolveRemotePath } from '@/utils/pathUtils'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import LogViewer from '@/components/controls/LogViewer.vue'
import ServiceControlItem from '@/components/controls/ServiceControlItem.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseConfirmDialog from '@/components/ui/BaseConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const controlsStore = useControlsStore()
const sessionStore = useControlSessionStore()
const runner = useControlRunner()

const id = route.params.id as string
const control = ref<ControlConnection | undefined>(undefined)
const viewMode = ref<'grid' | 'list'>('grid')
const serviceSearch = ref('')

const activeLog = ref<{ path: string; title: string } | null>(null)
const confirmDisable = ref<DetectedService | null>(null)
const isActionRunning = ref(false)
const showDeployPanel = ref(false)

const session = computed(() => sessionStore.getOrCreateSession(id))

const filteredServices = computed(() => {
  const q = serviceSearch.value.trim().toLowerCase()
  if (!q) return session.value.services
  return session.value.services.filter(s => s.name.toLowerCase().includes(q))
})

onMounted(async () => {
  if (controlsStore.controls.length === 0) {
    await controlsStore.load()
  }

  const plain = await controlsStore.getPlaintextControl(id)
  if (!plain) {
    router.replace('/controls')
    return
  }
  control.value = plain

  // Initial scan
  handleScan()
})

const handleScan = async () => {
  if (!control.value) return
  await runner.scanServices(control.value)
}

const openGeneralLog = () => {
  if (!control.value) return
  const path = resolveRemotePath(control.value.rootDeploymentPath, `${control.value.logsPath}/${control.value.applicationName}.log`)
  activeLog.value = { path, title: `${control.value.applicationName} — General Log` }
}

const openServiceLog = (service: DetectedService) => {
  if (!control.value) return
  const path = resolveRemotePath(control.value.rootDeploymentPath, `${control.value.logsPath}/${service.name}.log`)
  activeLog.value = { path, title: `${service.name} — Log` }
}

const handleStop = async (service: DetectedService) => {
  if (!control.value) return
  isActionRunning.value = true
  try {
    await runner.stopService(control.value, service)
  } catch (err) {
    alert(err)
  } finally {
    isActionRunning.value = false
  }
}

const handleRestart = async (service: DetectedService) => {
  if (!control.value) return
  isActionRunning.value = true
  try {
    await runner.restartService(control.value, service)
  } catch (err) {
    alert(err)
  } finally {
    isActionRunning.value = false
  }
}

const requestDisable = (service: DetectedService) => {
  confirmDisable.value = service
}

const handleDisableConfirm = async () => {
  if (!control.value || !confirmDisable.value) return
  const svc = confirmDisable.value
  confirmDisable.value = null
  isActionRunning.value = true
  try {
    await runner.disableService(control.value, svc)
  } catch (err) {
    alert(err)
  } finally {
    isActionRunning.value = false
  }
}

const handleHotDeploy = async (service: DetectedService) => {
  if (!control.value) return

  // 1. Get/Pick local JAR
  let localPath = control.value.serviceOverrides[service.id]?.localJarPath
  if (!localPath) {
    const picked = await useOpenDialog({
      title: `Select JAR for ${service.name}`,
      filters: [{ name: 'JAR Files', extensions: ['jar'] }]
    })
    if (!picked) return
    localPath = picked
    await controlsStore.updateServiceOverride(id, service.id, { localJarPath: picked })
  }

  // Use the new generic deploy runner if possible, or just SCP directly
  // For individual services, we'll keep the simple alert for now as the user 
  // primarily asked for the global "Deploy Package" feature.
  alert(`Service-specific hot-deploy for ${service.name} using ${localPath} is coming soon. Use the main 'Deploy Package' button for full lifecycle deployment.`)
}

const startDeploy = async () => {
  if (!control.value) return
  showDeployPanel.value = true
  runner.resetDeployStatus()

  try {
    await runner.deployPackage(id)
    // After success, rescan to see changes
    if (runner.deployStatus.value.phase === 'success') {
      setTimeout(handleScan, 1000)
    }
  } catch (err) {
    console.error('Deploy failed:', err)
  }
}

const closeDeployPanel = () => {
  showDeployPanel.value = false
  runner.resetDeployStatus()
}
</script>

<template>
  <div v-if="control" class="control-detail">
    <!-- Header -->
    <header class="detail-header">
      <div class="header-nav">
        <button class="back-btn" @click="router.push('/controls')">← Back to Controls</button>
      </div>

      <div class="header-main">
        <div class="title-section">
          <h1 class="control-name">{{ control.name }}</h1>
          <div class="server-host">{{ control.username }}@{{ control.host }}:{{ control.sshPort }}</div>
        </div>

        <div class="header-actions">
          <BaseButton variant="secondary" @click="openGeneralLog">📖 App Log</BaseButton>
          <BaseButton variant="secondary" :loading="session.isScanning" @click="handleScan">🔄 Rescan</BaseButton>
          <BaseButton v-if="control.localPackagePath" variant="primary"
            :loading="runner.deployStatus.value.phase !== 'idle' && runner.deployStatus.value.phase !== 'success' && runner.deployStatus.value.phase !== 'error'"
            @click="startDeploy">
            🚀 Deploy Package
          </BaseButton>
          <BaseButton variant="secondary" @click="router.push(`/controls/${id}/edit`)">✏️ Edit</BaseButton>
        </div>
      </div>
    </header>

    <!-- App Info Tiles -->
    <div class="info-tiles">
      <div class="info-tile">
        <label>Application</label>
        <div class="tile-value">{{ control.applicationName }}</div>
      </div>
      <div class="info-tile">
        <label>Ports (HTTP/S)</label>
        <div class="tile-value">{{ control.applicationHttpPort || '—' }} / {{ control.applicationHttpsPort || '—' }}
        </div>
      </div>
      <div class="info-tile">
        <label>Root Path</label>
        <div class="tile-value truncate" :title="control.rootDeploymentPath">{{ control.rootDeploymentPath }}</div>
      </div>
      <div class="info-tile">
        <label>Last Scan</label>
        <div class="tile-value">{{ session.lastScanAt ? new Date(session.lastScanAt).toLocaleTimeString() : 'Never' }}
        </div>
      </div>
    </div>

    <!-- Deployment Progress Panel -->
    <transition name="slide">
      <section v-if="showDeployPanel" class="deploy-panel">
        <div class="panel-header">
          <div class="panel-title-box">
            <h2 class="section-title">Deployment Progress</h2>
            <div :class="['status-pill', runner.deployStatus.value.phase]">
              {{ runner.deployStatus.value.phase.toUpperCase() }}
            </div>
          </div>
          <BaseButton v-if="['success', 'error'].includes(runner.deployStatus.value.phase)" size="sm" variant="ghost"
            @click="closeDeployPanel">Close</BaseButton>
        </div>

        <div class="panel-content">
          <div class="step-indicator">
            <div class="step-text">{{ runner.deployStatus.value.currentStep || 'Initializing...' }}</div>
            <div class="progress-bar">
              <div class="progress-fill" :class="runner.deployStatus.value.phase"></div>
            </div>
          </div>

          <div class="terminal-box" ref="logContainer">
            <div v-for="(log, i) in runner.deployStatus.value.logs" :key="i" class="log-line">
              {{ log }}
            </div>
            <div v-if="runner.deployStatus.value.error" class="log-line error">
              [CRITICAL] {{ runner.deployStatus.value.error }}
            </div>
          </div>
        </div>
      </section>
    </transition>

    <!-- Services Section -->
    <section class="services-section">
      <div class="services-header">
        <div class="services-title-box">
          <h2 class="section-title">Detected Services</h2>
          <span class="count-badge">{{ session.services.length }}</span>
        </div>

        <div class="services-toolbar">
          <div class="search-mini">
            <span class="mini-icon">🔍</span>
            <input v-model="serviceSearch" type="text" placeholder="Filter services..." />
          </div>

          <div class="mode-toggle">
            <button :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'">
              Grid
            </button>
            <button :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">
              List
            </button>
          </div>
        </div>
      </div>

      <div v-if="session.isScanning && session.services.length === 0" class="scan-loading">
        <div class="spinner"></div>
        <p>Scanning remote filesystem...</p>
      </div>

      <div v-else-if="session.services.length === 0" class="empty-services">
        <div class="empty-icon">📂</div>
        <p>No services detected in <code>{{ control.servicesPath }}</code></p>
        <BaseButton variant="secondary" size="sm" @click="handleScan">Scan Again</BaseButton>
      </div>

      <div v-else class="services-container" :class="viewMode">
        <ServiceControlItem v-for="svc in filteredServices" :key="svc.id" :service="svc" :connection="control"
          :is-action-loading="isActionRunning" @stop="handleStop" @restart="handleRestart" @disable="requestDisable"
          @hot-deploy="handleHotDeploy" @view-log="openServiceLog" />
      </div>
    </section>

    <!-- Overlay: Log Viewer -->
    <div v-if="activeLog" class="log-overlay">
      <div class="log-modal">
        <LogViewer :connection="control" :log-path="activeLog.path" :title="activeLog.title"
          @close="activeLog = null" />
      </div>
    </div>

    <!-- Confirm Dialog: Disable -->
    <BaseConfirmDialog v-if="confirmDisable" title="Disable Service"
      :message="`Are you sure you want to disable '${confirmDisable.name}'? This will rename its directory and stop the process.`"
      confirm-label="Disable Service" variant="danger" @confirm="handleDisableConfirm"
      @cancel="confirmDisable = null" />
  </div>
</template>

<style scoped>
.control-detail {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.detail-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.back-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}

.back-btn:hover {
  color: var(--color-text-primary);
}

.header-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.control-name {
  margin: 0 0 4px;
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.server-host {
  font-size: 14px;
  color: var(--color-text-muted);
  font-family: 'Roboto Mono', monospace;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.info-tiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 900px) {
  .info-tiles {
    grid-template-columns: repeat(2, 1fr);
  }
}

.info-tile {
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 8px;
  padding: 12px 16px;
}

.info-tile label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.tile-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.services-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.services-title-box {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.count-badge {
  font-size: 12px;
  font-weight: 700;
  background-color: var(--color-surface-3);
  color: var(--color-text-secondary);
  padding: 2px 8px;
  border-radius: 12px;
}

.services-toolbar {
  display: flex;
  gap: 12px;
}

.search-mini {
  position: relative;
  width: 240px;
}

.mini-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--color-text-muted);
}

.search-mini input {
  width: 100%;
  height: 32px;
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 6px;
  padding: 0 10px 0 30px;
  color: var(--color-text-primary);
  font-size: 13px;
}

.mode-toggle {
  display: flex;
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 6px;
  padding: 2px;
}

.mode-toggle button {
  background: none;
  border: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.mode-toggle button.active {
  background-color: var(--color-surface-3);
  color: var(--color-text-primary);
}

.services-container.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.services-container.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scan-loading,
.empty-services {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  gap: 16px;
  color: var(--color-text-muted);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-surface-3);
  border-top-color: var(--color-primary-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-icon {
  font-size: 40px;
}

.log-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 40px;
}

.log-modal {
  width: 100%;
  height: 100%;
  max-width: 1400px;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Deployment Panel ────────────────────────────────────── */

.deploy-panel {
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 16px 20px;
  background-color: var(--color-surface-2);
  border-bottom: 1px solid var(--color-surface-3);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-title-box {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: var(--color-surface-3);
  color: var(--color-text-secondary);
}

.status-pill.transferring,
.status-pill.cleaning,
.status-pill.finalizing,
.status-pill.pre-commands,
.status-pill.post-commands {
  background-color: color-mix(in srgb, var(--color-info) 15%, transparent);
  color: var(--color-info);
}

.status-pill.success {
  background-color: color-mix(in srgb, var(--color-success) 15%, transparent);
  color: var(--color-success);
}

.status-pill.error {
  background-color: color-mix(in srgb, var(--color-error) 15%, transparent);
  color: var(--color-error);
}

.panel-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.progress-bar {
  height: 6px;
  background-color: var(--color-surface-2);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  width: 100%;
  background-color: var(--color-primary-500);
  animation: progress-slide 2s infinite linear;
  transform-origin: left;
}

.progress-fill.success {
  animation: none;
  background-color: var(--color-success);
}

.progress-fill.error {
  animation: none;
  background-color: var(--color-error);
}

@keyframes progress-slide {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

.terminal-box {
  background-color: var(--color-surface-0);
  border: 1px solid var(--color-surface-3);
  border-radius: 6px;
  padding: 12px;
  height: 200px;
  overflow-y: auto;
  font-family: 'Roboto Mono', monospace;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-line {
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}

.log-line.error {
  color: var(--color-error);
  font-weight: 600;
}

/* ── Animations ─────────────────────────────────────────── */

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
