/**
 * Multi-instance support types
 *
 * An Instance represents a connection to a Redoubt server deployment.
 * Users can have multiple instances (e.g., personal server, work server).
 */

/**
 * Core instance model representing a Redoubt server
 */
export interface Instance {
  /** UUID, generated client-side */
  id: string;
  /** Base URL (e.g., "https://redoubt.example.com") */
  url: string;
  /** Display name (fetched from server or user-set) */
  name: string;
  /** Instance icon URL */
  iconUrl: string | null;
  /** When the instance was added */
  addedAt: string;
  /** When the instance was last used */
  lastUsedAt: string;
  /** Last visited space ID for navigation restore */
  lastSpaceId?: string | null;
  /** Last visited channel ID for navigation restore */
  lastChannelId?: string | null;
}

/**
 * Server info response from /api/v1/info endpoint
 */
export interface ServerInfo {
  name: string;
  version: string;
  iconUrl?: string;
}

/**
 * Connection status for an instance
 */
export type InstanceConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

/**
 * Connection state tracking for an instance
 */
export interface InstanceConnectionState {
  status: InstanceConnectionStatus;
  lastError?: string;
  lastConnectedAt?: string;
}

/**
 * Credentials stored per-instance
 */
export interface InstanceCredentials {
  accessToken: string | null;
  refreshToken: string;
  expiresAt: string;
}
