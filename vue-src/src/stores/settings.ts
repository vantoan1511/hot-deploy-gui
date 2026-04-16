import { defineStore } from 'pinia'
import { ref } from 'vue'
import { checkSshpass, checkPlink } from '@/composables/useSSH'

export const useSettingsStore = defineStore('settings', () => {
  const sshpassAvailable = ref<boolean | null>(null)
  const plinkAvailable = ref<boolean | null>(null)
  const isChecking = ref(false)

  async function init() {
    isChecking.value = true
    try {
      const [sshpass, plink] = await Promise.all([
        checkSshpass(),
        checkPlink()
      ])
      sshpassAvailable.value = sshpass
      plinkAvailable.value = plink
    } catch {
      sshpassAvailable.value = false
      plinkAvailable.value = false
    } finally {
      isChecking.value = false
    }
  }

  return {
    sshpassAvailable,
    plinkAvailable,
    isChecking,
    init,
  }
})
