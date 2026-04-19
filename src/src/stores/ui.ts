import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useUIStore = defineStore('ui', () => {
  const isSidebarCollapsed = ref(localStorage.getItem('sidebar-collapsed') === 'true')

  function toggleSidebar() {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }

  watch(isSidebarCollapsed, (val) => {
    localStorage.setItem('sidebar-collapsed', val.toString())
  })

  return {
    isSidebarCollapsed,
    toggleSidebar
  }
})
