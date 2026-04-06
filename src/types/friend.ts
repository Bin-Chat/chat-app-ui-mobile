import type { User } from './user';

export enum FriendshipStatus {
  NONE = 'none',
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  BLOCKED = 'blocked',
  SELF = 'self',
}

export interface FriendItem {
  friendshipId: string;
  friendSince: string;
  user: User;
}

export interface FriendRequest {
  friendshipId: string;
  sentAt: string;
  sender: User;
}

export interface SentRequest {
  friendshipId: string;
  sentAt: string;
  addressee: User;
}

export interface FriendshipStatusResult {
  status: FriendshipStatus;
  friendshipId?: string;
  isSender?: boolean;
}
