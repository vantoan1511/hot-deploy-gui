import { z, type ZodIssue } from 'zod'
import type { Deployment, ExportBundle } from '@/types/deployment'

// ── Zod Schema ───────────────────────────────────────────────

const DeploymentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  host: z.string().min(1),
  username: z.string().min(1),
  authMethod: z.enum(['key', 'password']),
  privateKeyPath: z.string().optional(),
  password: z.string().optional(),
  sshPort: z.number().int().min(1).max(65535),
  localJarPath: z.string().min(1),
  remoteDeployPath: z.string().min(1),
  remoteLogPath: z.string().min(1),
  serviceName: z.string().min(1),
  startCommand: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  tags: z.array(z.string()),
  description: z.string().optional(),
})

const ExportBundleSchema = z.object({
  version: z.literal('1'),
  exportedAt: z.string().datetime(),
  deployments: z.array(DeploymentSchema),
})

// ── Export ───────────────────────────────────────────────────

/**
 * Serialize deployments to a JSON export bundle string.
 * Passwords are stripped unless the caller pre-encrypts them.
 */
export function serializeExport(
  deployments: Deployment[],
  includePasswords = false
): string {
  const bundle: ExportBundle = {
    version: '1',
    exportedAt: new Date().toISOString(),
    deployments: deployments.map(d => ({
      ...d,
      password: includePasswords ? d.password : undefined,
    })),
  }
  return JSON.stringify(bundle, null, 2)
}

// ── Import ───────────────────────────────────────────────────

export interface ImportResult {
  deployments: Deployment[]
  errors: string[]
}

/**
 * Parse and validate a JSON export bundle.
 * Returns parsed deployments and any field-level validation errors.
 */
export function parseImport(raw: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { deployments: [], errors: ['Invalid JSON: could not parse file.'] }
  }

  const result = ExportBundleSchema.safeParse(parsed)
  if (!result.success) {
    const errors = result.error.issues.map(
      (e: ZodIssue) => `${String(e.path.join('.'))}: ${e.message}`
    )
    return { deployments: [], errors }
  }

  return {
    deployments: result.data.deployments as Deployment[],
    errors: [],
  }
}
