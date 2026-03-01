import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

/**
 * A fetch wrapper that uses Tauri's HTTP plugin to bypass CORS restrictions.
 * Falls back to native fetch if Tauri is not available (e.g. running in a browser).
 */
export const fetch: typeof globalThis.fetch =
  '__TAURI_INTERNALS__' in window ? tauriFetch : globalThis.fetch
