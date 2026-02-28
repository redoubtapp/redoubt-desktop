/**
 * Migration Utility
 *
 * Handles migration of existing single-instance auth data to the new
 * multi-instance storage format.
 */

import { setInstanceCredentials } from "./secureStorage";
import { useInstanceStore } from "@/store/instanceStore";

const MIGRATION_KEY = "redoubt:migration:v1";
const LEGACY_AUTH_KEY = "redoubt-auth";
const DEFAULT_API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface LegacyAuthState {
  state: {
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: string | null;
    user: {
      id: string;
      username: string;
      email: string;
      avatar_url?: string;
    } | null;
  };
  version?: number;
}

/**
 * Check if migration has already been completed
 */
function isMigrationComplete(): boolean {
  return localStorage.getItem(MIGRATION_KEY) === "complete";
}

/**
 * Mark migration as complete
 */
function markMigrationComplete(): void {
  localStorage.setItem(MIGRATION_KEY, "complete");
}

/**
 * Get legacy auth data from localStorage
 */
function getLegacyAuthData(): LegacyAuthState | null {
  try {
    const data = localStorage.getItem(LEGACY_AUTH_KEY);
    if (!data) return null;
    return JSON.parse(data) as LegacyAuthState;
  } catch {
    return null;
  }
}

/**
 * Clean up legacy auth data
 */
function cleanupLegacyAuth(): void {
  localStorage.removeItem(LEGACY_AUTH_KEY);
}

/**
 * Migrate existing single-instance auth to multi-instance format
 *
 * This function:
 * 1. Checks if migration is needed (legacy auth exists, not yet migrated)
 * 2. Creates a default instance from VITE_API_URL
 * 3. Migrates credentials to new secure storage format
 * 4. Cleans up old storage
 * 5. Marks migration complete
 *
 * Returns true if migration was performed, false otherwise.
 */
export async function migrateToMultiInstance(): Promise<boolean> {
  // Skip if already migrated
  if (isMigrationComplete()) {
    return false;
  }

  // Check for legacy auth data
  const legacyAuth = getLegacyAuthData();

  // If no legacy auth and no instances exist, just mark complete
  const store = useInstanceStore.getState();
  if (!legacyAuth && store.instances.length === 0) {
    markMigrationComplete();
    return false;
  }

  // If instances already exist but migration not marked, just mark complete
  if (store.instances.length > 0) {
    markMigrationComplete();
    return false;
  }

  // No legacy auth to migrate
  if (!legacyAuth?.state?.refreshToken) {
    markMigrationComplete();
    return false;
  }

  console.log("[Migration] Starting migration to multi-instance format...");

  try {
    // Create default instance from the API URL
    const instance = await store.addInstance(DEFAULT_API_URL);
    console.log("[Migration] Created default instance:", instance.id);

    // Migrate credentials to new storage format
    // If expiresAt is missing, set a past date to force token refresh
    const expiresAt = legacyAuth.state.expiresAt || new Date(0).toISOString();
    setInstanceCredentials(instance.id, {
      accessToken: legacyAuth.state.accessToken,
      refreshToken: legacyAuth.state.refreshToken!,
      expiresAt,
    });
    console.log("[Migration] Migrated credentials");

    // Set as active instance
    store.setActiveInstance(instance.id);
    console.log("[Migration] Set as active instance");

    // Clean up legacy auth
    cleanupLegacyAuth();
    console.log("[Migration] Cleaned up legacy auth data");

    // Mark migration complete
    markMigrationComplete();
    console.log("[Migration] Migration complete");

    return true;
  } catch (error) {
    console.error("[Migration] Failed to migrate:", error);
    // Don't mark as complete so we can retry
    return false;
  }
}

/**
 * Reset migration status (for testing/debugging)
 */
export function resetMigration(): void {
  localStorage.removeItem(MIGRATION_KEY);
}
