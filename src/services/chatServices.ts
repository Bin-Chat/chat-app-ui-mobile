import authorizedAxios from '@/api/authorizedAxios';
import type { Conversation, Message, Participant } from '@/types/chat';

interface SendMessagePayload {
  content?: string;
  attachments?: {
    url: string;
    type: 'image' | 'video' | 'file';
    filename: string;
    size?: number;
    mimeType?: string;
  }[];
  replyTo?: {
    messageId: string;
    senderId: string;
    content: string;
    attachmentType?: string;
  } | null;
}

interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
}

export const chatServices = {
  createConversation: (data: {
    type: 'direct' | 'group';
    participantIds: string[];
    name?: string;
  }) => authorizedAxios.post<Conversation>('/api/chat/conversations', data).then((r) => r.data),

  getConversations: () =>
    authorizedAxios.get<Conversation[]>('/api/chat/conversations').then((r) => r.data),

  getMessages: (conversationId: string, cursor?: string) =>
    authorizedAxios
      .get<MessagesResponse>(`/api/chat/conversations/${conversationId}/messages`, {
        params: { cursor, limit: 30 },
      })
      .then((r) => r.data),

  sendMessage: (conversationId: string, data: SendMessagePayload) =>
    authorizedAxios
      .post<Message>(`/api/chat/conversations/${conversationId}/messages`, data)
      .then((r) => r.data),

  revokeMessage: (messageId: string) =>
    authorizedAxios.patch(`/api/chat/messages/${messageId}/revoke`).then((r) => r.data),

  deleteMessage: (messageId: string) =>
    authorizedAxios.delete(`/api/chat/messages/${messageId}`).then((r) => r.data),

  forwardMessage: (messageId: string, targetConversationId: string) =>
    authorizedAxios
      .post<Message>(`/api/chat/messages/${messageId}/forward`, { targetConversationId })
      .then((r) => r.data),

  reactToMessage: (messageId: string, emoji: string) =>
    authorizedAxios.post(`/api/chat/messages/${messageId}/react`, { emoji }).then((r) => r.data),

  // ── Group Management ──────────────────────────────────────────────

  getGroupMembers: (conversationId: string) =>
    authorizedAxios
      .get<Participant[]>(`/api/chat/conversations/${conversationId}/members`)
      .then((r) => r.data),

  addMembers: (conversationId: string, memberIds: string[]) =>
    authorizedAxios
      .post<Conversation>(`/api/chat/conversations/${conversationId}/members`, { memberIds })
      .then((r) => r.data),

  removeMember: (conversationId: string, memberId: string) =>
    authorizedAxios
      .delete<Conversation>(`/api/chat/conversations/${conversationId}/members`, {
        data: { memberId },
      })
      .then((r) => r.data),

  leaveGroup: (conversationId: string) =>
    authorizedAxios
      .post(`/api/chat/conversations/${conversationId}/leave`)
      .then((r) => r.data),

  updateGroup: (conversationId: string, data: { name?: string; avatar?: string; description?: string }) =>
    authorizedAxios
      .patch<Conversation>(`/api/chat/conversations/${conversationId}`, data)
      .then((r) => r.data),

  changeRole: (conversationId: string, memberId: string, role: 'admin' | 'member') =>
    authorizedAxios
      .patch(`/api/chat/conversations/${conversationId}/role`, { memberId, role })
      .then((r) => r.data),

  transferOwnership: (conversationId: string, newOwnerId: string) =>
    authorizedAxios
      .patch(`/api/chat/conversations/${conversationId}/transfer`, { newOwnerId })
      .then((r) => r.data),

  dissolveGroup: (conversationId: string) =>
    authorizedAxios
      .delete(`/api/chat/conversations/${conversationId}`)
      .then((r) => r.data),
};
