/**
 * Connection Manager
 *
 * Coordinates WebSocket connections across multiple Redoubt instances.
 * Manages the active instance connection and handles instance switching.
 */

import { WebSocketManager, type WSEvent } from "./webSocketManager";
import { useInstanceStore } from "@/store/instanceStore";
import { presenceStores, type UserPresence } from "@/store/presenceStore";
import { chatStores } from "@/store/chatStore";
import { authStores } from "@/store/authStore";
import { useVoiceStore } from "@/store/voiceStore";
import { soundManager } from "./soundManager";
import type { InstanceConnectionStatus } from "@/types/instance";

interface QueuedMessage {
  type: string;
  payload?: Record<string, unknown>;
}

interface InstanceConnection {
  instanceId: string;
  websocket: WebSocketManager;
  status: InstanceConnectionStatus;
  unsubscribe: (() => void) | null;
  messageQueue: QueuedMessage[];
}

type ConnectionChangeHandler = (
  instanceId: string,
  connected: boolean
) => void;

/**
 * Manages connections to multiple Redoubt instances
 */
class ConnectionManager {
  private connections: Map<string, InstanceConnection> = new Map();
  private activeInstanceId: string | null = null;
  private connectionChangeHandlers: Set<ConnectionChangeHandler> = new Set();

  /**
   * Connect to an instance
   */
  async connect(instanceId: string, userId: string): Promise<void> {
    const instance = useInstanceStore.getState().getInstanceById(instanceId);
    if (!instance) {
      console.error(`[ConnectionManager] Instance ${instanceId} not found`);
      return;
    }

    // Check if already connected
    const existing = this.connections.get(instanceId);
    if (existing?.status === "connected") {
      console.log(`[ConnectionManager] Already connected to ${instanceId}`);
      return;
    }

    // Update connection state
    useInstanceStore
      .getState()
      .setConnectionState(instanceId, { status: "connecting" });

    // Create WebSocket manager if needed
    let connection = this.connections.get(instanceId);
    if (!connection) {
      const wsManager = new WebSocketManager(instance.url, instanceId);
      connection = {
        instanceId,
        websocket: wsManager,
        status: "connecting",
        unsubscribe: null,
        messageQueue: [],
      };
      this.connections.set(instanceId, connection);
    }

    // Subscribe to WebSocket events
    const unsubscribe = connection.websocket.subscribe(
      userId,
      (event) => this.handleMessage(instanceId, event),
      (connected) => this.handleConnectionChange(instanceId, connected)
    );

    connection.unsubscribe = unsubscribe;
  }

  /**
   * Disconnect from an instance
   */
  async disconnect(instanceId: string): Promise<void> {
    const connection = this.connections.get(instanceId);
    if (!connection) return;

    console.log(`[ConnectionManager] Disconnecting from ${instanceId}`);

    // Leave voice if connected on this instance
    const voiceInstanceId = useVoiceStore.getState().instanceId;
    if (voiceInstanceId === instanceId) {
      // Voice disconnect is handled by useVoice hook
      useVoiceStore.getState().reset();
    }

    // Unsubscribe and close WebSocket
    connection.unsubscribe?.();
    connection.websocket.closeConnection();

    // Update state
    this.connections.delete(instanceId);
    useInstanceStore.getState().setConnectionState(instanceId, {
      status: "disconnected",
    });
  }

  /**
   * Switch active instance - disconnects from previous, connects to new
   */
  async switchInstance(instanceId: string, userId: string): Promise<void> {
    // Disconnect from previous active instance
    if (this.activeInstanceId && this.activeInstanceId !== instanceId) {
      await this.disconnect(this.activeInstanceId);
    }

    this.activeInstanceId = instanceId;

    // Connect to new instance
    await this.connect(instanceId, userId);
  }

  /**
   * Get connection for an instance
   */
  getConnection(instanceId: string): InstanceConnection | null {
    return this.connections.get(instanceId) ?? null;
  }

  /**
   * Get WebSocket manager for an instance
   */
  getWebSocket(instanceId: string): WebSocketManager | null {
    return this.connections.get(instanceId)?.websocket ?? null;
  }

  /**
   * Check if connected to an instance
   */
  isConnected(instanceId: string): boolean {
    const connection = this.connections.get(instanceId);
    return connection?.status === "connected";
  }

  /**
   * Get the active instance ID
   */
  getActiveInstanceId(): string | null {
    return this.activeInstanceId;
  }

  /**
   * Subscribe to connection changes
   */
  onConnectionChange(handler: ConnectionChangeHandler): () => void {
    this.connectionChangeHandlers.add(handler);
    return () => {
      this.connectionChangeHandlers.delete(handler);
    };
  }

  /**
   * Send a message through an instance's WebSocket
   * If the WebSocket isn't connected yet, the message is queued and sent when connected.
   */
  send(instanceId: string, type: string, payload?: Record<string, unknown>): void {
    const connection = this.connections.get(instanceId);
    if (!connection) {
      console.warn(`[ConnectionManager] No connection for instance ${instanceId}, dropping message:`, type);
      return;
    }

    if (connection.websocket.isOpen) {
      connection.websocket.sendMessage(type, payload);
    } else {
      // Queue the message to be sent when connected
      console.log(`[ConnectionManager] Queueing message for ${instanceId}:`, type);
      connection.messageQueue.push({ type, payload });
    }
  }

  /**
   * Flush queued messages for an instance
   */
  private flushMessageQueue(instanceId: string): void {
    const connection = this.connections.get(instanceId);
    if (!connection || !connection.websocket.isOpen) return;

    const queue = connection.messageQueue;
    if (queue.length === 0) return;

    console.log(`[ConnectionManager] Flushing ${queue.length} queued messages for ${instanceId}`);

    // Clear the queue first to avoid re-queueing if something goes wrong
    connection.messageQueue = [];

    for (const msg of queue) {
      connection.websocket.sendMessage(msg.type, msg.payload);
    }
  }

