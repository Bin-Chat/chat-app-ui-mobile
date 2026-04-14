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
} from 'lucide-react-native';

import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { UserAvatar } from '@/components/UserAvatar';
import { uploadFile, FILE_SIZE_LIMITS, getCategory } from '@/services/uploadService';
import { chatServices } from '@/services/chatServices';
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
        <View className="bg-gray-100 rounded-2xl px-3 py-2 max-w-[280px]">
          <Text className="text-gray-400 text-[13px] italic">Tin nhắn đã được thu hồi</Text>
          <Text className="text-gray-300 text-[11px] text-right mt-0.5">{timeStr}</Text>
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
  const msgIndexMap = useRef<Map<string, number>>(new Map());
  const { bottom: bottomInset } = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const friends = useFriendStore((s) => s.friends);
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

  const handleScrollToMessage = useCallback((messageId: string) => {
    const idx = msgIndexMap.current.get(messageId);
    if (idx !== undefined && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
    }
  }, []);

  const handleLoadMore = useCallback(() => {
    if (loadingMessages || !hasMore || messages.length === 0) return;
    // DESC storage: messages[last] is the oldest — use its createdAt as pagination cursor
    const oldestMsg = messages[messages.length - 1];
    fetchMessages(conversationId, oldestMsg.createdAt);
  }, [conversationId, hasMore, loadingMessages, messages]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    // System messages (group events)
    if (item.senderId === 'system') {
      return (
        <View className="items-center py-1.5 px-6">
          <Text className="text-[12px] text-gray-400 text-center bg-gray-50 rounded-full px-3 py-1">
            {item.content}
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
          <UserAvatar user={{ fullName: displayName, avatar: avatarUser?.avatar }} size={36} />
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
    </SafeAreaView>
  );
}
