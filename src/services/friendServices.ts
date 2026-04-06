import authorizedAxios from '@/api/authorizedAxios';
import type {
  FriendItem,
  FriendRequest,
  SentRequest,
  FriendshipStatusResult,
} from '@/types/friend';
import type { User } from '@/types/user';

export const friendServices = {
  sendRequest: (addresseeId: string) =>
    authorizedAxios.post('/api/friends/request', { addresseeId }).then((r) => r.data),

  acceptRequest: (friendshipId: string) =>
    authorizedAxios.patch(`/api/friends/requests/${friendshipId}/accept`).then((r) => r.data),

  declineRequest: (friendshipId: string) =>
    authorizedAxios.patch(`/api/friends/requests/${friendshipId}/decline`).then((r) => r.data),

  cancelRequest: (friendshipId: string) =>
    authorizedAxios.delete(`/api/friends/requests/${friendshipId}`).then((r) => r.data),

  getFriends: () => authorizedAxios.get<FriendItem[]>('/api/friends').then((r) => r.data),

  getReceivedRequests: () =>
    authorizedAxios.get<FriendRequest[]>('/api/friends/requests/received').then((r) => r.data),

  getSentRequests: () =>
    authorizedAxios.get<SentRequest[]>('/api/friends/requests/sent').then((r) => r.data),

  unfriend: (friendId: string) =>
    authorizedAxios.delete(`/api/friends/${friendId}`).then((r) => r.data),

  checkStatus: (userId: string) =>
    authorizedAxios
      .get<FriendshipStatusResult>(`/api/friends/status/${userId}`)
      .then((r) => r.data),

  searchUsers: (name: string) =>
    authorizedAxios.get<User[]>('/api/users/search', { params: { name } }).then((r) => r.data),

  findUserByEmail: (email: string) =>
    authorizedAxios.get<User>(`/api/users/email/${encodeURIComponent(email)}`).then((r) => r.data),
};
