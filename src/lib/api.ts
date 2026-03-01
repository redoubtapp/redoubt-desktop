import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  RefreshResponse,
  User,
  Space,
  Channel,
  SpaceMember,
  VoiceJoinResponse,
  VoiceParticipant,
  VoiceState,
  APIError,
  Message,
  MessageEdit,
  MessagesListResponse,
  SendMessageRequest,
  EditMessageRequest,
  Reaction,
  Emoji,
  UnreadCountResponse,
  OpenGraphMetadata,
  Attachment,
  InviteResponse,
  InviteInfoResponse,
  CreateInviteRequest,
  JoinSpaceResponse,
} from '@/types/api'
import { fetch } from '@/lib/fetch'

// Default API base for backward compatibility
const DEFAULT_API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'

/**
 * API Client for communicating with a Redoubt server
 *
 * Can be instantiated with a specific base URL for multi-instance support,
 * or use the default singleton for backward compatibility.
 */
class ApiClient {
  private baseUrl: string
  private instanceId: string | null
  private accessToken: string | null = null
  private refreshPromise: Promise<boolean> | null = null

  constructor(baseUrl: string = DEFAULT_API_BASE, instanceId: string | null = null) {
    this.baseUrl = baseUrl
    this.instanceId = instanceId
  }

  /**
   * Get the base URL for this client
   */
  getBaseUrl(): string {
    return this.baseUrl
  }

  /**
   * Get the instance ID this client is associated with (if any)
   */
  getInstanceId(): string | null {
    return this.instanceId
  }

  setAccessToken(token: string | null) {
    this.accessToken = token
  }

