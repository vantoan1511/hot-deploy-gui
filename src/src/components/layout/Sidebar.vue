<script setup lang="ts">
import { RouterLink, useLink } from 'vue-router'

interface NavItem {
  label: string
  to: string
  icon: string
}

const navItems: NavItem[] = [
  { label: 'Deployments',  to: '/',             icon: '⚡' },
  { label: 'Controls',     to: '/controls',      icon: '🎮' },
  { label: 'Release Tool', to: '/release-tool', icon: '🔖' },
  { label: 'Devtools+',    to: '/devtools',     icon: '🛠' },
  { label: 'Settings',     to: '/settings',     icon: '⚙' },
]

const appVersion = __APP_VERSION__
</script>

<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="sidebar-header">
      <span class="logo-icon">🚀</span>
      <div class="logo-text">
        <span class="logo-name">Hot Deploy</span>
        <span class="logo-sub">GUI</span>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        custom
        v-slot="{ navigate, isActive }"
      >
        <div
          role="link"
          class="nav-item"
          :class="{ 'nav-item--active': isActive }"
          @click="navigate"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </div>
      </RouterLink>
    </nav>

    <!-- Footer -->
    <div class="sidebar-footer">
      <span class="version-label">v{{ appVersion }}</span>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  min-width: 240px;
  height: 100%;
  background-color: var(--color-surface-1);
  border-right: 1px solid var(--color-surface-3);
  display: flex;
  flex-direction: column;
  user-select: none;
}

/* ── Header / Logo ───────────────────────────────────────── */
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 18px;
  border-bottom: 1px solid var(--color-surface-3);
}

.logo-icon {
  font-size: 22px;
  line-height: 1;
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.logo-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.logo-sub {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-primary-500);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ── Navigation ──────────────────────────────────────────── */
.sidebar-nav {
  flex: 1;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: background-color 0.15s, color 0.15s;
}

.nav-item:hover {
  background-color: var(--color-surface-2);
  color: var(--color-text-primary);
}

.nav-item--active,
.nav-item--exact-active {
  background-color: color-mix(in srgb, var(--color-primary-500) 15%, transparent);
  color: var(--color-primary-500);
}

.nav-icon {
  font-size: 15px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
}

/* ── Footer ──────────────────────────────────────────────── */
.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--color-surface-3);
}

.version-label {
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
