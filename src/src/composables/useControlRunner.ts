import { ref } from 'vue'
import { execSSH, execSCP } from './useSSH'
import { resolveRemotePath } from '@/utils/pathUtils'
import { useControlSessionStore } from '@/stores/controlSession'
import { useControlsStore } from '@/stores/controls'
import type { ControlConnection, DetectedService } from '@/types/deployment'

export function useControlRunner() {
  const sessionStore = useControlSessionStore()
  const controlsStore = useControlsStore()
  const isRefreshing = ref(false)

  /**
   * Resolve wildcards and relative paths to a single absolute services path.
   */
  async function resolveServicesPath(connection: ControlConnection): Promise<string | null> {
    const root = connection.rootDeploymentPath
    const rawPath = connection.servicesPath
    const base = resolveRemotePath(root, rawPath)

    if (base.includes('*')) {
      const parent = base.substring(0, base.lastIndexOf('/'))
      const pattern = base.substring(base.lastIndexOf('/') + 1)
      const res = await execSSH(connection, `ls -1dt ${parent}/${pattern} 2>/dev/null | head -1`)
      return res.output.trim() || null
    }

    return base
  }

  /**
   * Discover services on the remote server.
   */
  async function scanServices(connection: ControlConnection) {
    const session = sessionStore.getOrCreateSession(connection.id)
    sessionStore.setScanning(connection.id, true)

    try {
      const resolvedPath = await resolveServicesPath(connection)
      if (!resolvedPath) {
        sessionStore.setServices(connection.id, [])
        return
      }

      // 1. List all entries in the services path
      const listRes = await execSSH(connection, `ls -F "${resolvedPath}"`)
      const entries = listRes.output.split('\n').map(l => l.trim()).filter(Boolean)

      const detected: DetectedService[] = []

      for (const entry of entries) {
        const isDir = entry.endsWith('/')
        const name = entry.replace(/[\/]$/, '')
        const fullPath = `${resolvedPath}/${name}`

        if (isDir) {
          // Check for .jar inside the directory (marker)
          // We look for any .jar file, usually matching the name or just being there
          const jarCheck = await execSSH(connection, `ls "${fullPath}"/*.jar 2>/dev/null | head -1`)
          if (jarCheck.output.trim()) {
            detected.push(await createDetectedService(connection, name, 'directory', fullPath))
          }
        } else if (name.endsWith('.jar')) {
          // UI service case
          detected.push(await createDetectedService(connection, name.replace('.jar', ''), 'ui', fullPath))
        }
      }

      sessionStore.setServices(connection.id, detected)
    } finally {
      sessionStore.setScanning(connection.id, false)
    }
  }

  /**
   * Helper to build a DetectedService object with PID and status.
   */
  async function createDetectedService(
    connection: ControlConnection,
    name: string,
    type: 'directory' | 'ui',
    path: string
  ): Promise<DetectedService> {
    const pidsRes = await execSSH(connection, `pgrep -f "${path}"`)
    const pids = pidsRes.output.split('\n').map(p => parseInt(p.trim())).filter(p => !isNaN(p))
    
    let status: DetectedService['status'] = pids.length > 0 ? 'running' : 'stopped'
    if (path.endsWith('_disabled')) status = 'disabled'

    let startCmd: string | undefined = undefined
    if (pids.length === 1) {
      const cmdRes = await execSSH(connection, `ps -p ${pids[0]} -o args=`)
      startCmd = cmdRes.output.trim()
    }

    return {
      id: name, // Folders/JARs are unique enough in this context
      name,
      type,
      path,
      status,
      pids,
      detectedStartCommand: startCmd,
      lastChecked: Date.now(),
    }
  }

  async function stopService(connection: ControlConnection, service: DetectedService) {
    if (service.pids.length > 1) {
      throw new Error(`Multiple PIDs found for ${service.name}. Manual intervention required.`)
    }
    if (service.pids.length === 0) return

    await execSSH(connection, `kill ${service.pids[0]}`)
    // Partial update of UI state
    sessionStore.updateService(connection.id, service.id, { 
      status: 'stopped', 
      pids: [], 
      lastChecked: Date.now() 
    })
  }

  async function restartService(connection: ControlConnection, service: DetectedService) {
    // 1. Resolve start command (override > detected)
    const override = connection.serviceOverrides[service.id]
    const cmd = override?.startCommand || service.detectedStartCommand
    
    if (!cmd) throw new Error(`No start command found for ${service.name}`)

    // 2. Stop if running
    if (service.status === 'running') {
      await stopService(connection, service)
    }

    // 3. Start
    // Use nohup and backgrounding
    const workDir = service.type === 'directory' ? service.path : connection.rootDeploymentPath
    const logPath = resolveRemotePath(connection.rootDeploymentPath, `${connection.logsPath}/${service.name}.log`)
    const fullCmd = `cd "${workDir}" && nohup ${cmd} > "${logPath}" 2>&1 &`
    
    await execSSH(connection, fullCmd)
    
    // Refresh state after 1s
    setTimeout(() => refreshService(connection, service.id), 1500)
  }

  async function disableService(connection: ControlConnection, service: DetectedService) {
    if (service.status === 'disabled') return

    // 1. Kill if running
    if (service.pids.length > 0) {
      await stopService(connection, service)
    }

    // 2. Rename path
    const disabledPath = `${service.path}_disabled`
    await execSSH(connection, `mv "${service.path}" "${disabledPath}"`)

    sessionStore.updateService(connection.id, service.id, {
      path: disabledPath,
      status: 'disabled',
      lastChecked: Date.now()
    })
  }

  async function refreshService(connection: ControlConnection, serviceId: string) {
    const session = sessionStore.getOrCreateSession(connection.id)
    const service = session.services.find(s => s.id === serviceId)
    if (!service) return

    const updated = await createDetectedService(connection, service.name, service.type, service.path)
    sessionStore.updateService(connection.id, serviceId, updated)
  }

  // ── Hot Deploy ─────────────────────────────────────────────

  interface DeployStatus {
    phase: 'idle'|'transferring'|'cleaning'|'finalizing'|'pre-commands'|'post-commands'|'success'|'error'
    currentStep?: string
    logs: string[]
    error?: string
  }

  const deployStatus = ref<DeployStatus>({ phase: 'idle', logs: [] })

  async function deployPackage(controlId: string) {
    const control = await controlsStore.getPlaintextControl(controlId)
    if (!control) throw new Error('Control not found')
    if (!control.localPackagePath) throw new Error('No local package path configured')

    const pkgPath = control.localPackagePath
    const filename = pkgPath.split(/[/\\]/).pop() || 'package'
    const targetPath = `${control.rootDeploymentPath}/${filename}`
    const tmpPath = `${targetPath}.tmp`

    deployStatus.value = { phase: 'transferring', currentStep: `Uploading ${filename}...`, logs: [] }

    try {
      // 1. Transfer to .tmp
      const scpRes = await execSCP(control, pkgPath, tmpPath)
      deployStatus.value.logs.push(`[TRANSFER] ${scpRes.output || 'Upload complete'}`)
      if (scpRes.exitCode !== 0) throw new Error(`Transfer failed: ${scpRes.output}`)

      // 2. Remove old
      deployStatus.value.phase = 'cleaning'
      deployStatus.value.currentStep = 'Cleaning old package...'
      const rmRes = await execSSH(control, `rm -f "${targetPath}"`)
      deployStatus.value.logs.push(`[CLEANUP] Removed ${targetPath}`)

      // 3. Finalize (Rename)
      deployStatus.value.phase = 'finalizing'
      deployStatus.value.currentStep = 'Finalizing package...'
      const mvRes = await execSSH(control, `mv "${tmpPath}" "${targetPath}"`)
      if (mvRes.exitCode !== 0) throw new Error(`Finalization failed: ${mvRes.output}`)
      deployStatus.value.logs.push(`[FINALIZE] Moved ${tmpPath} -> ${targetPath}`)

      // 4. Pre-commands
      let preSuccess = true
      if (control.preCommands?.length) {
        deployStatus.value.phase = 'pre-commands'
        for (const cmd of control.preCommands) {
          if (!cmd.trim()) continue
          deployStatus.value.currentStep = `Running pre-command: ${cmd}`
          const res = await execSSH(control, cmd)
          deployStatus.value.logs.push(`[PRE] ${cmd} -> Exit ${res.exitCode}\n${res.output}`)
          if (res.exitCode !== 0) {
            preSuccess = false
            if (!control.runPostOnFailure) break
          }
        }
      }

      // 5. Post-commands
      if (control.postCommands?.length && (preSuccess || control.runPostOnFailure)) {
        deployStatus.value.phase = 'post-commands'
        for (const cmd of control.postCommands) {
          if (!cmd.trim()) continue
          deployStatus.value.currentStep = `Running post-command: ${cmd}`
          const res = await execSSH(control, cmd)
          deployStatus.value.logs.push(`[POST] ${cmd} -> Exit ${res.exitCode}\n${res.output}`)
          if (res.exitCode !== 0) break
        }
      }

      deployStatus.value.phase = preSuccess ? 'success' : 'error'
      deployStatus.value.currentStep = preSuccess ? 'Deployment successful!' : 'Deployment failed in pre-commands.'
    } catch (err) {
      deployStatus.value.phase = 'error'
      deployStatus.value.error = String(err)
      deployStatus.value.logs.push(`[ERROR] ${err}`)
    }
  }

  function resetDeployStatus() {
    deployStatus.value = { phase: 'idle', logs: [] }
  }

  return {
    isRefreshing,
    deployStatus,
    scanServices,
    stopService,
    restartService,
    disableService,
    refreshService,
    deployPackage,
    resetDeployStatus,
  }
}
