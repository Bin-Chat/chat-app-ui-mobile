import { useEffect } from 'react';
import { Alert } from 'react-native';
import { socketService } from '@/services/socket';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';

/**
 * Wire socket.io friend events → Zustand friend store.
 * Mount once in (app)/_layout.tsx — renders nothing.
 * Mirrors web FriendSocketInitializer.tsx pattern.
 */
export function useFriendSocket() {
  const user = useAuthStore((s) => s.user);
  const {
    fetchReceivedRequests,
    fetchFriends,
    fetchSentRequests,
    socketRequestAccepted,
    socketRequestDeclined,
    socketRequestCancelled,
    socketUnfriended,
  } = useFriendStore();

  useEffect(() => {
    if (!user?.id) {
      socketService.disconnect();
      return;
    }

    socketService.connect(user.id);

    // Payload from gateway only has { friendshipId, requesterId, addresseeId, sentAt }
    // → no sender profile info → fetch full list from API instead
    const onRequestReceived = () => {
      Alert.alert('Lời mời kết bạn', 'Bạn có lời mời kết bạn mới');
      fetchReceivedRequests();
    };

    const onRequestAccepted = (payload: any) => {
      if (payload.requesterId === user.id) {
        Alert.alert('Kết bạn', 'Lời mời kết bạn đã được chấp nhận');
      }
      // Gateway only emits { friendshipId, requesterId, addresseeId, acceptedAt } — no profile data.
      // Don't call socketRequestAccepted (it would add a malformed FriendItem without .user).
      // fetchFriends() will refresh the list from the API with full profile data.
      fetchFriends();
      fetchSentRequests();
    };

    const onRequestDeclined = (payload: any) => {
      socketRequestDeclined(payload.friendshipId);
    };

    const onRequestCancelled = (payload: any) => {
      socketRequestCancelled(payload.friendshipId);
    };

    const onUnfriended = (payload: any) => {
      const removedId = payload.formerFriendId ?? payload.userId;
      socketUnfriended(removedId);
    };

    socketService.on('friend:request_received', onRequestReceived);
    socketService.on('friend:request_accepted', onRequestAccepted);
    socketService.on('friend:request_declined', onRequestDeclined);
    socketService.on('friend:request_cancelled', onRequestCancelled);
    socketService.on('friend:unfriended', onUnfriended);

    return () => {
      socketService.off('friend:request_received', onRequestReceived);
      socketService.off('friend:request_accepted', onRequestAccepted);
      socketService.off('friend:request_declined', onRequestDeclined);
      socketService.off('friend:request_cancelled', onRequestCancelled);
      socketService.off('friend:unfriended', onUnfriended);
    };
  }, [user?.id]);
}
