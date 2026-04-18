// ── Service ─────────────────────────────────────────────────
// One deployable unit within a Deployment configuration

export interface Service {
  id: string              // UUID v4
  name: string            // Service folder name and process identifier
  localJarPath: string    // Absolute local path to the .jar file
  startCommand: string    // Shell command to start (empty = skipped)
  stopCommand?: string    // Custom stop command (default: pkill -f <svcPath>)
}

// ── Deployment Configuration ────────────────────────────────
// Core data entity as defined in SPEC.md §2.1

export type AuthMethod = 'key' | 'password'

export interface Deployment {
  id: string               // UUID v4
  name: string             // Human-readable label
  host: string             // Remote hostname or IP
  username: string         // SSH login username
  authMethod: AuthMethod
  privateKeyPath?: string  // Absolute local path to SSH private key
  password?: string        // Encrypted SSH password
  sshPort: number          // Default: 22
  remoteDeployPath: string // Absolute remote base path (supports wildcards)
  remoteLogPath: string    // Absolute remote log directory
  services: Service[]      // One or more services to deploy
  createdAt: string        // ISO 8601
  updatedAt: string        // ISO 8601
  tags: string[]
  description?: string
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

// ── Import / Export ─────────────────────────────────────────

export interface ExportBundle {
  version: '1'
  exportedAt: string   // ISO 8601
  deployments: Deployment[]
}
