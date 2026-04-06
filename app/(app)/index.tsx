import { useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MessageCircle, Users } from 'lucide-react-native';

import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { UserAvatar } from '@/components/UserAvatar';
import type { Conversation } from '@/types/chat';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ`;
  const days = Math.floor(hours / 24);
  return `${days} ngày`;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { conversations, loadingConversations, fetchConversations } = useChatStore();
  const unreadCounts = useChatStore((s) => s.unreadCounts);
  const user = useAuthStore((s) => s.user);
  const friends = useFriendStore((s) => s.friends);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [])
  );

  const enriched = useMemo(() => {
    return conversations.map((conv) => {
      if (conv.type === 'direct') {
        const otherP = conv.participants.find((p) => p.userId !== user?.id);
        const friend = friends.find((f) => f.user?.id === otherP?.userId);
        return { ...conv, otherUser: friend?.user ?? undefined };
      }
      return { ...conv, otherUser: undefined };
    });
  }, [conversations, user, friends]);

  const renderItem = ({ item }: { item: (typeof enriched)[0] }) => {
    const name =
      item.type === 'direct' ? item.otherUser?.fullName || 'Người dùng' : item.name || 'Nhóm chat';
    const avatar = item.type === 'direct' ? item.otherUser?.avatar : item.avatar;
    const lastMsg = item.lastMessage;
    const unread = unreadCounts[item._id] ?? 0;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/conversation/${item._id}`)}
        className="flex-row items-center px-4 py-3 bg-white"
        activeOpacity={0.6}
      >
        <UserAvatar user={{ fullName: name, avatar: avatar ?? undefined }} size={48} />
        <View className="flex-1 ml-3">
          <View className="flex-row items-center justify-between">
            <Text
              className={`text-[15px] truncate ${
                unread > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'
              }`}
              numberOfLines={1}
              style={{ flex: 1, marginRight: 6 }}
            >
              {name}
            </Text>
            <View className="flex-row items-center gap-1.5">
              {lastMsg && (
                <Text className="text-[11px] text-gray-400">{timeAgo(lastMsg.sentAt)}</Text>
              )}
              {unread > 0 && (
                <View
                  className="rounded-full bg-[#0068FF] items-center justify-center"
                  style={{ minWidth: 18, height: 18, paddingHorizontal: 4 }}
                >
                  <Text className="text-white text-[10px] font-bold leading-none">
                    {unread > 99 ? '99+' : unread}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {lastMsg && (
            <Text
              className={`text-[13px] mt-0.5 ${
                unread > 0 ? 'font-semibold text-gray-600' : 'text-gray-400'
              }`}
              numberOfLines={1}
            >
              {lastMsg.content || '[Tệp đính kèm]'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loadingConversations && conversations.length === 0) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0068FF" />
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <MessageCircle size={56} color="#d1d5db" />
        <Text className="text-gray-400 text-base mt-4 text-center">
          Chưa có cuộc trò chuyện nào
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={enriched}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshing={loadingConversations}
        onRefresh={fetchConversations}
        contentContainerStyle={{ paddingBottom: 80 }}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-50 ml-[76px]" />}
      />
      {/* Create Group FAB */}
      <TouchableOpacity
        onPress={() => router.push('/create-group')}
        className="absolute bottom-5 right-5 w-14 h-14 rounded-full bg-[#0068FF] items-center justify-center shadow-lg"
        style={{ elevation: 6 }}
        activeOpacity={0.75}
      >
        <Users size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
