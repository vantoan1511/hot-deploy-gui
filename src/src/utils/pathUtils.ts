import { filesystem } from '@neutralinojs/lib'
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
 * Strips a Maven/Gradle version suffix from a service directory name.
 * e.g. 'cu-dossier-processing-service-1.3.65-SNAPSHOT' → 'cu-dossier-processing-service'
 */
export function serviceBaseName(name: string): string {
  return name.replace(/-\d+\.\d+[\w.\-]*$/, '')
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

/**
 * Resolves a local path to an actual jar file.
 * If the path already ends in .jar, it is returned as-is.
 * Otherwise it is treated as a project root and the main jar is located
 * under <root>/build/libs/ — excluding javadoc/sources/kubernetes/plain classifiers.
 */
export async function resolveLocalJarPath(localPath: string): Promise<string> {
  if (localPath.toLowerCase().endsWith('.jar')) return localPath

  const cleanRoot = localPath.replace(/[/\\]+$/, '')
  const sep = cleanRoot.includes('\\') ? '\\' : '/'
  const libsDir = `${cleanRoot}${sep}build${sep}libs`

  try {
    const entries = await filesystem.readDirectory(libsDir)
    const mainJar = entries.find(e => {
      if (e.type !== 'FILE') return false
      const name = e.entry
      return name.endsWith('.jar') && !/(javadoc|sources|kubernetes|plain)\.jar$/.test(name)
    })
    return mainJar ? `${libsDir}${sep}${mainJar.entry}` : localPath
  } catch {
    return localPath
  }
}
