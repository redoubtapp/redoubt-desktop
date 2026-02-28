/**
 * Presence Store
 *
 * Manages user presence and typing indicators via instance-scoped stores.
 */

import { type StoreApi } from "zustand";
import { createInstanceAwareStore } from "./createInstanceStore";

type PresenceStatus = "online" | "idle" | "offline";

export interface UserPresence {
  userId: string;
  username: string;
  avatarUrl?: string;
  status: PresenceStatus;
  voiceChannelId?: string;
  muted?: boolean;
  deafened?: boolean;
  video?: boolean;
  streaming?: boolean;
  speaking?: boolean;
}

interface TypingUser {
  userId: string;
  username: string;
  channelId: string;
  startedAt: number;
}

export interface PresenceState {
  // User presence by userId
  presence: Map<string, UserPresence>;

  // Typing indicators by channelId
  typing: Map<string, TypingUser[]>;

  // WebSocket connection
  isConnected: boolean;
  reconnectAttempts: number;

  // Actions
  setPresence: (userId: string, presence: UserPresence) => void;
  removePresence: (userId: string) => void;
  setVoiceState: (
    userId: string,
    channelId: string | null | undefined,
    state?: Partial<UserPresence>
  ) => void;
  setTyping: (channelId: string, userId: string, username: string) => void;
  clearTyping: (channelId: string, userId: string) => void;
  setConnected: (connected: boolean) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;

  // Selectors
  getUsersInChannel: (channelId: string) => UserPresence[];
  getTypingUsers: (channelId: string) => TypingUser[];
  isUserOnline: (userId: string) => boolean;

  // Reset
  reset: () => void;
}

/**
 * Create a presence store for a specific instance
 */
function createPresenceStore(_instanceId: string) {
  return (
    set: StoreApi<PresenceState>["setState"],
    get: StoreApi<PresenceState>["getState"]
  ): PresenceState => ({
    presence: new Map(),
    typing: new Map(),
    isConnected: false,
    reconnectAttempts: 0,

    setPresence: (userId, presence) => {
      set((state) => {
        const existing = state.presence.get(userId);
        const newPresence = new Map(state.presence);
        // Merge with existing to preserve fields like avatarUrl
        newPresence.set(userId, existing ? { ...existing, ...presence } : presence);
        return { presence: newPresence };
      });
    },

    removePresence: (userId) => {
      set((state) => {
        const newPresence = new Map(state.presence);
        newPresence.delete(userId);
        return { presence: newPresence };
      });
    },

    setVoiceState: (userId, channelId, state = {}) => {
      set((s) => {
        const existing = s.presence.get(userId);
        const newPresence = new Map(s.presence);

        if (existing) {
          newPresence.set(userId, {
            ...existing,
            voiceChannelId:
              channelId === undefined
                ? existing.voiceChannelId
                : channelId || undefined,
            ...state,
          });
        } else if (channelId) {
          newPresence.set(userId, {
            userId,
            username: state.username || userId,
            status: "online",
            voiceChannelId: channelId,
            ...state,
          });
        }

        return { presence: newPresence };
      });
    },

    setTyping: (channelId, userId, username) => {
      set((state) => {
        const newTyping = new Map(state.typing);
        const channelTyping = [...(newTyping.get(channelId) || [])];

        const existingIndex = channelTyping.findIndex((t) => t.userId === userId);
        const typingUser = { userId, username, channelId, startedAt: Date.now() };

        if (existingIndex >= 0) {
          channelTyping[existingIndex] = typingUser;
        } else {
          channelTyping.push(typingUser);
        }

        newTyping.set(channelId, channelTyping);
        return { typing: newTyping };
      });
    },

    clearTyping: (channelId, userId) => {
      set((state) => {
        const newTyping = new Map(state.typing);
        const channelTyping = newTyping.get(channelId) || [];
        newTyping.set(
          channelId,
          channelTyping.filter((t) => t.userId !== userId)
        );
        return { typing: newTyping };
      });
    },

    setConnected: (isConnected) => set({ isConnected }),
    incrementReconnectAttempts: () =>
      set((s) => ({ reconnectAttempts: s.reconnectAttempts + 1 })),
    resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),

    getUsersInChannel: (channelId) => {
      return Array.from(get().presence.values()).filter(
        (p) => p.voiceChannelId === channelId
      );
    },

    getTypingUsers: (channelId) => {
      return get().typing.get(channelId) || [];
    },

    isUserOnline: (userId) => {
      const presence = get().presence.get(userId);
      return presence?.status === "online" || presence?.status === "idle";
    },

    reset: () => {
      set({
        presence: new Map(),
        typing: new Map(),
        isConnected: false,
        reconnectAttempts: 0,
      });
    },
  });
}

/**
 * Instance-scoped presence stores factory
 * Use this for multi-instance support
 */
export const presenceStores =
  createInstanceAwareStore<PresenceState>(createPresenceStore);

/**
 * Hook to use presence store for a specific instance
 */
export function useInstancePresenceStore(
  instanceId: string
): StoreApi<PresenceState> {
  return presenceStores.get(instanceId);
}
