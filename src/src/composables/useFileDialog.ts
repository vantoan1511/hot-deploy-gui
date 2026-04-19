import { os } from '@neutralinojs/lib'

export interface FileDialogOptions {
  title?: string
  filters?: Array<{ name: string; extensions: string[] }>
  defaultPath?: string
}

/**
 * Show an OS-native open-file dialog.
 * Returns the chosen path, or null if cancelled.
 */
export async function useOpenDialog(options: FileDialogOptions = {}): Promise<string | null> {
  try {
    const result = await os.showOpenDialog(options.title ?? 'Open File', {
      filters: options.filters,
      defaultPath: options.defaultPath,
    })
    // showOpenDialog returns string[] (selected paths)
    return (Array.isArray(result) ? result[0] : result) ?? null
  } catch {
    return null
  }
}

/**
 * Show an OS-native save-file dialog.
 * Returns the chosen path, or null if cancelled.
 */
export async function useSaveDialog(options: FileDialogOptions = {}): Promise<string | null> {
  try {
    const result = await os.showSaveDialog(options.title ?? 'Save File', {
      filters: options.filters,
      defaultPath: options.defaultPath,
    })
    // showSaveDialog returns a string path
    return (result as string | null) ?? null
  } catch {
    return null
  }
}
