import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, X, Search, Check } from 'lucide-react-native';

import { useFriendStore } from '@/store/friendStore';
import { useChatStore } from '@/store/chatStore';
import { UserAvatar } from '@/components/UserAvatar';
import type { FriendItem } from '@/types/friend';

const MAX_MEMBERS = 200;

export default function CreateGroupScreen() {
  const router = useRouter();
  const friends = useFriendStore((s) => s.friends);
  const { createConversation } = useChatStore();

  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return friends;
    const q = search.toLowerCase();
    return friends.filter(
      (f) =>
        f.user.fullName.toLowerCase().includes(q) ||
        (f.user.email && f.user.email.toLowerCase().includes(q))
    );
  }, [friends, search]);

  const selectedFriends = useMemo(
    () => friends.filter((f) => selectedIds.includes(f.user.id)),
    [friends, selectedIds]
  );

  const toggleSelect = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      if (prev.length >= MAX_MEMBERS) {
        Alert.alert('Giới hạn', `Nhóm tối đa ${MAX_MEMBERS} thành viên.`);
        return prev;
      }
      return [...prev, userId];
    });
  }, []);

  const handleCreate = async () => {
    if (selectedIds.length < 2) {
      Alert.alert('Lỗi', 'Cần ít nhất 2 thành viên để tạo nhóm');
      return;
    }
    // If no name entered, auto-generate from member names
    const autoName = selectedFriends.map((f) => f.user.fullName.split(' ').pop()).join(', ');
    const name = groupName.trim() || autoName;
    setCreating(true);
    try {
      const conv = await createConversation(selectedIds, 'group', name);
      router.replace(`/conversation/${conv._id}`);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể tạo nhóm');
    } finally {
      setCreating(false);
    }
  };

  const renderFriend = ({ item }: { item: FriendItem }) => {
    const isSelected = selectedIds.includes(item.user.id);
    const isDisabled = !isSelected && selectedIds.length >= MAX_MEMBERS;
    return (
      <TouchableOpacity
        onPress={() => toggleSelect(item.user.id)}
        className="flex-row items-center px-4 py-3"
        activeOpacity={0.6}
        disabled={isDisabled}
      >
        <View
          className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
            isSelected ? 'bg-[#0068FF] border-[#0068FF]' : isDisabled ? 'border-gray-200' : 'border-gray-300'
          }`}
        >
          {isSelected && <Check size={14} color="#fff" />}
        </View>
        <UserAvatar
          user={{ fullName: item.user.fullName, avatar: item.user.avatar ?? undefined }}
          size={40}
        />
        <Text className={`ml-3 text-[15px] flex-1 ${isDisabled ? 'text-gray-300' : 'text-gray-800'}`} numberOfLines={1}>
          {item.user.fullName}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-3 py-2 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center"
        >
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <Text className="flex-1 text-[17px] font-semibold text-gray-900 ml-2">Tạo nhóm</Text>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={creating || selectedIds.length < 2}
          className={`px-4 py-2 rounded-full ${
            selectedIds.length >= 2 ? 'bg-[#0068FF]' : 'bg-gray-200'
          }`}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text
              className={`text-[14px] font-semibold ${
                selectedIds.length >= 2 ? 'text-white' : 'text-gray-400'
              }`}
            >
              Tạo ({selectedIds.length}/{MAX_MEMBERS})
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Group Name */}
      <View className="px-4 py-3 border-b border-gray-100">
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Tên nhóm (tùy chọn, mặc định lấy tên thành viên)"
          maxLength={100}
          className="text-[15px] bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Selected Tags */}
      {selectedFriends.length > 0 && (
        <View className="px-4 py-2 border-b border-gray-100">
          <FlatList
            data={selectedFriends}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.user.id}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <View className="flex-row items-center bg-blue-50 rounded-full pl-2 pr-1 py-1">
                <UserAvatar
                  user={{ fullName: item.user.fullName, avatar: item.user.avatar ?? undefined }}
                  size={22}
                />
                <Text className="text-[12px] text-[#0068FF] font-medium mx-1.5" numberOfLines={1}>
                  {item.user.fullName}
                </Text>
                <TouchableOpacity onPress={() => toggleSelect(item.user.id)} className="p-0.5">
                  <X size={14} color="#0068FF" />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      {/* Search */}
      <View className="px-4 py-2">
        <View className="flex-row items-center bg-gray-50 rounded-xl px-3 border border-gray-100">
          <Search size={16} color="#9ca3af" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm bạn bè..."
            className="flex-1 ml-2 text-[14px] py-2.5"
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {/* Friend list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.user.id}
        renderItem={renderFriend}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-400 text-[14px]">Không tìm thấy bạn bè</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-px bg-gray-50 ml-[76px]" />}
      />
    </SafeAreaView>
  );
}
