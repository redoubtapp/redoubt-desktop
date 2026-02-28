/**
 * Instance Store
 *
 * Manages the list of Redoubt server instances the user has added,
 * tracks which instance is active, and handles connection state.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Instance,
  ServerInfo,
  InstanceConnectionState,
} from "@/types/instance";
import { clearInstanceCredentials } from "@/lib/secureStorage";
import { setInstanceUrlResolver, clearApiClient } from "@/lib/api";

interface InstanceState {
  // State
  instances: Instance[];
  activeInstanceId: string | null;
  connectionStates: Map<string, InstanceConnectionState>;

  // Actions
  addInstance: (url: string) => Promise<Instance>;
  removeInstance: (id: string) => Promise<void>;
  setActiveInstance: (id: string) => void;
  updateInstance: (id: string, updates: Partial<Instance>) => void;
  setConnectionState: (id: string, state: InstanceConnectionState) => void;
  updateInstanceNavigation: (
    id: string,
    spaceId: string | null,
    channelId: string | null
  ) => void;

  // Selectors (implemented as getters via getState())
  getActiveInstance: () => Instance | null;
  getInstanceById: (id: string) => Instance | null;
}

/**
 * Normalize a URL to a consistent format
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim();

  // Add https:// if no protocol specified
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = `https://${normalized}`;
  }

  // Remove trailing slash
  normalized = normalized.replace(/\/+$/, "");

  // Remove /api/v1 suffix if present (we add it when making requests)
  normalized = normalized.replace(/\/api\/v1$/, "");

  return normalized;
}

/**
 * Validate a URL is a valid Redoubt server by fetching server info
 */
async function validateRedoubtServer(url: string): Promise<ServerInfo> {
  const normalizedUrl = normalizeUrl(url);

  // Try to fetch server info from /api/v1/info endpoint
  // If that doesn't exist, fall back to checking if the API is accessible
  try {
    const response = await fetch(`${normalizedUrl}/api/v1/info`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        name: data.name || "Redoubt Server",
        version: data.version || "unknown",
        iconUrl: data.icon_url,
      };
    }
  } catch {
    // /api/v1/info might not exist, continue with fallback
  }

  // Fallback: try to access the API base to see if it's reachable
  try {
    const response = await fetch(`${normalizedUrl}/api/v1/health`, {
      method: "GET",
    });

    if (response.ok || response.status === 401) {
      // 401 means the API exists but requires auth - that's fine
      return {
        name: new URL(normalizedUrl).hostname,
        version: "unknown",
      };
    }
  } catch {
    // Try one more fallback - just check if the host is reachable
  }

  // Last fallback: check if anything responds at the URL
  try {
    const response = await fetch(normalizedUrl, {
      method: "HEAD",
    });

    if (response.ok) {
      return {
        name: new URL(normalizedUrl).hostname,
        version: "unknown",
      };
    }
  } catch {
    throw new Error("Could not connect to server. Please check the URL.");
  }

  throw new Error("Server does not appear to be a valid Redoubt instance.");
}

export const useInstanceStore = create<InstanceState>()(
  persist(
    (set, get) => ({
      instances: [],
      activeInstanceId: null,
      connectionStates: new Map(),

      addInstance: async (url: string) => {
        const normalizedUrl = normalizeUrl(url);

        // Check if instance already exists
        const existing = get().instances.find((i) => i.url === normalizedUrl);
        if (existing) {
          throw new Error("This server has already been added.");
        }

        // Validate the server
        const serverInfo = await validateRedoubtServer(normalizedUrl);

        const instance: Instance = {
          id: crypto.randomUUID(),
          url: normalizedUrl,
          name: serverInfo.name,
          iconUrl: serverInfo.iconUrl ?? null,
          addedAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        };

        set((state) => ({
          instances: [...state.instances, instance],
        }));

        return instance;
      },

      removeInstance: async (id: string) => {
        // Clear credentials for this instance
        clearInstanceCredentials(id);

        // Clear cached API client
        clearApiClient(id);

        set((state) => {
          const newInstances = state.instances.filter((i) => i.id !== id);
          const connectionStates = new Map(state.connectionStates);
          connectionStates.delete(id);

          // If removing the active instance, switch to the first remaining one
          let newActiveId = state.activeInstanceId;
          if (state.activeInstanceId === id) {
            newActiveId = newInstances.length > 0 ? newInstances[0].id : null;
          }

          return {
            instances: newInstances,
            activeInstanceId: newActiveId,
            connectionStates,
          };
        });
      },

      setActiveInstance: (id: string) => {
        const instance = get().instances.find((i) => i.id === id);
        if (!instance) {
          console.warn(`Instance ${id} not found`);
          return;
        }

        // Update lastUsedAt
        set((state) => ({
          activeInstanceId: id,
          instances: state.instances.map((i) =>
            i.id === id ? { ...i, lastUsedAt: new Date().toISOString() } : i
          ),
        }));
      },

      updateInstance: (id: string, updates: Partial<Instance>) => {
        set((state) => ({
          instances: state.instances.map((i) =>
            i.id === id ? { ...i, ...updates } : i
          ),
        }));
      },

      setConnectionState: (id: string, connectionState: InstanceConnectionState) => {
        set((state) => {
          const connectionStates = new Map(state.connectionStates);
          connectionStates.set(id, connectionState);
          return { connectionStates };
        });
      },

      updateInstanceNavigation: (
        id: string,
        spaceId: string | null,
        channelId: string | null
      ) => {
        set((state) => ({
          instances: state.instances.map((i) =>
            i.id === id
              ? { ...i, lastSpaceId: spaceId, lastChannelId: channelId }
              : i
          ),
        }));
      },

      getActiveInstance: () => {
        const { instances, activeInstanceId } = get();
        return instances.find((i) => i.id === activeInstanceId) ?? null;
      },

      getInstanceById: (id: string) => {
        return get().instances.find((i) => i.id === id) ?? null;
      },
    }),
    {
      name: "redoubt:instances",
      // Only persist instances and activeInstanceId, not connectionStates (runtime only)
      partialize: (state) => ({
        instances: state.instances,
        activeInstanceId: state.activeInstanceId,
      }),
      // Handle Map deserialization (connectionStates is not persisted but needs to be initialized)
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.connectionStates = new Map();
        }
      },
    }
  )
);

/**
 * Helper to check if there are any instances configured
 */
export function hasInstances(): boolean {
  return useInstanceStore.getState().instances.length > 0;
}

/**
 * Helper to get the active instance or throw
 */
export function getActiveInstanceOrThrow(): Instance {
  const instance = useInstanceStore.getState().getActiveInstance();
  if (!instance) {
    throw new Error("No active instance");
  }
  return instance;
}

/**
 * Initialize the instance URL resolver for the API client
 * This is called automatically when the module loads
 */
function initializeUrlResolver(): void {
  setInstanceUrlResolver((instanceId: string) => {
    const instance = useInstanceStore.getState().getInstanceById(instanceId);
    return instance?.url ?? null;
  });
}

// Register the resolver when this module loads
initializeUrlResolver();

// Export utilities for use in AddInstanceDialog
export { validateRedoubtServer, normalizeUrl };
