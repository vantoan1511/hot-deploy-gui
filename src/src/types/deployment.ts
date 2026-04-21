// ── Service ─────────────────────────────────────────────────
// One deployable unit within a Deployment configuration

export interface Service {
  id: string              // UUID v4
  name: string            // Service folder name and process identifier
  localJarPath: string    // Absolute local path to the .jar file
  startCommand: string    // Shell command to start (empty = skipped)
  stopCommand?: string    // Custom stop command (default: pkill -f <svcPath>)
  isUiService?: boolean   // Upload-and-rename only; no service dir resolution or extraction
}

// ── SSH Base Configuration ──────────────────────────────────
// Fields common to all SSH-based connections

export type AuthMethod = 'key' | 'password'

export interface SSHConfig {
  host: string             // Remote hostname or IP
  username: string         // SSH login username
  authMethod: AuthMethod
  sshPort: number          // Port (default 22)
  privateKeyPath?: string  // Absolute local path to SSH private key
  password?: string        // Encrypted SSH password
}

// ── Deployment Configuration ────────────────────────────────
// Core data entity as defined in SPEC.md §2.1

export interface Deployment extends SSHConfig {
  id: string               // UUID v4
  name: string             // Human-readable label
  
  remoteDeployPath: string // Absolute remote base path (supports wildcards)
  remoteLogPath: string    // Absolute remote log directory
  services: Service[]      // One or more services to deploy

  createdAt: string        // ISO 8601
  updatedAt: string        // ISO 8601
  tags: string[]
  description?: string
}

// ── Control Configuration ───────────────────────────────────
// Server-wide management configuration

export interface ControlConnection extends SSHConfig {
  id: string               // UUID v4
  name: string             // Human-readable label
  
  // Application specifics
  applicationName: string      // e.g. "my-app"
  applicationHttpPort?: number
  applicationHttpsPort?: number
  
  // Path specifics
  rootDeploymentPath: string   // Absolute base, e.g. "/opt/my-app"
  servicesPath: string         // Absolute, relative, or wildcard
  logsPath: string             // Absolute or relative, default "logs"
  
  // Overrides for dynamic services
  serviceOverrides: Record<string, ControlServiceOverride> // serviceId (folder name) -> overrides

  statusPollIntervalSeconds?: number  // 0 = disabled, default 5

  createdAt: string
  updatedAt: string
  tags: string[]

  // Deployment specifics
  localPackagePath?: string     // Local .jar or .tgz
  preCommands?: string[]        // Remote commands before finalize
  postCommands?: string[]       // Remote commands after finalize
  runPostOnFailure?: boolean    // Whether to run post-commands if pre-commands fail
}

export interface ControlServiceOverride {
  startCommand?: string
  localJarPath?: string
}

export interface DetectedService {
  id: string               // Derived from path/name
  name: string             // Friendly name
  type: 'directory' | 'ui'
  path: string             // Full remote path
  status: 'running' | 'stopped' | 'disabled' | 'error'
  pids: number[]
  detectedStartCommand?: string
  lastChecked: number
}

// ── App Settings ────────────────────────────────────────────

export interface AppSettings {
  theme: 'dark' | 'system'
  defaultSshPort: number
  sshpassAvailable: boolean | null  // null = not yet checked
}

// ── Deploy Session ──────────────────────────────────────────

export type StepStatus = 'idle' | 'running' | 'success' | 'warning' | 'error' | 'skipped'

export interface StepResult {
  stepIndex: number
  status: StepStatus
  startedAt: number | null      // Date.now()
  finishedAt: number | null
  output: string                // Accumulated stdout + stderr
  exitCode: number | null
}

export interface DeploySession {
  deploymentId: string
  startedAt: number
  steps: StepResult[]
  isRunning: boolean
  currentStepIndex: number
  resolvedDeployPath: string | null          // wildcard expanded at runtime
  resolvedSvcPaths: Record<string, string>   // serviceId → resolved remote path
  services: Service[]                        // snapshot of services at session start
}

// ── Control Session ─────────────────────────────────────────

export interface ControlSession {
  connectionId: string
  isScanning: boolean
  lastScanAt: number | null
  services: DetectedService[]
}

// ── Import / Export ─────────────────────────────────────────

export interface ExportBundle {
  version: '1'
  exportedAt: string   // ISO 8601
  deployments?: Deployment[]
  controls?: ControlConnection[]
}

export type CollisionAction = 'replace' | 'keep-both' | 'skip'

export interface CollisionDecision {
  id: string
  action: CollisionAction
}

export interface CollisionItem {
  id: string
  name: string
  host: string
  username: string
  updatedAt: string
}
