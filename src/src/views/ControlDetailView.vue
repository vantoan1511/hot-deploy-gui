<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useControlsStore } from '@/stores/controls'
import { useControlSessionStore } from '@/stores/controlSession'
import { useControlRunner } from '@/composables/useControlRunner'
import { useOpenDialog } from '@/composables/useFileDialog'
import { resolveRemotePath } from '@/utils/pathUtils'
import type { ControlConnection, DetectedService } from '@/types/deployment'

import BaseButton from '@/components/ui/BaseButton.vue'
import ServiceControlItem from '@/components/controls/ServiceControlItem.vue'
import LogViewer from '@/components/controls/LogViewer.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

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

async function handleScan() {
  if (!control.value) return
  await runner.scanServices(control.value)
}

function openGeneralLog() {
  if (!control.value) return
  const path = resolveRemotePath(control.value.rootDeploymentPath, `${control.value.logsPath}/${control.value.applicationName}.log`)
  activeLog.value = { path, title: `${control.value.applicationName} — General Log` }
}

function openServiceLog(service: DetectedService) {
  if (!control.value) return
  const path = resolveRemotePath(control.value.rootDeploymentPath, `${control.value.logsPath}/${service.name}.log`)
  activeLog.value = { path, title: `${service.name} — Log` }
}

async function handleStop(service: DetectedService) {
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

async function handleRestart(service: DetectedService) {
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

function requestDisable(service: DetectedService) {
  confirmDisable.value = service
}

async function handleDisableConfirm() {
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

async function handleHotDeploy(service: DetectedService) {
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

  // 2. Perform deploy logic similar to useDeployRunner step-by-step
  // For this simplified version we'll show a message or just implement the core SCP + MV
  alert(`Deploying ${localPath} to ${service.path}... (Implementation in progress)`)
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
          <BaseButton variant="primary" @click="router.push(`/controls/${id}/edit`)">✏️ Edit</BaseButton>
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
        <div class="tile-value">{{ control.applicationHttpPort || '—' }} / {{ control.applicationHttpsPort || '—' }}</div>
      </div>
      <div class="info-tile">
        <label>Root Path</label>
        <div class="tile-value truncate" :title="control.rootDeploymentPath">{{ control.rootDeploymentPath }}</div>
      </div>
      <div class="info-tile">
        <label>Last Scan</label>
        <div class="tile-value">{{ session.lastScanAt ? new Date(session.lastScanAt).toLocaleTimeString() : 'Never' }}</div>
      </div>
    </div>

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
            <button 
              :class="{ active: viewMode === 'grid' }" 
              @click="viewMode = 'grid'"
            >
              Grid
            </button>
            <button 
              :class="{ active: viewMode === 'list' }" 
              @click="viewMode = 'list'"
            >
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

      <div 
        v-else 
        class="services-container" 
        :class="viewMode"
      >
        <ServiceControlItem
          v-for="svc in filteredServices"
          :key="svc.id"
          :service="svc"
          :connection="control"
          :is-action-loading="isActionRunning"
          @stop="handleStop"
          @restart="handleRestart"
          @disable="requestDisable"
          @hot-deploy="handleHotDeploy"
          @view-log="openServiceLog"
        />
      </div>
    </section>

    <!-- Overlay: Log Viewer -->
    <div v-if="activeLog" class="log-overlay">
      <div class="log-modal">
        <LogViewer
          :connection="control"
          :log-path="activeLog.path"
          :title="activeLog.title"
          @close="activeLog = null"
        />
      </div>
    </div>

    <!-- Confirm Dialog: Disable -->
    <ConfirmDialog
      v-if="confirmDisable"
      title="Disable Service"
      :message="`Are you sure you want to disable '${confirmDisable.name}'? This will rename its directory and stop the process.`"
      confirm-label="Disable Service"
      variant="danger"
      @confirm="handleDisableConfirm"
      @cancel="confirmDisable = null"
    />
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

.scan-loading, .empty-services {
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
  to { transform: rotate(360deg); }
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
</style>
