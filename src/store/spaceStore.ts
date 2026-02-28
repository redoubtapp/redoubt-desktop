/**
 * Space Store
 *
 * Manages spaces and channels via instance-scoped stores.
 */

import { type StoreApi } from "zustand";
import type { Space, Channel, SpaceMember } from "@/types/api";
import { getApiClient } from "@/lib/api";
import { createInstanceAwareStore } from "./createInstanceStore";
import { useInstanceStore } from "./instanceStore";

export interface SpaceState {
  spaces: Space[];
  currentSpaceId: string | null;
  currentChannelId: string | null;
  channels: Channel[];
  members: SpaceMember[];
  isLoading: boolean;

  // Actions
  loadSpaces: () => Promise<void>;
  selectSpace: (spaceId: string) => Promise<void>;
  selectChannel: (channelId: string) => void;
  loadChannels: (spaceId: string) => Promise<void>;
  loadMembers: (spaceId: string) => Promise<void>;
  createSpace: (name: string) => Promise<Space>;
  createChannel: (
    spaceId: string,
    name: string,
    type: "text" | "voice"
  ) => Promise<Channel>;
  reset: () => void;
}

/**
 * Create a space store for a specific instance
 */
function createSpaceStore(instanceId: string) {
  return (
    set: StoreApi<SpaceState>["setState"],
    get: StoreApi<SpaceState>["getState"]
  ): SpaceState => ({
    spaces: [],
    currentSpaceId: null,
    currentChannelId: null,
    channels: [],
    members: [],
    isLoading: false,

    loadSpaces: async () => {
      set({ isLoading: true });
      try {
        const apiClient = getApiClient(instanceId);
        const response = await apiClient.listSpaces();
        set({ spaces: response.spaces, isLoading: false });

        // Check for persisted navigation from instanceStore
        const instance = useInstanceStore.getState().getInstanceById(instanceId);
        const { currentSpaceId } = get();

        if (!currentSpaceId && response.spaces.length > 0) {
          // Try to restore persisted space, fallback to first
          const persistedSpaceId = instance?.lastSpaceId;
          const spaceToSelect =
            persistedSpaceId && response.spaces.some((s) => s.id === persistedSpaceId)
              ? persistedSpaceId
              : response.spaces[0].id;
          await get().selectSpace(spaceToSelect);

          // If we have a persisted channel and it matches, select it
          if (persistedSpaceId === spaceToSelect && instance?.lastChannelId) {
            const { channels } = get();
            if (channels.some((c) => c.id === instance.lastChannelId)) {
              get().selectChannel(instance.lastChannelId);
            }
          }
        }
      } catch {
        set({ isLoading: false });
      }
    },

    selectSpace: async (spaceId) => {
      set({ currentSpaceId: spaceId, currentChannelId: null });
      await Promise.all([
        get().loadChannels(spaceId),
        get().loadMembers(spaceId),
      ]);

      // Auto-select first channel
      const { channels } = get();
      const channelId = channels.length > 0 ? channels[0].id : null;
      if (channelId) {
        set({ currentChannelId: channelId });
      }

      // Persist navigation to instanceStore
      useInstanceStore.getState().updateInstanceNavigation(instanceId, spaceId, channelId);
    },

    selectChannel: (channelId) => {
      set({ currentChannelId: channelId });

      // Persist navigation to instanceStore
      const { currentSpaceId } = get();
      useInstanceStore.getState().updateInstanceNavigation(instanceId, currentSpaceId, channelId);
    },

    loadChannels: async (spaceId) => {
      try {
        const apiClient = getApiClient(instanceId);
        const response = await apiClient.listChannels(spaceId);
        set({ channels: response.channels });
      } catch {
        set({ channels: [] });
      }
    },

    loadMembers: async (spaceId) => {
      try {
        const apiClient = getApiClient(instanceId);
        const response = await apiClient.getSpaceMembers(spaceId);
        set({ members: response.members });
      } catch {
        set({ members: [] });
      }
    },

    createSpace: async (name) => {
      const apiClient = getApiClient(instanceId);
      const space = await apiClient.createSpace(name);
      set((state) => ({ spaces: [...state.spaces, space] }));
      return space;
    },

    createChannel: async (spaceId, name, type) => {
      const apiClient = getApiClient(instanceId);
      const channel = await apiClient.createChannel(spaceId, { name, type });
      set((state) => ({ channels: [...state.channels, channel] }));
      return channel;
    },

    reset: () => {
      set({
        spaces: [],
        currentSpaceId: null,
        currentChannelId: null,
        channels: [],
        members: [],
        isLoading: false,
      });
    },
  });
}

/**
 * Instance-scoped space stores factory
 * Use this for multi-instance support
 */
export const spaceStores = createInstanceAwareStore<SpaceState>(createSpaceStore);

/**
 * Hook to use space store for a specific instance
 */
export function useInstanceSpaceStore(instanceId: string): StoreApi<SpaceState> {
  return spaceStores.get(instanceId);
}
