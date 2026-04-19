<script setup lang="ts">
// Settings view — placeholder for M5
</script>

<template>
  <div class="settings-page">
    <header class="page-header">
      <h1 class="page-title">Settings</h1>
      <p class="page-sub">Application preferences and defaults</p>
    </header>

    <div class="coming-soon">
      <div class="cs-icon">⚙</div>
      <h2 class="cs-title">Coming Soon</h2>
      <p class="cs-sub">Settings configuration will be available in a future release.</p>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  padding: 32px;
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.page-header { display: flex; flex-direction: column; gap: 4px; }

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.page-sub {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;
  gap: 12px;
  text-align: center;
}

.cs-icon {
  font-size: 40px;
  margin-bottom: 4px;
  opacity: 0.4;
}

.cs-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.cs-sub {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
  max-width: 320px;
}
</style>
