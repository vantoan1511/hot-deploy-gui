<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDeploymentsStore } from '@/stores/deployments'
import DeploymentCard from '@/components/deployments/DeploymentCard.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

const router = useRouter()
const store = useDeploymentsStore()

const search = ref('')
const deleteTarget = ref<string | null>(null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.sortedDeployments
  
  return store.sortedDeployments.filter(d => {
    return (
      d.name.toLowerCase().includes(q) ||
      d.host.toLowerCase().includes(q) ||
      d.username.toLowerCase().includes(q) ||
      d.serviceName.toLowerCase().includes(q) ||
      d.tags.some(t => t.toLowerCase().includes(q))
    )
  })
})

onMounted(async () => {
  await store.load()
})

async function handleClone(id: string) {
  try {
    await store.clone(id)
  } catch (err) {
    console.error('Failed to clone deployment:', err)
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
      console.error('Failed to delete deployment:', err)
    }
  }
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
    <ConfirmDialog
      v-if="deleteTarget"
      title="Delete Configuration"
      :message="`Are you sure you want to delete '${store.getById(deleteTarget)?.name}'? This action cannot be undone.`"
      confirm-label="Delete"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
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
  gap: 32px;
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
  gap: 16px;
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
</style>
