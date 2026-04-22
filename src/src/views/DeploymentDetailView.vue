<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { filesystem } from '@neutralinojs/lib'
import { useDeploymentsStore } from '@/stores/deployments'
import { serializeExport } from '@/utils/exportImport'
import { useSaveDialog } from '@/composables/useFileDialog'
import BaseButton from '@/components/ui/BaseButton.vue'
import TagBadge from '@/components/ui/TagBadge.vue'
import BaseConfirmDialog from '@/components/ui/BaseConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useDeploymentsStore()

const id = route.params.id as string
const showDeleteConfirm = ref(false)
const isExporting = ref(false)

const deployment = computed(() => store.getById(id))

onMounted(async () => {
  if (store.deployments.length === 0) {
    await store.load()
  }
})

async function handleDelete() {
  await store.remove(id)
  router.push('/')
}

async function handleExport() {
  if (!deployment.value) return
  isExporting.value = true
  try {
    const slug = deployment.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const path = await useSaveDialog({
      title: 'Export Deployment',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: `${slug}.json`,
    })
    if (!path) return
    const json = serializeExport({ deployments: [deployment.value] })
    await filesystem.writeFile(path, json)
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="view-page">
    <div v-if="!deployment && !store.isLoading" class="not-found">
      <div class="empty-icon">❓</div>
      <p>Deployment configuration not found.</p>
      <BaseButton @click="router.push('/')">← Back to Dashboard</BaseButton>
    </div>

    <template v-else-if="deployment">
      <!-- Header -->
      <div class="detail-header">
        <button class="back-btn" @click="router.push('/')">← Back</button>
        <div class="header-actions">
          <BaseButton variant="ghost" class="delete-link" @click="showDeleteConfirm = true">
            Delete
          </BaseButton>
          <BaseButton variant="ghost" :loading="isExporting" @click="handleExport">
            Export
          </BaseButton>
          <BaseButton variant="secondary" @click="router.push(`/deployments/${id}/edit`)">
            Edit
          </BaseButton>
          <BaseButton variant="primary" @click="router.push(`/deployments/${id}/deploy`)">
            Deploy →
          </BaseButton>
        </div>
      </div>

      <div class="detail-content">
        <!-- Title & description -->
        <div class="detail-intro">
          <h1 class="detail-name">{{ deployment.name }}</h1>
          <div v-if="deployment.tags.length" class="detail-tags">
            <TagBadge v-for="tag in deployment.tags" :key="tag" :label="tag" />
          </div>
          <p v-if="deployment.description" class="detail-desc">{{ deployment.description }}</p>
        </div>

        <!-- Info Grid -->
        <div class="info-grid">
          <section class="info-section">
            <h3 class="section-title">Connection</h3>
            <dl class="field-list">
              <div class="field-item">
                <dt>Host</dt>
                <dd>{{ deployment.host }}:{{ deployment.sshPort }}</dd>
              </div>
              <div class="field-item">
                <dt>Username</dt>
                <dd>{{ deployment.username }}</dd>
              </div>
              <div class="field-item">
                <dt>Auth Method</dt>
                <dd>{{ deployment.authMethod === 'key' ? 'SSH Key' : 'Password' }}</dd>
              </div>
              <div v-if="deployment.authMethod === 'key'" class="field-item">
                <dt>Key Path</dt>
                <dd class="path">{{ deployment.privateKeyPath }}</dd>
              </div>
            </dl>
          </section>

          <section class="info-section services-section">
            <h3 class="section-title">Services ({{ deployment.services?.length ?? 0 }})</h3>
            <div class="services-list">
              <div v-for="svc in deployment.services" :key="svc.id" class="service-entry">
                <div class="service-entry-name">
                  {{ svc.name }}
                  <span v-if="svc.isUiService" class="ui-badge">UI</span>
                </div>
                <dl class="field-list">
                  <div class="field-item">
                    <dt>Local JAR</dt>
                    <dd class="path">{{ svc.localJarPath }}</dd>
                  </div>
                  <div class="field-item">
                    <dt>Start Command</dt>
                    <dd class="code"><code>{{ svc.startCommand || '—' }}</code></dd>
                  </div>
                  <div v-if="svc.stopCommand" class="field-item">
                    <dt>Stop Command</dt>
                    <dd class="code"><code>{{ svc.stopCommand }}</code></dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section class="info-section">
            <h3 class="section-title">Remote Environment</h3>
            <dl class="field-list">
              <div class="field-item">
                <dt>Deploy Path</dt>
                <dd class="path">{{ deployment.remoteDeployPath || '—' }}</dd>
              </div>
              <div class="field-item">
                <dt>Log Path</dt>
                <dd class="path">{{ deployment.remoteLogPath || '—' }}</dd>
              </div>
            </dl>
          </section>

          <section class="info-section">
            <h3 class="section-title">Metadata</h3>
            <dl class="field-list">
              <div class="field-item">
                <dt>Created</dt>
                <dd>{{ new Date(deployment.createdAt).toLocaleString() }}</dd>
              </div>
              <div class="field-item">
                <dt>Last Updated</dt>
                <dd>{{ new Date(deployment.updatedAt).toLocaleString() }}</dd>
              </div>
              <div class="field-item">
                <dt>ID</dt>
                <dd class="code"><code>{{ deployment.id }}</code></dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <!-- Delete Confirmation -->
      <BaseConfirmDialog
        v-if="showDeleteConfirm"
        title="Delete Configuration"
        :message="`Are you sure you want to delete '${deployment.name}'? This action cannot be undone.`"
        confirm-label="Delete"
        variant="danger"
        @confirm="handleDelete"
        @cancel="showDeleteConfirm = false"
      />
    </template>
  </div>
</template>

<style scoped>
.view-page {
  padding: 28px 32px;
  max-width: 900px;
  margin: 0 auto;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
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
}

.back-btn:hover {
  color: var(--color-text-primary);
  background-color: var(--color-surface-2);
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.delete-link {
  color: var(--color-error);
  font-size: 13px;
}

.delete-link:hover {
  background-color: color-mix(in srgb, var(--color-error) 10%, transparent) !important;
}

.detail-intro {
  margin-bottom: 32px;
}

.detail-name {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.detail-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.detail-desc {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}

.info-section {
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 8px;
  padding: 20px;
}

.section-title {
  margin: 0 0 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-surface-3);
  padding-bottom: 8px;
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-item dt {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 500;
}

.field-item dd {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-primary);
}

.path {
  font-family: 'Roboto Mono', monospace;
  word-break: break-all;
  font-size: 12px !important;
}

.code {
  font-family: inherit;
}

code {
  background-color: var(--color-surface-2);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: 'Roboto Mono', monospace;
  font-size: 12px;
}

.services-section {
  grid-column: 1 / -1;
}

.services-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.service-entry {
  background-color: var(--color-surface-2);
  border: 1px solid var(--color-surface-3);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.service-entry-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.ui-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: color-mix(in srgb, var(--color-primary-500) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary-500) 40%, transparent);
  color: var(--color-primary-500);
  letter-spacing: 0.05em;
}

.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 100px 0;
  color: var(--color-text-muted);
}

.empty-icon {
  font-size: 48px;
}
</style>
