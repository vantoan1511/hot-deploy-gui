/**
 * AES-GCM 256 password encryption/decryption using the Web Crypto API.
 *
 * The encryption key is derived (PBKDF2) from a machine-specific salt
 * combined with a fixed app salt. This provides obfuscation against
 * casual file inspection — it is NOT multi-user key management.
 */

const APP_SALT = 'hot-deploy-gui-v1'
const PBKDF2_ITERATIONS = 100_000

async function deriveKey(machineSecret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(machineSecret + APP_SALT),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(APP_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
  return buffer.buffer
}

/**
 * Encrypt a plaintext password. Returns a base64 string: iv:ciphertext
 */
export async function encryptPassword(plaintext: string, machineSecret: string): Promise<string> {
  const key = await deriveKey(machineSecret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return `${bufferToBase64(iv.buffer)}:${bufferToBase64(ciphertext)}`
}

/**
 * Decrypt a base64-encoded "iv:ciphertext" string.
 * Returns null if decryption fails.
 */
export async function decryptPassword(encrypted: string, machineSecret: string): Promise<string | null> {
  try {
    const parts = encrypted.split(':')
    const ivB64 = parts[0]
    const ciphertextB64 = parts[1]
    if (!ivB64 || !ciphertextB64) return null
    const key = await deriveKey(machineSecret)
    const iv = new Uint8Array(base64ToBuffer(ivB64))
    const ciphertext = base64ToBuffer(ciphertextB64)
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(plaintext)
  } catch {
    return null
  }
}
