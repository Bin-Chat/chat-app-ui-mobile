import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { UserAvatar } from './UserAvatar';
import { useFriendStore } from '@/store/friendStore';
import type { SentRequest } from '@/types/friend';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface SentRequestCardProps {
  item: SentRequest;
}

export function SentRequestCard({ item }: SentRequestCardProps) {
  const [loading, setLoading] = React.useState(false);
  const { cancelFriendRequest } = useFriendStore();

  const handleCancel = async () => {
    setLoading(true);
    try {
      await cancelFriendRequest(item.friendshipId);
    } finally {
      setLoading(false);
    }
  };

  const sentDate = item.sentAt ? format(new Date(item.sentAt), 'dd/MM/yyyy', { locale: vi }) : null;

  return (
    <View className="flex-row items-center bg-white px-4 py-3 border-b border-gray-100">
      <UserAvatar user={item.addressee} size={48} variant="thumb" />
      <View className="flex-1 ml-3">
        <Text className="text-gray-900 font-medium text-base" numberOfLines={1}>
          {item.addressee?.fullName ?? 'Người dùng'}
        </Text>
        {sentDate && <Text className="text-gray-400 text-xs mt-0.5">Đã gửi: {sentDate}</Text>}
      </View>
      <TouchableOpacity
        onPress={handleCancel}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg bg-gray-100"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Text className="text-gray-600 text-sm font-medium">Thu hồi</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
