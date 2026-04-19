import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage } from '@neutralinojs/lib'
import { v4 as uuidv4 } from 'uuid'
import type { ControlConnection, CollisionDecision } from '@/types/deployment'
import { encryptPassword, decryptPassword } from '@/utils/crypto'

const STORAGE_KEY = 'controls'
const SECRET_KEY = '_app_secret'

export const useControlsStore = defineStore('controls', () => {
  // ── State ───────────────────────────────────────────────────
  const controls = ref<ControlConnection[]>([])
  const machineSecret = ref<string | null>(null)
  const isLoading = ref(false)
  const isLoaded = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ──────────────────────────────────────────────────
  const sortedControls = computed(() =>
    [...controls.value].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  )

  function getById(id: string): ControlConnection | undefined {
    return controls.value.find(c => c.id === id)
  }

  // ── Persistence ──────────────────────────────────────────────
  async function load(force = false): Promise<void> {
    if (isLoading.value) return
    if (isLoaded.value && !force) return
    isLoading.value = true
    error.value = null
    try {
      if (!machineSecret.value) {
        try {
          const secret = await storage.getData(SECRET_KEY)
          machineSecret.value = secret
        } catch {
          const newSecret = uuidv4()
          await storage.setData(SECRET_KEY, newSecret)
          machineSecret.value = newSecret
        }
      }

      // Load controls
      const raw = await storage.getData(STORAGE_KEY)
      controls.value = JSON.parse(raw) as ControlConnection[]
      isLoaded.value = true
    } catch {
      // First launch or no data yet
      controls.value = []
      isLoaded.value = true
    } finally {
      isLoading.value = false
    }
  }

  async function persist(): Promise<void> {
    await storage.setData(STORAGE_KEY, JSON.stringify(controls.value))
  }

  // ── CRUD ─────────────────────────────────────────────────────
  async function create(data: Omit<ControlConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<ControlConnection> {
    const now = new Date().toISOString()
    
    // Encrypt password if present
    const processedData = { ...data }
    if (processedData.authMethod === 'password' && processedData.password && machineSecret.value) {
      processedData.password = await encryptPassword(processedData.password, machineSecret.value)
    }

    const control: ControlConnection = {
      ...processedData,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    }
    controls.value.push(control)
    await persist()
    return control
  }

  async function update(id: string, data: Partial<Omit<ControlConnection, 'id' | 'createdAt'>>): Promise<void> {
    const index = controls.value.findIndex(c => c.id === id)
    if (index === -1) throw new Error(`Control connection ${id} not found`)
    
    const existing = controls.value[index] as ControlConnection
    
    // Encrypt password if present and changed
    const processedData = { ...data }
    if (processedData.authMethod === 'password' && processedData.password && machineSecret.value) {
      processedData.password = await encryptPassword(processedData.password, machineSecret.value)
    } else if (processedData.authMethod === 'key') {
      processedData.password = undefined
    }

    controls.value[index] = {
      ...existing,
      ...processedData,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }
    await persist()
  }

  async function remove(id: string): Promise<void> {
    controls.value = controls.value.filter(c => c.id !== id)
    await persist()
  }

  async function clone(id: string): Promise<ControlConnection> {
    const source = getById(id)
    if (!source) throw new Error(`Control connection ${id} not found`)
    
    const { id: _, createdAt: __, updatedAt: ___, password: ____, ...rest } = source
    return create({
      ...rest,
      name: `${source.name} (Copy)`,
    })
  }

  /**
   * Returns a connection with its password decrypted.
   */
  async function getPlaintextControl(id: string): Promise<ControlConnection | undefined> {
    const c = getById(id)
    if (!c) return undefined
    
    if (c.authMethod === 'password' && c.password && machineSecret.value) {
      const plaintext = await decryptPassword(c.password, machineSecret.value)
      return { ...c, password: plaintext || undefined }
    }
    
    return { ...c }
  }

  async function updateServiceOverride(id: string, serviceId: string, override: Partial<import('@/types/deployment').ControlServiceOverride>): Promise<void> {
    const connection = getById(id)
    if (!connection) throw new Error(`Control connection ${id} not found`)
    
    const overrides = { ...connection.serviceOverrides }
    overrides[serviceId] = {
      ...(overrides[serviceId] || {}),
      ...override,
    }
    
    await update(id, { serviceOverrides: overrides })
  }

  async function importMerge(
    incoming: ControlConnection[],
    decisions: CollisionDecision[],
  ): Promise<{ added: number; replaced: number; skipped: number }> {
    const decisionMap = new Map(decisions.map(d => [d.id, d.action]))
    let added = 0, replaced = 0, skipped = 0

    for (const item of incoming) {
      const existingIdx = controls.value.findIndex(d => d.id === item.id)
      if (existingIdx === -1) {
        controls.value.push(item)
        added++
      } else {
        const action = decisionMap.get(item.id) ?? 'skip'
        if (action === 'replace') {
          controls.value[existingIdx] = item
          replaced++
        } else if (action === 'keep-both') {
          controls.value.push({
            ...item,
            id: uuidv4(),
            name: `${item.name} (Imported)`,
            updatedAt: new Date().toISOString(),
          })
          added++
        } else {
          skipped++
        }
      }
    }

    await persist()
    return { added, replaced, skipped }
  }

  return {
    controls,
    sortedControls,
    isLoading,
    error,
    getById,
    getPlaintextControl,
    load,
    create,
    update,
    remove,
    clone,
    updateServiceOverride,
    importMerge,
  }
})
