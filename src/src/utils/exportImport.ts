import { z, type ZodIssue } from 'zod'
import type { Deployment, ExportBundle } from '@/types/deployment'

// ── Zod Schema ───────────────────────────────────────────────

const ServiceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  localJarPath: z.string().min(1),
  startCommand: z.string(),
  stopCommand: z.string().optional(),
  isUiService: z.boolean().optional(),
})

const DeploymentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  host: z.string().min(1),
  username: z.string().min(1),
  authMethod: z.enum(['key', 'password']),
  privateKeyPath: z.string().optional(),
  password: z.string().optional(),
  sshPort: z.number().int().min(1).max(65535),
  remoteDeployPath: z.string().optional(),
  remoteLogPath: z.string().optional(),
  services: z.array(ServiceSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  tags: z.array(z.string()),
  description: z.string().optional(),
})

const ServiceOverrideSchema = z.object({
  startCommand: z.string().optional(),
  stopCommand: z.string().optional(),
  localJarPath: z.string().optional(),
})

const ControlConnectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  host: z.string().min(1),
  username: z.string().min(1),
  authMethod: z.enum(['key', 'password']),
  sshPort: z.number().int().min(1).max(65535),
  applicationName: z.string().optional(),
  applicationHttpPort: z.number().optional(),
  applicationHttpsPort: z.number().optional(),
  rootDeploymentPath: z.string().optional(),
  servicesPath: z.string().optional(),
  logsPath: z.string().optional(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  privateKeyPath: z.string().optional(),
  password: z.string().optional(),
  serviceOverrides: z.record(z.string(), ServiceOverrideSchema).optional(),
  // Hot Deploy
  localPackagePath: z.string().optional(),
  preCommands: z.array(z.string()).optional(),
  postCommands: z.array(z.string()).optional(),
  runPostOnFailure: z.boolean().optional(),
})

const ExportBundleSchema = z.object({
  version: z.literal('1'),
  exportedAt: z.string().datetime(),
  deployments: z.array(DeploymentSchema).optional(),
  controls: z.array(ControlConnectionSchema).optional(),
})

// ── Legacy Schema (pre-multi-service) ────────────────────────

const LegacyDeploymentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  host: z.string().min(1),
  username: z.string().min(1),
  authMethod: z.enum(['key', 'password']),
  privateKeyPath: z.string().optional(),
  password: z.string().optional(),
  sshPort: z.number().int().min(1).max(65535),
  remoteDeployPath: z.string().optional(),
  remoteLogPath: z.string().optional(),
  serviceName: z.string().optional(),
  localJarPath: z.string().optional(),
  startCommand: z.string(),
  stopCommand: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  tags: z.array(z.string()),
  description: z.string().optional(),
})

const LegacyExportBundleSchema = z.object({
  version: z.literal('1'),
  exportedAt: z.string().datetime(),
  deployments: z.array(LegacyDeploymentSchema),
})

type LegacyDeployment = z.infer<typeof LegacyDeploymentSchema>

function convertLegacy(legacy: LegacyDeployment): any {
  const { serviceName, localJarPath, startCommand, stopCommand, ...rest } = legacy
  return {
    ...rest,
    services: [{
      id: crypto.randomUUID(),
      name: serviceName,
      localJarPath,
      startCommand,
      stopCommand,
    }],
  }
}

// ── Export ───────────────────────────────────────────────────

/**
 * Serialize configs to a JSON export bundle string.
 * Passwords are stripped unless the caller pre-encrypts them.
 */
export function serializeExport(
  data: { deployments?: any[], controls?: any[] },
  includePasswords = false
): string {
  const bundle: ExportBundle = {
    version: '1',
    exportedAt: new Date().toISOString(),
    deployments: data.deployments?.map(d => ({
      ...d,
      password: includePasswords ? d.password : undefined,
    })),
    controls: data.controls?.map(c => ({
      ...c,
      password: includePasswords ? c.password : undefined,
    })),
  }
  return JSON.stringify(bundle, null, 2)
}

// ── Import ───────────────────────────────────────────────────

export interface ImportResult {
  deployments: any[]
  controls: any[]
  errors: string[]
  converted?: number
}

export function parseImport(raw: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { deployments: [], controls: [], errors: ['Invalid JSON: could not parse file.'] }
  }

  const result = ExportBundleSchema.safeParse(parsed)
  if (result.success) {
    return { 
      deployments: result.data.deployments || [], 
      controls: result.data.controls || [],
      errors: [] 
    }
  }

  // Try legacy single-service format and auto-convert
  const legacy = LegacyExportBundleSchema.safeParse(parsed)
  if (legacy.success) {
    const deployments = legacy.data.deployments.map(convertLegacy)
    return { deployments, controls: [], errors: [], converted: deployments.length }
  }

  const errors = result.error.issues.map(
    (e: ZodIssue) => `${String(e.path.join('.'))}: ${e.message}`
  )
  return { deployments: [], controls: [], errors }
}
