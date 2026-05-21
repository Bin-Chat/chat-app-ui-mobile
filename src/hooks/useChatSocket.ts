import { useEffect } from 'react';
import { Alert, DeviceEventEmitter } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useFriendStore } from '@/store/friendStore';
import { useCallStore } from '@/store/callStore';
import { socketService } from '@/services/socket';
import type { Message } from '@/types/chat';

// Payload formats from the gateway (chat-events.consumer.ts)
interface MessageCreatedPayload {
  messageId: string; // NOT _id
  conversationId: string;
  senderId: string;
  content?: string;
  type?: string;
  attachments?: Message['attachments'];
  replyTo?: Message['replyTo'];
  metadata?: Record<string, any>;
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
    socketMemberBanned,
    socketMemberUnbanned,
    socketMessageEdited,
    socketPollUpdated,
    socketPollDeleted,
  } = useChatStore();
  const { fetchFriends } = useFriendStore();
  const { setIncomingCall, clearIncomingCall, endCall } = useCallStore();

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
        type: payload.type,
        content: payload.content ?? '',
        attachments: payload.attachments ?? [],
        metadata: payload.metadata,
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
      // Backend sends `newMemberIds`, normalize to `addedUserIds`
      const addedUserIds = payload.newMemberIds || payload.addedUserIds || [];
      socketGroupMembersAdded({ ...payload, addedUserIds });
      if (addedUserIds.includes(user.id)) {
        fetchConversations();
      }
    };
    const onGroupMemberRemoved = (payload: any) => {
      // Backend sends `removedMemberId`, normalize to `removedUserId`
      const removedUserId = payload.removedUserId || payload.removedMemberId;
      socketGroupMemberRemoved({ ...payload, removedUserId });
      if (removedUserId === user.id) {
        fetchConversations();
      }
    };
    const onGroupMemberLeft = (payload: any) => socketGroupMemberLeft(payload);
    const onGroupUpdated = (payload: any) => {
      // Backend sends updates in `changes` object, flatten for store
      socketGroupUpdated({
        conversationId: payload.conversationId,
        ...payload.changes,
      });
    };
    const onGroupRoleChanged = (payload: any) => {
      // Backend sends `memberId`, normalize to `targetUserId`
      const targetUserId = payload.targetUserId || payload.memberId;
      socketGroupRoleChanged({ ...payload, targetUserId });
    };
    const onGroupDissolved = (payload: any) => socketGroupDissolved(payload);
    const onGroupOwnerTransferred = (payload: any) => socketGroupOwnerTransferred(payload);
    const onMemberBanned = (payload: any) => {
      socketMemberBanned({
        conversationId: payload.conversationId,
        memberId: payload.memberId,
        bannedUntil: payload.bannedUntil ?? null,
      });
    };
    const onMemberUnbanned = (payload: any) => {
      socketMemberUnbanned({
        conversationId: payload.conversationId,
        memberId: payload.memberId,
      });
    };
    const onMessageEdited = (payload: any) => {
      socketMessageEdited({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        content: payload.content,
        isEdited: true,
        editedAt: payload.editedAt,
      });
    };

    socketService.on('group:members_added', onGroupMembersAdded);
    socketService.on('group:member_removed', onGroupMemberRemoved);
    socketService.on('group:member_left', onGroupMemberLeft);
    socketService.on('group:updated', onGroupUpdated);
    socketService.on('group:role_changed', onGroupRoleChanged);
    socketService.on('group:dissolved', onGroupDissolved);
    socketService.on('group:owner_transferred', onGroupOwnerTransferred);
    socketService.on('member:banned', onMemberBanned);
    socketService.on('member:unbanned', onMemberUnbanned);
    socketService.on('message:edited', onMessageEdited);

    // ── Call events ───────────────────────────────────────────────
    const onCallIncoming = (payload: {
      callId: string;
      conversationId: string;
      callType: 'audio' | 'video';
      callerId: string;
      callerName: string;
      callerAvatar?: string;
    }) => {
      setIncomingCall(payload);
    };

    const onCallEnded = () => {
      endCall();
    };

    const onCallBusy = () => {
      clearIncomingCall();
      endCall();
    };

    // ── Reminder events ───────────────────────────────────────────
    const onReminderFire = (event: any) => {
      Alert.alert('⏰ Nhắc hẹn', event.content ?? 'Bạn có một nhắc hẹn!', [{ text: 'OK' }], {
        cancelable: true,
      });
    };
    const onReminderUpdated = (event: any) => {
      DeviceEventEmitter.emit('reminder:updated', { reminder: event.reminder });
    };
    const onReminderDeleted = (event: any) => {
      DeviceEventEmitter.emit('reminder:deleted', { reminderId: event.reminderId });
    };

    // ── Note events ───────────────────────────────────────────────
    const onNoteCreated = (event: any) => {
      DeviceEventEmitter.emit('note:created', {
        conversationId: event.conversationId,
        note: event.note,
      });
    };
    const onNoteUpdated = (event: any) => {
      DeviceEventEmitter.emit('note:updated', {
        conversationId: event.conversationId,
        note: event.note,
      });
    };
    const onNoteDeleted = (event: any) => {
      DeviceEventEmitter.emit('note:deleted', {
        conversationId: event.conversationId,
        noteId: event.noteId,
      });
    };

    // ── Poll events ───────────────────────────────────────────────
    const onPollUpdated = (event: any) => {
      socketPollUpdated({
        pollId: event.pollId,
        messageId: event.messageId,
        conversationId: event.conversationId,
        poll: event.poll,
      });
    };
    const onPollDeleted = (event: any) => {
      socketPollDeleted({
        pollId: event.pollId,
        messageId: event.messageId,
        conversationId: event.conversationId,
      });
    };

    socketService.on('call:incoming', onCallIncoming);
    socketService.on('call:ended', onCallEnded);
    socketService.on('call:busy', onCallBusy);
    socketService.on('reminder:fire', onReminderFire);
    socketService.on('reminder:updated', onReminderUpdated);
    socketService.on('reminder:deleted', onReminderDeleted);
    socketService.on('note:created', onNoteCreated);
    socketService.on('note:updated', onNoteUpdated);
    socketService.on('note:deleted', onNoteDeleted);
    socketService.on('poll:created', onPollUpdated);
    socketService.on('poll:voted', onPollUpdated);
    socketService.on('poll:option_added', onPollUpdated);
    socketService.on('poll:closed', onPollUpdated);
    socketService.on('poll:deleted', onPollDeleted);

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
      socketService.off('member:banned', onMemberBanned);
      socketService.off('member:unbanned', onMemberUnbanned);
      socketService.off('message:edited', onMessageEdited);
      socketService.off('call:incoming', onCallIncoming);
      socketService.off('call:ended', onCallEnded);
      socketService.off('call:busy', onCallBusy);
      socketService.off('reminder:fire', onReminderFire);
      socketService.off('reminder:updated', onReminderUpdated);
      socketService.off('reminder:deleted', onReminderDeleted);
      socketService.off('note:created', onNoteCreated);
      socketService.off('note:updated', onNoteUpdated);
      socketService.off('note:deleted', onNoteDeleted);
      socketService.off('poll:created', onPollUpdated);
      socketService.off('poll:voted', onPollUpdated);
      socketService.off('poll:option_added', onPollUpdated);
      socketService.off('poll:closed', onPollUpdated);
      socketService.off('poll:deleted', onPollDeleted);
    };
  }, [user?.id]);
}
