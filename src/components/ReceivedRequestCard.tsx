import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { UserAvatar } from './UserAvatar';
import { useFriendStore } from '@/store/friendStore';
import type { FriendRequest } from '@/types/friend';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ReceivedRequestCardProps {
  item: FriendRequest;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function ReceivedRequestCard({ item, isSelected, onSelect }: ReceivedRequestCardProps) {
  const [accepting, setAccepting] = React.useState(false);
  const [declining, setDeclining] = React.useState(false);
  const { acceptFriendRequest, declineFriendRequest } = useFriendStore();

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await acceptFriendRequest(item.friendshipId);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await declineFriendRequest(item.friendshipId);
    } finally {
      setDeclining(false);
    }
  };

  const sentDate = item.sentAt ? format(new Date(item.sentAt), 'dd/MM/yyyy', { locale: vi }) : null;

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={onSelect ? 0.7 : 1}
      className={`flex-row items-center px-4 py-3 border-b border-gray-100 ${isSelected ? 'bg-blue-50' : 'bg-white'}`}
    >
      <UserAvatar user={item.sender} size={48} variant="thumb" />
      <View className="flex-1 ml-3">
        <Text className="text-gray-900 font-medium text-base" numberOfLines={1}>
          {item.sender?.fullName ?? 'Người dùng'}
        </Text>
        {sentDate && <Text className="text-gray-400 text-xs mt-0.5">{sentDate}</Text>}
      </View>
      <View className="flex-row gap-2 ml-2">
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            handleDecline();
          }}
          disabled={declining || accepting}
          className="px-3 py-1.5 rounded-lg bg-gray-100"
        >
          {declining ? (
            <ActivityIndicator size="small" color="#6b7280" />
          ) : (
            <Text className="text-gray-600 text-sm font-medium">Từ chối</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation?.();
            handleAccept();
          }}
          disabled={accepting || declining}
          className="px-3 py-1.5 rounded-lg bg-primary"
        >
          {accepting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white text-sm font-medium">Đồng ý</Text>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
