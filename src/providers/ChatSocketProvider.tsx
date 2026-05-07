import React from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { getCookieHeader } from '@/api/authorizedAxios';
import { getApiUrl } from '@/api/getApiUrl';
import type { Message } from '@/types/chat';

let chatSocket: Socket | null = null;

function connectChatSocket(userId: string, cookieHeader: string) {
  if (chatSocket?.connected) return;

  chatSocket = io(getApiUrl(), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    extraHeaders: { Cookie: cookieHeader },
  });

  chatSocket.on('connect', () => {
    chatSocket?.emit('join', { userId });
  });
}

function disconnectChatSocket() {
  chatSocket?.disconnect();
  chatSocket = null;
}

interface MessageCreatedEvent {
  messageId?: string;
  _id?: string;
  conversationId: string;
  senderId: string;
  content?: string;
  attachments?: Message['attachments'];
  replyTo?: Message['replyTo'];
  createdAt: string;
}

export function ChatSocketProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const {
    socketMessageNew,
    socketMessageRevoked,
    socketReactionToggled,
    socketConversationUpdated,
    socketConversationSettingsUpdated,
    socketMessagePinned,
    socketMessageUnpinned,
    showInAppNotification,
  } = useChatStore();

  // Track activeConversationId via ref to avoid stale closure in socket handler
  const activeConvRef = React.useRef<string | null>(null);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  React.useEffect(() => {
    activeConvRef.current = activeConversationId;
  }, [activeConversationId]);

  React.useEffect(() => {
    if (!isAuthenticated || !user) {
      disconnectChatSocket();
      return;
    }

    getCookieHeader().then((cookieHeader) => {
      connectChatSocket(user.id, cookieHeader);

      chatSocket?.on('message:new', (payload: MessageCreatedEvent) => {
        const msg: Message = {
          _id: payload.messageId ?? payload._id ?? '',
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

        // In-app notification when from a different conversation
        if (msg.senderId !== user.id && msg.conversationId !== activeConvRef.current) {
          const body =
            msg.content ||
            (msg.attachments?.length
              ? msg.attachments[0].type === 'image'
                ? '📷 Hình ảnh'
                : msg.attachments[0].type === 'video'
                  ? '🎬 Video'
                  : '📎 Tệp đính kèm'
              : '...');
          showInAppNotification({
            id: msg._id,
            title: 'Tin nhắn mới',
            body: body.slice(0, 80),
          });
        }
      });

      chatSocket?.on(
        'message:revoked',
        (payload: { messageId: string; conversationId: string; revokedBy?: string }) => {
          socketMessageRevoked(payload);
        }
      );

      chatSocket?.on(
        'message:reaction',
        (payload: { messageId: string; conversationId: string; userId: string; emoji: string }) => {
          socketReactionToggled(payload);
        }
      );

      chatSocket?.on('conversation:updated', (payload: any) => {
        socketConversationUpdated(payload);
      });

      chatSocket?.on(
        'conversation:settings',
        (payload: { conversationId: string; settings: Record<string, any> }) => {
          socketConversationSettingsUpdated(payload);
        }
      );

      chatSocket?.on(
        'message:pinned',
        (payload: { messageId: string; conversationId: string; pinnedBy: string }) => {
          socketMessagePinned(payload);
        }
      );

      chatSocket?.on(
        'message:unpinned',
        (payload: { messageId: string; conversationId: string }) => {
          socketMessageUnpinned(payload);
        }
      );
    });

    return () => {
      chatSocket?.off('message:new');
      chatSocket?.off('message:revoked');
      chatSocket?.off('message:reaction');
      chatSocket?.off('conversation:updated');
      chatSocket?.off('message:pinned');
      chatSocket?.off('message:unpinned');
      chatSocket?.off('conversation:settings');
    };
  }, [isAuthenticated, user?.id]);

  return <>{children}</>;
}
