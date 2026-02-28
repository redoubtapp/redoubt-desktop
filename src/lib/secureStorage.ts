/**
 * Per-instance credential storage
 *
 * Uses localStorage for now. Can be upgraded to Tauri's secure storage
 * or platform keychain later for enhanced security.
 */

import type { InstanceCredentials } from "@/types/instance";

const STORAGE_PREFIX = "redoubt:instance:";

/**
 * Get the storage key for instance credentials
 */
function getCredentialsKey(instanceId: string): string {
  return `${STORAGE_PREFIX}${instanceId}:credentials`;
}

/**
 * Get credentials for an instance
 */
export function getInstanceCredentials(
  instanceId: string
): InstanceCredentials | null {
  const key = getCredentialsKey(instanceId);
  const data = localStorage.getItem(key);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as InstanceCredentials;
  } catch {
    console.error(`Failed to parse credentials for instance ${instanceId}`);
    return null;
  }
}

/**
 * Save credentials for an instance
 */
export function setInstanceCredentials(
  instanceId: string,
  credentials: InstanceCredentials
): void {
  const key = getCredentialsKey(instanceId);
  localStorage.setItem(key, JSON.stringify(credentials));
}

/**
 * Clear credentials for an instance (on logout or instance removal)
 */
export function clearInstanceCredentials(instanceId: string): void {
  const key = getCredentialsKey(instanceId);
  localStorage.removeItem(key);
}

/**
 * Update specific credential fields without overwriting the entire object
 */
export function updateInstanceCredentials(
  instanceId: string,
  updates: Partial<InstanceCredentials>
): void {
  const existing = getInstanceCredentials(instanceId);
  if (!existing) {
    console.warn(
      `No existing credentials for instance ${instanceId}, cannot update`
    );
    return;
  }

  setInstanceCredentials(instanceId, {
    ...existing,
    ...updates,
  });
}

/**
 * Check if an instance has stored credentials
 */
export function hasInstanceCredentials(instanceId: string): boolean {
  const key = getCredentialsKey(instanceId);
  return localStorage.getItem(key) !== null;
}

/**
 * Get all instance IDs that have stored credentials
 */
export function getInstanceIdsWithCredentials(): string[] {
  const instanceIds: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX) && key.endsWith(":credentials")) {
      // Extract instanceId from key pattern: redoubt:instance:{id}:credentials
      const match = key.match(/^redoubt:instance:([^:]+):credentials$/);
      if (match) {
        instanceIds.push(match[1]);
      }
    }
  }

  return instanceIds;
}
