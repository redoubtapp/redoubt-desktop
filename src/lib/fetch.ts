import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

/**
 * A fetch wrapper that uses Tauri's HTTP plugin to bypass CORS restrictions.
 * Uses a lazy check so it works regardless of module evaluation order.
 * Falls back to native fetch if Tauri is not available (e.g. running in a browser).
 */
export const fetch: typeof globalThis.fetch = (...args) =>
  ('__TAURI_INTERNALS__' in window ? tauriFetch : globalThis.fetch)(...args)