  /**
   * Handle WebSocket connection change
   */
  private handleConnectionChange(instanceId: string, connected: boolean): void {
    const connection = this.connections.get(instanceId);
    if (connection) {
      connection.status = connected ? "connected" : "disconnected";
    }

    // Update instance store
    useInstanceStore.getState().setConnectionState(instanceId, {
      status: connected ? "connected" : "disconnected",
      lastConnectedAt: connected ? new Date().toISOString() : undefined,
    });

    // Update presence store
    const presenceStore = presenceStores.get(instanceId);
    presenceStore.getState().setConnected(connected);

    // Flush any queued messages now that we're connected
    if (connected) {
      this.flushMessageQueue(instanceId);
    }

    // Notify handlers
    for (const handler of this.connectionChangeHandlers) {
      handler(instanceId, connected);
    }
  }

  /**
   * Handle WebSocket message - route to appropriate instance-scoped store
   */
  private handleMessage(instanceId: string, event: WSEvent): void {
    const presenceStore = presenceStores.get(instanceId);
    const chatStore = chatStores.get(instanceId);

    switch (event.type) {
      case "auth.success":
        // Handled by connection change
        break;

      case "auth.error":
        console.error(`[WS:${instanceId}] Auth failed:`, event.payload);
        break;

      case "ping":
        this.send(instanceId, "pong");
        break;

      case "user.online":
      case "user.idle":
      case "presence.update": {
        const payload = event.payload as {
          user_id: string;
          username: string;
          status: "online" | "idle" | "offline";
        };
        presenceStore.getState().setPresence(payload.user_id, {
          userId: payload.user_id,
          username: payload.username,
          status: payload.status,
        });
        break;
      }

      case "user.offline": {
        const payload = event.payload as { user_id: string };
        presenceStore.getState().removePresence(payload.user_id);
        break;
      }

      case "voice.join": {
        const payload = event.payload as {
          user_id: string;
          username: string;
          avatar_url?: string;
          channel_id: string;
          self_muted: boolean;
          self_deafened: boolean;
          server_muted: boolean;
        };
        // Only include avatarUrl if it's defined to avoid overwriting existing values
        const voiceState: Partial<UserPresence> = {
          username: payload.username,
          muted: payload.self_muted || payload.server_muted,
          deafened: payload.self_deafened,
        };
        if (payload.avatar_url !== undefined) {
          voiceState.avatarUrl = payload.avatar_url;
        }
        presenceStore.getState().setVoiceState(payload.user_id, payload.channel_id, voiceState);

        // Play join sound for other users joining the same channel
        const currentUserId = authStores.get(instanceId).getState().user?.id;
        const currentChannelId = useVoiceStore.getState().currentChannelId;
        if (payload.user_id !== currentUserId && payload.channel_id === currentChannelId) {
          soundManager.play("join");
        }
        break;
      }

      case "voice.leave": {
        const payload = event.payload as { user_id: string; channel_id?: string };
        // Get the channel the user was in before updating state
        const leavingUserPresence = presenceStore.getState().presence.get(payload.user_id);
        const leavingChannelId = payload.channel_id || leavingUserPresence?.voiceChannelId;

        presenceStore.getState().setVoiceState(payload.user_id, null);

        // Play leave sound for other users leaving the same channel
        const currentUserId = authStores.get(instanceId).getState().user?.id;
        const currentChannelId = useVoiceStore.getState().currentChannelId;
        if (payload.user_id !== currentUserId && leavingChannelId === currentChannelId) {
          soundManager.play("leave");
        }
        break;
      }

      case "voice.mute": {
        const payload = event.payload as { user_id: string; muted: boolean };
        presenceStore.getState().setVoiceState(payload.user_id, undefined, {
          muted: payload.muted,
        });
        break;
      }

      case "typing.start": {
        const payload = event.payload as {
          channel_id: string;
          user_id: string;
          username: string;
        };
        presenceStore.getState().setTyping(
          payload.channel_id,
          payload.user_id,
          payload.username
        );
        break;
      }

      case "typing.stop": {
        const payload = event.payload as {
          channel_id: string;
          user_id: string;
        };
        presenceStore.getState().clearTyping(payload.channel_id, payload.user_id);
        break;
      }

      // Message events
      case "message.create": {
        const payload = event.payload as {
          id: string;
          channel_id: string;
          space_id: string;
          author: { id: string; username: string; avatar_url?: string };
          content: string;
          thread_id?: string;
          created_at: string;
          nonce?: string;
        };
        chatStore.getState().handleMessageCreate(payload);
        break;
      }

      case "message.update": {
        const payload = event.payload as {
          id: string;
          channel_id: string;
          space_id: string;
          content: string;
          edited_at: string;
          edit_count: number;
        };
        chatStore.getState().handleMessageUpdate(payload);
        break;
      }

      case "message.delete": {
        const payload = event.payload as {
          id: string;
          channel_id: string;
          space_id: string;
        };
        chatStore.getState().handleMessageDelete(payload);
        break;
      }

      case "reaction.add": {
        const payload = event.payload as {
          message_id: string;
          channel_id: string;
          space_id: string;
          user_id: string;
          username: string;
          emoji: string;
        };
        chatStore.getState().handleReactionAdd(payload);
        break;
      }

      case "reaction.remove": {
        const payload = event.payload as {
          message_id: string;
          channel_id: string;
          space_id: string;
          user_id: string;
          username: string;
          emoji: string;
        };
        chatStore.getState().handleReactionRemove(payload);
        break;
      }
    }
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
