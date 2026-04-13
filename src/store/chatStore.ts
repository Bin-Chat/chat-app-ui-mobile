import { create } from 'zustand';
import { chatServices } from '@/services/chatServices';
import type { Conversation, Message } from '@/types/chat';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  pinnedMessages: Record<string, Message[]>;
  hasMore: Record<string, boolean>;
  loadingConversations: boolean;
  loadingMessages: boolean;
  sendingMessage: boolean;
  error: string | null;
  inAppNotification: { id: string; title: string; body: string } | null;
  unreadCounts: Record<string, number>;
}

interface ChatActions {
  fetchConversations: () => Promise<void>;
  createConversation: (
    participantIds: string[],
    type?: 'direct' | 'group',
    name?: string
  ) => Promise<Conversation>;
  fetchMessages: (conversationId: string, cursor?: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    content?: string,
    attachments?: any[],
    replyTo?: {
      messageId: string;
      senderId: string;
      content: string;
      attachmentType?: string;
    } | null
  ) => Promise<void>;
  revokeMessage: (messageId: string, conversationId: string) => Promise<void>;
  deleteMessage: (messageId: string, conversationId: string) => Promise<void>;
  forwardMessage: (messageId: string, targetConversationId: string) => Promise<void>;
  reactToMessage: (
    messageId: string,
    conversationId: string,
    emoji: string,
    userId: string
  ) => void;
  setActiveConversation: (id: string | null) => void;
  showInAppNotification: (n: { id: string; title: string; body: string }) => void;
  clearInAppNotification: () => void;
  clearUnread: (conversationId: string) => void;
  // Socket event handlers
  socketMessageNew: (message: Message) => void;
  socketMessageRevoked: (data: { messageId: string; conversationId: string }) => void;
  socketConversationUpdated: (conversation: Conversation) => void;
  socketReactionToggled: (data: {
    messageId: string;
    conversationId: string;
    userId: string;
    emoji: string;
    action?: 'added' | 'removed';
  }) => void;
  // Group management
  addGroupMembers: (conversationId: string, memberIds: string[]) => Promise<void>;
  removeGroupMember: (conversationId: string, memberId: string) => Promise<void>;
  leaveGroup: (conversationId: string) => Promise<void>;
  updateGroup: (
    conversationId: string,
    data: { name?: string; avatar?: string; description?: string }
  ) => Promise<void>;
  changeGroupRole: (
    conversationId: string,
    memberId: string,
    role: 'admin' | 'member'
  ) => Promise<void>;
  transferGroupOwnership: (conversationId: string, newOwnerId: string) => Promise<void>;
  dissolveGroup: (conversationId: string) => Promise<void>;
  banGroupMember: (conversationId: string, memberId: string, bannedUntil?: string) => Promise<void>;
  unbanGroupMember: (conversationId: string, memberId: string) => Promise<void>;
  // Group socket handlers
  socketGroupMembersAdded: (data: { conversationId: string; addedUserIds: string[] }) => void;
  socketGroupMemberRemoved: (data: { conversationId: string; removedUserId: string }) => void;
  socketGroupMemberLeft: (data: { conversationId: string; userId: string }) => void;
  socketGroupUpdated: (data: {
    conversationId: string;
    name?: string;
    avatar?: string;
    description?: string;
  }) => void;
  socketGroupRoleChanged: (data: {
    conversationId: string;
    targetUserId: string;
    newRole: 'admin' | 'member';
  }) => void;
  socketGroupDissolved: (data: { conversationId: string }) => void;
  socketGroupOwnerTransferred: (data: {
    conversationId: string;
    oldOwnerId: string;
    newOwnerId: string;
  }) => void;
  // Pin
  pinMessage: (messageId: string, conversationId: string) => Promise<void>;
  unpinMessage: (messageId: string, conversationId: string) => Promise<void>;
  fetchPinnedMessages: (conversationId: string) => Promise<void>;
  socketMessagePinned: (data: {
    messageId: string;
    conversationId: string;
    pinnedBy: string;
  }) => void;
  socketMessageUnpinned: (data: { messageId: string; conversationId: string }) => void;
  // Group settings
  updateGroupSettings: (conversationId: string, settings: Record<string, boolean>) => Promise<void>;
  socketConversationSettingsUpdated: (data: {
    conversationId: string;
    settings: Record<string, any>;
  }) => void;
  // Ban socket handlers
  socketMemberBanned: (data: {
    conversationId: string;
    memberId: string;
    bannedUntil?: string | null;
  }) => void;
  socketMemberUnbanned: (data: { conversationId: string; memberId: string }) => void;
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  pinnedMessages: {},
  hasMore: {},
  loadingConversations: false,
  loadingMessages: false,
  sendingMessage: false,
  error: null,
  inAppNotification: null,
  unreadCounts: {},

