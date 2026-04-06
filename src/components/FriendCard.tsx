import React from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { UserAvatar } from './UserAvatar';
import { useFriendStore } from '@/store/friendStore';
import type { FriendItem } from '@/types/friend';

interface FriendCardProps {
  item: FriendItem;
  onPress?: (item: FriendItem) => void;
}

export function FriendCard({ item, onPress }: FriendCardProps) {
  const [loading, setLoading] = React.useState(false);
  const { unfriendUser } = useFriendStore();

  const handleLongPress = () => {
    Alert.alert(
      'Huỷ kết bạn',
      `Bạn có muốn huỷ kết bạn với ${item.user.fullName ?? item.user.email}?`,
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Huỷ kết bạn',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await unfriendUser(item.user.id);
            } catch {
              Alert.alert('Lỗi', 'Không thể huỷ kết bạn. Vui lòng thử lại.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={() => onPress?.(item)}
      onLongPress={handleLongPress}
      className="flex-row items-center bg-white px-4 py-3 border-b border-gray-100"
      activeOpacity={0.7}
    >
      <UserAvatar user={item.user} size={48} variant="thumb" />
      <View className="flex-1 ml-3">
        <Text className="text-gray-900 font-medium text-base" numberOfLines={1}>
          {item.user.fullName ?? 'Người dùng'}
        </Text>
        <Text className="text-gray-400 text-sm" numberOfLines={1}>
          {item.user.email}
        </Text>
      </View>
      {loading && <ActivityIndicator size="small" color="#9ca3af" />}
    </TouchableOpacity>
  );
}
