export interface Attachment {
  url: string;
  type: 'image' | 'video' | 'file' | 'audio';
  filename: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface ForwardInfo {
  messageId: string;
  conversationId: string;
  senderId: string;
}

export interface ReplyInfo {
  messageId: string;
  senderId: string;
  content: string;
  attachmentType?: 'image' | 'video' | 'file' | 'audio';
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type?: string;
  metadata?: Record<string, any>;
  attachments: Attachment[];
  deletedFor: string[];
  revokedAt: string | null;
  revokedBy?: string | null;
  forwardedFrom: ForwardInfo | null;
  replyTo: ReplyInfo | null;
  reactions: Reaction[];
  isEdited?: boolean;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  isBanned?: boolean;
  bannedUntil?: string | null;
}

export interface LastMessage {
  senderId: string;
  content: string;
  type: string;
  sentAt: string;
  revokedAt?: string | null;
}

export interface Conversation {
  _id: string;
  type: 'direct' | 'group';
  participants: Participant[];
  lastMessage: LastMessage | null;
  name?: string;
  avatar?: string;
  description?: string;
  settings?: {
    onlyAdminCanSend?: boolean;
    allowMemberInvite?: boolean;
    onlyAdminCanPin?: boolean;
    requireJoinApproval?: boolean;
    chatHistoryForNewMembers?: boolean;
  };
  createdAt: string;
  updatedAt: string;
  inviteToken?: string | null;
  inviteEnabled?: boolean;
  pendingMembers?: { userId: string; requestedAt: string }[];
}
