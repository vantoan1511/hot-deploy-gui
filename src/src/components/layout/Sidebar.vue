<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
import PanelMenu from 'primevue/panelmenu'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const ui = useUIStore()

// ── Menu Configuration ───────────────────────────────────────

const menuItems = computed(() => [
  {
    label: 'Deployments',
    to: '/',
    icon: 'pi pi-bolt',
    deprecated: true
  },
  {
    label: 'Controls',
    to: '/controls',
    icon: 'pi pi-desktop'
  },
  { label: 'Release Tool', to: '/release-tool', icon: 'pi pi-tag' },
  { label: 'Devtools+',    to: '/devtools',     icon: 'pi pi-wrench' },
  { label: 'Settings',     to: '/settings',     icon: 'pi pi-cog' },
])

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
      <!-- Full Menu -->
      <PanelMenu 
        v-if="!ui.isSidebarCollapsed"
        :model="menuItems" 
        class="custom-panelmenu"
      >
        <template #item="{ item, props, hasSubmenu }">
          <RouterLink 
            v-if="item.to" 
            :to="item.to" 
            v-slot="{ href, navigate, isActive, isExactActive }"
            custom
          >
            <a 
              :href="href" 
              v-bind="props.action" 
              @click="navigate" 
              class="menu-link"
              :class="{ 'menu-link--active': isActive || isExactActive, 'menu-link--deprecated': item.deprecated }"
            >
              <span :class="[item.icon, 'menu-icon']" />
              <span class="menu-label">{{ item.label }}</span>
              <span v-if="item.deprecated" class="deprecated-badge">DEPRECATED</span>
            </a>
          </RouterLink>
          
          <a v-else v-bind="props.action" class="menu-link menu-link--parent">
            <span :class="[item.icon, 'menu-icon']" />
            <span class="menu-label font-bold">{{ item.label }}</span>
            <i v-if="hasSubmenu" class="pi pi-angle-down submenu-icon" />
          </a>
        </template>
      </PanelMenu>

      <!-- Collapsed Icons -->
      <div v-else class="collapsed-nav">
        <RouterLink
          v-for="item in menuItems"
          :key="item.label"
          :to="item.to"
          custom
          v-slot="{ navigate, isActive }"
        >
          <div
            role="link"
            class="collapsed-item"
            :class="{ 'collapsed-item--active': isActive }"
            :title="item.label"
            @click="navigate"
          >
            <span :class="[item.icon, 'collapsed-icon']" />
          </div>
        </RouterLink>
      </div>
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
  width: 260px;
  min-width: 260px;
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
  overflow-y: auto;
}

/* Custom PanelMenu Styling */
:deep(.custom-panelmenu) {
  background: transparent;
  border: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:deep(.p-panelmenu-panel) {
  background: transparent;
  border: none;
  margin-bottom: 2px;
}

:deep(.p-panelmenu-header-content) {
  background: transparent !important;
  border: none !important;
}

:deep(.p-panelmenu-content) {
  background: transparent !important;
  border: none !important;
  padding-left: 12px;
}

.menu-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  width: 100%;
}

.menu-link:hover {
  background-color: var(--color-surface-2);
  color: var(--color-text-primary);
}

.menu-link--active {
  background-color: color-mix(in srgb, var(--color-primary-500) 12%, transparent);
  color: var(--color-primary-500);
  font-weight: 600;
}

.menu-link--parent {
  color: var(--color-text-primary);
}

.menu-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}

.menu-label {
  flex: 1;
}

.submenu-icon {
  font-size: 10px;
  color: var(--color-text-muted);
}

.deprecated-badge {
  font-size: 8px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 4px;
  background-color: color-mix(in srgb, var(--color-warning) 12%, transparent);
  color: var(--color-warning);
  border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
  margin-left: 6px;
}

/* Collapsed Icons */
.collapsed-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
}

.collapsed-item {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--color-text-muted);
  transition: all 0.2s;
  cursor: pointer;
}

.collapsed-item:hover {
  background-color: var(--color-surface-2);
  color: var(--color-text-primary);
}

.collapsed-item--active {
  background-color: color-mix(in srgb, var(--color-primary-500) 15%, transparent);
  color: var(--color-primary-500);
}

.collapsed-icon {
  font-size: 18px;
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
