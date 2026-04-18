<script setup lang="ts">
import { os } from '@neutralinojs/lib'

const RELEASE_TOOL_URL = 'https://releasetoo1.netlify.app/'

async function openInBrowser() {
  await os.open(RELEASE_TOOL_URL)
}
</script>

<template>
  <div class="release-tool-page">
    <header class="page-header">
      <h1 class="page-title">Release Tool</h1>
      <p class="page-sub">Orchestrix Release Tool — manage and publish releases</p>
    </header>

    <div class="launch-card">
      <div class="launch-icon">🔖</div>
      <h2 class="launch-title">Open Release Tool</h2>
      <p class="launch-desc">
        The Release Tool runs as a web app and requires full browser access for its file picker.
        Click below to open it in your default browser.
      </p>
      <button class="btn-launch" @click="openInBrowser">
        <span class="btn-icon">↗</span>
        Open in Browser
      </button>
      <span class="launch-url">{{ RELEASE_TOOL_URL }}</span>
    </div>
  </div>
</template>

<style scoped>
.release-tool-page {
  padding: 32px;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

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

.launch-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 48px 40px;
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: 10px;
}

.launch-icon {
  font-size: 40px;
  margin-bottom: 4px;
}

.launch-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.launch-desc {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  max-width: 380px;
  line-height: 1.6;
}

.btn-launch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 10px 24px;
  background-color: var(--color-primary-500);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-launch:hover {
  opacity: 0.88;
}

.btn-icon {
  font-size: 16px;
  font-style: normal;
}

.launch-url {
  font-size: 11px;
  color: var(--color-text-muted);
  font-family: monospace;
}
</style>
