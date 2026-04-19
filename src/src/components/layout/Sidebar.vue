<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useUIStore } from '@/stores/ui'

interface NavItem {
  label: string
  to: string
  icon: string
  deprecated?: boolean
}

const ui = useUIStore()

const navItems: NavItem[] = [
  { label: 'Deployments',  to: '/',             icon: '⚡', deprecated: true },
  { label: 'Controls',     to: '/controls',      icon: '🎮' },
  { label: 'Release Tool', to: '/release-tool', icon: '🔖' },
  { label: 'Devtools+',    to: '/devtools',     icon: '🛠' },
  { label: 'Settings',     to: '/settings',     icon: '⚙' },
]

const appVersion = __APP_VERSION__
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': ui.isSidebarCollapsed }">
    <!-- Header -->
    <div class="sidebar-header">
      <div class="header-content" v-if="!ui.isSidebarCollapsed">
        <span class="logo-icon">🚀</span>
        <div class="logo-text">
          <span class="logo-name">Hot Deploy</span>
          <span class="logo-sub">GUI</span>
        </div>
      </div>
      <div class="header-content centered" v-else>
         <span class="logo-icon">🚀</span>
      </div>
      
      <button 
        class="toggle-btn" 
        @click="ui.toggleSidebar" 
        :title="ui.isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
      >
        <i :class="ui.isSidebarCollapsed ? 'pi pi-chevron-right' : 'pi pi-bars'"></i>
      </button>
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
          :class="{ 'nav-item--active': isActive, 'nav-item--deprecated': item.deprecated }"
          :title="ui.isSidebarCollapsed ? (item.deprecated ? `${item.label} (Deprecated)` : item.label) : ''"
          @click="navigate"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span v-if="!ui.isSidebarCollapsed" class="nav-label">{{ item.label }}</span>
          <span v-if="!ui.isSidebarCollapsed && item.deprecated" class="deprecated-badge">DEPRECATED</span>
        </div>
      </RouterLink>
    </nav>

    <!-- Footer -->
    <div class="sidebar-footer">
      <span v-if="!ui.isSidebarCollapsed" class="version-label">v{{ appVersion }}</span>
      <span v-else class="version-label centered">{{ appVersion }}</span>
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.sidebar--collapsed {
  width: 68px;
  min-width: 68px;
}

/* ── Header / Logo ───────────────────────────────────────── */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 16px 18px;
  border-bottom: 1px solid var(--color-surface-3);
  height: 64px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

.header-content.centered {
  justify-content: center;
  width: 100%;
}

.logo-icon {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  white-space: nowrap;
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

.toggle-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background-color: var(--color-surface-2);
  color: var(--color-text-primary);
}

.sidebar--collapsed .sidebar-header {
  padding: 16px 0;
}

.sidebar--collapsed .toggle-btn {
  position: absolute;
  top: 14px;
  right: 10px;
  z-index: 10;
  background-color: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  transform: translateX(50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.sidebar--collapsed .toggle-btn:hover {
  background-color: var(--color-surface-3);
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
  transition: all 0.15s ease;
  cursor: pointer;
  white-space: nowrap;
}

.sidebar--collapsed .nav-item {
  justify-content: center;
  padding: 10px 0;
}

.nav-item:hover {
  background-color: var(--color-surface-2);
  color: var(--color-text-primary);
}

.nav-item--active {
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
  opacity: 1;
  transition: opacity 0.2s;
}

.deprecated-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 4px;
  background-color: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning);
  border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
  margin-left: 6px;
  flex-shrink: 0;
}

.nav-item--deprecated:hover .deprecated-badge {
  background-color: color-mix(in srgb, var(--color-warning) 25%, transparent);
}

/* ── Footer ──────────────────────────────────────────────── */
.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--color-surface-3);
  min-height: 48px;
  display: flex;
  align-items: center;
}

.sidebar--collapsed .sidebar-footer {
  padding: 12px 0;
  justify-content: center;
}

.version-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.version-label.centered {
  font-size: 9px;
  text-align: center;
}
</style>
