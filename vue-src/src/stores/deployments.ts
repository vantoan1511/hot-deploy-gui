import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage } from '@neutralinojs/lib'
import { v4 as uuidv4 } from 'uuid'
import type { Deployment } from '@/types/deployment'
import { encryptPassword, decryptPassword } from '@/utils/crypto'

const STORAGE_KEY = 'deployments'
const SECRET_KEY = '_app_secret'

export const useDeploymentsStore = defineStore('deployments', () => {
  // ── State ────────────────────────────────────────────────
  const deployments = ref<Deployment[]>([])
  const machineSecret = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ──────────────────────────────────────────────
  const sortedDeployments = computed(() =>
    [...deployments.value].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  )

  function getById(id: string): Deployment | undefined {
    return deployments.value.find(d => d.id === id)
  }

  // ── Persistence ──────────────────────────────────────────
  async function load(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      // Load machine secret
      try {
        const secret = await storage.getData(SECRET_KEY)
        machineSecret.value = secret
      } catch {
        const newSecret = uuidv4()
        await storage.setData(SECRET_KEY, newSecret)
        machineSecret.value = newSecret
      }

      // Load deployments
      const raw = await storage.getData(STORAGE_KEY)
      deployments.value = JSON.parse(raw) as Deployment[]
    } catch {
      // First launch — no data yet
      deployments.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function persist(): Promise<void> {
    await storage.setData(STORAGE_KEY, JSON.stringify(deployments.value))
  }

  // ── CRUD ─────────────────────────────────────────────────
  async function create(data: Omit<Deployment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deployment> {
    const now = new Date().toISOString()
    
    // Encrypt password if present
    const processedData = { ...data }
    if (processedData.authMethod === 'password' && processedData.password && machineSecret.value) {
      processedData.password = await encryptPassword(processedData.password, machineSecret.value)
    }

    const deployment: Deployment = {
      ...processedData,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    }
    deployments.value.push(deployment)
    await persist()
    return deployment
  }

  async function update(id: string, data: Partial<Omit<Deployment, 'id' | 'createdAt'>>): Promise<void> {
    const index = deployments.value.findIndex(d => d.id === id)
    if (index === -1) throw new Error(`Deployment ${id} not found`)
    
    const existing = deployments.value[index] as Deployment
    
    // Encrypt password if present and changed
    const processedData = { ...data }
    if (processedData.authMethod === 'password' && processedData.password && machineSecret.value) {
      processedData.password = await encryptPassword(processedData.password, machineSecret.value)
    } else if (processedData.authMethod === 'key') {
      processedData.password = undefined // clear password if switching to key
    }

    deployments.value[index] = {
      ...existing,
      ...processedData,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }
    await persist()
  }

  async function remove(id: string): Promise<void> {
    deployments.value = deployments.value.filter(d => d.id !== id)
    await persist()
  }

  async function clone(id: string): Promise<Deployment> {
    const source = getById(id)
    if (!source) throw new Error(`Deployment ${id} not found`)
    
    // We don't clone the encrypted password because it might be tricky or 
    // we want forced re-entry for security when cloning.
    return create({
      ...source,
      name: `${source.name} (Copy)`,
      password: undefined, 
    })
  }

  /**
   * Returns a deployment with its password decrypted.
   * Useful for SSH actions.
   */
  async function getPlaintextDeployment(id: string): Promise<Deployment | undefined> {
    const d = getById(id)
    if (!d) return undefined
    
    if (d.authMethod === 'password' && d.password && machineSecret.value) {
      const plaintext = await decryptPassword(d.password, machineSecret.value)
      return { ...d, password: plaintext || undefined }
    }
    
    return { ...d }
  }

  // ── Bulk operations (import/export) ──────────────────────
  async function replaceAll(list: Deployment[]): Promise<void> {
    deployments.value = list
    await persist()
  }

  return {
    deployments,
    sortedDeployments,
    isLoading,
    error,
    getById,
    getPlaintextDeployment,
    load,
    create,
    update,
    remove,
    clone,
    replaceAll,
  }
})
