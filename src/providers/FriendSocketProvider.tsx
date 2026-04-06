import React from 'react';
import { Alert } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { getCookieHeader } from '@/api/authorizedAxios';
import type { FriendItem, FriendRequest } from '@/types/friend';

const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let socket: Socket | null = null;

function connectSocket(userId: string, cookieHeader: string) {
  if (socket?.connected) return;

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    extraHeaders: { Cookie: cookieHeader },
  });

  socket.on('connect', () => {
    socket?.emit('join', { userId });
  });

  socket.on('disconnect', () => {
    // no-op
  });
}

function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function FriendSocketProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const {
    socketRequestReceived,
    socketRequestAccepted,
    socketRequestDeclined,
    socketRequestCancelled,
    socketUnfriended,
    fetchFriends,
    fetchReceivedRequests,
  } = useFriendStore();

  React.useEffect(() => {
    if (!isAuthenticated || !user) {
      disconnectSocket();
      return;
    }

    // Connect once auth is ready
    getCookieHeader().then((cookieHeader) => {
      connectSocket(user.id, cookieHeader);

      socket?.on(
        'friend:request_received',
        (payload: { friendshipId: string; sentAt: string; sender: FriendRequest['sender'] }) => {
          socketRequestReceived({
            friendshipId: payload.friendshipId,
            sentAt: payload.sentAt,
            sender: payload.sender,
          });
          Alert.alert(
            'Lời mời kết bạn',
            `${payload.sender?.fullName ?? 'Ai đó'} đã gửi lời mời kết bạn.`
          );
        }
      );

      socket?.on(
        'friend:request_accepted',
        (payload: { friendshipId: string; newFriend: FriendItem }) => {
          socketRequestAccepted(payload.friendshipId, payload.newFriend);
          Alert.alert(
            'Kết bạn thành công',
            `${payload.newFriend?.user?.fullName ?? 'Ai đó'} đã chấp nhận lời mời kết bạn.`
          );
        }
      );

      socket?.on('friend:request_declined', (payload: { friendshipId: string }) => {
        socketRequestDeclined(payload.friendshipId);
      });

      socket?.on('friend:request_cancelled', (payload: { friendshipId: string }) => {
        socketRequestCancelled(payload.friendshipId);
        fetchReceivedRequests();
      });

      socket?.on('friend:unfriended', (payload: { formerFriendId: string }) => {
        socketUnfriended(payload.formerFriendId);
      });
    });

    return () => {
      socket?.off('friend:request_received');
      socket?.off('friend:request_accepted');
      socket?.off('friend:request_declined');
      socket?.off('friend:request_cancelled');
      socket?.off('friend:unfriended');
    };
  }, [isAuthenticated, user?.id]);

  return <>{children}</>;
}
