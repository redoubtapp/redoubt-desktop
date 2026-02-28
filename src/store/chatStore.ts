/**
 * Chat Store
 *
 * Manages messages and chat state via instance-scoped stores.
 */

import { type StoreApi } from "zustand";
import type { Message } from "@/types/api";
import { getApiClient } from "@/lib/api";
import { authStores } from "./authStore";
import { createInstanceAwareStore } from "./createInstanceStore";

// Optimistic message has additional state
interface OptimisticMessage extends Message {
  nonce: string;
  pending: boolean;
  failed: boolean;
}

type MessageOrOptimistic = Message | OptimisticMessage;

function isOptimistic(msg: MessageOrOptimistic): msg is OptimisticMessage {
  return "nonce" in msg && "pending" in msg;
}

// WebSocket event payloads
interface MessageCreatePayload {
  id: string;
  channel_id: string;
  space_id: string;
  author: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  content: string;
  thread_id?: string;
  created_at: string;
  nonce?: string;
}

interface MessageUpdatePayload {
  id: string;
  channel_id: string;
  space_id: string;
  content: string;
  edited_at: string;
  edit_count: number;
}

interface MessageDeletePayload {
  id: string;
  channel_id: string;
  space_id: string;
}

interface ReactionPayload {
  message_id: string;
  channel_id: string;
  space_id: string;
  user_id: string;
  username: string;
  emoji: string;
}

export interface ChatState {
  // Messages by channel
  messagesByChannel: Map<string, MessageOrOptimistic[]>;

  // Thread replies by parent message ID
  threadReplies: Map<string, Message[]>;
  threadLoading: Set<string>;

  // Pagination state
  cursors: Map<string, string | null>;
  hasMore: Map<string, boolean>;
  isLoading: boolean;

  // Read state
  lastReadByChannel: Map<string, Date>;
  unreadCounts: Map<string, number>;

  // Actions
  loadMessages: (channelId: string) => Promise<void>;
  loadMore: (channelId: string) => Promise<void>;
  sendMessage: (
    channelId: string,
    content: string,
    threadId?: string
  ) => Promise<Message | null>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  replyToThread: (parentId: string, content: string) => Promise<void>;
  loadThreadReplies: (parentId: string) => Promise<Message[]>;
  markAsRead: (channelId: string, messageId?: string) => Promise<void>;
  loadUnreadCount: (channelId: string) => Promise<void>;

  // WebSocket event handlers
  handleMessageCreate: (payload: MessageCreatePayload) => void;
  handleMessageUpdate: (payload: MessageUpdatePayload) => void;
  handleMessageDelete: (payload: MessageDeletePayload) => void;
  handleReactionAdd: (payload: ReactionPayload) => void;
  handleReactionRemove: (payload: ReactionPayload) => void;

  // Helpers
  getMessages: (channelId: string) => MessageOrOptimistic[];
  clearChannel: (channelId: string) => void;
  retryMessage: (channelId: string, nonce: string) => Promise<void>;
  discardMessage: (channelId: string, nonce: string) => void;
  updateMessage: (channelId: string, message: Message) => void;
  reset: () => void;
}

/**
 * Create a chat store for a specific instance
 */
