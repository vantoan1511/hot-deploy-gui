import { useControlSessionStore } from '@/stores/controlSession'
import { useControlsStore } from '@/stores/controls'
import type { ControlConnection, DetectedService } from '@/types/deployment'
import { isUrl, resolveRemotePath } from '@/utils/pathUtils'
import { ref } from 'vue'
import { execSCP, execSSH } from './useSSH'

export const useControlRunner = () => {
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
  const scanServices = async (connection: ControlConnection) => {
    sessionStore.setScanning(connection.id, true)

    try {
      // Step 1: Resolve Path (Sequential Check)
      // This will throw if it times out, correctly stopping the scan.
      const resolvedPath = await resolveServicesPath(connection)
      if (!resolvedPath) {
        sessionStore.setServices(connection.id, [])
        return
      }

      // Step 2: Initial Directory List (The "Alive" Check)
      const listRes = await execSSH(connection, `ls -F "${resolvedPath}"`)
      
      // If the command failed (not a timeout, but an actual SSH/FS error)
      if (listRes.exitCode !== 0) {
        console.warn(`Scan failed for ${connection.name}: ${listRes.output}`)
        // We don't throw here to avoid potentially messy UI alerts for background scans,
        // but we STOP further scanning.
        return
      }

      const entries = listRes.output.split('\n').map(l => l.trim()).filter(Boolean)

      // Step 3: Parallel Scan (only if Step 2 succeeded)
      const scanPromises = entries.map(async (entry) => {
        const isDir = entry.endsWith('/')
        const name = entry.replace(/[\/]$/, '')
        const fullPath = `${resolvedPath}/${name}`

        if (isDir) {
          // Check for .jar inside the directory (marker)
          const jarCheck = await execSSH(connection, `ls "${fullPath}"/*.jar 2>/dev/null | head -1`)
          if (jarCheck.output.trim()) {
            return await createDetectedService(connection, name, 'directory', fullPath)
          }
        } else if (name.endsWith('.jar')) {
          // UI service case
          return await createDetectedService(connection, name.replace('.jar', ''), 'ui', fullPath)
        }
        return null
      })

      const results = await Promise.all(scanPromises)
      const detected = results.filter((s): s is DetectedService => s !== null)

      sessionStore.setServices(connection.id, detected)
    } catch (err) {
      console.error(`Scan aborted for ${connection.name}:`, err)
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
    // Single SSH call to get both PIDs and the start command of the first PID
    const res = await execSSH(connection, `pids=$(pgrep -f "${path}"); if [ -n "$pids" ]; then echo "PIDS:$pids"; first=$(echo "$pids" | head -n 1); ps -p "$first" -o args= | head -n 1; fi`)
    
    const lines = res.output.split('\n').map(l => l.trim()).filter(Boolean)
    const pidsLine = lines.find(l => l.startsWith('PIDS:'))
    const pids = pidsLine 
      ? pidsLine.replace('PIDS:', '').split(/\s+/).map(p => parseInt(p)).filter(p => !isNaN(p))
      : []
    
    // The line after PIDS: (or the only other line) is the command args
    const startCmd = lines.find(l => !l.startsWith('PIDS:'))

    let status: DetectedService['status'] = pids.length > 0 ? 'running' : 'stopped'
    if (path.endsWith('_disabled')) status = 'disabled'

    return {
      id: name,
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
      if (isUrl(pkgPath)) {
        deployStatus.value.currentStep = `Downloading (Remote) ${filename}...`
        const wgetCmd = `wget -q --no-check-certificate -O "${tmpPath}" "${pkgPath}"`
        const wgetRes = await execSSH(control, wgetCmd)
        deployStatus.value.logs.push(`[WGET] ${wgetRes.output || 'Download complete'}`)
        if (wgetRes.exitCode !== 0) throw new Error(`Fetch failed: ${wgetRes.output}`)
      } else {
        const scpRes = await execSCP(control, pkgPath, tmpPath)
        deployStatus.value.logs.push(`[TRANSFER] ${scpRes.output || 'Upload complete'}`)
        if (scpRes.exitCode !== 0) throw new Error(`Transfer failed: ${scpRes.output}`)
      }

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
