<script setup lang="ts">
import { onMounted } from 'vue'
import Sidebar from './Sidebar.vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
onMounted(() => settings.init())
</script>

<template>
  <div class="app-shell">
    <Sidebar />
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  background-color: var(--color-surface-0);
}
</style>