  setActiveConversation: (id) =>
    set((s) => ({
      activeConversationId: id,
      unreadCounts: id ? { ...s.unreadCounts, [id]: 0 } : s.unreadCounts,
    })),
  showInAppNotification: (n) => set({ inAppNotification: n }),
  clearInAppNotification: () => set({ inAppNotification: null }),
  clearUnread: (conversationId) =>
    set((s) => ({ unreadCounts: { ...s.unreadCounts, [conversationId]: 0 } })),

  fetchConversations: async () => {
    set({ loadingConversations: true, error: null });
    try {
      const data = await chatServices.getConversations();
      const conversations = Array.isArray(data) ? data : [];
      set({ conversations, loadingConversations: false });
    } catch (e: any) {
      set({ error: e.message, loadingConversations: false });
    }
  },

  createConversation: async (participantIds, type = 'direct', name) => {
    const conv = await chatServices.createConversation({ type, participantIds, name });
    set((s) => {
      const exists = s.conversations.some((c) => c._id === conv._id);
      return {
        conversations: exists ? s.conversations : [conv, ...s.conversations],
        activeConversationId: conv._id,
      };
    });
    return conv;
  },

  fetchMessages: async (conversationId, cursor) => {
    set({ loadingMessages: true });
    try {
      const data = await chatServices.getMessages(conversationId, cursor);
      const msgs = Array.isArray(data.messages) ? data.messages : [];
      set((s) => {
        const existing = s.messages[conversationId] ?? [];
        const existingIds = new Set(existing.map((m) => m._id));
        const newMsgs = msgs.filter((m) => !existingIds.has(m._id));
        // API returns DESC (newest first). Store in DESC order.
        // Initial load: newMsgs goes to front (existing is empty).
        // Pagination (older): older msgs go to END so inverted FlatList shows them at top.
        const merged = cursor ? [...existing, ...newMsgs] : [...newMsgs, ...existing];
        return {
          messages: { ...s.messages, [conversationId]: merged },
          hasMore: { ...s.hasMore, [conversationId]: data.hasMore },
          loadingMessages: false,
        };
      });
    } catch (e: any) {
      set({ error: e.message, loadingMessages: false });
    }
  },

  sendMessage: async (conversationId, content, attachments, replyTo) => {
    set({ sendingMessage: true });
    try {
      const msg = await chatServices.sendMessage(conversationId, { content, attachments, replyTo });
      set((s) => {
        const existing = s.messages[conversationId] ?? [];
        const exists = existing.some((m) => m._id === msg._id);
        return {
          messages: {
            ...s.messages,
            // Prepend: newest at index 0 (inverted FlatList shows index 0 at bottom)
            [conversationId]: exists ? existing : [msg, ...existing],
          },
          sendingMessage: false,
        };
      });
    } catch (e: any) {
      set({ sendingMessage: false, error: e.message });
      throw e;
    }
  },

  revokeMessage: async (messageId, conversationId) => {
    await chatServices.revokeMessage(messageId);
    set((s) => {
      const msgs = s.messages[conversationId] ?? [];
      return {
        messages: {
          ...s.messages,
          [conversationId]: msgs.map((m) =>
            m._id === messageId ? { ...m, revokedAt: new Date().toISOString() } : m
          ),
        },
      };
    });
  },

