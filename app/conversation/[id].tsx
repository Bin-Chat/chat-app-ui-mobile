import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  ArrowLeft,
  Send,
  CornerUpRight,
  RotateCcw,
  Trash2,
  Reply,
  X,
  Image as ImageIcon,
  FileText,
  Video as VideoIcon,
  Info,
  Pin,
  ChevronDown,
  Ban,
  Pencil,
  Phone,
  PhoneMissed,
  Video,
  VideoOff,
  Search,
  Languages,
  AlignLeft,
  Wand2,
  ShieldAlert,
  Bot,
  Sparkles,
} from 'lucide-react-native';

import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useCallStore } from '@/store/callStore';
import { socketService } from '@/services/socket';
import { UserAvatar } from '@/components/UserAvatar';
import { uploadFile, FILE_SIZE_LIMITS, getCategory } from '@/services/uploadService';
import { chatServices } from '@/services/chatServices';
import { aiServices } from '@/services/aiServices';
import type { Message, Attachment } from '@/types/chat';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PendingAttachment {
  uri: string;
  filename: string;
  mimeType: string;
  size: number;
  type: 'image' | 'video' | 'file';
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// ── Image Grid ──

function ImageGrid({ images, onPress }: { images: Attachment[]; onPress: (idx: number) => void }) {
  const gridW = SCREEN_WIDTH * 0.6; // ~60% screen width
  const halfW = (gridW - 2) / 2;

  if (images.length === 1) {
    return (
      <TouchableOpacity onPress={() => onPress(0)} className="mb-1">
        <Image
          source={{ uri: images[0].thumbnailUrl || images[0].url }}
          style={{ width: gridW, height: gridW, borderRadius: 12 }}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }
  if (images.length === 2) {
    return (
      <View
        style={{ flexDirection: 'row', gap: 2, width: gridW, borderRadius: 12, overflow: 'hidden' }}
        className="mb-1"
      >
        {images.map((img, i) => (
          <TouchableOpacity key={img.url} onPress={() => onPress(i)}>
            <Image
              source={{ uri: img.thumbnailUrl || img.url }}
              style={{ width: halfW, height: halfW }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  }
  if (images.length === 3) {
    return (
      <View style={{ width: gridW, borderRadius: 12, overflow: 'hidden' }} className="mb-1">
        <TouchableOpacity onPress={() => onPress(0)}>
          <Image
            source={{ uri: images[0].thumbnailUrl || images[0].url }}
            style={{ width: gridW, height: gridW * 0.55 }}
            resizeMode="cover"
          />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
          {images.slice(1).map((img, i) => (
            <TouchableOpacity key={img.url} onPress={() => onPress(i + 1)}>
              <Image
                source={{ uri: img.thumbnailUrl || img.url }}
                style={{ width: halfW, height: halfW }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }
  // 4+ images: 2x2 grid with overlay for extras
  const displayed = images.slice(0, 4);
  const remaining = images.length - 4;
  return (
    <View
      style={{
        width: gridW,
        borderRadius: 12,
        overflow: 'hidden',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 2,
      }}
      className="mb-1"
    >
      {displayed.map((img, i) => (
        <TouchableOpacity key={img.url} onPress={() => onPress(i)} style={{ position: 'relative' }}>
          <Image
            source={{ uri: img.thumbnailUrl || img.url }}
            style={{ width: halfW, height: halfW }}
            resizeMode="cover"
          />
          {i === 3 && remaining > 0 && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text className="text-white text-lg font-bold">+{remaining}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Message Bubble ──

function MessageBubble({
  message,
  isMine,
  showAvatar,
  senderName,
  senderAvatar,
  conversationId,
  userId,
  onReply,
  onForward,
  onScrollToMessage,
  isAdminOrOwner = false,
  conversationType,
  isPinned = false,
  onPin,
  onlyAdminCanPin,
  onEdit,
  onTranslate,
  onRewrite,
  isHighlighted = false,
}: {
  message: Message;
  isMine: boolean;
  showAvatar: boolean;
  senderName?: string;
  senderAvatar?: string;
  conversationId: string;
  userId: string;
  onReply: (msg: Message) => void;
  onForward: (msg: Message) => void;
  onScrollToMessage: (messageId: string) => void;
  isAdminOrOwner?: boolean;
  conversationType?: 'direct' | 'group';
  isPinned?: boolean;
  onPin?: () => void;
  onlyAdminCanPin?: boolean;
  onEdit?: () => void;
  onTranslate?: (content: string) => void;
  onRewrite?: (content: string) => void;
  isHighlighted?: boolean;
}) {
  const { revokeMessage, deleteMessage, reactToMessage } = useChatStore();
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const isRevoked = !!message.revokedAt;
  const isSystemMsg = message.type === 'system' || message.senderId === 'system';
  const timeStr = formatTime(message.createdAt);
  const canRevoke =
    isMine && !isRevoked && Date.now() - new Date(message.createdAt).getTime() < 15 * 60 * 1000;
  const canEdit =
    isMine &&
    !isRevoked &&
    !isSystemMsg &&
    Date.now() - new Date(message.createdAt).getTime() < 30 * 60 * 1000;
  // Respect onlyAdminCanPin group setting
  const canPin = !isRevoked && !isSystemMsg && (!onlyAdminCanPin || isAdminOrOwner);

  const images = message.attachments.filter((a) => a.type === 'image');
  const videos = message.attachments.filter((a) => a.type === 'video');
  const files = message.attachments.filter((a) => a.type === 'file');

  // Determine whether a bubble background is needed
  const hasText = !!message.content?.trim();
  const hasReply = !!message.replyTo;
  // Pure media = only one attachment type, no text, no reply-to
  const isImageOnly =
    images.length > 0 && !hasText && !hasReply && videos.length === 0 && files.length === 0;
  const isVideoOnly =
    videos.length > 0 && !hasText && !hasReply && images.length === 0 && files.length === 0;
  const isFileOnly =
    files.length > 0 && !hasText && !hasReply && images.length === 0 && videos.length === 0;
  const needsBubble = !isImageOnly && !isVideoOnly && !isFileOnly;

  const groupedReactions = (message.reactions ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  const handleRevoke = async () => {
    setShowActions(false);
    try {
      await revokeMessage(message._id, conversationId);
    } catch {
      Alert.alert('Lỗi', 'Không thể thu hồi tin nhắn');
    }
  };

  const handleDelete = () => {
    setShowActions(false);
    Alert.alert('Xóa tin nhắn', 'Tin nhắn sẽ bị xóa khỏi thiết bị của bạn', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () =>
          deleteMessage(message._id, conversationId).catch(() =>
            Alert.alert('Lỗi', 'Không thể xóa')
          ),
      },
    ]);
  };

  if (isRevoked) {
    return (
      <View
        className={`flex-row ${isMine ? 'justify-end' : 'justify-start'} px-3 py-0.5 ${!showAvatar && !isMine ? 'pl-12' : ''}`}
      >
        {showAvatar && !isMine && (
          <View className="mr-2 mt-auto mb-1">
            <UserAvatar user={{ fullName: senderName, avatar: senderAvatar }} size={28} />
          </View>
        )}
        <View className="max-w-[280px]">
          {message.revokedBy === 'ai-moderation' ? (
            <View className="rounded-2xl px-3 py-2.5 border border-red-200 bg-red-50">
              <View className="flex-row items-start gap-1.5">
                <ShieldAlert size={14} color="#ef4444" style={{ marginTop: 1 }} />
                <View className="flex-1">
                  <Text className="text-red-600 text-[12px] font-semibold">
                    Vi phạm chính sách cộng đồng
                  </Text>
                  <Text className="text-red-400 text-[11px] mt-0.5">
                    Tin nhắn đã bị AI kiểm duyệt và xóa tự động do nội dung không phù hợp.
                  </Text>
                </View>
              </View>
              <Text className="text-red-300 text-[10px] text-right mt-1">{timeStr}</Text>
            </View>
          ) : (
            <View className="bg-gray-100 rounded-2xl px-3 py-2">
              <Text className="text-gray-400 text-[13px] italic">Tin nhắn đã được thu hồi</Text>
              <Text className="text-gray-300 text-[11px] text-right mt-0.5">{timeStr}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => setShowActions(true)}
        className={`flex-row ${isMine ? 'justify-end' : 'justify-start'} px-3 py-0.5 ${!showAvatar && !isMine ? 'pl-12' : ''}`}
        style={
          isHighlighted
            ? { backgroundColor: 'rgba(0, 104, 255, 0.08)', borderRadius: 12 }
            : undefined
        }
      >
        {showAvatar && !isMine && (
          <View className="mr-2 mt-auto mb-1">
            <UserAvatar user={{ fullName: senderName, avatar: senderAvatar }} size={28} />
          </View>
        )}
        <View className="max-w-[280px]">
          {message.forwardedFrom && (
            <View className="flex-row items-center mb-0.5">
              <CornerUpRight size={10} color="#9ca3af" />
              <Text className="text-gray-400 text-[11px] ml-1">Đã chuyển tiếp</Text>
            </View>
          )}
          {/* ── Pure image message: no bubble, timestamp overlaid ── */}
          {isImageOnly && (
            <View style={{ borderRadius: 12, overflow: 'hidden' }}>
              <ImageGrid images={images} onPress={setLightboxIdx} />
              <View style={{ position: 'absolute', bottom: 6, right: 8 }}>
                <View
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10 }}>{timeStr}</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Pure video message: no bubble, thumbnail + overlay ── */}
          {isVideoOnly &&
            videos.map((v) => {
              const poster = v.thumbnailUrl ?? undefined;
              return (
                <View key={v.url} style={{ borderRadius: 12, overflow: 'hidden' }}>
                  <TouchableOpacity onPress={() => Linking.openURL(v.url)} activeOpacity={0.85}>
                    <View style={{ width: 220, height: 150, backgroundColor: '#111827' }}>
                      {poster ? (
                        <Image
                          source={{ uri: poster }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      ) : null}
                      <View
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 20, paddingLeft: 4 }}>▶</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <View style={{ position: 'absolute', bottom: 6, right: 8 }}>
                    <View
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.45)',
                        borderRadius: 10,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10 }}>{timeStr}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

          {/* ── Pure file message: clean card(s), no bubble ── */}
          {isFileOnly && (
            <View>
              {files.map((f) => {
                const ext = f.filename.includes('.')
                  ? (f.filename.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'FILE')
                  : 'FILE';
                const sizeLabel = f.size
                  ? f.size >= 1024 * 1024
                    ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
                    : `${Math.round(f.size / 1024)} KB`
                  : '';
                return (
                  <TouchableOpacity
                    key={f.url}
                    onPress={() => Linking.openURL(f.url)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: isMine ? 'rgba(0,104,255,0.12)' : '#f9fafb',
                      borderWidth: 1,
                      borderColor: isMine ? 'rgba(0,104,255,0.2)' : '#e5e7eb',
                      borderRadius: 14,
                      padding: 10,
                      marginBottom: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        backgroundColor: isMine ? 'rgba(0,104,255,0.15)' : '#eff6ff',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#0068FF' }}>
                        {ext}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 13, fontWeight: '500', color: '#111827' }}
                        numberOfLines={1}
                      >
                        {f.filename}
                      </Text>
                      {sizeLabel ? (
                        <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                          {sizeLabel}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <Text
                style={{
                  fontSize: 10,
                  color: '#9ca3af',
                  textAlign: isMine ? 'right' : 'left',
                  marginTop: 2,
                }}
              >
                {timeStr}
              </Text>
            </View>
          )}

          {/* ── Text / mixed / reply message: bubble with background ── */}
          {needsBubble && (
            <View
              className={`rounded-2xl px-3 py-2 ${isMine ? 'bg-[#0068FF]' : 'bg-white shadow-sm'}`}
            >
              {/* Reply quoted band */}
              {message.replyTo && (
                <TouchableOpacity
                  onPress={() => onScrollToMessage(message.replyTo!.messageId)}
                  className={`mb-2 px-2 py-1.5 rounded-lg border-l-[3px] ${
                    isMine ? 'bg-white/20 border-white/60' : 'bg-gray-50 border-[#0068FF]/50'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-[11px] font-semibold ${
                      isMine ? 'text-white/80' : 'text-[#0068FF]'
                    }`}
                    numberOfLines={1}
                  >
                    {message.replyTo.senderId === message.senderId
                      ? 'Chính mình'
                      : (senderName ?? 'Người dùng')}
                  </Text>
                  <Text
                    className={`text-[12px] ${isMine ? 'text-white/60' : 'text-gray-500'}`}
                    numberOfLines={1}
                  >
                    {message.replyTo.content ||
                      `[${
                        message.replyTo.attachmentType === 'image'
                          ? 'Hình ảnh'
                          : message.replyTo.attachmentType === 'video'
                            ? 'Video'
                            : 'Tệp tin'
                      }]`}
                  </Text>
                </TouchableOpacity>
              )}
              {images.length > 0 && <ImageGrid images={images} onPress={setLightboxIdx} />}
              {/* Videos inside bubble */}
              {videos.map((v) => {
                const poster = v.thumbnailUrl ?? undefined;
                return (
                  <TouchableOpacity
                    key={v.url}
                    onPress={() => Linking.openURL(v.url)}
                    style={{ marginBottom: 4, borderRadius: 8, overflow: 'hidden' }}
                  >
                    <View style={{ width: 208, height: 140, backgroundColor: '#374151' }}>
                      {poster ? (
                        <Image
                          source={{ uri: poster }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      ) : null}
                    </View>
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 18, paddingLeft: 4 }}>▶</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {/* File cards inside bubble */}
              {files.map((f) => {
                const ext = f.filename.includes('.')
                  ? (f.filename.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'FILE')
                  : 'FILE';
                const sizeLabel = f.size
                  ? f.size >= 1024 * 1024
                    ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
                    : `${Math.round(f.size / 1024)} KB`
                  : '';
                return (
                  <TouchableOpacity
                    key={f.url}
                    onPress={() => Linking.openURL(f.url)}
                    className={`flex-row items-center gap-2 p-2.5 rounded-xl mb-1 ${
                      isMine ? 'bg-white/20' : 'bg-gray-50 border border-gray-100'
                    }`}
                  >
                    <View
                      className={`w-10 h-10 rounded-lg items-center justify-center ${isMine ? 'bg-white/20' : 'bg-[#0068FF]/10'}`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${isMine ? 'text-white' : 'text-[#0068FF]'}`}
                      >
                        {ext}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-[12px] font-medium ${isMine ? 'text-white' : 'text-gray-800'}`}
                        numberOfLines={1}
                      >
                        {f.filename}
                      </Text>
                      {sizeLabel ? (
                        <Text
                          className={`text-[11px] ${isMine ? 'text-white/60' : 'text-gray-400'}`}
                        >
                          {sizeLabel}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {message.content ? (
                <Text
                  className={`text-[14px] leading-5 ${isMine ? 'text-white' : 'text-gray-800'}`}
                >
                  {message.content}
                </Text>
              ) : null}
              <Text
                className={`text-[11px] text-right mt-0.5 ${isMine ? 'text-white/60' : 'text-gray-400'}`}
              >
                {timeStr}
              </Text>
            </View>
          )}

          {Object.keys(groupedReactions).length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-1">
              {Object.entries(groupedReactions).map(([emoji, count]) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => reactToMessage(message._id, conversationId, emoji, userId)}
                  className="flex-row items-center px-1.5 py-0.5 rounded-full bg-white shadow-sm border border-gray-100"
                >
                  <Text className="text-[12px]">{emoji}</Text>
                  {count > 1 && <Text className="text-gray-500 text-[11px] ml-0.5">{count}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Image lightbox */}
      {lightboxIdx !== null && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLightboxIdx(null)}>
          <View className="flex-1 bg-black items-center justify-center">
            <TouchableOpacity
              className="absolute top-12 right-4 z-10 w-10 h-10 bg-black/60 rounded-full items-center justify-center"
              onPress={() => setLightboxIdx(null)}
            >
              <Text className="text-white text-lg">✕</Text>
            </TouchableOpacity>
            <Image
              source={{ uri: images[lightboxIdx]?.url }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
              resizeMode="contain"
            />
            {images.length > 1 && (
              <View className="flex-row items-center gap-4 mt-4">
                <TouchableOpacity
                  onPress={() => setLightboxIdx((lightboxIdx - 1 + images.length) % images.length)}
                >
                  <Text className="text-white text-2xl px-4">←</Text>
                </TouchableOpacity>
                <Text className="text-white">
                  {lightboxIdx + 1} / {images.length}
                </Text>
                <TouchableOpacity onPress={() => setLightboxIdx((lightboxIdx + 1) % images.length)}>
                  <Text className="text-white text-2xl px-4">→</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* Action modal */}
      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActions(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/30 justify-end"
          activeOpacity={1}
          onPress={() => setShowActions(false)}
        >
          <View className="bg-white rounded-t-2xl px-4 py-3 pb-8">
            {/* Reactions row */}
            <View className="flex-row justify-center gap-3 mb-4 pt-2">
              {REACTION_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => {
                    reactToMessage(message._id, conversationId, emoji, userId);
                    setShowActions(false);
                  }}
                >
                  <Text className="text-[28px]">{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="h-px bg-gray-100 mb-2" />
            <TouchableOpacity
              className="flex-row items-center py-3"
              onPress={() => {
                setShowActions(false);
                onReply(message);
              }}
            >
              <Reply size={18} color="#0068FF" />
              <Text className="text-[15px] text-[#0068FF] ml-2">Trả lời</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center py-3"
              onPress={() => {
                setShowActions(false);
                onForward(message);
              }}
            >
              <CornerUpRight size={18} color="#10b981" />
              <Text className="text-[15px] text-emerald-600 ml-2">Chuyển tiếp</Text>
            </TouchableOpacity>
            {canEdit && onEdit && (
              <TouchableOpacity
                className="flex-row items-center py-3"
                onPress={() => {
                  setShowActions(false);
                  onEdit();
                }}
              >
                <Pencil size={18} color="#6366f1" />
                <Text className="text-[15px] text-indigo-500 ml-2">Chỉnh sửa</Text>
              </TouchableOpacity>
            )}
            {message.content ? (
              <TouchableOpacity
                className="flex-row items-center py-3"
                onPress={() => {
                  setShowActions(false);
                }}
              >
                <Text className="text-[15px] text-gray-700 ml-2">Sao chép (chưa hỗ trợ)</Text>
              </TouchableOpacity>
            ) : null}
            {message.content && !message.revokedAt && (
              <TouchableOpacity
                className="flex-row items-center py-3"
                onPress={() => {
                  setShowActions(false);
                  onTranslate?.(message.content!);
                }}
              >
                <Languages size={18} color="#8b5cf6" />
                <Text className="text-[15px] text-purple-500 ml-2">Dịch tin nhắn (AI)</Text>
              </TouchableOpacity>
            )}
            {isMine && canRevoke && (
              <TouchableOpacity className="flex-row items-center py-3" onPress={handleRevoke}>
                <RotateCcw size={18} color="#f97316" />
                <Text className="text-[15px] text-orange-500 ml-2">Thu hồi</Text>
              </TouchableOpacity>
            )}
            {canPin && (
              <TouchableOpacity
                className="flex-row items-center py-3"
                onPress={() => {
                  setShowActions(false);
                  onPin?.();
                }}
              >
                <Pin size={18} color="#f59e0b" />
                <Text className="text-[15px] text-amber-500 ml-2">
                  {isPinned ? 'Bỏ ghim' : 'Ghim tin nhắn'}
                </Text>
              </TouchableOpacity>
            )}
            {isMine ? (
              <TouchableOpacity className="flex-row items-center py-3" onPress={handleDelete}>
                <Trash2 size={18} color="#ef4444" />
                <Text className="text-[15px] text-red-500 ml-2">Xóa ở phía tôi</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity className="flex-row items-center py-3" onPress={handleDelete}>
                <Trash2 size={18} color="#ef4444" />
                <Text className="text-[15px] text-red-500 ml-2">Xóa</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ── Main Screen ──

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  // AI feature states
  const [showAiSearch, setShowAiSearch] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState<any[]>([]);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [summaryFromDate, setSummaryFromDate] = useState(() => {
    const d = new Date(Date.now() - 7 * 86400000);
    return d.toISOString().split('T')[0];
  });
  const [summaryToDate, setSummaryToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [summaryMeta, setSummaryMeta] = useState<{
    count: number;
    from: string;
    to: string;
  } | null>(null);
  const [showTranslate, setShowTranslate] = useState(false);
  const [translateContent, setTranslateContent] = useState('');
  const [translated, setTranslated] = useState<string | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateLang, setTranslateLang] = useState('en');
  const [showRewrite, setShowRewrite] = useState(false);
  const [rewriteContent, setRewriteContent] = useState('');
  const [rewriteResults, setRewriteResults] = useState<
    { style: string; label: string; text: string }[] | null
  >(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  // Chatbot RAG state
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatbotHistory, setChatbotHistory] = useState<{ role: 'user' | 'bot'; text: string }[]>(
    []
  );
  const [chatbotInput, setChatbotInput] = useState('');
  const [chatbotLoading, setChatbotLoading] = useState(false);
  const chatbotScrollRef = useRef<ScrollView>(null);
  const msgIndexMap = useRef<Map<string, number>>(new Map());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const { bottom: bottomInset, top: topInset } = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const friends = useFriendStore((s) => s.friends);
  const callStatus = useCallStore((s) => s.status);
  const startCall = useCallStore((s) => s.startCall);
  const {
    conversations,
    messages: allMessages,
    pinnedMessages: allPinnedMessages,
    hasMore: allHasMore,
    loadingMessages,
    sendingMessage,
    fetchMessages,
    sendMessage,
    forwardMessage,
    setActiveConversation,
    pinMessage: storePinMessage,
    unpinMessage: storeUnpinMessage,
    fetchPinnedMessages,
    editMessage: storeEditMessage,
  } = useChatStore();

  const conversationId = id ?? '';
  const conversation = conversations.find((c) => c._id === conversationId);
  const messages = allMessages[conversationId] ?? [];
  const pinnedMessages = allPinnedMessages[conversationId] ?? [];
  const hasMore = allHasMore[conversationId] ?? true;

  const myRole = conversation?.participants.find((p) => p.userId === user?.id)?.role;
  const isAdminOrOwner = myRole === 'owner' || myRole === 'admin';

  const initiateCall = useCallback(
    (callType: 'audio' | 'video') => {
      if (!conversation || !user || callStatus !== 'idle') return;
      const callId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const participantIds = conversation.participants
        .map((p: any) => p.userId)
        .filter((uid: string) => uid !== user.id);

      socketService.emit('call:initiate', {
        callId,
        conversationId,
        callType,
        participantIds,
        callerName: user.fullName ?? user.username ?? 'Bạn',
        callerAvatar: user.avatar,
      });

      startCall({
        callId,
        conversationId,
        callType,
        participantIds: [...participantIds, user.id],
        initiatorId: user.id,
      });

      router.push('/call');
    },
    [callStatus, conversation, conversationId, startCall, user, router]
  );

  // Multi-pin banner cycling
  const [pinnedBannerIdx, setPinnedBannerIdx] = useState(0);
  useEffect(() => {
    setPinnedBannerIdx(0);
  }, [conversationId, pinnedMessages.length]);
  const currentPinned = pinnedMessages[pinnedBannerIdx] ?? null;

  // Zalo-style pin action notification (bottom of message area)
  const [pinNotif, setPinNotif] = useState<{
    messageId: string;
    preview: string;
    action: 'pin' | 'unpin';
  } | null>(null);
  const pinNotifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showPinBanner = (messageId: string, preview: string, action: 'pin' | 'unpin') => {
    if (pinNotifTimer.current) clearTimeout(pinNotifTimer.current);
    setPinNotif({ messageId, preview, action });
    pinNotifTimer.current = setTimeout(() => setPinNotif(null), 4000);
  };

  // Restricted input when onlyAdminCanSend
  const isOnlyAdminCanSend = !!conversation?.settings?.onlyAdminCanSend;
  const isOnlyAdminCanPin = !!conversation?.settings?.onlyAdminCanPin;
  const isInputRestricted = isOnlyAdminCanSend && !isAdminOrOwner;
  const isBannedMember = !!conversation?.participants.find((p) => p.userId === user?.id)?.isBanned;

  const otherUser = useMemo(() => {
    if (!conversation || conversation.type !== 'direct') return null;
    const otherP = conversation.participants.find((p) => p.userId !== user?.id);
    return friends.find((f) => f.user.id === otherP?.userId)?.user ?? null;
  }, [conversation, user, friends]);

  const displayName =
    conversation?.type === 'direct'
      ? otherUser?.fullName || 'Người dùng'
      : conversation?.name || 'Nhóm chat';
  const avatarUser = conversation?.type === 'direct' ? otherUser : null;
  // For group chats, use the conversation avatar directly
  const headerAvatar = conversation?.type === 'group' ? conversation?.avatar : avatarUser?.avatar;

  // Load messages
  useEffect(() => {
    if (conversationId) fetchMessages(conversationId);
  }, [conversationId]);

  // Load pinned messages
  useEffect(() => {
    if (conversationId) fetchPinnedMessages(conversationId);
  }, [conversationId]);

  // Mark conversation as active (clears unread count) on enter; clear on leave
  useEffect(() => {
    if (conversationId) {
      setActiveConversation(conversationId);
      chatServices.markAsRead(conversationId).catch(() => {});
    }
    return () => setActiveConversation(null);
  }, [conversationId]);

  // Visible messages (filter deleted)
  // Store is DESC (newest first); inverted FlatList handles visual flip so data[0] appears at bottom.
  // Do NOT reverse here — that would cause double-flip (newest at top).
  const visibleMessages = useMemo(() => {
    return messages.filter((m) => !(m.deletedFor ?? []).includes(user?.id ?? ''));
  }, [messages, user]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && pendingAttachments.length === 0) return;

    // Handle edit mode
    if (editingMessage) {
      const currentEdit = editingMessage;
      setText('');
      setEditingMessage(null);
      try {
        await storeEditMessage(currentEdit._id, conversationId, trimmed);
      } catch (e: any) {
        console.error('[handleSend:edit] error:', e?.response?.data ?? e?.message ?? e);
        Alert.alert(
          'Lỗi',
          e?.response?.data?.message ?? e?.message ?? 'Không thể chỉnh sửa tin nhắn'
        );
      }
      return;
    }

    const attachmentsToSend = [...pendingAttachments];
    setText('');
    setPendingAttachments([]);
    const currentReply = replyingTo;
    setReplyingTo(null);

    setUploading(true);
    try {
      // 1. Upload all attachments first
      const uploadedAll: any[] = [];
      for (const att of attachmentsToSend) {
        const uploaded = await uploadFile(att.uri, att.filename, att.mimeType, att.size);
        uploadedAll.push(uploaded);
      }

      // 2. Send ONE message with all attachments + text/reply together
      await sendMessage(
        conversationId,
        trimmed || undefined,
        uploadedAll.length > 0 ? uploadedAll : undefined,
        currentReply
          ? {
              messageId: currentReply._id,
              senderId: currentReply.senderId,
              content: currentReply.content?.slice(0, 100) ?? '',
              attachmentType: currentReply.attachments?.[0]?.type,
            }
          : null
      );
    } catch (e: any) {
      console.error('[handleSend] error:', e?.response?.data ?? e?.message ?? e);
      const msg = e?.response?.data?.message ?? e?.message ?? 'Không thể gửi tin nhắn';
      Alert.alert('Lỗi', msg);
    } finally {
      setUploading(false);
    }
  };

  const handlePickAttachment = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Cần quyền truy cập thư viện ảnh để gửi tệp đính kèm.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as ImagePicker.MediaType,
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: 5,
        exif: false,
      });
      if (result.canceled) return;

      const newAtts: PendingAttachment[] = result.assets
        .map((asset) => {
          const filename = asset.fileName || `photo_${Date.now()}.jpg`;
          const mimeType = asset.mimeType || 'image/jpeg';
          const size = asset.fileSize || 0;
          const limit = FILE_SIZE_LIMITS[getCategory(mimeType)];
          if (size && size > limit) {
            Alert.alert(
              'Ảnh quá lớn',
              `${filename} vượt giới hạn ${Math.round(limit / (1024 * 1024))} MB`
            );
            return null;
          }
          return { uri: asset.uri, filename, mimeType, size, type: 'image' as const };
        })
        .filter(Boolean) as PendingAttachment[];

      setPendingAttachments((prev) => [...prev, ...newAtts].slice(0, 5));
    } catch (err: any) {
      // PHPhotosErrorDomain errors (e.g. iCloud photo not downloaded) — show friendly message
      if (err?.message?.includes('PHPhotos') || err?.code === 3164) {
        Alert.alert(
          'Không thể chọn ảnh',
          'Ảnh này chưa được tải về thiết bị. Vui lòng tải về từ iCloud trước.'
        );
      } else {
        Alert.alert('Lỗi', 'Không thể chọn ảnh. Vui lòng thử lại.');
      }
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;

      const newAtts: PendingAttachment[] = result.assets
        .map((asset) => {
          const mimeType = asset.mimeType || 'application/octet-stream';
          const size = asset.size || 0;
          const category = getCategory(mimeType);
          const limit = FILE_SIZE_LIMITS[category];
          if (size && size > limit) {
            Alert.alert(
              'Tệp quá lớn',
              `${asset.name} vượt giới hạn ${Math.round(limit / (1024 * 1024))} MB`
            );
            return null;
          }
          return { uri: asset.uri, filename: asset.name, mimeType, size, type: category };
        })
        .filter(Boolean) as PendingAttachment[];

      setPendingAttachments((prev) => [...prev, ...newAtts].slice(0, 5));
    } catch {
      Alert.alert('Lỗi', 'Không thể chọn tệp. Vui lòng thử lại.');
    }
  };

  const handlePickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Cần quyền truy cập thư viện để gửi video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'videos' as ImagePicker.MediaType,
        selectionLimit: 1,
        videoMaxDuration: 120,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const newAtts: PendingAttachment[] = result.assets
        .map((asset) => {
          const filename = asset.fileName || `video_${Date.now()}.mp4`;
          const mimeType = asset.mimeType || 'video/mp4';
          const size = asset.fileSize || 0;
          const limit = FILE_SIZE_LIMITS['video'];
          if (size && size > limit) {
            Alert.alert(
              'Video quá lớn',
              `${filename} vượt giới hạn ${Math.round(limit / (1024 * 1024))} MB`
            );
            return null;
          }
          return { uri: asset.uri, filename, mimeType, size, type: 'video' as const };
        })
        .filter(Boolean) as PendingAttachment[];

      setPendingAttachments((prev) => [...prev, ...newAtts].slice(0, 5));
    } catch (err: any) {
      console.error('[handlePickVideo]', err?.message ?? err);
      Alert.alert('Lỗi', err?.message ?? 'Không thể chọn video. Vui lòng thử lại.');
    }
  };

  // ── AI handlers ──────────────────────────────────────────────────────────
  const handleAiSearch = async () => {
    const q = aiSearchQuery.trim();
    if (!q) return;
    setAiSearchLoading(true);
    setAiSearchResults([]);
    try {
      const res = await aiServices.search(q, conversationId, 10);
      setAiSearchResults(res.results);
    } catch {
      Alert.alert('Lỗi', 'Tìm kiếm thất bại. Vui lòng thử lại.');
    } finally {
      setAiSearchLoading(false);
    }
  };

  const handleAiSummary = async () => {
    if (new Date(summaryFromDate) > new Date(summaryToDate)) {
      Alert.alert('Thông báo', 'Ngày bắt đầu phải trước ngày kết thúc.');
      return;
    }
    const from = new Date(summaryFromDate).getTime();
    const to = new Date(summaryToDate).getTime() + 86400000;
    // Build name lookup from conversation participants
    const nameMap: Record<string, string> = {};
    conversation?.participants?.forEach((p: any) => {
      if (p.userId && p.fullName) nameMap[p.userId] = p.fullName;
    });
    friends.forEach((f) => {
      if (f.user.id && f.user.fullName) nameMap[f.user.id] = f.user.fullName;
    });

    const textMessages = messages
      .filter((m) => {
        if (m.type !== 'text' || !m.content || m.revokedAt) return false;
        const t = new Date(m.createdAt).getTime();
        return t >= from && t <= to;
      })
      .map((m) => ({
        senderId: m.senderId,
        senderName: nameMap[m.senderId],
        content: m.content,
        timestamp: m.createdAt,
      }));

    if (textMessages.length < 3) {
      Alert.alert(
        'Thông báo',
        `Cần ít nhất 3 tin nhắn văn bản trong khoảng thời gian đã chọn (hiện có ${textMessages.length}).`
      );
      return;
    }
    setAiSummaryLoading(true);
    setAiSummary(null);
    setSummaryMeta(null);
    try {
      const res = await aiServices.summarize(
        conversationId,
        textMessages,
        summaryFromDate,
        summaryToDate
      );
      setAiSummary(res.summary);
      setSummaryMeta({ count: textMessages.length, from: summaryFromDate, to: summaryToDate });
    } catch {
      Alert.alert('Lỗi', 'Không thể tóm tắt. Vui lòng thử lại.');
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleTranslate = async () => {
    setTranslateLoading(true);
    setTranslated(null);
    try {
      const res = await aiServices.translate(translateContent, translateLang);
      setTranslated(res.translated);
    } catch {
      Alert.alert('Lỗi', 'Dịch thất bại. Vui lòng thử lại.');
    } finally {
      setTranslateLoading(false);
    }
  };

  const handleRewrite = async () => {
    setRewriteLoading(true);
    setRewriteResults(null);
    try {
      const res = await aiServices.rewrite(rewriteContent);
      setRewriteResults(res.rewrites);
    } catch {
      Alert.alert('Lỗi', 'Viết lại thất bại. Vui lòng thử lại.');
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleAskBot = async () => {
    const q = chatbotInput.trim();
    if (!q || chatbotLoading) return;
    setChatbotInput('');
    setChatbotHistory((prev) => [...prev, { role: 'user', text: q }]);
    setChatbotLoading(true);
    try {
      const res = await aiServices.ask(q, conversationId);
      setChatbotHistory((prev) => [...prev, { role: 'bot', text: res.answer }]);
    } catch {
      setChatbotHistory((prev) => [
        ...prev,
        { role: 'bot', text: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.' },
      ]);
    } finally {
      setChatbotLoading(false);
      setTimeout(() => chatbotScrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  // Pending jump-to-message when target isn't rendered yet
  const pendingJumpRef = useRef<{ messageId: string; attempts: number } | null>(null);

  const jumpToMessage = useCallback(
    (messageId: string) => {
      const idx = msgIndexMap.current.get(messageId);
      if (idx !== undefined && flatListRef.current) {
        flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
        setHighlightedId(messageId);
        setTimeout(() => setHighlightedId(null), 2000);
        pendingJumpRef.current = null;
        return;
      }
      // Message not yet rendered — need to load older pages
      if (!hasMore || messages.length === 0) {
        Alert.alert('Thông báo', 'Tin nhắn không tồn tại hoặc đã bị xóa.');
        return;
      }
      // Queue the jump and dispatch the FIRST fetch immediately
      const oldestMsg = messages[messages.length - 1];
      pendingJumpRef.current = { messageId, attempts: 1 };
      fetchMessages(conversationId, oldestMsg.createdAt);
    },
    [conversationId, hasMore, messages, fetchMessages]
  );

  const handleScrollToMessage = useCallback(
    (messageId: string) => {
      jumpToMessage(messageId);
    },
    [jumpToMessage]
  );

  // Effect: after each new batch of messages loads (messages.length changes), retry pending jump.
  // The FIRST fetch is triggered inside jumpToMessage itself; this handles retries 2..5.
  useEffect(() => {
    const pending = pendingJumpRef.current;
    if (!pending) return;

    // Wait a tick for FlatList to finish rendering new items before checking
    const timer = setTimeout(() => {
      const idx = msgIndexMap.current.get(pending.messageId);
      if (idx !== undefined && flatListRef.current) {
        flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
        setHighlightedId(pending.messageId);
        setTimeout(() => setHighlightedId(null), 2000);
        pendingJumpRef.current = null;
        return;
      }

      if (pending.attempts >= 5 || !hasMore || messages.length === 0) {
        Alert.alert('Thông báo', 'Tin nhắn đã quá cũ hoặc không thể tải được.');
        pendingJumpRef.current = null;
        return;
      }

      // Target still not rendered — fetch next older page
      const oldestMsg = messages[messages.length - 1];
      pendingJumpRef.current = { ...pending, attempts: pending.attempts + 1 };
      fetchMessages(conversationId, oldestMsg.createdAt);
    }, 400);

    return () => clearTimeout(timer);
  }, [messages.length, conversationId, hasMore, fetchMessages]);

  const handleLoadMore = useCallback(() => {
    if (loadingMessages || !hasMore || messages.length === 0) return;
    // DESC storage: messages[last] is the oldest — use its createdAt as pagination cursor
    const oldestMsg = messages[messages.length - 1];
    fetchMessages(conversationId, oldestMsg.createdAt);
  }, [conversationId, hasMore, loadingMessages, messages]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    // System messages (call events, group events)
    // Note: call messages sent via chatServices.sendMessage() have type='system' but
    // senderId = actual user ID (not 'system'), so we must check both fields.
    if (item.senderId === 'system' || item.type === 'system') {
      const content = item.content ?? '';

      // ── Call system messages ─────────────────────────────────────────
      const isVoiceCall = content.startsWith('[VOICE]') || content.startsWith('📞');
      const isVideoCall = content.startsWith('[VIDEO]') || content.startsWith('📹');

      if (isVoiceCall || isVideoCall) {
        const rest =
          content.startsWith('[VOICE]') || content.startsWith('[VIDEO]')
            ? content.slice(7).trim()
            : content.slice(2).trim();

        // "nhỡ" = missed/timeout, "từ chối" = rejected, "bị hủy" = cancelled by caller
        const isMissed =
          rest.includes('bị hủy') || rest.includes('nhỡ') || rest.includes('từ chối');
        const dashIdx = rest.lastIndexOf(' - ');
        const callLabel = dashIdx !== -1 ? rest.slice(0, dashIdx) : rest;
        const duration = dashIdx !== -1 ? rest.slice(dashIdx + 3) : null;

        const iconBgColor = isMissed ? '#f3f4f6' : isVideoCall ? '#eff6ff' : '#f0fdf4';
        const iconColor = isMissed ? '#9ca3af' : isVideoCall ? '#3b82f6' : '#22c55e';
        const CallIcon = isVideoCall
          ? isMissed
            ? VideoOff
            : Video
          : isMissed
            ? PhoneMissed
            : Phone;

        return (
          <View className="items-center my-3 px-6">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 12,
                maxWidth: 280,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: iconBgColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CallIcon size={20} color={iconColor} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: '#1f2937',
                    lineHeight: 18,
                  }}
                  numberOfLines={1}
                >
                  {callLabel}
                </Text>
                <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  {isMissed ? 'Không thành công' : (duration ?? 'Đã kết thúc')}
                </Text>
              </View>
            </View>
          </View>
        );
      }

      // ── Generic system pill ─────────────────────────────────────────
      return (
        <View className="items-center py-1.5 px-6">
          <Text className="text-[12px] text-gray-400 text-center bg-gray-50 rounded-full px-3 py-1">
            {content}
          </Text>
        </View>
      );
    }

    const isMine = item.senderId === user?.id;
    // Since list is inverted, index 0 = newest. Previous message is index+1
    const prevMsg = visibleMessages[index + 1];
    const showAvatar = !isMine && (!prevMsg || prevMsg.senderId !== item.senderId);
    const sender = !isMine ? friends.find((f) => f.user.id === item.senderId)?.user : null;
    // Show sender name in group chats when avatar is shown
    const showSenderName = conversation?.type === 'group' && !isMine && showAvatar;
    msgIndexMap.current.set(item._id, index);

    return (
      <View>
        {showSenderName && sender && (
          <Text className="text-[11px] text-gray-400 ml-12 mb-0.5 px-3">{sender.fullName}</Text>
        )}
        <MessageBubble
          message={item}
          isMine={isMine}
          showAvatar={showAvatar}
          senderName={sender?.fullName}
          senderAvatar={sender?.avatar}
          conversationId={conversationId}
          userId={user?.id ?? ''}
          onReply={setReplyingTo}
          onEdit={() => {
            setEditingMessage(item);
            setText(item.content ?? '');
          }}
          onForward={setForwardingMessage}
          onScrollToMessage={handleScrollToMessage}
          isAdminOrOwner={isAdminOrOwner}
          conversationType={conversation?.type}
          isPinned={pinnedMessages.some((p) => p._id === item._id)}
          onlyAdminCanPin={isOnlyAdminCanPin}
          isHighlighted={highlightedId === item._id}
          onPin={async () => {
            const isAlreadyPinned = pinnedMessages.some((p) => p._id === item._id);
            try {
              if (isAlreadyPinned) {
                await storeUnpinMessage(item._id, conversationId);
                showPinBanner(item._id, item.content || '[Tệp đính kèm]', 'unpin');
              } else {
                await storePinMessage(item._id, conversationId);
                showPinBanner(item._id, item.content || '[Tệp đính kèm]', 'pin');
              }
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message ?? 'Thao tác thất bại');
            }
          }}
          onTranslate={(content) => {
            setTranslateContent(content);
            setTranslated(null);
            setTranslateLang('en');
            setShowTranslate(true);
          }}
          onRewrite={(content) => {
            setRewriteContent(content);
            setRewriteResults(null);
            setShowRewrite(true);
          }}
        />
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-3 py-2 border-b border-gray-100 bg-white">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center"
        >
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <View className="ml-2">
          <UserAvatar user={{ fullName: displayName, avatar: headerAvatar }} size={36} />
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-[15px] font-semibold text-gray-800" numberOfLines={1}>
            {displayName}
          </Text>
          {conversation?.type === 'group' ? (
            <Text className="text-[12px] text-gray-400">
              {conversation.participants.length} thành viên
            </Text>
          ) : (
            <Text className="text-[12px] text-green-500">Đang hoạt động</Text>
          )}
        </View>
        {conversation?.type === 'group' && (
          <TouchableOpacity
            onPress={() => router.push(`/group-info/${conversationId}`)}
            className="w-9 h-9 items-center justify-center"
          >
            <Info size={20} color="#6b7280" />
          </TouchableOpacity>
        )}
        {/* Call buttons */}
        {callStatus === 'idle' && (
          <>
            <TouchableOpacity
              onPress={() => initiateCall('audio')}
              className="w-9 h-9 items-center justify-center"
            >
              <Phone size={20} color="#6b7280" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => initiateCall('video')}
              className="w-9 h-9 items-center justify-center"
            >
              <Video size={20} color="#6b7280" />
            </TouchableOpacity>
          </>
        )}
        {/* AI buttons */}
        <TouchableOpacity
          onPress={() => {
            setShowAiSearch(true);
            setAiSearchQuery('');
            setAiSearchResults([]);
          }}
          className="w-9 h-9 items-center justify-center"
        >
          <Search size={20} color="#6b7280" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setShowAiSummary(true);
            setAiSummary(null);
          }}
          className="w-9 h-9 items-center justify-center"
        >
          <AlignLeft size={20} color="#6b7280" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowChatbot(true)}
          className="w-9 h-9 items-center justify-center"
        >
          <Bot size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Pinned message banner */}
      {currentPinned && (
        <View className="flex-row items-center px-4 py-2 bg-amber-50 border-b border-amber-100">
          <Pin size={13} color="#f59e0b" />
          <TouchableOpacity
            className="flex-1 min-w-0 ml-2"
            onPress={() => handleScrollToMessage(currentPinned._id)}
            activeOpacity={0.7}
          >
            <Text className="text-[10px] font-semibold text-amber-600">
              Tin nhắn được ghim
              {pinnedMessages.length > 1
                ? ` (${pinnedBannerIdx + 1}/${pinnedMessages.length})`
                : ''}
            </Text>
            <Text className="text-[12px] text-gray-600" numberOfLines={1}>
              {currentPinned.content || '[Tệp đính kèm]'}
            </Text>
          </TouchableOpacity>
          {pinnedMessages.length > 1 && (
            <TouchableOpacity
              onPress={() => setPinnedBannerIdx((i) => (i + 1) % pinnedMessages.length)}
              className="w-7 h-7 items-center justify-center rounded-full"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronDown size={16} color="#f59e0b" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Messages */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={visibleMessages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={{ paddingVertical: 8 }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMessages ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#0068FF" />
              </View>
            ) : null
          }
        />

        {/* Input */}
        <View className="border-t border-gray-100 bg-white" style={{ paddingBottom: bottomInset }}>
          {/* Pin action notification (Zalo-style) */}
          {pinNotif && (
            <View className="flex-row items-center gap-2 px-4 py-2.5 bg-[#1e1e2e]">
              <Pin size={13} color="#fbbf24" />
              <Text className="flex-1 text-[13px] text-white" numberOfLines={1}>
                {pinNotif.action === 'pin' ? 'Bạn đã ghim' : 'Bạn đã bỏ ghim'} 1 tin nhắn{' '}
                <Text className="text-gray-400">{pinNotif.preview}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => {
                  handleScrollToMessage(pinNotif.messageId);
                  setPinNotif(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text className="text-[13px] text-[#4DA3FF] font-medium">Xem</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Restricted input */}
          {isBannedMember ? (
            <View className="flex-row items-center gap-2 px-4 py-3.5 bg-red-50 border-t border-red-200">
              <Ban size={16} color="#ef4444" />
              <Text className="flex-1 text-[13px] text-red-600">
                Bạn đang bị cấm gửi tin nhắn trong nhóm này.
              </Text>
            </View>
          ) : isInputRestricted ? (
            <View className="flex-row items-center gap-2 px-4 py-3.5 bg-gray-800">
              <Info size={16} color="#d1d5db" />
              <Text className="flex-1 text-[13px] text-gray-300">
                Chỉ trưởng/phó cộng đồng được gửi tin nhắn vào cộng đồng.
              </Text>
            </View>
          ) : (
            <>
              {/* Reply preview */}
              {replyingTo && (
                <View className="flex-row items-center gap-2 mx-3 mt-2 px-3 py-2 bg-gray-50 rounded-xl border-l-4 border-[#0068FF]">
                  <Reply size={14} color="#0068FF" />
                  <View className="flex-1">
                    <Text className="text-[11px] font-semibold text-[#0068FF]">Đang trả lời</Text>
                    <Text className="text-[12px] text-gray-500" numberOfLines={1}>
                      {replyingTo.content || '[Hình ảnh/Video/Tệp tin]'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setReplyingTo(null)} className="p-1">
                    <X size={14} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              )}
              {/* Edit preview */}
              {editingMessage && (
                <View className="flex-row items-center gap-2 mx-3 mt-2 px-3 py-2 bg-yellow-50 rounded-xl border-l-4 border-yellow-400">
                  <Pencil size={14} color="#ca8a04" />
                  <View className="flex-1">
                    <Text className="text-[11px] font-semibold text-yellow-700">
                      Đang chỉnh sửa
                    </Text>
                    <Text className="text-[12px] text-gray-500" numberOfLines={1}>
                      {editingMessage.content || '[Tệp đính kèm]'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingMessage(null);
                      setText('');
                    }}
                    className="p-1"
                  >
                    <X size={14} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              )}
              <View className="flex-row items-end px-3 py-2">
                {/* Image picker */}
                <TouchableOpacity
                  onPress={handlePickAttachment}
                  className="w-9 h-9 items-center justify-center mr-0.5"
                >
                  <ImageIcon size={19} color="#6b7280" />
                </TouchableOpacity>
                {/* Video picker */}
                <TouchableOpacity
                  onPress={handlePickVideo}
                  className="w-9 h-9 items-center justify-center mr-0.5"
                >
                  <VideoIcon size={19} color="#6b7280" />
                </TouchableOpacity>
                {/* Document picker */}
                <TouchableOpacity
                  onPress={handlePickDocument}
                  className="w-9 h-9 items-center justify-center mr-1"
                >
                  <FileText size={19} color="#6b7280" />
                </TouchableOpacity>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Nhập tin nhắn..."
                  multiline
                  maxLength={2000}
                  className="flex-1 bg-gray-50 rounded-2xl px-4 py-2.5 text-[14px] max-h-[100px] border border-gray-100"
                  placeholderTextColor="#9ca3af"
                />
                {text.trim().length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setRewriteContent(text);
                      setRewriteResults(null);
                      setShowRewrite(true);
                    }}
                    className="ml-1 w-9 h-9 items-center justify-center rounded-lg"
                  >
                    <Wand2 size={19} color="#7c3aed" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={
                    uploading || sendingMessage || (!text.trim() && pendingAttachments.length === 0)
                  }
                  className={`ml-2 w-10 h-10 rounded-full items-center justify-center ${
                    text.trim() || pendingAttachments.length > 0 ? 'bg-[#0068FF]' : 'bg-gray-200'
                  }`}
                >
                  {uploading || sendingMessage ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Send
                      size={18}
                      color={text.trim() || pendingAttachments.length > 0 ? '#fff' : '#9ca3af'}
                    />
                  )}
                </TouchableOpacity>
              </View>
              {/* Attachment preview strip */}
              {pendingAttachments.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 8, gap: 8 }}
                >
                  {pendingAttachments.map((att, i) => (
                    <View key={att.uri || String(i)} style={{ width: 72, height: 72 }}>
                      {att.type === 'image' ? (
                        <Image
                          source={{ uri: att.uri }}
                          style={{ width: 72, height: 72, borderRadius: 8 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 72,
                            height: 72,
                            borderRadius: 8,
                            backgroundColor: '#1f2937',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 4,
                          }}
                        >
                          <Text style={{ color: '#9ca3af', fontSize: 18 }}>
                            {att.type === 'video' ? '🎬' : '📄'}
                          </Text>
                          <Text
                            style={{
                              color: '#9ca3af',
                              fontSize: 9,
                              marginTop: 2,
                              textAlign: 'center',
                            }}
                            numberOfLines={2}
                          >
                            {att.filename}
                          </Text>
                        </View>
                      )}
                      {/* Remove button */}
                      <TouchableOpacity
                        onPress={() =>
                          setPendingAttachments((prev) => prev.filter((_, j) => j !== i))
                        }
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: '#ef4444',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Forward Modal */}
      <Modal
        visible={!!forwardingMessage}
        transparent
        animationType="slide"
        onRequestClose={() => setForwardingMessage(null)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-2xl" style={{ maxHeight: '70%' }}>
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
              <Text className="text-[16px] font-semibold text-gray-900">Chuyển tiếp đến</Text>
              <TouchableOpacity onPress={() => setForwardingMessage(null)} className="p-1">
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={conversations.filter((c) => c._id !== conversationId)}
              keyExtractor={(c) => c._id}
              contentContainerStyle={{ paddingBottom: 32 }}
              renderItem={({ item }) => {
                const isGroup = item.type === 'group';
                const otherP = !isGroup
                  ? item.participants.find((p) => p.userId !== user?.id)
                  : null;
                const friend = otherP ? friends.find((f) => f.user.id === otherP.userId) : null;
                const name = isGroup
                  ? item.name || 'Nhóm chat'
                  : friend?.user.fullName || 'Người dùng';
                const avatar = isGroup ? item.avatar : friend?.user.avatar;
                return (
                  <TouchableOpacity
                    className="flex-row items-center px-4 py-3"
                    onPress={async () => {
                      if (!forwardingMessage) return;
                      const msgId = forwardingMessage._id;
                      setForwardingMessage(null);
                      try {
                        await forwardMessage(msgId, item._id);
                        Alert.alert('Đã chuyển tiếp', `Tin nhắn đã được chuyển đến ${name}`);
                      } catch {
                        Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn');
                      }
                    }}
                  >
                    <UserAvatar user={{ fullName: name, avatar }} size={40} />
                    <Text className="ml-3 text-[15px] text-gray-800" numberOfLines={1}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── AI Search Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showAiSearch}
        animationType="slide"
        onRequestClose={() => setShowAiSearch(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'white',
            paddingTop: topInset,
            paddingBottom: bottomInset,
          }}
        >
          <View className="flex-row items-center px-4 py-3.5 border-b border-gray-100 bg-white">
            <TouchableOpacity
              onPress={() => setShowAiSearch(false)}
              className="w-9 h-9 items-center justify-center rounded-full bg-gray-100 mr-3"
            >
              <X size={18} color="#374151" />
            </TouchableOpacity>
            <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2.5">
              <Search size={15} color="#0068FF" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-gray-800">Tìm kiếm thông minh</Text>
              <Text className="text-[11px] text-blue-500">Powered by AI</Text>
            </View>
          </View>
          <View className="flex-row items-center px-4 py-3 border-b border-gray-100 gap-2">
            <TextInput
              className="flex-1 bg-gray-100 rounded-xl px-4 py-2 text-sm text-gray-800"
              placeholder="Tìm kiếm tin nhắn..."
              value={aiSearchQuery}
              onChangeText={setAiSearchQuery}
              onSubmitEditing={handleAiSearch}
              returnKeyType="search"
            />
            <TouchableOpacity
              onPress={handleAiSearch}
              className="bg-blue-500 px-4 py-2 rounded-xl"
              disabled={aiSearchLoading}
            >
              {aiSearchLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white text-sm font-medium">Tìm</Text>
              )}
            </TouchableOpacity>
          </View>
          <FlatList
            data={aiSearchResults}
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              !aiSearchLoading ? (
                <Text className="text-gray-400 text-sm text-center mt-8">
                  {aiSearchQuery ? 'Không tìm thấy kết quả.' : 'Nhập từ khóa để tìm kiếm.'}
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setShowAiSearch(false);
                  setTimeout(() => jumpToMessage(item.messageId), 300);
                }}
                activeOpacity={0.7}
                className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100 active:bg-blue-50"
              >
                <Text className="text-gray-800 text-sm mb-1" numberOfLines={3}>
                  {item.content}
                </Text>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-xs text-gray-400">
                    {item.timestamp ? new Date(item.timestamp).toLocaleString('vi-VN') : ''}
                  </Text>
                  <Text className="text-xs font-medium text-blue-500">
                    {Math.round((item.score ?? 0) * 100)}% phù hợp
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* ── AI Summary Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showAiSummary}
        animationType="slide"
        onRequestClose={() => {
          setShowAiSummary(false);
          setAiSummary(null);
          setSummaryMeta(null);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'white',
            paddingTop: topInset,
            paddingBottom: bottomInset,
          }}
        >
          <View className="flex-row items-center px-4 py-3.5 border-b border-gray-100 bg-white">
            <TouchableOpacity
              onPress={() => {
                setShowAiSummary(false);
                setAiSummary(null);
                setSummaryMeta(null);
              }}
              className="w-9 h-9 items-center justify-center rounded-full bg-gray-100 mr-3"
            >
              <X size={18} color="#374151" />
            </TouchableOpacity>
            <View className="w-8 h-8 rounded-full bg-amber-100 items-center justify-center mr-2.5">
              <AlignLeft size={15} color="#d97706" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-gray-800">
                Tóm tắt cuộc trò chuyện
              </Text>
              <Text className="text-[11px] text-amber-500">Powered by AI</Text>
            </View>
          </View>

          {/* Date range pickers */}
          <View className="px-4 py-3 border-b border-gray-100">
            <Text className="text-xs text-gray-500 font-medium mb-2">Khoảng thời gian</Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="text-[11px] text-gray-400 mb-1">Từ ngày</Text>
                <TextInput
                  value={summaryFromDate}
                  onChangeText={(v) => {
                    setSummaryFromDate(v);
                    setAiSummary(null);
                    setSummaryMeta(null);
                  }}
                  placeholder="YYYY-MM-DD"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[11px] text-gray-400 mb-1">Đến ngày</Text>
                <TextInput
                  value={summaryToDate}
                  onChangeText={(v) => {
                    setSummaryToDate(v);
                    setAiSummary(null);
                    setSummaryMeta(null);
                  }}
                  placeholder="YYYY-MM-DD"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
            <Text className="text-[11px] text-gray-400 mt-1.5">
              Định dạng: YYYY-MM-DD (ví dụ: 2025-01-15)
            </Text>
          </View>

          <View className="flex-1 px-4 py-4">
            {aiSummaryLoading ? (
              <View className="flex-1 items-center justify-center gap-3">
                <ActivityIndicator size="large" color="#0068FF" />
                <Text className="text-gray-500 text-sm">Đang phân tích tin nhắn...</Text>
              </View>
            ) : aiSummary ? (
              <ScrollView className="flex-1">
                {summaryMeta && (
                  <View className="flex-row gap-2 mb-3">
                    <View className="bg-gray-100 rounded-lg px-2.5 py-1">
                      <Text className="text-[11px] text-gray-500">
                        {new Date(summaryMeta.from).toLocaleDateString('vi-VN')} →{' '}
                        {new Date(summaryMeta.to).toLocaleDateString('vi-VN')}
                      </Text>
                    </View>
                    <View className="bg-gray-100 rounded-lg px-2.5 py-1">
                      <Text className="text-[11px] text-gray-500">
                        {summaryMeta.count} tin nhắn
                      </Text>
                    </View>
                  </View>
                )}
                <View className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <Text className="text-gray-800 text-sm leading-6">{aiSummary}</Text>
                </View>
              </ScrollView>
            ) : (
              <View className="flex-1 items-center justify-center">
                <AlignLeft size={48} color="#d1d5db" />
                <Text className="text-gray-400 text-sm mt-3 text-center px-8">
                  Nhấn "Tóm tắt" để AI phân tích nội dung cuộc trò chuyện trong khoảng thời gian đã
                  chọn.
                </Text>
              </View>
            )}
          </View>
          <View className="px-4 pb-4">
            <TouchableOpacity
              onPress={handleAiSummary}
              className="bg-blue-500 rounded-xl py-3 items-center"
              disabled={aiSummaryLoading}
            >
              {aiSummaryLoading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="text-white font-medium ml-2">Đang tóm tắt...</Text>
                </View>
              ) : (
                <Text className="text-white font-medium">
                  {aiSummary ? 'Tóm tắt lại' : 'Tóm tắt'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Translate Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showTranslate}
        animationType="slide"
        onRequestClose={() => setShowTranslate(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'white',
            paddingTop: topInset,
            paddingBottom: bottomInset,
          }}
        >
          <View className="flex-row items-center px-4 py-3.5 border-b border-gray-100 bg-white">
            <TouchableOpacity
              onPress={() => setShowTranslate(false)}
              className="w-9 h-9 items-center justify-center rounded-full bg-gray-100 mr-3"
            >
              <X size={18} color="#374151" />
            </TouchableOpacity>
            <View className="w-8 h-8 rounded-full bg-purple-100 items-center justify-center mr-2.5">
              <Languages size={15} color="#7c3aed" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-gray-800">Dịch tin nhắn</Text>
              <Text className="text-[11px] text-purple-500">Powered by AI</Text>
            </View>
          </View>
          <ScrollView className="flex-1 px-4 py-4">
            <Text className="text-xs font-medium text-gray-500 mb-1">Nội dung gốc</Text>
            <View className="bg-gray-50 rounded-xl p-3 border border-gray-100 mb-4">
              <Text className="text-gray-800 text-sm">{translateContent}</Text>
            </View>
            <Text className="text-xs font-medium text-gray-500 mb-2">Dịch sang</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {[
                  { code: 'en', label: 'Tiếng Anh' },
                  { code: 'vi', label: 'Tiếng Việt' },
                  { code: 'zh', label: 'Trung' },
                  { code: 'ja', label: 'Nhật' },
                  { code: 'ko', label: 'Hàn' },
                  { code: 'fr', label: 'Pháp' },
                  { code: 'de', label: 'Đức' },
                ].map((lang) => (
                  <TouchableOpacity
                    key={lang.code}
                    onPress={() => setTranslateLang(lang.code)}
                    className={`px-3 py-1.5 rounded-full border mr-1 ${
                      translateLang === lang.code
                        ? 'bg-purple-500 border-purple-500'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        translateLang === lang.code ? 'text-white' : 'text-gray-600'
                      }`}
                    >
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {translated && (
              <>
                <Text className="text-xs font-medium text-gray-500 mb-1">Kết quả dịch</Text>
                <View className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                  <Text className="text-gray-800 text-sm">{translated}</Text>
                </View>
              </>
            )}
          </ScrollView>
          <View className="px-4 pb-4">
            <TouchableOpacity
              onPress={handleTranslate}
              className="bg-purple-500 rounded-xl py-3 items-center"
              disabled={translateLoading}
            >
              {translateLoading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="text-white font-medium ml-2">Đang dịch...</Text>
                </View>
              ) : (
                <Text className="text-white font-medium">{translated ? 'Dịch lại' : 'Dịch'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Rewrite Modal ────────────────────────────────────────────────────── */}
      <Modal
        visible={showRewrite}
        animationType="slide"
        onRequestClose={() => setShowRewrite(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'white',
            paddingTop: topInset,
            paddingBottom: bottomInset,
          }}
        >
          <View className="flex-row items-center px-4 py-3.5 border-b border-gray-100 bg-white">
            <TouchableOpacity
              onPress={() => setShowRewrite(false)}
              className="w-9 h-9 items-center justify-center rounded-full bg-gray-100 mr-3"
            >
              <X size={18} color="#374151" />
            </TouchableOpacity>
            <View className="w-8 h-8 rounded-full bg-violet-100 items-center justify-center mr-2.5">
              <Wand2 size={15} color="#7c3aed" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-gray-800">Viết lại tin nhắn</Text>
              <Text className="text-[11px] text-violet-500">Powered by AI</Text>
            </View>
          </View>
          <ScrollView className="flex-1 px-4 py-4">
            <Text className="text-xs font-medium text-gray-500 mb-1">Nội dung gốc</Text>
            <View className="bg-gray-50 rounded-xl p-3 border border-gray-100 mb-4">
              <Text className="text-gray-800 text-sm">{rewriteContent}</Text>
            </View>
            {rewriteLoading && (
              <View className="items-center py-6">
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text className="text-gray-400 text-sm mt-2">AI đang viết lại...</Text>
              </View>
            )}
            {rewriteResults && !rewriteLoading && (
              <>
                <Text className="text-xs font-medium text-gray-500 mb-3">
                  Các phiên bản viết lại
                </Text>
                {rewriteResults.map((r) => (
                  <View
                    key={r.style}
                    className="mb-3 bg-violet-50 rounded-xl p-3 border border-violet-100"
                  >
                    <Text className="text-xs font-semibold text-violet-600 mb-1">{r.label}</Text>
                    <Text className="text-gray-800 text-sm leading-relaxed mb-2">{r.text}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setText(r.text);
                        setShowRewrite(false);
                      }}
                      className="self-start bg-violet-600 rounded-lg px-3 py-1.5"
                    >
                      <Text className="text-white text-xs font-semibold">Dùng câu này</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
          <View className="px-4 pb-4">
            <TouchableOpacity
              onPress={handleRewrite}
              className="bg-violet-600 rounded-xl py-3 items-center"
              disabled={rewriteLoading}
            >
              {rewriteLoading ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="text-white font-medium ml-2">Đang xử lý...</Text>
                </View>
              ) : (
                <Text className="text-white font-medium">
                  {rewriteResults ? 'Viết lại tiếp' : 'Viết lại ngay'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Chatbot RAG Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showChatbot}
        animationType="slide"
        onRequestClose={() => setShowChatbot(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'white',
            paddingTop: topInset,
            paddingBottom: bottomInset,
          }}
        >
          {/* Header */}
          <View className="flex-row items-center px-4 py-3.5 border-b border-gray-100 bg-white">
            <TouchableOpacity
              onPress={() => setShowChatbot(false)}
              className="w-9 h-9 items-center justify-center rounded-full bg-gray-100 mr-3"
            >
              <X size={18} color="#374151" />
            </TouchableOpacity>
            <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2.5">
              <Bot size={16} color="#0068FF" />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-gray-800">BinChat AI</Text>
              <Text className="text-[11px] text-blue-500">Trợ lý AI thông minh (RAG)</Text>
            </View>
            {chatbotHistory.length > 0 && (
              <TouchableOpacity
                onPress={() => setChatbotHistory([])}
                className="px-3 py-1.5 rounded-lg border border-gray-200"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text className="text-xs text-gray-500">Xóa lịch sử</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Messages area */}
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <ScrollView
              ref={chatbotScrollRef}
              className="flex-1 px-4 pt-4"
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 8 }}
              onContentSizeChange={() => chatbotScrollRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
            >
              {chatbotHistory.length === 0 && (
                <View className="flex-1 items-center justify-center py-16">
                  <View className="w-16 h-16 rounded-full bg-blue-50 items-center justify-center mb-4">
                    <Sparkles size={30} color="#0068FF" />
                  </View>
                  <Text className="text-gray-800 font-semibold text-base mb-2">Xin chào! 👋</Text>
                  <Text className="text-gray-400 text-sm text-center px-8 leading-5">
                    Tôi là BinChat AI. Hỏi tôi bất cứ điều gì về cuộc trò chuyện này hoặc bất kỳ câu
                    hỏi nào bạn muốn.
                  </Text>
                  <View className="mt-6 gap-2 w-full px-4">
                    {[
                      'Tóm tắt nội dung gần đây',
                      'Các chủ đề đã thảo luận',
                      'Những điều quan trọng cần nhớ',
                    ].map((suggestion) => (
                      <TouchableOpacity
                        key={suggestion}
                        onPress={() => setChatbotInput(suggestion)}
                        className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5"
                      >
                        <Text className="text-[13px] text-blue-600">{suggestion}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              {chatbotHistory.map((msg, i) => (
                <View
                  key={i}
                  className={
                    'mb-3 flex-row ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')
                  }
                >
                  {msg.role === 'bot' && (
                    <View className="w-7 h-7 rounded-full bg-blue-100 items-center justify-center mr-2 mt-auto mb-0.5 flex-shrink-0">
                      <Bot size={13} color="#0068FF" />
                    </View>
                  )}
                  <View
                    className={
                      'max-w-[78%] px-4 py-2.5 rounded-2xl ' +
                      (msg.role === 'user'
                        ? 'bg-[#0068FF] rounded-br-sm'
                        : 'bg-gray-100 rounded-bl-sm')
                    }
                  >
                    <Text
                      className={
                        'text-sm leading-5 ' +
                        (msg.role === 'user' ? 'text-white' : 'text-gray-800')
                      }
                      selectable
                    >
                      {msg.text}
                    </Text>
                  </View>
                </View>
              ))}
              {chatbotLoading && (
                <View className="flex-row items-center mb-3">
                  <View className="w-7 h-7 rounded-full bg-blue-100 items-center justify-center mr-2 flex-shrink-0">
                    <Bot size={13} color="#0068FF" />
                  </View>
                  <View className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                    <View className="flex-row gap-1 items-center">
                      <View className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      <View className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      <View className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Input */}
            <View className="flex-row items-end px-3 py-2.5 border-t border-gray-100 bg-white">
              <TextInput
                value={chatbotInput}
                onChangeText={setChatbotInput}
                placeholder="Hỏi BinChat AI..."
                multiline
                maxLength={500}
                className="flex-1 bg-gray-50 rounded-2xl px-4 py-2.5 text-[14px] max-h-[100px] border border-gray-100 mr-2"
                placeholderTextColor="#9ca3af"
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={handleAskBot}
              />
              <TouchableOpacity
                onPress={handleAskBot}
                disabled={chatbotLoading || !chatbotInput.trim()}
                className={
                  'w-10 h-10 rounded-full items-center justify-center ' +
                  (chatbotInput.trim() && !chatbotLoading ? 'bg-[#0068FF]' : 'bg-gray-200')
                }
              >
                {chatbotLoading ? (
                  <ActivityIndicator size="small" color="#0068FF" />
                ) : (
                  <Send size={18} color={chatbotInput.trim() ? '#fff' : '#9ca3af'} />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
