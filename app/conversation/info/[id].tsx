import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Phone,
  Video,
  ChevronRight,
  ChevronDown,
  FileText,
  Link,
  Image as ImageIcon,
  Download,
} from 'lucide-react-native';

import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useCallStore } from '@/store/callStore';
import { UserAvatar } from '@/components/UserAvatar';
import { chatServices } from '@/services/chatServices';
import { socketService } from '@/services/socket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = Math.floor((SCREEN_WIDTH - 48) / 3);

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function MediaCollapsible({
  title,
  icon,
  children,
  defaultOpen,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <View className="border-t border-gray-100">
      <TouchableOpacity
        className="flex-row items-center justify-between px-4 py-3"
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <View className="flex-row items-center">
          {icon}
          <Text className="text-[14px] font-semibold text-gray-700 ml-2">{title}</Text>
        </View>
        {open ? (
          <ChevronDown size={16} color="#9ca3af" />
        ) : (
          <ChevronRight size={16} color="#9ca3af" />
        )}
      </TouchableOpacity>
      {open && <View className="px-4 pb-4">{children}</View>}
    </View>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function ImageSection({ conversationId }: { conversationId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(
    async (cur?: string) => {
      setLoading(true);
      try {
        const res = await chatServices.getConversationMedia(conversationId, 'image', cur);
        setItems((prev) => (cur ? [...prev, ...res.items] : res.items));
        setHasMore(res.hasMore);
        setCursor(res.nextCursor);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const displayed = showAll ? items : items.slice(0, 9);

  if (loading && items.length === 0) {
    return <ActivityIndicator size="small" color="#0068FF" style={{ marginVertical: 8 }} />;
  }

  if (items.length === 0) {
    return (
      <Text className="text-[12px] text-gray-400 text-center py-2">Chưa có ảnh/video nào</Text>
    );
  }

  return (
    <View>
      <View className="flex-row flex-wrap gap-1">
        {displayed.map((item: any, i: number) => (
          <TouchableOpacity
            key={`${item.messageId}-${i}`}
            onPress={() => Linking.openURL(item.url)}
            activeOpacity={0.8}
          >
            <View
              style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
              className="rounded-lg overflow-hidden bg-gray-100"
            >
              <Image
                source={{ uri: item.thumbnailUrl ?? item.url }}
                style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
                resizeMode="cover"
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
      {!showAll && items.length > 9 && (
        <TouchableOpacity onPress={() => setShowAll(true)} className="mt-2">
          <Text className="text-[13px] text-[#0068FF] text-center">
            Xem tất cả ({items.length}
            {hasMore ? '+' : ''})
          </Text>
        </TouchableOpacity>
      )}
      {showAll && hasMore && (
        <TouchableOpacity
          onPress={() => load(cursor ?? undefined)}
          disabled={loading}
          className="mt-2"
        >
          <Text className="text-[13px] text-[#0068FF] text-center">
            {loading ? 'Đang tải...' : 'Tải thêm'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function FileSection({ conversationId }: { conversationId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (cur?: string) => {
      setLoading(true);
      try {
        const res = await chatServices.getConversationMedia(conversationId, 'file', cur);
        setItems((prev) => (cur ? [...prev, ...res.items] : res.items));
        setHasMore(res.hasMore);
        setCursor(res.nextCursor);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (loading && items.length === 0) {
    return <ActivityIndicator size="small" color="#0068FF" style={{ marginVertical: 8 }} />;
  }

  if (items.length === 0) {
    return <Text className="text-[12px] text-gray-400 text-center py-2">Chưa có file nào</Text>;
  }

  return (
    <View>
      {items.map((item: any, i: number) => (
        <TouchableOpacity
          key={`${item.messageId}-${i}`}
          className="flex-row items-center py-2.5 border-b border-gray-50"
          onPress={() => Linking.openURL(item.url)}
          activeOpacity={0.7}
        >
          <View className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center mr-3">
            <FileText size={18} color="#0068FF" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[13px] font-medium text-gray-800" numberOfLines={1}>
              {item.filename}
            </Text>
            <Text className="text-[11px] text-gray-400">
              {formatBytes(item.size)} · {formatDate(item.createdAt)}
            </Text>
          </View>
          <Download size={16} color="#9ca3af" />
        </TouchableOpacity>
      ))}
      {hasMore && (
        <TouchableOpacity
          onPress={() => load(cursor ?? undefined)}
          disabled={loading}
          className="mt-2"
        >
          <Text className="text-[13px] text-[#0068FF] text-center">
            {loading ? 'Đang tải...' : 'Tải thêm'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function LinkSection({ conversationId }: { conversationId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (cur?: string) => {
      setLoading(true);
      try {
        const res = await chatServices.getConversationMedia(conversationId, 'link', cur);
        setItems((prev) => (cur ? [...prev, ...res.items] : res.items));
        setHasMore(res.hasMore);
        setCursor(res.nextCursor);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (loading && items.length === 0) {
    return <ActivityIndicator size="small" color="#0068FF" style={{ marginVertical: 8 }} />;
  }

  if (items.length === 0) {
    return <Text className="text-[12px] text-gray-400 text-center py-2">Chưa có link nào</Text>;
  }

  return (
    <View>
      {items.map((item: any, i: number) => (
        <TouchableOpacity
          key={`${item.messageId}-${i}`}
          className="flex-row items-center py-2.5 border-b border-gray-50"
          onPress={() => Linking.openURL(item.url)}
          activeOpacity={0.7}
        >
          <View className="w-9 h-9 rounded-xl bg-green-50 items-center justify-center mr-3">
            <Link size={18} color="#16a34a" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[13px] font-medium text-[#0068FF]" numberOfLines={1}>
              {item.domain}
            </Text>
            <Text className="text-[11px] text-gray-400" numberOfLines={1}>
              {item.url}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
      {hasMore && (
        <TouchableOpacity
          onPress={() => load(cursor ?? undefined)}
          disabled={loading}
          className="mt-2"
        >
          <Text className="text-[13px] text-[#0068FF] text-center">
            {loading ? 'Đang tải...' : 'Tải thêm'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function DirectInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const conversationId = id ?? '';

  const user = useAuthStore((s) => s.user);
  const friends = useFriendStore((s) => s.friends);
  const conversation = useChatStore((s) => s.conversations.find((c) => c._id === conversationId));
  const callStatus = useCallStore((s) => s.status);

  const otherParticipant = conversation?.participants.find((p) => p.userId !== user?.id);
  const otherUser = friends.find((f) => f.user.id === otherParticipant?.userId)?.user ?? null;

  const initiateCall = useCallback(
    (callType: 'audio' | 'video') => {
      if (!conversation || !user || callStatus !== 'idle') return;
      const callId = Math.random().toString(36).slice(2);
      const participantIds = conversation.participants
        .map((p) => p.userId)
        .filter((uid) => uid !== user.id);
      socketService.emit('call:initiate', {
        callId,
        conversationId,
        callType,
        participantIds,
        callerName: user.fullName ?? 'Bạn',
        callerAvatar: user.avatar,
      });
      useCallStore.getState().startCall({
        callId,
        conversationId,
        callType,
        participantIds: [...participantIds, user.id],
        initiatorId: user.id,
      });
      router.push('/call');
    },
    [conversation, conversationId, user, callStatus, router]
  );

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
        <Text className="flex-1 text-[17px] font-semibold text-gray-900 ml-2">Thông tin</Text>
      </View>

      <ScrollView className="flex-1">
        {/* User card */}
        <View className="items-center pt-6 pb-4 border-b border-gray-100">
          <UserAvatar
            user={{
              fullName: otherUser?.fullName ?? 'Người dùng',
              avatar: otherUser?.avatar ?? undefined,
            }}
            size={72}
          />
          <Text className="text-[20px] font-bold text-gray-900 mt-3">
            {otherUser?.fullName ?? 'Người dùng'}
          </Text>

          {/* Call shortcuts */}
          <View className="flex-row gap-4 mt-4">
            <TouchableOpacity
              className="items-center"
              onPress={() => initiateCall('audio')}
              activeOpacity={0.7}
            >
              <View className="w-11 h-11 rounded-full bg-blue-50 items-center justify-center mb-1">
                <Phone size={20} color="#0068FF" />
              </View>
              <Text className="text-[11px] text-gray-500">Thoại</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="items-center"
              onPress={() => initiateCall('video')}
              activeOpacity={0.7}
            >
              <View className="w-11 h-11 rounded-full bg-blue-50 items-center justify-center mb-1">
                <Video size={20} color="#0068FF" />
              </View>
              <Text className="text-[11px] text-gray-500">Video</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Media sections */}
        <MediaCollapsible
          title="Ảnh/Video"
          icon={<ImageIcon size={16} color="#6b7280" />}
          defaultOpen={true}
        >
          <ImageSection conversationId={conversationId} />
        </MediaCollapsible>

        <MediaCollapsible title="File" icon={<FileText size={16} color="#6b7280" />}>
          <FileSection conversationId={conversationId} />
        </MediaCollapsible>

        <MediaCollapsible title="Link" icon={<Link size={16} color="#6b7280" />}>
          <LinkSection conversationId={conversationId} />
        </MediaCollapsible>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
