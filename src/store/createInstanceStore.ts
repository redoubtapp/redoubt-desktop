/**
 * Factory for creating instance-scoped Zustand stores
 *
 * Each Redoubt server instance gets its own isolated store instance.
 * This allows multiple instances to have separate state for spaces,
 * channels, messages, etc.
 */

import { create, type StateCreator, type StoreApi, useStore } from "zustand";

/**
 * Generic factory for creating instance-scoped stores
 *
 * @param createStoreFn - Function that creates the store state/actions given an instanceId
 * @returns Object with methods to get/clear stores by instanceId
 */
export function createInstanceScopedStore<T>(
  createStoreFn: StateCreator<T>
): InstanceScopedStoreFactory<T> {
  const stores = new Map<string, StoreApi<T>>();

  return {
    /**
     * Get or create the store for a specific instance
     */
    get(instanceId: string): StoreApi<T> {
      if (!stores.has(instanceId)) {
        const store = create<T>(createStoreFn);
        stores.set(instanceId, store);
      }
      return stores.get(instanceId)!;
    },

    /**
     * Clear the store for a specific instance (e.g., on logout or instance removal)
     */
    clear(instanceId: string): void {
      stores.delete(instanceId);
    },

    /**
     * Clear all instance stores
     */
    clearAll(): void {
      stores.clear();
    },

    /**
     * Check if a store exists for an instance
     */
    has(instanceId: string): boolean {
      return stores.has(instanceId);
    },

    /**
     * Get all active instance IDs
     */
    getActiveInstanceIds(): string[] {
      return Array.from(stores.keys());
    },
  };
}

/**
 * Factory for creating instance-scoped stores that need access to instanceId
 *
 * @param createStoreFn - Function that takes instanceId and returns a StateCreator
 * @returns Object with methods to get/clear stores by instanceId
 */
export function createInstanceAwareStore<T>(
  createStoreFn: (instanceId: string) => StateCreator<T>
): InstanceScopedStoreFactory<T> {
  const stores = new Map<string, StoreApi<T>>();

  return {
    get(instanceId: string): StoreApi<T> {
      if (!stores.has(instanceId)) {
        const store = create<T>(createStoreFn(instanceId));
        stores.set(instanceId, store);
      }
      return stores.get(instanceId)!;
    },

    clear(instanceId: string): void {
      stores.delete(instanceId);
    },

    clearAll(): void {
      stores.clear();
    },

    has(instanceId: string): boolean {
      return stores.has(instanceId);
    },

    getActiveInstanceIds(): string[] {
      return Array.from(stores.keys());
    },
  };
}

/**
 * Type for the instance-scoped store factory
 */
export interface InstanceScopedStoreFactory<T> {
  get: (instanceId: string) => StoreApi<T>;
  clear: (instanceId: string) => void;
  clearAll: () => void;
  has: (instanceId: string) => boolean;
  getActiveInstanceIds: () => string[];
}

/**
 * Hook to use an instance-scoped store with a selector
 *
 * @param factory - The instance-scoped store factory
 * @param instanceId - The instance ID to use
 * @param selector - Selector function to extract state
 * @returns Selected state
 */
export function useInstanceStore<T, R>(
  factory: InstanceScopedStoreFactory<T>,
  instanceId: string,
  selector: (state: T) => R
): R {
  const store = factory.get(instanceId);
  return useStore(store, selector);
}

/**
 * Hook to get the full store API for an instance
 *
 * @param factory - The instance-scoped store factory
 * @param instanceId - The instance ID to use
 * @returns The store API
 */
export function useInstanceStoreApi<T>(
  factory: InstanceScopedStoreFactory<T>,
  instanceId: string
): StoreApi<T> {
  return factory.get(instanceId);
}
