/**
 * WebSocket Manager
 *
 * Manages a WebSocket connection to a Redoubt server instance.
 * Handles reconnection with exponential backoff.
 */

import { getInstanceCredentials } from "./secureStorage";
import { authStores } from "@/store/authStore";

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

// Custom close codes from server
export const CLOSE_SESSION_REPLACED = 4000;

export interface WSEvent {
  type: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export type MessageHandler = (event: WSEvent) => void;
export type ConnectionHandler = (connected: boolean) => void;

/**
 * Check if token is expired or about to expire (within 30 seconds)
 */
function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  return now >= expiryTime - 30000;
}

/**
 * Get a valid token for an instance, refreshing if necessary
 */
async function getValidToken(instanceId: string): Promise<string | null> {
  const credentials = getInstanceCredentials(instanceId);
  if (!credentials?.accessToken) return null;

  if (isTokenExpired(credentials.expiresAt)) {
    console.log(`[WS:${instanceId}] Token expired, refreshing...`);
    try {
      const authStore = authStores.get(instanceId);
      const refreshed = await authStore.getState().refreshAccessToken();
      if (!refreshed) {
        console.error(`[WS:${instanceId}] Failed to refresh token`);
        return null;
      }
      // Get updated credentials after refresh
      const newCredentials = getInstanceCredentials(instanceId);
      return newCredentials?.accessToken ?? null;
    } catch (error) {
      console.error(`[WS:${instanceId}] Error refreshing token:`, error);
      return null;
    }
  }

  return credentials.accessToken;
}

/**
 * WebSocket manager for a single Redoubt instance
 */
export class WebSocketManager {
  private instanceId: string;
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private subscriberCount = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private currentUserId: string | null = null;

  constructor(baseUrl: string, instanceId: string) {
    // Convert HTTP URL to WS URL
    this.baseUrl = baseUrl.replace(/^http/, "ws");
    this.instanceId = instanceId;
  }

  /**
   * Subscribe to WebSocket events
   */
  subscribe(
    userId: string,
    onMessage: MessageHandler,
    onConnectedChange: ConnectionHandler
  ): () => void {
    this.subscriberCount++;
    this.messageHandlers.add(onMessage);
    this.connectionHandlers.add(onConnectedChange);

    // If user changed, close old connection
    if (this.currentUserId && this.currentUserId !== userId) {
      this.closeConnection();
    }
    this.currentUserId = userId;

    // Connect if not already connected
    if (!this.ws && !this.isConnecting) {
      this.connect();
    }

    return () => {
      this.subscriberCount--;
      this.messageHandlers.delete(onMessage);
      this.connectionHandlers.delete(onConnectedChange);

      // Delay cleanup to allow StrictMode remount
      setTimeout(() => {
        if (this.subscriberCount === 0) {
          this.closeConnection();
          this.notifyConnectionChange(false);
        }
      }, 100);
    };
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    const tokenToUse = await getValidToken(this.instanceId);
    if (!tokenToUse) {
      console.error(`[WS:${this.instanceId}] No valid token available`);
      this.isConnecting = false;
      return;
    }

    // Check if we still have subscribers after async operation
    if (this.subscriberCount === 0) {
      this.isConnecting = false;
      return;
    }

    const wsUrl = `${this.baseUrl}/ws?token=${encodeURIComponent(tokenToUse)}`;
    console.log(`[WS:${this.instanceId}] Connecting to:`, wsUrl);
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      console.log(`[WS:${this.instanceId}] Connected`);
      this.isConnecting = false;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSEvent;
        if (data.type === "auth.success") {
          this.notifyConnectionChange(true);
          this.reconnectAttempts = 0;
        }
        this.notifyMessage(data);
      } catch (err) {
        console.error(`[WS:${this.instanceId}] Failed to parse message:`, err);
      }
    };

    ws.onclose = (event) => {
      console.log(`[WS:${this.instanceId}] Closed`, {
        code: event.code,
        reason: event.reason,
      });
      this.isConnecting = false;
      this.ws = null;
      this.notifyConnectionChange(false);

      // Don't reconnect if:
      // - No subscribers
      // - Clean close (1000)
      // - Session replaced by another tab (4000)
      if (
        this.subscriberCount === 0 ||
        event.code === 1000 ||
        event.code === CLOSE_SESSION_REPLACED
      ) {
        if (event.code === CLOSE_SESSION_REPLACED) {
          console.log(
            `[WS:${this.instanceId}] Session replaced, not reconnecting`
          );
        }
        return;
      }

      // Reconnect with exponential backoff
      const delay =
        RECONNECT_DELAYS[
          Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)
        ];
      this.reconnectAttempts++;

      this.reconnectTimeout = setTimeout(() => {
        if (this.subscriberCount > 0) {
          this.connect();
        }
      }, delay);
    };

    ws.onerror = (error) => {
      console.error(`[WS:${this.instanceId}] Error:`, error);
      this.isConnecting = false;
    };
  }

  /**
   * Close the connection
   */
  closeConnection(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    if (this.ws) {
      // Only close if not already closing/closed
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, "Connection closed");
      }
      this.ws = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.currentUserId = null;
  }

  /**
   * Send a message through the WebSocket
   */
  send(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  /**
   * Send a typed message
   */
  sendMessage(type: string, payload?: Record<string, unknown>): void {
    this.send(JSON.stringify({ type, payload }));
  }

  /**
   * Check if the WebSocket is open
   */
  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get the instance ID
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  private notifyMessage(event: WSEvent): void {
    for (const handler of this.messageHandlers) {
      handler(event);
    }
  }

  private notifyConnectionChange(connected: boolean): void {
    for (const handler of this.connectionHandlers) {
      handler(connected);
    }
  }
}
