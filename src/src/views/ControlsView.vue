<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useControlsStore } from '@/stores/controls'
import type { ControlConnection } from '@/types/deployment'
import ControlCard from '@/components/controls/ControlCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const router = useRouter()
const store = useControlsStore()

const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.sortedControls
  return store.sortedControls.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.host.toLowerCase().includes(q) ||
    c.applicationName.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  await store.load()
})

async function handleClone(id: string) {
  try {
    const newControl = await store.clone(id)
    // Optional: Navigate to edit or detail of the new one
    // router.push(`/controls/${newControl.id}/edit`)
  } catch (err) {
    alert(`Failed to clone: ${err}`)
  }
}

async function handleDelete(id: string) {
  const control = store.getById(id)
  if (!control) return

  if (confirm(`Are you sure you want to delete "${control.name}"? This action cannot be undone.`)) {
    try {
      await store.remove(id)
    } catch (err) {
      alert(`Failed to delete: ${err}`)
    }
  }
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
        <input
          v-model="search"
          type="text"
          class="search-input"
          placeholder="Search by name, host, or application..."
        />
        <button v-if="search" class="clear-search" @click="search = ''">×</button>
      </div>
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
        <ControlCard
          v-for="c in filtered"
          :key="c.id"
          :control="c"
          @clone="handleClone"
          @delete="handleDelete"
        />
      </div>
    </main>
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
