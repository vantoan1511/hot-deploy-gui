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
  let pollingTimer: ReturnType<typeof setInterval> | null = null

  function startPolling(connection: ControlConnection) {
    stopPolling()
    const intervalMs = (connection.statusPollIntervalSeconds ?? 5) * 1000
    if (intervalMs <= 0) return
    pollingTimer = setInterval(async () => {
      const session = sessionStore.getOrCreateSession(connection.id)
      if (!session.isScanning && session.services.length > 0) {
        await bulkEnrichServices(connection, session.services)
      }
    }, intervalMs)
  }

  function stopPolling() {
    if (pollingTimer !== null) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

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

      const dirs = new Set(entries.filter(e => e.endsWith('/')).map(e => e.replace(/\/$/, '')))
      const jars = entries.filter(e => e.endsWith('.jar')).map(e => e.replace(/\.jar$/, ''))

      // Step 3: Build skeletons immediately — no SSH calls needed
      // If both dir and jar exist → java service; if only jar and name contains 'ui' → UI service
      const detected: DetectedService[] = []
      for (const name of jars) {
        const fullPath = `${resolvedPath}/${name}`
        if (dirs.has(name)) {
          detected.push(makeServiceSkeleton(name, 'directory', fullPath))
        } else if (name.toLowerCase().includes('ui')) {
          detected.push(makeServiceSkeleton(name, 'ui', `${fullPath}.jar`))
        }
      }

      // Show services immediately, stop scanning indicator
      sessionStore.setServices(connection.id, detected)
      sessionStore.setScanning(connection.id, false)

      // Step 4: Single SSH call to enrich all services at once
      bulkEnrichServices(connection, detected).catch(() => {})
    } catch (err) {
      console.error(`Scan aborted for ${connection.name}:`, err)
    } finally {
      sessionStore.setScanning(connection.id, false)
    }
  }

  function makeServiceSkeleton(name: string, type: 'directory' | 'ui', path: string): DetectedService {
    const status: DetectedService['status'] = path.endsWith('_disabled') ? 'disabled' : 'stopped'
    return { id: name, name, type, path, status, pids: [], lastChecked: Date.now() }
  }

  async function bulkEnrichServices(connection: ControlConnection, services: DetectedService[]): Promise<void> {
    if (services.length === 0) return
    const pathList = services.map(s => `"${s.path}"`).join(' ')
    const script = `for p in ${pathList}; do pids=$(pgrep -f "$p" 2>/dev/null | tr '\\n' ' '); first=$(echo "$pids" | awk '{print $1}'); cmd=$([ -n "$first" ] && tr '\\0' ' ' < /proc/$first/cmdline 2>/dev/null | tr -d '\\n\\r' || echo ""); printf 'SVC\\t%s\\t%s\\t%s\\n' "$p" "\${pids% }" "$cmd"; done`
    const res = await execSSH(connection, script)
    const byPath = new Map(services.map(s => [s.path, s]))
    for (const line of res.output.split('\n')) {
      if (!line.startsWith('SVC\t')) continue
      const parts = line.split('\t')
      const path = parts[1]
      const rawPids = parts[2] ?? ''
      const cmd = parts.slice(3).join('\t')  // rejoin in case cmd contains tabs
      if (!path) continue
      const svc = byPath.get(path)
      if (!svc) continue
      const pids = rawPids.trim() ? rawPids.trim().split(/\s+/).map(Number).filter(n => !isNaN(n)) : []
      const status: DetectedService['status'] = svc.path.endsWith('_disabled') ? 'disabled' : pids.length > 0 ? 'running' : 'stopped'
      const update: Partial<DetectedService> = { status, pids, lastChecked: Date.now() }
      const trimmedCmd = cmd?.trim()
      if (trimmedCmd) update.detectedStartCommand = trimmedCmd
      sessionStore.updateService(connection.id, svc.id, update)
    }
  }

  async function enrichServiceStatus(connection: ControlConnection, service: DetectedService): Promise<Partial<DetectedService>> {
    const res = await execSSH(connection, `pids=$(pgrep -f "${service.path}"); if [ -n "$pids" ]; then echo "PIDS:$pids"; first=$(echo "$pids" | head -n 1); echo "CMD:$(tr '\\0' ' ' < /proc/$first/cmdline 2>/dev/null | tr -d '\\n\\r')"; fi`)
    const lines = res.output.split('\n').map((l: string) => l.trim()).filter(Boolean)
    const pidsLine = lines.find((l: string) => l.startsWith('PIDS:'))
    const pids = pidsLine
      ? pidsLine.replace('PIDS:', '').split(/\s+/).map((p: string) => parseInt(p)).filter((p: number) => !isNaN(p))
      : []
    const startCmd = lines.find((l: string) => l.startsWith('CMD:'))?.replace('CMD:', '').trim()
    let status: DetectedService['status'] = pids.length > 0 ? 'running' : 'stopped'
    if (service.path.endsWith('_disabled')) status = 'disabled'
    const update: Partial<DetectedService> = { status, pids, lastChecked: Date.now() }
    if (startCmd) update.detectedStartCommand = startCmd
    return update
  }

  async function createDetectedService(
    connection: ControlConnection,
    name: string,
    type: 'directory' | 'ui',
    path: string
  ): Promise<DetectedService> {
    const skeleton = makeServiceSkeleton(name, type, path)
    const update = await enrichServiceStatus(connection, skeleton)
    return { ...skeleton, ...update }
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
    const fallbackCmd = service.type === 'directory' ? `java -jar ${service.name}.jar` : undefined
    const cmd = override?.startCommand || service.detectedStartCommand || fallbackCmd

    if (!cmd) throw new Error(`No start command found for ${service.name}`)

    // 2. Stop if running
    if (service.status === 'running') {
      await stopService(connection, service)
    }

    // 3. Start
    const workDir = service.type === 'directory' ? service.path : connection.rootDeploymentPath
    const logPath = resolveRemotePath(connection.rootDeploymentPath, `${connection.logsPath}/${service.name}.log`)
    const fullCmd = `cd "${workDir}" && nohup ${cmd} > "${logPath}" 2>&1 &`

    console.log(`[restart] ${service.name}`, { cmd, workDir, logPath, fullCmd, cmdSource: override?.startCommand ? 'override' : service.detectedStartCommand ? 'detected' : 'fallback' })

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
    startPolling,
    stopPolling,
    stopService,
    restartService,
    disableService,
    refreshService,
    deployPackage,
    resetDeployStatus,
  }
}
