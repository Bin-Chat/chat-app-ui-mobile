import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useFriendStore } from '@/store/friendStore';
import { useChatStore } from '@/store/chatStore';
import { FriendCard } from '@/components/FriendCard';
import { ReceivedRequestCard } from '@/components/ReceivedRequestCard';
import { SentRequestCard } from '@/components/SentRequestCard';
import { UserAvatar } from '@/components/UserAvatar';
import { friendServices } from '@/services/friendServices';
import type { FriendItem, FriendRequest } from '@/types/friend';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { UserPlus, Check, X, Search, MessageCircle } from 'lucide-react-native';

type Tab = 'friends' | 'received' | 'sent';

export default function ContactsScreen() {
  const [activeTab, setActiveTab] = React.useState<Tab>('friends');
  const router = useRouter();
  const { createConversation } = useChatStore();
  const [selectedRequest, setSelectedRequest] = React.useState<FriendRequest | null>(null);
  const [selectedFriend, setSelectedFriend] = React.useState<FriendItem | null>(null);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [searchEmail, setSearchEmail] = React.useState('');
  const [searchResult, setSearchResult] = React.useState<{
    id: string;
    email: string;
    fullName?: string;
    avatar?: string;
  } | null>(null);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [addLoading, setAddLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const {
    friends,
    receivedRequests,
    sentRequests,
    loadingFriends,
    loadingRequests,
    fetchFriends,
    fetchReceivedRequests,
    fetchSentRequests,
    sendFriendRequest,
  } = useFriendStore();

  useFocusEffect(
    React.useCallback(() => {
      fetchFriends();
      fetchReceivedRequests();
      fetchSentRequests();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFriends(), fetchReceivedRequests(), fetchSentRequests()]);
    setRefreshing(false);
  };

  const handleSearchUser = async () => {
    const email = searchEmail.trim();
    if (!email) return;
    setSearchLoading(true);
    setSearchResult(null);
    try {
      const data = await friendServices.findUserByEmail(email);
      setSearchResult(data as { id: string; email: string; fullName?: string; avatar?: string });
    } catch {
      Alert.alert('Không tìm thấy', 'Không tìm thấy người dùng với email này.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendRequest = async (addresseeId: string) => {
    setAddLoading(true);
    try {
      await sendFriendRequest(addresseeId);
      Alert.alert('Thành công', 'Đã gửi lời mời kết bạn!');
      setShowAddModal(false);
      setSearchEmail('');
      setSearchResult(null);
    } catch (e: unknown) {
      Alert.alert(
        'Lỗi',
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Không thể gửi lời mời.'
      );
    } finally {
      setAddLoading(false);
    }
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'friends', label: 'Bạn bè', count: friends.length },
    {
      key: 'received',
      label: 'Lời mời',
      count: receivedRequests.length || undefined,
    },
    { key: 'sent', label: 'Đã gửi', count: sentRequests.length || undefined },
  ];

  const isLoading = activeTab === 'friends' ? loadingFriends : loadingRequests;

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900">Danh bạ</Text>
        <TouchableOpacity
          onPress={() => {
            setSelectedRequest(null);
            setSelectedFriend(null);
            setShowAddModal(true);
          }}
          className="w-9 h-9 bg-primary-light rounded-full items-center justify-center"
        >
          <UserPlus size={18} color="#0068FF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-100">
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => {
              setActiveTab(t.key);
              setSelectedRequest(null);
              setSelectedFriend(null);
            }}
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === t.key ? 'border-primary' : 'border-transparent'}`}
          >
            <View className="flex-row items-center gap-1.5">
              <Text
                className={`text-sm font-medium ${activeTab === t.key ? 'text-primary' : 'text-gray-500'}`}
              >
                {t.label}
              </Text>
              {t.count != null && t.count > 0 && (
                <View className="bg-primary rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                  <Text className="text-white text-[11px] font-bold">
                    {t.count > 99 ? '99+' : t.count}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {isLoading && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0068FF" />
        </View>
      ) : activeTab === 'friends' ? (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.friendshipId}
          renderItem={({ item }) => (
            <FriendCard
              item={item}
              onPress={() => {
                setSelectedFriend(item);
                setSelectedRequest(null);
              }}
            />
          )}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Text className="text-gray-400">Chưa có bạn bè nào</Text>
            </View>
          }
        />
      ) : activeTab === 'received' ? (
        <FlatList
          data={receivedRequests}
          keyExtractor={(item) => item.friendshipId}
          renderItem={({ item }) => (
            <ReceivedRequestCard
              item={item}
              isSelected={selectedRequest?.friendshipId === item.friendshipId}
              onSelect={() => {
                setSelectedRequest(item);
                setSelectedFriend(null);
              }}
            />
          )}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-gray-400">Không có lời mời nào</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={sentRequests}
          keyExtractor={(item) => item.friendshipId}
          renderItem={({ item }) => <SentRequestCard item={item} />}
          contentContainerStyle={{ paddingBottom: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-gray-400">Chưa gửi lời mời nào</Text>
            </View>
          }
        />
      )}

      {/* Sender Profile Modal */}
      <Modal
        visible={!!selectedRequest}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedRequest(null)}
      >
        <View className="flex-1 bg-white">
          {/* Cover */}
          <View className="h-32 bg-gradient-to-br from-blue-500 to-cyan-400" />
          <TouchableOpacity
            onPress={() => setSelectedRequest(null)}
            className="absolute top-4 right-4 w-9 h-9 bg-black/30 rounded-full items-center justify-center"
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>

          <View className="px-5 pt-0 pb-6">
            <View className="-mt-10 mb-4">
              <UserAvatar user={selectedRequest?.sender} size={80} variant="medium" />
            </View>
            <Text className="text-xl font-bold text-gray-900">
              {selectedRequest?.sender?.fullName ?? 'Người dùng'}
            </Text>
            <Text className="text-gray-500 mt-0.5">{selectedRequest?.sender?.email}</Text>
            {selectedRequest?.sentAt && (
              <Text className="text-gray-400 text-sm mt-1">
                Gửi lời mời:{' '}
                {format(new Date(selectedRequest.sentAt), 'dd/MM/yyyy', {
                  locale: vi,
                })}
              </Text>
            )}
            {selectedRequest?.sender?.bio && (
              <Text className="text-gray-600 mt-3 leading-5">{selectedRequest.sender.bio}</Text>
            )}

            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={async () => {
                  if (!selectedRequest) return;
                  try {
                    await useFriendStore
                      .getState()
                      .declineFriendRequest(selectedRequest.friendshipId);
                    setSelectedRequest(null);
                  } catch {
                    Alert.alert('Lỗi', 'Không thể từ chối.');
                  }
                }}
                className="flex-1 border border-gray-200 rounded-xl py-3 flex-row items-center justify-center gap-2"
              >
                <X size={16} color="#6b7280" />
                <Text className="text-gray-600 font-medium">Từ chối</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!selectedRequest) return;
                  try {
                    await useFriendStore
                      .getState()
                      .acceptFriendRequest(selectedRequest.friendshipId);
                    setSelectedRequest(null);
                  } catch {
                    Alert.alert('Lỗi', 'Không thể chấp nhận.');
                  }
                }}
                className="flex-1 bg-primary rounded-xl py-3 flex-row items-center justify-center gap-2"
              >
                <Check size={16} color="#fff" />
                <Text className="text-white font-medium">Đồng ý</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Friend Profile Modal */}
      <Modal
        visible={!!selectedFriend}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedFriend(null)}
      >
        <View className="flex-1 bg-white">
          <View className="h-32 bg-gradient-to-br from-blue-500 to-cyan-400" />
          <TouchableOpacity
            onPress={() => setSelectedFriend(null)}
            className="absolute top-4 right-4 w-9 h-9 bg-black/30 rounded-full items-center justify-center"
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>
          <View className="px-5 pt-0 pb-6">
            <View className="-mt-10 mb-4">
              <UserAvatar user={selectedFriend?.user} size={80} variant="medium" />
            </View>
            <Text className="text-xl font-bold text-gray-900">
              {selectedFriend?.user?.fullName ?? 'Người dùng'}
            </Text>
            <Text className="text-gray-500 mt-0.5">{selectedFriend?.user?.email}</Text>
            {selectedFriend?.user?.phone && (
              <Text className="text-gray-500 mt-0.5">{selectedFriend.user.phone}</Text>
            )}
            {selectedFriend?.user?.bio && (
              <Text className="text-gray-600 mt-3 leading-5">{selectedFriend.user.bio}</Text>
            )}

            {/* Chat button */}
            <TouchableOpacity
              onPress={async () => {
                if (!selectedFriend) return;
                try {
                  const conv = await createConversation([selectedFriend.user.id]);
                  setSelectedFriend(null);
                  router.push(`/conversation/${conv._id}`);
                } catch {
                  Alert.alert('Lỗi', 'Không thể mở hội thoại');
                }
              }}
              className="mt-5 flex-row items-center justify-center bg-[#0068FF] py-3 rounded-xl"
            >
              <MessageCircle size={18} color="#fff" />
              <Text className="text-white font-semibold text-[15px] ml-2">Nhắn tin</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Friend Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddModal(false);
          setSearchEmail('');
          setSearchResult(null);
        }}
      >
        <View className="flex-1 bg-white px-5 pt-6">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-bold text-gray-900">Thêm bạn bè</Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setSearchEmail('');
                setSearchResult(null);
              }}
            >
              <X size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text className="text-gray-700 font-medium mb-1.5">Tìm theo email</Text>
          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
              placeholder="email@example.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              value={searchEmail}
              onChangeText={setSearchEmail}
              onSubmitEditing={handleSearchUser}
              returnKeyType="search"
            />
            <TouchableOpacity
              onPress={handleSearchUser}
              disabled={searchLoading}
              className="w-12 bg-primary rounded-xl items-center justify-center"
            >
              {searchLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Search size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {searchResult && (
            <View className="mt-5 border border-gray-100 rounded-2xl p-4 flex-row items-center">
              <UserAvatar user={searchResult} size={52} variant="thumb" />
              <View className="flex-1 ml-3">
                <Text className="text-gray-900 font-medium text-base">
                  {searchResult.fullName ?? 'Người dùng'}
                </Text>
                <Text className="text-gray-400 text-sm">{searchResult.email}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleSendRequest(searchResult!.id)}
                disabled={addLoading}
                className="bg-primary px-4 py-2 rounded-xl"
              >
                {addLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-medium">Kết bạn</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