function createChatStore(instanceId: string) {
  return (
    set: StoreApi<ChatState>["setState"],
    get: StoreApi<ChatState>["getState"]
  ): ChatState => {
    // Helper to get the current user from the instance-scoped auth store
    const getCurrentUser = () => {
      const authStore = authStores.get(instanceId);
      return authStore.getState().user;
    };

    return {
      messagesByChannel: new Map(),
      threadReplies: new Map(),
      threadLoading: new Set(),
      cursors: new Map(),
      hasMore: new Map(),
      isLoading: false,
      lastReadByChannel: new Map(),
      unreadCounts: new Map(),

      loadMessages: async (channelId) => {
        set({ isLoading: true });

        try {
          const apiClient = getApiClient(instanceId);
          const response = await apiClient.listMessages(channelId, undefined, 50);

          set((state) => {
            const messages = new Map(state.messagesByChannel);
            messages.set(channelId, response.messages.reverse());

            const cursors = new Map(state.cursors);
            cursors.set(channelId, response.next_cursor || null);

            const hasMore = new Map(state.hasMore);
            hasMore.set(channelId, response.has_more);

            return {
              messagesByChannel: messages,
              cursors,
              hasMore,
              isLoading: false,
            };
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      loadMore: async (channelId) => {
        const { cursors, hasMore, isLoading } = get();
        if (isLoading || !hasMore.get(channelId)) return;

        const cursor = cursors.get(channelId);
        if (!cursor) return;

        set({ isLoading: true });

        try {
          const apiClient = getApiClient(instanceId);
          const response = await apiClient.listMessages(channelId, cursor, 50);

          set((state) => {
            const messages = new Map(state.messagesByChannel);
            const existing = messages.get(channelId) || [];
            messages.set(channelId, [...response.messages.reverse(), ...existing]);

            const newCursors = new Map(state.cursors);
            newCursors.set(channelId, response.next_cursor || null);

            const newHasMore = new Map(state.hasMore);
            newHasMore.set(channelId, response.has_more);

            return {
              messagesByChannel: messages,
              cursors: newCursors,
              hasMore: newHasMore,
              isLoading: false,
            };
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      sendMessage: async (channelId, content, threadId) => {
        const nonce = crypto.randomUUID();
        const user = getCurrentUser();
        if (!user) throw new Error("Not authenticated");

        const optimisticMessage: OptimisticMessage = {
          id: nonce,
          channel_id: channelId,
          author: {
            id: user.id,
            username: user.username,
            avatar_url: user.avatar_url,
          },
          content,
          thread_id: threadId,
          is_thread_root: false,
          reply_count: 0,
          created_at: new Date().toISOString(),
          nonce,
          pending: true,
          failed: false,
        };

        set((state) => {
          const messages = new Map(state.messagesByChannel);
          const channelMessages = messages.get(channelId) || [];
          messages.set(channelId, [...channelMessages, optimisticMessage]);
          return { messagesByChannel: messages };
        });

        try {
          const apiClient = getApiClient(instanceId);
          const response = await apiClient.sendMessage(channelId, {
            content,
            thread_id: threadId,
            nonce,
          });

          set((state) => {
            const messages = new Map(state.messagesByChannel);
            const channelMessages = messages.get(channelId) || [];
            const updated = channelMessages.map((m) =>
              isOptimistic(m) && m.nonce === nonce ? response : m
            );
            messages.set(channelId, updated);
            return { messagesByChannel: messages };
          });

          return response;
        } catch (error) {
          set((state) => {
            const messages = new Map(state.messagesByChannel);
            const channelMessages = messages.get(channelId) || [];
            const updated = channelMessages.map((m) =>
              isOptimistic(m) && m.nonce === nonce
                ? { ...m, pending: false, failed: true }
                : m
            );
            messages.set(channelId, updated);
            return { messagesByChannel: messages };
          });
          throw error;
        }
      },

      editMessage: async (messageId, content) => {
        const apiClient = getApiClient(instanceId);
        const response = await apiClient.editMessage(messageId, { content });

        set((state) => {
          const messages = new Map(state.messagesByChannel);
          messages.forEach((channelMessages, channelId) => {
            const updated = channelMessages.map((m) =>
              m.id === messageId
                ? { ...m, content: response.content, edited_at: response.edited_at }
                : m
            );
            messages.set(channelId, updated);
          });
          return { messagesByChannel: messages };
        });
      },

      deleteMessage: async (messageId) => {
        const apiClient = getApiClient(instanceId);
        await apiClient.deleteMessage(messageId);

        set((state) => {
          const messages = new Map(state.messagesByChannel);
          messages.forEach((channelMessages, channelId) => {
            const updated = channelMessages.filter((m) => m.id !== messageId);
            messages.set(channelId, updated);
          });
          return { messagesByChannel: messages };
        });
      },

      toggleReaction: async (messageId, emoji) => {
        const currentUser = getCurrentUser();
        if (!currentUser) return;

        const apiClient = getApiClient(instanceId);
        const result = await apiClient.toggleReaction(messageId, emoji);

        set((state) => {
          const messages = new Map(state.messagesByChannel);

          for (const [channelId, channelMessages] of messages.entries()) {
            const messageIdx = channelMessages.findIndex((m) => m.id === messageId);
            if (messageIdx === -1) continue;

            const updated = channelMessages.map((m) => {
              if (m.id !== messageId) return m;

              const reactions = m.reactions ? [...m.reactions] : [];
              const existingIdx = reactions.findIndex((r) => r.emoji === emoji);

              if (result.added) {
                if (existingIdx >= 0) {
                  const existing = reactions[existingIdx];
                  if (!existing.users.includes(currentUser.username)) {
                    reactions[existingIdx] = {
                      ...existing,
                      count: existing.count + 1,
                      users: [...existing.users, currentUser.username],
                      has_reacted: true,
                    };
                  }
                } else {
                  reactions.push({
                    emoji,
                    count: 1,
                    users: [currentUser.username],
                    has_reacted: true,
                  });
                }
              } else {
                if (existingIdx >= 0) {
                  const existing = reactions[existingIdx];
                  const newUsers = existing.users.filter(
                    (u) => u !== currentUser.username
                  );
                  if (newUsers.length === 0) {
                    reactions.splice(existingIdx, 1);
                  } else {
                    reactions[existingIdx] = {
                      ...existing,
                      count: newUsers.length,
                      users: newUsers,
                      has_reacted: false,
                    };
                  }
                }
              }

              return { ...m, reactions };
            });
            messages.set(channelId, updated);
            break;
          }

          return { messagesByChannel: messages };
        });
      },

      replyToThread: async (parentId, content) => {
        const nonce = crypto.randomUUID();
        const apiClient = getApiClient(instanceId);
        const reply = await apiClient.replyToThread(parentId, { content, nonce });

        set((state) => {
          const messages = new Map(state.messagesByChannel);
          messages.forEach((channelMessages, channelId) => {
            const parentIdx = channelMessages.findIndex((m) => m.id === parentId);
            if (parentIdx !== -1) {
              const updated = channelMessages.map((m) =>
                m.id === parentId
                  ? { ...m, is_thread_root: true, reply_count: m.reply_count + 1 }
                  : m
              );
              messages.set(channelId, updated);
            }
          });

          const threadReplies = new Map(state.threadReplies);
          const existing = threadReplies.get(parentId);
          if (existing) {
            threadReplies.set(parentId, [...existing, reply]);
          }

          return { messagesByChannel: messages, threadReplies };
        });
      },

      loadThreadReplies: async (parentId) => {
        const { threadReplies, threadLoading } = get();

        const cached = threadReplies.get(parentId);
        if (cached) return cached;

        if (threadLoading.has(parentId)) {
          return new Promise((resolve) => {
            const check = () => {
              const replies = get().threadReplies.get(parentId);
              if (replies) {
                resolve(replies);
              } else if (!get().threadLoading.has(parentId)) {
                resolve([]);
              } else {
                setTimeout(check, 50);
              }
            };
            check();
          });
        }

        set((state) => ({
          threadLoading: new Set(state.threadLoading).add(parentId),
        }));

        try {
          const apiClient = getApiClient(instanceId);
          const response = await apiClient.getThreadReplies(parentId);
          const replies = response.replies || [];

          set((state) => {
            const newReplies = new Map(state.threadReplies);
            newReplies.set(parentId, replies);
            const newLoading = new Set(state.threadLoading);
            newLoading.delete(parentId);
            return { threadReplies: newReplies, threadLoading: newLoading };
          });

          return replies;
        } catch (error) {
          set((state) => {
            const newLoading = new Set(state.threadLoading);
            newLoading.delete(parentId);
            return { threadLoading: newLoading };
          });
          throw error;
        }
      },

      markAsRead: async (channelId, messageId) => {
        const apiClient = getApiClient(instanceId);
        await apiClient.markChannelAsRead(channelId, messageId);

        set((state) => {
          const unreadCounts = new Map(state.unreadCounts);
          unreadCounts.set(channelId, 0);

          const lastReadByChannel = new Map(state.lastReadByChannel);
          lastReadByChannel.set(channelId, new Date());

          return { unreadCounts, lastReadByChannel };
        });
      },

      loadUnreadCount: async (channelId) => {
        try {
          const apiClient = getApiClient(instanceId);
          const response = await apiClient.getUnreadCount(channelId);
          set((state) => {
            const unreadCounts = new Map(state.unreadCounts);
            unreadCounts.set(channelId, response.unread_count);
            return { unreadCounts };
          });
        } catch {
          // Ignore errors for unread counts
        }
      },

      handleMessageCreate: (payload) => {
        const currentUser = getCurrentUser();

        set((state) => {
          const messages = new Map(state.messagesByChannel);
          const channelMessages = messages.get(payload.channel_id) || [];

          const exists = channelMessages.some(
            (m) =>
              m.id === payload.id ||
              (isOptimistic(m) && m.nonce === payload.nonce)
          );

          if (exists) {
            const updated = channelMessages.map((m) =>
              isOptimistic(m) && m.nonce === payload.nonce
                ? {
                    id: payload.id,
                    channel_id: payload.channel_id,
                    author: payload.author,
                    content: payload.content,
                    thread_id: payload.thread_id,
                    is_thread_root: false,
                    reply_count: 0,
                    created_at: payload.created_at,
                  }
                : m
            );
            messages.set(payload.channel_id, updated);
          } else {
            const newMessage: Message = {
              id: payload.id,
              channel_id: payload.channel_id,
              author: payload.author,
              content: payload.content,
              thread_id: payload.thread_id,
              is_thread_root: false,
              reply_count: 0,
              created_at: payload.created_at,
            };
            messages.set(payload.channel_id, [...channelMessages, newMessage]);

            if (currentUser && payload.author.id !== currentUser.id) {
              const unreadCounts = new Map(state.unreadCounts);
              const current = unreadCounts.get(payload.channel_id) || 0;
              unreadCounts.set(payload.channel_id, current + 1);
              return { messagesByChannel: messages, unreadCounts };
            }
          }

          return { messagesByChannel: messages };
        });
      },

      handleMessageUpdate: (payload) => {
        set((state) => {
          const messages = new Map(state.messagesByChannel);
          const channelMessages = messages.get(payload.channel_id);
          if (channelMessages) {
            const updated = channelMessages.map((m) =>
              m.id === payload.id
                ? { ...m, content: payload.content, edited_at: payload.edited_at }
                : m
            );
            messages.set(payload.channel_id, updated);
          }
          return { messagesByChannel: messages };
        });
      },

      handleMessageDelete: (payload) => {
        set((state) => {
          const messages = new Map(state.messagesByChannel);
          const channelMessages = messages.get(payload.channel_id);
          if (channelMessages) {
            const updated = channelMessages.filter((m) => m.id !== payload.id);
            messages.set(payload.channel_id, updated);
          }
          return { messagesByChannel: messages };
        });
      },

      handleReactionAdd: (payload) => {
        const currentUserId = getCurrentUser()?.id;
        set((state) => {
          const messages = new Map(state.messagesByChannel);
          const channelMessages = messages.get(payload.channel_id);
          if (channelMessages) {
            const updated = channelMessages.map((m) => {
              if (m.id !== payload.message_id) return m;

              const reactions = m.reactions ? [...m.reactions] : [];
              const existingIdx = reactions.findIndex(
                (r) => r.emoji === payload.emoji
              );

              if (existingIdx >= 0) {
                const existing = reactions[existingIdx];
                if (!existing.users.includes(payload.username)) {
                  reactions[existingIdx] = {
                    ...existing,
                    count: existing.count + 1,
                    users: [...existing.users, payload.username],
                    has_reacted:
                      existing.has_reacted || payload.user_id === currentUserId,
                  };
                }
              } else {
                reactions.push({
                  emoji: payload.emoji,
                  count: 1,
                  users: [payload.username],
                  has_reacted: payload.user_id === currentUserId,
                });
              }

              return { ...m, reactions };
            });
            messages.set(payload.channel_id, updated);
          }
          return { messagesByChannel: messages };
        });
      },

      handleReactionRemove: (payload) => {
        const currentUserId = getCurrentUser()?.id;
        set((state) => {
          const messages = new Map(state.messagesByChannel);
          const channelMessages = messages.get(payload.channel_id);
          if (channelMessages) {
            const updated = channelMessages.map((m) => {
              if (m.id !== payload.message_id || !m.reactions) return m;

              const reactions = m.reactions
                .map((r) => {
                  if (r.emoji !== payload.emoji) return r;

                  const newUsers = r.users.filter((u) => u !== payload.username);
                  if (newUsers.length === 0) return null;

                  return {
                    ...r,
                    count: newUsers.length,
                    users: newUsers,
                    has_reacted:
                      payload.user_id === currentUserId ? false : r.has_reacted,
                  };
                })
                .filter((r): r is NonNullable<typeof r> => r !== null);

              return { ...m, reactions };
            });
            messages.set(payload.channel_id, updated);
          }
          return { messagesByChannel: messages };
        });
      },

      getMessages: (channelId) => {
        return get().messagesByChannel.get(channelId) || [];
      },

      clearChannel: (channelId) => {
        set((state) => {
          const messages = new Map(state.messagesByChannel);
          messages.delete(channelId);
          const cursors = new Map(state.cursors);
          cursors.delete(channelId);
          const hasMore = new Map(state.hasMore);
          hasMore.delete(channelId);
          return { messagesByChannel: messages, cursors, hasMore };
        });
      },

      retryMessage: async (channelId, nonce) => {
        const messages = get().messagesByChannel.get(channelId) || [];
        const failedMsg = messages.find(
          (m) => isOptimistic(m) && m.nonce === nonce && m.failed
        ) as OptimisticMessage | undefined;

        if (!failedMsg) return;

        get().discardMessage(channelId, nonce);
        await get().sendMessage(channelId, failedMsg.content, failedMsg.thread_id);
      },

      discardMessage: (channelId, nonce) => {
        set((state) => {
          const messages = new Map(state.messagesByChannel);
          const channelMessages = messages.get(channelId) || [];
          const updated = channelMessages.filter(
            (m) => !(isOptimistic(m) && m.nonce === nonce)
          );
          messages.set(channelId, updated);
          return { messagesByChannel: messages };
        });
      },

      updateMessage: (channelId, message) => {
        set((state) => {
          const messages = new Map(state.messagesByChannel);
          const channelMessages = messages.get(channelId) || [];
          const updated = channelMessages.map((m) =>
            m.id === message.id ? message : m
          );
          messages.set(channelId, updated);
          return { messagesByChannel: messages };
        });
      },

      reset: () => {
        set({
          messagesByChannel: new Map(),
          threadReplies: new Map(),
          threadLoading: new Set(),
          cursors: new Map(),
          hasMore: new Map(),
          isLoading: false,
          lastReadByChannel: new Map(),
          unreadCounts: new Map(),
        });
      },
    };
  };
}

/**
 * Instance-scoped chat stores factory
 * Use this for multi-instance support
 */
export const chatStores = createInstanceAwareStore<ChatState>(createChatStore);

/**
 * Hook to use chat store for a specific instance
 */
export function useInstanceChatStore(instanceId: string): StoreApi<ChatState> {
  return chatStores.get(instanceId);
}
