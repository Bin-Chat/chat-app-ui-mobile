import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useFriendStore } from '@/store/friendStore';
import { socketService } from '@/services/socket';
import type { Message } from '@/types/chat';

// Payload formats from the gateway (chat-events.consumer.ts)
interface MessageCreatedPayload {
  messageId: string; // NOT _id
  conversationId: string;
  senderId: string;
  content?: string;
  attachments?: Message['attachments'];
  replyTo?: Message['replyTo'];
  createdAt: string;
}

interface ConversationUpdatedPayload {
  conversationId: string; // NOT _id
  participants: string[];
  lastMessage?: {
    senderId: string;
    content: string;
    type: string;
    sentAt: string;
  };
}

interface ReactionToggledPayload {
  messageId: string;
  conversationId: string;
  userId: string;
  emoji: string;
  action: 'added' | 'removed';
}

export function useChatSocket() {
  const user = useAuthStore((s) => s.user);
  const {
    socketMessageNew,
    socketMessageRevoked,
    socketConversationUpdated,
    socketReactionToggled,
    fetchConversations,
    socketGroupMembersAdded,
    socketGroupMemberRemoved,
    socketGroupMemberLeft,
    socketGroupUpdated,
    socketGroupRoleChanged,
    socketGroupDissolved,
    socketGroupOwnerTransferred,
  } = useChatStore();
  const { fetchFriends } = useFriendStore();

  useEffect(() => {
    if (!user) return;

    // Load data on mount / when user changes
    fetchConversations();
    fetchFriends();

    // Map gateway payload (messageId) → store Message type (_id)
    const onMessageNew = (payload: MessageCreatedPayload) => {
      const msg: Message = {
        _id: payload.messageId,
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        content: payload.content ?? '',
        attachments: payload.attachments ?? [],
        deletedFor: [],
        revokedAt: null,
        forwardedFrom: null,
        replyTo: payload.replyTo ?? null,
        reactions: [],
        createdAt: payload.createdAt,
        updatedAt: payload.createdAt,
      };
      socketMessageNew(msg);
    };

    const onMessageRevoked = (payload: { messageId: string; conversationId: string }) => {
      socketMessageRevoked(payload);
    };

    // Map gateway payload (conversationId) → store expects _id
    const onConversationUpdated = (payload: ConversationUpdatedPayload) => {
      socketConversationUpdated({
        _id: payload.conversationId,
        lastMessage: payload.lastMessage ?? null,
      } as any);
    };

    // Use action field: "added" = add, "removed" = remove (don't toggle blindly)
    const onReactionToggled = (payload: ReactionToggledPayload) => {
      socketReactionToggled({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        userId: payload.userId,
        emoji: payload.emoji,
        action: payload.action,
      });
    };

    socketService.on('message:new', onMessageNew);
    socketService.on('message:revoked', onMessageRevoked);
    socketService.on('conversation:updated', onConversationUpdated);
    socketService.on('message:reaction', onReactionToggled);

    // ── Group events ────────────────────────────────────────────
    const onGroupMembersAdded = (payload: any) => {
      socketGroupMembersAdded(payload);
      if (payload.addedUserIds?.includes(user.id)) {
        fetchConversations();
      }
    };
    const onGroupMemberRemoved = (payload: any) => {
      socketGroupMemberRemoved(payload);
      if (payload.removedUserId === user.id) {
        fetchConversations();
      }
    };
    const onGroupMemberLeft = (payload: any) => socketGroupMemberLeft(payload);
    const onGroupUpdated = (payload: any) => socketGroupUpdated(payload);
    const onGroupRoleChanged = (payload: any) => socketGroupRoleChanged(payload);
    const onGroupDissolved = (payload: any) => socketGroupDissolved(payload);
    const onGroupOwnerTransferred = (payload: any) => socketGroupOwnerTransferred(payload);

    socketService.on('group:members_added', onGroupMembersAdded);
    socketService.on('group:member_removed', onGroupMemberRemoved);
    socketService.on('group:member_left', onGroupMemberLeft);
    socketService.on('group:updated', onGroupUpdated);
    socketService.on('group:role_changed', onGroupRoleChanged);
    socketService.on('group:dissolved', onGroupDissolved);
    socketService.on('group:owner_transferred', onGroupOwnerTransferred);

    return () => {
      socketService.off('message:new', onMessageNew);
      socketService.off('message:revoked', onMessageRevoked);
      socketService.off('conversation:updated', onConversationUpdated);
      socketService.off('message:reaction', onReactionToggled);
      socketService.off('group:members_added', onGroupMembersAdded);
      socketService.off('group:member_removed', onGroupMemberRemoved);
      socketService.off('group:member_left', onGroupMemberLeft);
      socketService.off('group:updated', onGroupUpdated);
      socketService.off('group:role_changed', onGroupRoleChanged);
      socketService.off('group:dissolved', onGroupDissolved);
      socketService.off('group:owner_transferred', onGroupOwnerTransferred);
    };
  }, [user?.id]);
}
