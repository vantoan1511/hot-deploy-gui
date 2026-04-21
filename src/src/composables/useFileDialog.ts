import { os } from '@neutralinojs/lib'

export interface FileDialogOptions {
  title?: string
  filters?: Array<{ name: string; extensions: string[] }>
  defaultPath?: string
}

/**
 * Show an OS-native open-file dialog with a 60s safety timeout.
 * Returns the chosen path, or null if cancelled or timed out.
 */
export async function useOpenDialog(options: FileDialogOptions = {}): Promise<string | null> {
  const DIALOG_TIMEOUT = 60000
  let timer: any
  
  try {
    const dialogPromise = os.showOpenDialog(options.title ?? 'Open File', {
      filters: options.filters,
      defaultPath: options.defaultPath,
    })
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Dialog timed out')), DIALOG_TIMEOUT)
    })

    const result = await Promise.race([dialogPromise, timeoutPromise])
    // showOpenDialog returns string[] (selected paths)
    return (Array.isArray(result) ? result[0] : result) ?? null
  } catch (err) {
    console.warn('File dialog failed or timed out:', err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Show an OS-native folder picker dialog with a 60s safety timeout.
 * Returns the chosen folder path, or null if cancelled or timed out.
 */
export async function useOpenFolderDialog(options: { title?: string; defaultPath?: string } = {}): Promise<string | null> {
  const DIALOG_TIMEOUT = 60000
  let timer: any

  try {
    const dialogPromise = os.showFolderDialog(options.title ?? 'Select Folder', {
      defaultPath: options.defaultPath,
    })

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Dialog timed out')), DIALOG_TIMEOUT)
    })

    const result = await Promise.race([dialogPromise, timeoutPromise])
    return (result as string | null) ?? null
  } catch (err) {
    console.warn('Folder dialog failed or timed out:', err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Show an OS-native save-file dialog with a 60s safety timeout.
 * Returns the chosen path, or null if cancelled or timed out.
 */
export async function useSaveDialog(options: FileDialogOptions = {}): Promise<string | null> {
  const DIALOG_TIMEOUT = 60000
  let timer: any

  try {
    const dialogPromise = os.showSaveDialog(options.title ?? 'Save File', {
      filters: options.filters,
      defaultPath: options.defaultPath,
    })

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Dialog timed out')), DIALOG_TIMEOUT)
    })

    const result = await Promise.race([dialogPromise, timeoutPromise])
    // showSaveDialog returns a string path
    return (result as string | null) ?? null
  } catch (err) {
    console.warn('Save dialog failed or timed out:', err)
    return null
  } finally {
    clearTimeout(timer)
  }
}
