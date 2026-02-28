/**
 * WebSocket Hook
 *
 * Provides WebSocket connectivity for the active instance using ConnectionManager.
 */

import { useEffect, useCallback } from "react";
import { useStore } from "zustand";
import { authStores } from "@/store/authStore";
import { useInstanceStore } from "@/store/instanceStore";
import { connectionManager } from "@/lib/connectionManager";

/**
 * WebSocket hook for the active instance
 */
export function useWebSocket() {
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);
  const authStore = activeInstanceId ? authStores.get(activeInstanceId) : null;
  const userId = useStore(authStore ?? authStores.get(""), (s) => s.user?.id);

  useEffect(() => {
    if (!userId || !activeInstanceId) {
      return;
    }

    connectionManager.connect(activeInstanceId, userId);

    return () => {
      // Don't disconnect on unmount - ConnectionManager manages lifecycle
    };
  }, [userId, activeInstanceId]);

  const sendTyping = useCallback(
    (channelId: string) => {
      if (activeInstanceId) {
        connectionManager.send(activeInstanceId, "typing.start", {
          channel_id: channelId,
        });
      }
    },
    [activeInstanceId]
  );

  const subscribeToSpace = useCallback(
    (spaceId: string) => {
      if (activeInstanceId) {
        connectionManager.send(activeInstanceId, "subscribe", {
          space_id: spaceId,
        });
      }
    },
    [activeInstanceId]
  );

  const unsubscribeFromSpace = useCallback(
    (spaceId: string) => {
      if (activeInstanceId) {
        connectionManager.send(activeInstanceId, "unsubscribe", {
          space_id: spaceId,
        });
      }
    },
    [activeInstanceId]
  );

  return { sendTyping, subscribeToSpace, unsubscribeFromSpace };
}

/**
 * Hook specifically for multi-instance mode
 * Use this when you need explicit control over which instance to connect to
 */
export function useInstanceWebSocket(instanceId: string) {
  const authStore = authStores.get(instanceId);
  const userId = useStore(authStore, (s) => s.user?.id);

  useEffect(() => {
    if (!userId || !instanceId) {
      return;
    }

    connectionManager.connect(instanceId, userId);

    return () => {
      // Connection lifecycle managed by ConnectionManager
    };
  }, [userId, instanceId]);

  const sendTyping = useCallback(
    (channelId: string) => {
      connectionManager.send(instanceId, "typing.start", {
        channel_id: channelId,
      });
    },
    [instanceId]
  );

  const subscribeToSpace = useCallback(
    (spaceId: string) => {
      connectionManager.send(instanceId, "subscribe", { space_id: spaceId });
    },
    [instanceId]
  );

  const unsubscribeFromSpace = useCallback(
    (spaceId: string) => {
      connectionManager.send(instanceId, "unsubscribe", { space_id: spaceId });
    },
    [instanceId]
  );

  return { sendTyping, subscribeToSpace, unsubscribeFromSpace };
}
