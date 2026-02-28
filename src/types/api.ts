// API types matching the Go backend

export interface User {
  id: string
  email: string
  username: string
  avatar_url?: string
  is_instance_admin: boolean
  email_verified: boolean
  created_at: string
}

export interface Space {
  id: string
  name: string
  owner_id: string
  icon_url?: string
  created_at: string
}

export interface Channel {
  id: string
  space_id: string
  name: string
  type: 'text' | 'voice'
  position: number
  max_participants?: number
  created_at: string
}

export interface SpaceMember {
  user_id: string
  username: string
  avatar_url?: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

export interface Invite {
  id: string
  code: string
  space_id: string
  creator_id: string
  max_uses?: number
  use_count: number
  expires_at?: string
  created_at: string
}

export interface InviteResponse {
  id: string
  code: string
  space_id: string
  created_by: string
  created_by_username?: string
  uses: number
  max_uses?: number
  expires_at?: string
  created_at: string
}

export interface InviteInfoResponse {
  code: string
  space_name: string
  space_icon_url?: string
}

export interface CreateInviteRequest {
  max_uses?: number
  expires_in_hours?: number
}

export interface JoinSpaceResponse {
  space: Space
}

// Auth types
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  username: string
  password: string
  invite_code: string
}

export interface AuthResponse {
  user: User
  access_token: string
  refresh_token: string
  expires_at: string
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at: string
  user: User
}

// Voice types
export interface VoiceJoinResponse {
  token: string
  ws_url: string
  room_name: string
}

export interface VoiceParticipant {
  user_id: string
  username: string
  avatar_url?: string
  self_muted: boolean
  self_deafened: boolean
  server_muted: boolean
  connected_at: string
}

export interface VoiceState {
  channel_id: string
  space_id: string
  self_muted: boolean
  self_deafened: boolean
  server_muted: boolean
}

// Message types
export interface MessageAuthor {
  id: string
  username: string
  avatar_url?: string
}

export interface Attachment {
  id: string
  filename: string
  content_type: string
  size_bytes: number
  url: string
  is_image: boolean
}

export interface Message {
  id: string
  channel_id: string
  author: MessageAuthor
  content: string
  thread_id?: string
  is_thread_root: boolean
  reply_count: number
  edited_at?: string
  created_at: string
  reactions?: Reaction[]
  attachments?: Attachment[]
}

export interface MessageEdit {
  id: string
  previous_content: string
  edited_at: string
}

export interface Reaction {
  emoji: string
  count: number
  users: string[]
  has_reacted: boolean
}

export interface Emoji {
  emoji: string
  name: string
  category: string
}

export interface MessagesListResponse {
  messages: Message[]
  next_cursor?: string
  has_more: boolean
}

export interface SendMessageRequest {
  content: string
  thread_id?: string
  nonce?: string
}

export interface EditMessageRequest {
  content: string
}

export interface MarkAsReadRequest {
  message_id?: string
}

export interface UnreadCountResponse {
  unread_count: number
}

// OpenGraph types
export interface OpenGraphMetadata {
  url: string
  title?: string
  description?: string
  image?: string
  site_name?: string
  type?: string
  favicon?: string
}

// API Error
export interface APIError {
  type: string
  title: string
  status: number
  detail: string
  instance: string
}
