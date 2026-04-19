import type { Service } from '@/types/deployment'

/**
 * Basename of the local JAR file for a service.
 * e.g. 'auth-service-1.0.0.jar'
 */
export function remoteJarFilename(service: Service): string {
  return service.localJarPath.split(/[/\\]/).pop() ?? service.localJarPath
}

/**
 * Derived log path: remoteLogPath + '/' + serviceName + '.log'
 * e.g. /opt/my-app/logs/my-service.log
 */
export function remoteServiceLogPath(remoteLogPath: string, serviceName: string): string {
  return `${remoteLogPath.replace(/\/$/, '')}/${serviceName}.log`
}

/**
 * Resolves a remote path.
 * If 'path' is relative (doesn't start with /), it's resolved against 'root'.
 * Removes trailing slashes for consistency.
 */
export function resolveRemotePath(root: string, path: string): string {
  const cleanRoot = root.replace(/\/+$/, '')
  let cleanPath = path.trim()

  if (!cleanPath.startsWith('/')) {
    // Handle leading ./ or just the name
    cleanPath = cleanPath.replace(/^\.\//, '')
    return `${cleanRoot}/${cleanPath}`.replace(/\/+$/, '')
  }

  return cleanPath.replace(/\/+$/, '')
}

export function isUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://')
}
