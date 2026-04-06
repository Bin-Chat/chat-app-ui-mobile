import { create } from 'zustand';
import { friendServices } from '@/services/friendServices';
import type { FriendItem, FriendRequest, SentRequest } from '@/types/friend';

interface FriendState {
  friends: FriendItem[];
  receivedRequests: FriendRequest[];
  sentRequests: SentRequest[];
  loadingFriends: boolean;
  loadingRequests: boolean;
  error: string | null;
}

interface FriendActions {
  fetchFriends: () => Promise<void>;
  fetchReceivedRequests: () => Promise<void>;
  fetchSentRequests: () => Promise<void>;
  sendFriendRequest: (addresseeId: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  declineFriendRequest: (friendshipId: string) => Promise<void>;
  cancelFriendRequest: (friendshipId: string) => Promise<void>;
  unfriendUser: (friendId: string) => Promise<void>;
  // Socket event dispatchers
  socketRequestReceived: (request: FriendRequest) => void;
  socketRequestAccepted: (friendshipId: string, newFriend: FriendItem) => void;
  socketRequestDeclined: (friendshipId: string) => void;
  socketRequestCancelled: (friendshipId: string) => void;
  socketUnfriended: (friendId: string) => void;
}

export const useFriendStore = create<FriendState & FriendActions>((set, get) => ({
  friends: [],
  receivedRequests: [],
  sentRequests: [],
  loadingFriends: false,
  loadingRequests: false,
  error: null,

  fetchFriends: async () => {
    set({ loadingFriends: true, error: null });
    try {
      const data = await friendServices.getFriends();
      const friends: FriendItem[] = Array.isArray(data)
        ? data
        : ((data as { friends: FriendItem[] }).friends ?? []);
      set({ friends, loadingFriends: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loadingFriends: false });
    }
  },

  fetchReceivedRequests: async () => {
    set({ loadingRequests: true, error: null });
    try {
      const data = await friendServices.getReceivedRequests();
      const receivedRequests: FriendRequest[] = Array.isArray(data)
        ? data
        : ((data as { requests: FriendRequest[] }).requests ?? []);
      set({ receivedRequests, loadingRequests: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loadingRequests: false });
    }
  },

  fetchSentRequests: async () => {
    set({ loadingRequests: true, error: null });
    try {
      const data = await friendServices.getSentRequests();
      const sentRequests: SentRequest[] = Array.isArray(data)
        ? data
        : ((data as { requests: SentRequest[] }).requests ?? []);
      set({ sentRequests, loadingRequests: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loadingRequests: false });
    }
  },

  sendFriendRequest: async (addresseeId: string) => {
    await friendServices.sendRequest(addresseeId);
    await get().fetchSentRequests();
  },

  acceptFriendRequest: async (friendshipId: string) => {
    await friendServices.acceptRequest(friendshipId);
    set((state) => ({
      receivedRequests: state.receivedRequests.filter((r) => r.friendshipId !== friendshipId),
    }));
    await get().fetchFriends();
  },

  declineFriendRequest: async (friendshipId: string) => {
    await friendServices.declineRequest(friendshipId);
    set((state) => ({
      receivedRequests: state.receivedRequests.filter((r) => r.friendshipId !== friendshipId),
    }));
  },

  cancelFriendRequest: async (friendshipId: string) => {
    await friendServices.cancelRequest(friendshipId);
    set((state) => ({
      sentRequests: state.sentRequests.filter((r) => r.friendshipId !== friendshipId),
    }));
  },

  unfriendUser: async (friendId: string) => {
    await friendServices.unfriend(friendId);
    set((state) => ({
      friends: state.friends.filter((f) => f.user.id !== friendId),
    }));
  },

  // --- Socket event dispatchers ---
  socketRequestReceived: (request: FriendRequest) => {
    set((state) => ({
      receivedRequests: [request, ...state.receivedRequests],
    }));
  },

  socketRequestAccepted: (friendshipId: string, newFriend: FriendItem) => {
    set((state) => ({
      sentRequests: state.sentRequests.filter((r) => r.friendshipId !== friendshipId),
      friends: [newFriend, ...state.friends],
    }));
  },

  socketRequestDeclined: (friendshipId: string) => {
    set((state) => ({
      sentRequests: state.sentRequests.filter((r) => r.friendshipId !== friendshipId),
    }));
  },

  socketRequestCancelled: (friendshipId: string) => {
    set((state) => ({
      receivedRequests: state.receivedRequests.filter((r) => r.friendshipId !== friendshipId),
    }));
  },

  socketUnfriended: (friendId: string) => {
    set((state) => ({
      friends: state.friends.filter((f) => f.user.id !== friendId),
    }));
  },
}));
