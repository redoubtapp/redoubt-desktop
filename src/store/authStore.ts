/**
 * Auth Store
 *
 * Manages authentication state via instance-scoped stores.
 */

import { type StoreApi } from "zustand";
import type { User } from "@/types/api";
import { ApiError, getApiClient } from "@/lib/api";
import {
  getInstanceCredentials,
  setInstanceCredentials,
  clearInstanceCredentials,
} from "@/lib/secureStorage";
import { createInstanceAwareStore } from "./createInstanceStore";

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
    inviteCode: string
  ) => Promise<string>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  setError: (error: string | null) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  loadFromStorage: () => Promise<void>;
}

/**
 * Create an auth store for a specific instance
 */
function createAuthStore(instanceId: string) {
  return (
    set: StoreApi<AuthState>["setState"],
    get: StoreApi<AuthState>["getState"]
  ): AuthState => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    isLoading: false,
    error: null,

    login: async (email, password) => {
      set({ isLoading: true, error: null });
      try {
        const apiClient = getApiClient(instanceId);
        const response = await apiClient.login({ email, password });
        apiClient.setAccessToken(response.access_token);

        // Save credentials to secure storage
        setInstanceCredentials(instanceId, {
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          expiresAt: response.expires_at,
        });

        set({
          user: response.user,
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          expiresAt: response.expires_at,
          isLoading: false,
        });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.detail : "Login failed";
        set({ error: message, isLoading: false });
        throw err;
      }
    },

    register: async (email, username, password, inviteCode) => {
      set({ isLoading: true, error: null });
      try {
        const apiClient = getApiClient(instanceId);
        const response = await apiClient.register({
          email,
          username,
          password,
          invite_code: inviteCode,
        });
        set({ isLoading: false });
        return response.message;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.detail : "Registration failed";
        set({ error: message, isLoading: false });
        throw err;
      }
    },

    logout: async () => {
      try {
        const apiClient = getApiClient(instanceId);
        await apiClient.logout();
      } catch {
        // Ignore errors, logout anyway
      }

      // Clear credentials from storage
      clearInstanceCredentials(instanceId);

      // Clear API client token
      try {
        const apiClient = getApiClient(instanceId);
        apiClient.setAccessToken(null);
      } catch {
        // Ignore if client doesn't exist
      }

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      });
    },

    refreshAccessToken: async () => {
      const { refreshToken } = get();
      if (!refreshToken) return false;

      try {
        const apiClient = getApiClient(instanceId);
        const response = await apiClient.refresh(refreshToken);
        apiClient.setAccessToken(response.access_token);

        // Update credentials in storage
        setInstanceCredentials(instanceId, {
          accessToken: response.access_token,
          refreshToken: response.refresh_token || refreshToken,
          expiresAt: response.expires_at,
        });

        set({
          accessToken: response.access_token,
          refreshToken: response.refresh_token || refreshToken,
          expiresAt: response.expires_at,
        });
        return true;
      } catch {
        // Refresh failed, clear auth
        get().clearAuth();
        return false;
      }
    },

    setError: (error) => set({ error }),

    setUser: (user) => set({ user }),

    clearAuth: () => {
      // Clear credentials from storage
      clearInstanceCredentials(instanceId);

      // Clear API client token
      try {
        const apiClient = getApiClient(instanceId);
        apiClient.setAccessToken(null);
      } catch {
        // Ignore if client doesn't exist
      }

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      });
    },

    loadFromStorage: async () => {
      const credentials = getInstanceCredentials(instanceId);
      if (!credentials) return;

      // Set the access token on the API client
      const apiClient = getApiClient(instanceId);
      if (credentials.accessToken) {
        apiClient.setAccessToken(credentials.accessToken);
      }

      set({
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        expiresAt: credentials.expiresAt,
      });

      // Try to fetch the current user to validate the token
      try {
        const user = await apiClient.getCurrentUser();
        set({ user });
      } catch {
        // Token might be expired, try to refresh
        const refreshed = await get().refreshAccessToken();
        if (refreshed) {
          // Try again after refresh
          try {
            const user = await apiClient.getCurrentUser();
            set({ user });
          } catch {
            // Still failed, clear auth
            get().clearAuth();
          }
        }
      }
    },
  });
}

/**
 * Instance-scoped auth stores factory
 * Use this for multi-instance support
 */
export const authStores = createInstanceAwareStore<AuthState>(createAuthStore);

/**
 * Hook to use auth store for a specific instance
 */
export function useInstanceAuthStore(
  instanceId: string
): StoreApi<AuthState> {
  return authStores.get(instanceId);
}
