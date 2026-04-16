<script setup lang="ts">
import Sidebar from './Sidebar.vue'
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