  getAccessToken(): string | null {
    return this.accessToken
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (this.accessToken) {
      ;(headers as Record<string, string>)['Authorization'] =
        `Bearer ${this.accessToken}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    })

    // Handle 401 by trying to refresh the token (but only once, and not for auth endpoints)
    if (response.status === 401 && !isRetry && !endpoint.startsWith('/auth/')) {
      const refreshed = await this.tryRefreshToken()
      if (refreshed) {
        return this.request<T>(endpoint, options, true)
      }
    }

    if (!response.ok) {
      const error: APIError = await response.json()
      throw new ApiError(error)
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T
    }

    return response.json()
  }

  private async tryRefreshToken(): Promise<boolean> {
    // Avoid multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = (async () => {
      try {
        // Require instance ID for token refresh
        if (!this.instanceId) {
          console.error('Cannot refresh token: no instance ID set')
          return false
        }

        const { authStores } = await import('@/store/authStore')
        const authStore = authStores.get(this.instanceId)
        const state = authStore.getState()
        if (!state.refreshToken) {
          return false
        }
        return await state.refreshAccessToken()
      } catch {
        return false
      } finally {
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  // Auth endpoints
  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async register(data: RegisterRequest): Promise<{ message: string }> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async refresh(refreshToken: string): Promise<RefreshResponse> {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  }

  async logout(): Promise<void> {
    return this.request('/auth/logout', { method: 'POST' })
  }

  // User endpoints
  async getCurrentUser(): Promise<User> {
    return this.request('/users/me')
  }

  async updateCurrentUser(data: Partial<User>): Promise<User> {
    return this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  // Space endpoints
  async listSpaces(): Promise<{ spaces: Space[] }> {
    return this.request('/spaces')
  }

  async getSpace(id: string): Promise<Space> {
    return this.request(`/spaces/${id}`)
  }

  async createSpace(name: string): Promise<Space> {
    const response = await this.request<{ space: Space; channels: Channel[] }>(
      '/spaces',
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      }
    )
    return response.space
  }

  async getSpaceMembers(spaceId: string): Promise<{ members: SpaceMember[] }> {
    return this.request(`/spaces/${spaceId}/members`)
  }

  // Channel endpoints
  async listChannels(spaceId: string): Promise<{ channels: Channel[] }> {
    return this.request(`/spaces/${spaceId}/channels`)
  }

  async getChannel(id: string): Promise<Channel> {
    return this.request(`/channels/${id}`)
  }

  async createChannel(
    spaceId: string,
    data: { name: string; type: 'text' | 'voice' }
  ): Promise<Channel> {
    return this.request(`/spaces/${spaceId}/channels`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Voice endpoints
  async joinVoiceChannel(channelId: string): Promise<VoiceJoinResponse> {
    return this.request(`/channels/${channelId}/voice/join`, {
      method: 'POST',
    })
  }

  async leaveVoiceChannel(): Promise<void> {
    return this.request('/voice/leave', { method: 'POST' })
  }

  async getVoiceParticipants(
    channelId: string
  ): Promise<{ participants: VoiceParticipant[] }> {
    return this.request(`/channels/${channelId}/voice/participants`)
  }

  async getVoiceState(): Promise<{ voice_state: VoiceState | null }> {
    return this.request('/voice/state')
  }

  async updateMuteState(data: {
    self_muted?: boolean
    self_deafened?: boolean
  }): Promise<void> {
    return this.request('/voice/mute', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  // Message endpoints
  async listMessages(
    channelId: string,
    cursor?: string,
    limit = 50
  ): Promise<MessagesListResponse> {
    const params = new URLSearchParams()
    if (cursor) params.set('cursor', cursor)
    params.set('limit', limit.toString())
    const query = params.toString()
    return this.request(`/channels/${channelId}/messages${query ? `?${query}` : ''}`)
  }

  async sendMessage(channelId: string, data: SendMessageRequest): Promise<Message> {
    return this.request(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getMessage(messageId: string): Promise<Message> {
    return this.request(`/messages/${messageId}`)
  }

  async editMessage(messageId: string, data: EditMessageRequest): Promise<Message> {
    return this.request(`/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteMessage(messageId: string): Promise<void> {
    return this.request(`/messages/${messageId}`, {
      method: 'DELETE',
    })
  }

  async getEditHistory(messageId: string): Promise<{ edits: MessageEdit[] }> {
    return this.request(`/messages/${messageId}/edits`)
  }

  async getThreadReplies(messageId: string): Promise<{ replies: Message[] }> {
    return this.request(`/messages/${messageId}/thread`)
  }

  async replyToThread(messageId: string, data: SendMessageRequest): Promise<Message> {
    return this.request(`/messages/${messageId}/thread`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async markChannelAsRead(channelId: string, messageId?: string): Promise<void> {
    return this.request(`/channels/${channelId}/read`, {
      method: 'PUT',
      body: JSON.stringify(messageId ? { message_id: messageId } : {}),
    })
  }

  async getUnreadCount(channelId: string): Promise<UnreadCountResponse> {
    return this.request(`/channels/${channelId}/unread`)
  }

  // Reaction endpoints
  async addReaction(messageId: string, emoji: string): Promise<void> {
    return this.request(`/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    })
  }

  async removeReaction(messageId: string, emoji: string): Promise<void> {
    return this.request(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
      method: 'DELETE',
    })
  }

  async toggleReaction(messageId: string, emoji: string): Promise<{ added: boolean }> {
    return this.request(`/messages/${messageId}/reactions/toggle`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    })
  }

  async getMessageReactions(messageId: string): Promise<{ reactions: Reaction[] }> {
    return this.request(`/messages/${messageId}/reactions`)
  }

  // Emoji endpoints
  async listEmoji(): Promise<{ emoji: Emoji[] }> {
    return this.request('/emoji')
  }

  // OpenGraph endpoints
  async fetchOpenGraph(url: string): Promise<OpenGraphMetadata> {
    return this.request('/opengraph/fetch', {
      method: 'POST',
      body: JSON.stringify({ url }),
    })
  }

  // Attachment endpoints
  async uploadAttachment(
    messageId: string,
    file: File,
    order?: number
  ): Promise<Attachment> {
    const formData = new FormData()
    formData.append('file', file)
    if (order !== undefined) {
      formData.append('order', order.toString())
    }

    // Use a custom request that doesn't set Content-Type (browser sets it with boundary)
    const headers: HeadersInit = {}
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const response = await fetch(`${this.baseUrl}/messages/${messageId}/attachments`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const error: APIError = await response.json()
      throw new ApiError(error)
    }

    return response.json()
  }

  async getMessageAttachments(messageId: string): Promise<{ attachments: Attachment[] }> {
    return this.request(`/messages/${messageId}/attachments`)
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    return this.request(`/attachments/${attachmentId}`, {
      method: 'DELETE',
    })
  }

  getAttachmentUrl(attachmentId: string): string {
    return `${this.baseUrl}/attachments/${attachmentId}`
  }

  getAttachmentDownloadUrl(attachmentId: string): string {
    return `${this.baseUrl}/attachments/${attachmentId}/download`
  }

  async fetchAttachmentBlob(attachmentId: string): Promise<Blob> {
    const headers: HeadersInit = {}
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const response = await fetch(`${this.baseUrl}/attachments/${attachmentId}`, {
      headers,
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch attachment: ${response.status}`)
    }

    return response.blob()
  }

  async downloadAttachment(attachmentId: string, filename: string): Promise<void> {
    const blob = await this.fetchAttachmentBlob(attachmentId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Avatar endpoints
  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const formData = new FormData()
    formData.append('avatar', file)

    const headers: HeadersInit = {}
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const response = await fetch(`${this.baseUrl}/users/me/avatar`, {
      method: 'PUT',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const error: APIError = await response.json()
      throw new ApiError(error)
    }

    return response.json()
  }

  async deleteAvatar(): Promise<void> {
    return this.request('/users/me/avatar', {
      method: 'DELETE',
    })
  }

  async fetchAvatarBlob(userId: string): Promise<Blob> {
    const headers: HeadersInit = {}
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const response = await fetch(`${this.baseUrl}/users/${userId}/avatar`, {
      headers,
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch avatar: ${response.status}`)
    }

    return response.blob()
  }

  getAvatarUrl(userId: string): string {
    return `${this.baseUrl}/users/${userId}/avatar`
  }

  // Invite endpoints
  async listSpaceInvites(spaceId: string): Promise<{ invites: InviteResponse[] }> {
    return this.request(`/spaces/${spaceId}/invites`)
  }

  async createInvite(
    spaceId: string,
    data?: CreateInviteRequest
  ): Promise<InviteResponse> {
    return this.request(`/spaces/${spaceId}/invites`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    })
  }

  async getInviteInfo(code: string): Promise<InviteInfoResponse> {
    return this.request(`/invites/${code}`)
  }

  async joinViaInvite(code: string): Promise<JoinSpaceResponse> {
    return this.request(`/invites/${code}/join`, {
      method: 'POST',
    })
  }

  async revokeInvite(inviteId: string): Promise<void> {
    return this.request(`/invites/${inviteId}`, {
      method: 'DELETE',
    })
  }
}

export class ApiError extends Error {
  type: string
  status: number
  detail: string
  instance: string

  constructor(error: APIError) {
    super(error.title)
    this.name = 'ApiError'
    this.type = error.type
    this.status = error.status
    this.detail = error.detail
    this.instance = error.instance
  }
}

// Export the ApiClient class for creating new instances
export { ApiClient }

/**
 * Map of instance ID to ApiClient
 * Used by getApiClient() to cache clients per instance
 */
const apiClients = new Map<string, ApiClient>()

/**
 * Instance URL resolver - set by instanceStore to avoid circular dependency
 */
let instanceUrlResolver: ((instanceId: string) => string | null) | null = null

/**
 * Register the instance URL resolver
 * Called by instanceStore during initialization
 */
export function setInstanceUrlResolver(
  resolver: (instanceId: string) => string | null
): void {
  instanceUrlResolver = resolver
}

/**
 * Get or create an API client for a specific instance
 *
 * @param instanceId - The instance ID
 * @returns The ApiClient for this instance
 */
export function getApiClient(instanceId: string): ApiClient {
  if (!apiClients.has(instanceId)) {
    if (!instanceUrlResolver) {
      throw new Error('Instance URL resolver not set. Ensure instanceStore is initialized.')
    }

    const url = instanceUrlResolver(instanceId)
    if (!url) {
      throw new Error(`Instance ${instanceId} not found`)
    }

    const client = new ApiClient(`${url}/api/v1`, instanceId)
    apiClients.set(instanceId, client)
  }

  return apiClients.get(instanceId)!
}

/**
 * Clear the cached API client for an instance
 * Call this when an instance is removed or credentials are cleared
 *
 * @param instanceId - The instance ID to clear
 */
export function clearApiClient(instanceId: string): void {
  apiClients.delete(instanceId)
}

/**
 * Clear all cached API clients
 */
export function clearAllApiClients(): void {
  apiClients.clear()
}

/**
 * Legacy singleton API client for backward compatibility
 * Uses the default API base URL
 */
export const api = new ApiClient()
