import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ControlSession, DetectedService } from '@/types/deployment'

export const useControlSessionStore = defineStore('controlSession', () => {
  const sessions = ref<Record<string, ControlSession>>({})

  function getOrCreateSession(connectionId: string): ControlSession {
    if (!sessions.value[connectionId]) {
      sessions.value[connectionId] = {
        connectionId,
        isScanning: false,
        lastScanAt: null,
        services: [],
      }
    }
    return sessions.value[connectionId]!
  }

  function setScanning(connectionId: string, isScanning: boolean) {
    const session = getOrCreateSession(connectionId)
    session.isScanning = isScanning
    if (!isScanning) {
      session.lastScanAt = Date.now()
    }
  }

  function setServices(connectionId: string, services: DetectedService[]) {
    const session = getOrCreateSession(connectionId)
    session.services = services
  }

  function updateService(connectionId: string, serviceId: string, update: Partial<DetectedService>) {
    const session = getOrCreateSession(connectionId)
    const index = session.services.findIndex(s => s.id === serviceId)
    if (index !== -1) {
      session.services[index] = { ...session.services[index]!, ...update }
    }
  }

  return {
    sessions,
    getOrCreateSession,
    setScanning,
    setServices,
    updateService,
  }
})
