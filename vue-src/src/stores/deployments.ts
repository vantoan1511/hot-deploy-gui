import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage } from '@neutralinojs/lib'
import { v4 as uuidv4 } from 'uuid'
import type { Deployment } from '@/types/deployment'

const STORAGE_KEY = 'deployments'

export const useDeploymentsStore = defineStore('deployments', () => {
  // ── State ────────────────────────────────────────────────
  const deployments = ref<Deployment[]>([])
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
    const deployment: Deployment = {
      ...data,
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
    deployments.value[index] = {
      ...existing,
      ...data,
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
    return create({
      ...source,
      name: `${source.name} (Copy)`,
      password: undefined, // do not clone sensitive fields
    })
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
    load,
    create,
    update,
    remove,
    clone,
    replaceAll,
  }
})