  deleteMessage: async (messageId, conversationId) => {
    await chatServices.deleteMessage(messageId);
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).filter((m) => m._id !== messageId),
      },
    }));
  },

  forwardMessage: async (messageId, targetConversationId) => {
    const msg = await chatServices.forwardMessage(messageId, targetConversationId);
    set((s) => {
      const existing = s.messages[targetConversationId] ?? [];
      const alreadyExists = existing.some((m) => m._id === msg._id);
      return {
        messages: {
          ...s.messages,
          [targetConversationId]: alreadyExists ? existing : [msg, ...existing],
        },
      };
    });
  },

  reactToMessage: (messageId, conversationId, emoji, _userId) => {
    // No optimistic update — let socket event (message:reaction) update the UI
    // to avoid double-toggle (optimistic cancel + socket toggle = reaction disappears)
    chatServices.reactToMessage(messageId, emoji).catch(() => {});
  },

  // ── Socket handlers ──
  socketMessageNew: (message) => {
    set((s) => {
      const convId = message.conversationId;
      const existing = s.messages[convId] ?? [];
      const exists = existing.some((m) => m._id === message._id);
      // Prepend: newest at index 0 (inverted FlatList shows index 0 at bottom)
      const newMessages = exists ? existing : [message, ...existing];

      // Increment unread count when conversation is not active
      const unreadCounts = { ...s.unreadCounts };
      if (convId !== s.activeConversationId) {
        unreadCounts[convId] = (unreadCounts[convId] ?? 0) + 1;
      }

      // Update lastMessage on conversation + move to top
      const convIdx = s.conversations.findIndex((c) => c._id === convId);
      let conversations = [...s.conversations];
      if (convIdx >= 0) {
        const conv = {
          ...conversations[convIdx],
          lastMessage: {
            senderId: message.senderId,
            content: message.content || (message.attachments?.length ? '[Tệp đính kèm]' : ''),
            type: message.attachments?.length ? 'attachment' : 'text',
            sentAt: message.createdAt,
          },
        };
        conversations.splice(convIdx, 1);
        conversations = [conv, ...conversations];
      }

      return {
        messages: { ...s.messages, [convId]: newMessages },
        conversations,
        unreadCounts,
      };
    });
  },

  socketMessageRevoked: ({ messageId, conversationId }) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
          m._id === messageId ? { ...m, revokedAt: new Date().toISOString() } : m
        ),
      },
    }));
  },

  socketConversationUpdated: (conversation) => {
    set((s) => {
      const idx = s.conversations.findIndex((c) => c._id === conversation._id);
      // Only update existing conversations — NEVER insert unknown entries
      // (prevents ghost "中文名" caused by ObjectId mapping mismatch on backend)
      if (idx < 0) return {};
      const conversations = [...s.conversations];
      conversations[idx] = { ...conversations[idx], ...conversation };
      // Move updated conversation to top
      const [conv] = conversations.splice(idx, 1);
      conversations.unshift(conv);
      return { conversations };
    });
  },

  socketReactionToggled: ({ messageId, conversationId, userId, emoji, action }) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).map((m) => {
          if (m._id !== messageId) return m;
          const reactions = [...(m.reactions ?? [])];
          const idx = reactions.findIndex((r) => r.userId === userId && r.emoji === emoji);
          if (action === 'removed') {
            if (idx >= 0) reactions.splice(idx, 1);
          } else {
            // action === 'added' (or undefined for legacy)
            if (idx < 0) reactions.push({ userId, emoji });
          }
          return { ...m, reactions };
        }),
      },
    }));
  },

  // ── Group Management ──────────────────────────────────────────────

  addGroupMembers: async (conversationId, memberIds) => {
    const updated = await chatServices.addMembers(conversationId, memberIds);
    set((s) => ({
      conversations: s.conversations.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)),
    }));
  },

  removeGroupMember: async (conversationId, memberId) => {
    const updated = await chatServices.removeMember(conversationId, memberId);
    set((s) => ({
      conversations: s.conversations.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)),
    }));
  },

  leaveGroup: async (conversationId) => {
    await chatServices.leaveGroup(conversationId);
    set((s) => ({
      conversations: s.conversations.filter((c) => c._id !== conversationId),
      activeConversationId:
        s.activeConversationId === conversationId ? null : s.activeConversationId,
    }));
  },

  updateGroup: async (conversationId, data) => {
    const updated = await chatServices.updateGroup(conversationId, data);
    set((s) => ({
      conversations: s.conversations.map((c) => (c._id === updated._id ? { ...c, ...updated } : c)),
    }));
  },

  changeGroupRole: async (conversationId, memberId, role) => {
    await chatServices.changeRole(conversationId, memberId, role);
  },

  transferGroupOwnership: async (conversationId, newOwnerId) => {
    await chatServices.transferOwnership(conversationId, newOwnerId);
  },

  dissolveGroup: async (conversationId) => {
    await chatServices.dissolveGroup(conversationId);
    set((s) => ({
      conversations: s.conversations.filter((c) => c._id !== conversationId),
      activeConversationId:
        s.activeConversationId === conversationId ? null : s.activeConversationId,
    }));
  },

  banGroupMember: async (conversationId, memberId, bannedUntil) => {
    await chatServices.banMember(conversationId, memberId, bannedUntil);
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c._id !== conversationId) return c;
        return {
          ...c,
          participants: c.participants.map((p) =>
            p.userId === memberId ? { ...p, isBanned: true, bannedUntil: bannedUntil ?? null } : p
          ),
        };
      }),
    }));
  },

  unbanGroupMember: async (conversationId, memberId) => {
    await chatServices.unbanMember(conversationId, memberId);
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c._id !== conversationId) return c;
        return {
          ...c,
          participants: c.participants.map((p) =>
            p.userId === memberId ? { ...p, isBanned: false, bannedUntil: null } : p
          ),
        };
      }),
    }));
  },

  // ── Group Socket Handlers ──────────────────────────────────────────

  socketGroupMembersAdded: ({ conversationId, addedUserIds }) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c._id !== conversationId) return c;
        const newParticipants = [...c.participants];
        for (const uid of addedUserIds) {
          if (!newParticipants.some((p) => p.userId === uid)) {
            newParticipants.push({
              userId: uid,
              role: 'member',
              joinedAt: new Date().toISOString(),
            });
          }
        }
        return { ...c, participants: newParticipants };
      }),
    }));
  },

  socketGroupMemberRemoved: ({ conversationId, removedUserId }) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c._id !== conversationId) return c;
        return { ...c, participants: c.participants.filter((p) => p.userId !== removedUserId) };
      }),
    }));
  },

  socketGroupMemberLeft: ({ conversationId, userId }) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c._id !== conversationId) return c;
        return { ...c, participants: c.participants.filter((p) => p.userId !== userId) };
      }),
    }));
  },

  socketGroupUpdated: ({ conversationId, name, avatar, description }) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c._id !== conversationId) return c;
        return {
          ...c,
          ...(name ? { name } : {}),
          ...(avatar ? { avatar } : {}),
          ...(description !== undefined ? { description } : {}),
        };
      }),
    }));
  },

  socketGroupRoleChanged: ({ conversationId, targetUserId, newRole }) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c._id !== conversationId) return c;
        return {
          ...c,
          participants: c.participants.map((p) =>
            p.userId === targetUserId ? { ...p, role: newRole } : p
          ),
        };
      }),
    }));
  },

  socketGroupDissolved: ({ conversationId }) => {
    set((s) => ({
      conversations: s.conversations.filter((c) => c._id !== conversationId),
      activeConversationId:
        s.activeConversationId === conversationId ? null : s.activeConversationId,
    }));
  },

  socketGroupOwnerTransferred: ({ conversationId, oldOwnerId, newOwnerId }) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c._id !== conversationId) return c;
        return {
          ...c,
          participants: c.participants.map((p) => {
            if (p.userId === oldOwnerId) return { ...p, role: 'admin' as const };
            if (p.userId === newOwnerId) return { ...p, role: 'owner' as const };
            return p;
          }),
        };
      }),
    }));
  },

  // ── Pin Actions ─────────────────────────────────────────────────────────

  pinMessage: async (messageId, conversationId) => {
    await chatServices.pinMessage(messageId);
    const pins = await chatServices.getPinnedMessages(conversationId);
    set((s) => ({ pinnedMessages: { ...s.pinnedMessages, [conversationId]: pins } }));
  },

  unpinMessage: async (messageId, conversationId) => {
    await chatServices.unpinMessage(messageId);
    const pins = await chatServices.getPinnedMessages(conversationId);
    set((s) => ({ pinnedMessages: { ...s.pinnedMessages, [conversationId]: pins } }));
  },

  fetchPinnedMessages: async (conversationId) => {
    const pins = await chatServices.getPinnedMessages(conversationId);
    set((s) => ({ pinnedMessages: { ...s.pinnedMessages, [conversationId]: pins } }));
  },

  socketMessagePinned: ({ messageId, conversationId, pinnedBy }) => {
    const { fetchPinnedMessages } = get();
    fetchPinnedMessages(conversationId);
  },

  socketMessageUnpinned: ({ messageId, conversationId }) => {
    set((s) => ({
      pinnedMessages: {
        ...s.pinnedMessages,
        [conversationId]: (s.pinnedMessages[conversationId] ?? []).filter(
          (m) => m._id !== messageId
        ),
      },
    }));
  },

  updateGroupSettings: async (conversationId, settings) => {
    await chatServices.updateSettings(conversationId, settings);
    set((s) => {
      const idx = s.conversations.findIndex((c) => c._id === conversationId);
      if (idx < 0) return {};
      const conversations = [...s.conversations];
      conversations[idx] = {
        ...conversations[idx],
        settings: { ...conversations[idx].settings, ...settings },
      };
      return { conversations };
    });
  },

  socketConversationSettingsUpdated: ({ conversationId, settings }) => {
    set((s) => {
      const idx = s.conversations.findIndex((c) => c._id === conversationId);
      if (idx < 0) return {};
      const conversations = [...s.conversations];
      conversations[idx] = {
        ...conversations[idx],
        settings: { ...conversations[idx].settings, ...settings },
      };
      return { conversations };
    });
  },

  socketMemberBanned: ({ conversationId, memberId, bannedUntil }) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c._id !== conversationId) return c;
        return {
          ...c,
          participants: c.participants.map((p) =>
            p.userId === memberId ? { ...p, isBanned: true, bannedUntil: bannedUntil ?? null } : p
          ),
        };
      }),
    }));
  },

  socketMemberUnbanned: ({ conversationId, memberId }) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c._id !== conversationId) return c;
        return {
          ...c,
          participants: c.participants.map((p) =>
            p.userId === memberId ? { ...p, isBanned: false, bannedUntil: null } : p
          ),
        };
      }),
    }));
  },
}));
