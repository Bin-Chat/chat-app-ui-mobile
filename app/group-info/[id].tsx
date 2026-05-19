import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Image,
  Linking,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Crown,
  Shield,
  UserPlus,
  LogOut,
  Trash2,
  ChevronRight,
  ChevronDown,
  X,
  Search,
  Check,
  Edit2,
  Camera,
  Ban,
  FileText,
  Link,
  Image as ImageIcon,
  Download,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { UserAvatar } from '@/components/UserAvatar';
import { chatServices } from '@/services/chatServices';
import { uploadFile } from '@/services/uploadService';
import type { Participant } from '@/types/chat';
import type { FriendItem } from '@/types/friend';
import ReminderListModal from '@/components/ReminderListModal';

// ── Role helpers ──
const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, member: 2 };
const ROLE_LABEL: Record<string, string> = {
  owner: 'Chủ nhóm',
  admin: 'Phó nhóm',
  member: 'Thành viên',
};

function RoleBadge({ role }: { role: string }) {
  if (role === 'owner')
    return (
      <View className="flex-row items-center bg-amber-50 rounded-full px-2 py-0.5 ml-2">
        <Crown size={12} color="#f59e0b" />
        <Text className="text-[11px] text-amber-600 ml-1 font-medium">Chủ nhóm</Text>
      </View>
    );
  if (role === 'admin')
    return (
      <View className="flex-row items-center bg-blue-50 rounded-full px-2 py-0.5 ml-2">
        <Shield size={12} color="#3b82f6" />
        <Text className="text-[11px] text-blue-600 ml-1 font-medium">Phó nhóm</Text>
      </View>
    );
  return null;
}

// ── Media Sections ──────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const THUMB_SIZE = Math.floor((SCREEN_WIDTH - 48) / 3);

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
        <View className="flex-row items-center gap-2">
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

function ConversationMediaSections({ conversationId }: { conversationId: string }) {
  // ── Images ──
  const [images, setImages] = useState<any[]>([]);
  const [imagesMore, setImagesMore] = useState(false);
  const [imagesCursor, setImagesCursor] = useState<string | null>(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [showAllImages, setShowAllImages] = useState(false);

  const loadImages = useCallback(
    async (cursor?: string) => {
      setImagesLoading(true);
      try {
        const res = await chatServices.getConversationMedia(conversationId, 'image', cursor);
        setImages((prev) => (cursor ? [...prev, ...res.items] : res.items));
        setImagesMore(res.hasMore);
        setImagesCursor(res.nextCursor);
      } catch {
        /* silent */
      } finally {
        setImagesLoading(false);
      }
    },
    [conversationId]
  );

  // ── Files ──
  const [files, setFiles] = useState<any[]>([]);
  const [filesMore, setFilesMore] = useState(false);
  const [filesCursor, setFilesCursor] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);

  const loadFiles = useCallback(
    async (cursor?: string) => {
      setFilesLoading(true);
      try {
        const res = await chatServices.getConversationMedia(conversationId, 'file', cursor);
        setFiles((prev) => (cursor ? [...prev, ...res.items] : res.items));
        setFilesMore(res.hasMore);
        setFilesCursor(res.nextCursor);
      } catch {
        /* silent */
      } finally {
        setFilesLoading(false);
      }
    },
    [conversationId]
  );

  // ── Links ──
  const [links, setLinks] = useState<any[]>([]);
  const [linksMore, setLinksMore] = useState(false);
  const [linksCursor, setLinksCursor] = useState<string | null>(null);
  const [linksLoading, setLinksLoading] = useState(false);

  const loadLinks = useCallback(
    async (cursor?: string) => {
      setLinksLoading(true);
      try {
        const res = await chatServices.getConversationMedia(conversationId, 'link', cursor);
        setLinks((prev) => (cursor ? [...prev, ...res.items] : res.items));
        setLinksMore(res.hasMore);
        setLinksCursor(res.nextCursor);
      } catch {
        /* silent */
      } finally {
        setLinksLoading(false);
      }
    },
    [conversationId]
  );

  const displayedImages = showAllImages ? images : images.slice(0, 9);

  useEffect(() => {
    loadImages();
    loadFiles();
    loadLinks();
  }, [loadImages, loadFiles, loadLinks]);

  return (
    <>
      {/* Ảnh/Video */}
      <MediaCollapsible
        title="Ảnh/Video"
        icon={<ImageIcon size={16} color="#6b7280" />}
        defaultOpen={true}
      >
        {imagesLoading && images.length === 0 ? (
          <ActivityIndicator size="small" color="#0068FF" />
        ) : images.length === 0 && !imagesLoading ? (
          <Text className="text-[12px] text-gray-400 text-center py-2">Chưa có ảnh/video nào</Text>
        ) : (
          <View>
            <View className="flex-row flex-wrap gap-1">
              {displayedImages.map((item: any, i: number) => (
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
            {!showAllImages && images.length > 9 && (
              <TouchableOpacity
                onPress={() => {
                  setShowAllImages(true);
                  if (imagesMore) loadImages(imagesCursor ?? undefined);
                }}
                className="mt-2"
              >
                <Text className="text-[13px] text-[#0068FF] text-center">
                  Xem tất cả ({images.length}
                  {imagesMore ? '+' : ''})
                </Text>
              </TouchableOpacity>
            )}
            {showAllImages && imagesMore && (
              <TouchableOpacity
                onPress={() => loadImages(imagesCursor ?? undefined)}
                disabled={imagesLoading}
                className="mt-2"
              >
                <Text className="text-[13px] text-[#0068FF] text-center">
                  {imagesLoading ? 'Đang tải...' : 'Tải thêm'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {images.length === 0 && !imagesLoading && (
          <TouchableOpacity onPress={() => loadImages()} className="py-1">
            <Text className="text-[12px] text-[#0068FF] text-center">Tải</Text>
          </TouchableOpacity>
        )}
      </MediaCollapsible>

      {/* File */}
      <MediaCollapsible title="File" icon={<FileText size={16} color="#6b7280" />}>
        {filesLoading && files.length === 0 ? (
          <ActivityIndicator size="small" color="#0068FF" />
        ) : files.length === 0 && !filesLoading ? (
          <Text className="text-[12px] text-gray-400 text-center py-2">Chưa có file nào</Text>
        ) : (
          <View>
            {files.map((item: any, i: number) => (
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
            {filesMore && (
              <TouchableOpacity
                onPress={() => loadFiles(filesCursor ?? undefined)}
                disabled={filesLoading}
                className="mt-2"
              >
                <Text className="text-[13px] text-[#0068FF] text-center">
                  {filesLoading ? 'Đang tải...' : 'Tải thêm'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {files.length === 0 && !filesLoading && (
          <TouchableOpacity onPress={() => loadFiles()} className="py-1">
            <Text className="text-[12px] text-[#0068FF] text-center">Tải</Text>
          </TouchableOpacity>
        )}
      </MediaCollapsible>

      {/* Link */}
      <MediaCollapsible title="Link" icon={<Link size={16} color="#6b7280" />}>
        {linksLoading && links.length === 0 ? (
          <ActivityIndicator size="small" color="#0068FF" />
        ) : links.length === 0 && !linksLoading ? (
          <Text className="text-[12px] text-gray-400 text-center py-2">Chưa có link nào</Text>
        ) : (
          <View>
            {links.map((item: any, i: number) => (
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
            {linksMore && (
              <TouchableOpacity
                onPress={() => loadLinks(linksCursor ?? undefined)}
                disabled={linksLoading}
                className="mt-2"
              >
                <Text className="text-[13px] text-[#0068FF] text-center">
                  {linksLoading ? 'Đang tải...' : 'Tải thêm'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </MediaCollapsible>
    </>
  );
}

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const conversationId = id ?? '';

  const user = useAuthStore((s) => s.user);
  const friends = useFriendStore((s) => s.friends);
  const conversation = useChatStore((s) => s.conversations.find((c) => c._id === conversationId));
  const {
    addGroupMembers,
    removeGroupMember,
    leaveGroup,
    updateGroup,
    changeGroupRole,
    transferGroupOwnership,
    dissolveGroup,
    fetchConversations,
    updateGroupSettings,
    banGroupMember,
    unbanGroupMember,
  } = useChatStore();

  const [members, setMembers] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Participant | null>(null);
  const [showReminderList, setShowReminderList] = useState(false);

  // Current user's role
  const myRole = useMemo(
    () => conversation?.participants.find((p) => p.userId === user?.id)?.role ?? 'member',
    [conversation, user]
  );
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin';
  const canManage = isOwner || isAdmin;

  // Load members
  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await chatServices.getGroupMembers(conversationId);
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      // Fallback to conversation participants
      setMembers(conversation?.participants ?? []);
    } finally {
      setLoading(false);
    }
  }, [conversationId, conversation]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Sorted members
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)),
    [members]
  );

  // Get friend info for a member
  const getFriendInfo = useCallback(
    (userId: string) => {
      if (userId === user?.id) return { fullName: user.fullName, avatar: user.avatar };
      const f = friends.find((fr) => fr.user.id === userId);
      return f ? { fullName: f.user.fullName, avatar: f.user.avatar } : { fullName: 'Người dùng' };
    },
    [user, friends]
  );

  // ── Actions ──
  const handleToggleSetting = async (key: string, value: boolean) => {
    try {
      await updateGroupSettings(conversationId, { [key]: value });
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể cập nhật cài đặt');
    }
  };

  const handleBanMember = (member: Participant, name: string) => {
    Alert.alert('Cấm gửi tin nhắn', `Cấm ${name} gửi tin nhắn trong 24 giờ?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Cấm 24h',
        style: 'destructive',
        onPress: async () => {
          try {
            const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await banGroupMember(conversationId, member.userId, until);
            setMembers((prev) =>
              prev.map((m) =>
                m.userId === member.userId ? { ...m, isBanned: true, bannedUntil: until } : m
              )
            );
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message || 'Không thể cấm thành viên');
          }
        },
      },
    ]);
  };

  const handleUnbanMember = async (member: Participant, name: string) => {
    try {
      await unbanGroupMember(conversationId, member.userId);
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === member.userId ? { ...m, isBanned: false, bannedUntil: null } : m
        )
      );
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể bỏ cấm');
    }
  };

  const handleLeave = () => {
    Alert.alert('Rời nhóm', 'Bạn có chắc chắn muốn rời khỏi nhóm này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Rời nhóm',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveGroup(conversationId);
            await fetchConversations();
            router.replace('/(app)');
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message || 'Không thể rời nhóm');
          }
        },
      },
    ]);
  };

  const handleDissolve = () => {
    Alert.alert(
      'Giải tán nhóm',
      'Nhóm sẽ bị xóa vĩnh viễn cùng toàn bộ tin nhắn. Bạn có chắc chắn?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Giải tán',
          style: 'destructive',
          onPress: async () => {
            try {
              await dissolveGroup(conversationId);
              await fetchConversations();
              router.replace('/(app)');
            } catch (e: any) {
              Alert.alert('Lỗi', e?.message || 'Không thể giải tán nhóm');
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = (memberId: string, name: string) => {
    Alert.alert('Xóa thành viên', `Bạn có chắc muốn xóa ${name} khỏi nhóm?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeGroupMember(conversationId, memberId);
            setMembers((prev) => prev.filter((m) => m.userId !== memberId));
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message || 'Không thể xóa thành viên');
          }
        },
      },
    ]);
  };

  const handleChangeRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      await changeGroupRole(conversationId, memberId, newRole);
      setMembers((prev) => prev.map((m) => (m.userId === memberId ? { ...m, role: newRole } : m)));
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể thay đổi vai trò');
    }
  };

  const handleTransfer = (memberId: string, name: string) => {
    Alert.alert(
      'Chuyển quyền chủ nhóm',
      `Bạn sẽ chuyển quyền chủ nhóm cho ${name}. Bạn sẽ trở thành thành viên thường.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Chuyển',
          onPress: async () => {
            try {
              await transferGroupOwnership(conversationId, memberId);
              setMembers((prev) =>
                prev.map((m) => {
                  if (m.userId === memberId) return { ...m, role: 'owner' };
                  if (m.userId === user?.id) return { ...m, role: 'member' };
                  return m;
                })
              );
            } catch (e: any) {
              Alert.alert('Lỗi', e?.message || 'Không thể chuyển quyền');
            }
          },
        },
      ]
    );
  };

  // ── Member action sheet ──
  const renderMemberActions = () => {
    if (!selectedMember || selectedMember.userId === user?.id) return null;
    const memberInfo = getFriendInfo(selectedMember.userId);
    const memberRole = selectedMember.role;

    return (
      <Modal transparent animationType="fade" onRequestClose={() => setSelectedMember(null)}>
        <TouchableOpacity
          className="flex-1 bg-black/40 justify-end"
          activeOpacity={1}
          onPress={() => setSelectedMember(null)}
        >
          <View className="bg-white rounded-t-2xl px-4 pt-4 pb-8">
            <View className="flex-row items-center mb-4">
              <UserAvatar
                user={{ fullName: memberInfo.fullName, avatar: memberInfo.avatar ?? undefined }}
                size={44}
              />
              <View className="ml-3">
                <Text className="text-[16px] font-semibold text-gray-900">
                  {memberInfo.fullName}
                </Text>
                <Text className="text-[13px] text-gray-500">
                  {ROLE_LABEL[memberRole] ?? 'Thành viên'}
                </Text>
              </View>
            </View>

            {/* Owner actions */}
            {isOwner && memberRole !== 'owner' && (
              <>
                <TouchableOpacity
                  className="flex-row items-center py-3.5"
                  onPress={() => {
                    setSelectedMember(null);
                    handleChangeRole(
                      selectedMember.userId,
                      memberRole === 'admin' ? 'member' : 'admin'
                    );
                  }}
                >
                  <Shield size={18} color="#3b82f6" />
                  <Text className="ml-3 text-[15px] text-gray-800">
                    {memberRole === 'admin' ? 'Hạ xuống thành viên' : 'Thăng lên phó nhóm'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center py-3.5"
                  onPress={() => {
                    setSelectedMember(null);
                    handleTransfer(selectedMember.userId, memberInfo.fullName);
                  }}
                >
                  <Crown size={18} color="#f59e0b" />
                  <Text className="ml-3 text-[15px] text-gray-800">Chuyển quyền chủ nhóm</Text>
                </TouchableOpacity>

                {!selectedMember.isBanned ? (
                  <TouchableOpacity
                    className="flex-row items-center py-3.5"
                    onPress={() => {
                      const m = selectedMember;
                      setSelectedMember(null);
                      handleBanMember(m, memberInfo.fullName);
                    }}
                  >
                    <Ban size={18} color="#f97316" />
                    <Text className="ml-3 text-[15px] text-orange-500">Cấm gửi tin nhắn</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    className="flex-row items-center py-3.5"
                    onPress={() => {
                      const m = selectedMember;
                      setSelectedMember(null);
                      handleUnbanMember(m, memberInfo.fullName);
                    }}
                  >
                    <Ban size={18} color="#22c55e" />
                    <Text className="ml-3 text-[15px] text-green-500">Bỏ cấm</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  className="flex-row items-center py-3.5"
                  onPress={() => {
                    setSelectedMember(null);
                    handleRemoveMember(selectedMember.userId, memberInfo.fullName);
                  }}
                >
                  <Trash2 size={18} color="#ef4444" />
                  <Text className="ml-3 text-[15px] text-red-500">Xóa khỏi nhóm</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Admin actions – can remove/ban members only */}
            {isAdmin && memberRole === 'member' && (
              <>
                {!selectedMember.isBanned ? (
                  <TouchableOpacity
                    className="flex-row items-center py-3.5"
                    onPress={() => {
                      const m = selectedMember;
                      setSelectedMember(null);
                      handleBanMember(m, memberInfo.fullName);
                    }}
                  >
                    <Ban size={18} color="#f97316" />
                    <Text className="ml-3 text-[15px] text-orange-500">Cấm gửi tin nhắn</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    className="flex-row items-center py-3.5"
                    onPress={() => {
                      const m = selectedMember;
                      setSelectedMember(null);
                      handleUnbanMember(m, memberInfo.fullName);
                    }}
                  >
                    <Ban size={18} color="#22c55e" />
                    <Text className="ml-3 text-[15px] text-green-500">Bỏ cấm</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  className="flex-row items-center py-3.5"
                  onPress={() => {
                    setSelectedMember(null);
                    handleRemoveMember(selectedMember.userId, memberInfo.fullName);
                  }}
                >
                  <Trash2 size={18} color="#ef4444" />
                  <Text className="ml-3 text-[15px] text-red-500">Xóa khỏi nhóm</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ── Render ──
  const renderMember = ({ item }: { item: Participant }) => {
    const info = getFriendInfo(item.userId);
    const isMe = item.userId === user?.id;

    return (
      <TouchableOpacity
        className="flex-row items-center px-4 py-3"
        activeOpacity={canManage && !isMe ? 0.6 : 1}
        onPress={() => {
          if (canManage && !isMe) setSelectedMember(item);
        }}
      >
        <UserAvatar
          user={{ fullName: info.fullName, avatar: info.avatar ?? undefined }}
          size={40}
        />
        <View className="flex-1 ml-3">
          <View className="flex-row items-center flex-wrap">
            <Text className="text-[15px] text-gray-800 font-medium" numberOfLines={1}>
              {info.fullName}
              {isMe ? ' (Bạn)' : ''}
            </Text>
            <RoleBadge role={item.role} />
            {item.isBanned && (
              <View className="flex-row items-center bg-red-50 rounded-full px-2 py-0.5 ml-1">
                <Ban size={10} color="#ef4444" />
                <Text className="text-[10px] text-red-500 ml-0.5 font-medium">Bị cấm</Text>
              </View>
            )}
          </View>
        </View>
        {canManage && !isMe && <ChevronRight size={16} color="#d1d5db" />}
      </TouchableOpacity>
    );
  };

  if (!conversation) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-400">Nhóm không tồn tại</Text>
      </SafeAreaView>
    );
  }

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
        <Text className="flex-1 text-[17px] font-semibold text-gray-900 ml-2">Thông tin nhóm</Text>
        {canManage && (
          <TouchableOpacity
            onPress={() => setShowEditGroup(true)}
            className="w-9 h-9 items-center justify-center"
          >
            <Edit2 size={18} color="#0068FF" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView className="flex-1">
        {/* Group info */}
        <View className="items-center pt-6 pb-4 border-b border-gray-100">
          <UserAvatar
            user={{
              fullName: conversation.name ?? 'Nhóm',
              avatar: conversation.avatar ?? undefined,
            }}
            size={72}
          />
          <Text className="text-[20px] font-bold text-gray-900 mt-3">
            {conversation.name || 'Nhóm chat'}
          </Text>
          {conversation.description && (
            <Text className="text-[14px] text-gray-500 mt-1 px-6 text-center">
              {conversation.description}
            </Text>
          )}
          <Text className="text-[13px] text-gray-400 mt-1">{members.length} thành viên</Text>
        </View>

        {/* Add member button */}
        {(canManage || !!(conversation?.settings as any)?.allowMemberInvite) && (
          <TouchableOpacity
            onPress={() => setShowAddMember(true)}
            className="flex-row items-center px-4 py-3.5 border-b border-gray-100"
          >
            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center">
              <UserPlus size={18} color="#0068FF" />
            </View>
            <Text className="ml-3 text-[15px] text-[#0068FF] font-medium">Thêm thành viên</Text>
          </TouchableOpacity>
        )}

        {/* Members */}
        <View className="mt-2">
          <Text className="px-4 py-2 text-[13px] text-gray-500 font-medium uppercase">
            Thành viên ({sortedMembers.length})
          </Text>
          {loading ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color="#0068FF" />
            </View>
          ) : (
            sortedMembers.map((m) => (
              <React.Fragment key={m.userId}>{renderMember({ item: m })}</React.Fragment>
            ))
          )}
        </View>

        {/* Group Settings — owner only */}
        {isOwner && (
          <View className="mt-2 mx-4 mb-2 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
            <Text className="text-[13px] font-semibold text-gray-700 mb-3">⚙️ Cài đặt nhóm</Text>
            {(
              [
                ['onlyAdminCanSend', 'Chỉ Quản trị viên gửi tin nhắn'],
                ['allowMemberInvite', 'Thành viên được mời người khác'],
                ['onlyAdminCanPin', 'Chỉ quản trị viên được ghim tin nhắn'],
              ] as [string, string][]
            ).map(([key, label]) => {
              const val = !!(conversation?.settings as any)?.[key];
              return (
                <View key={key} className="flex-row items-center justify-between py-2.5">
                  <Text className="flex-1 text-[14px] text-gray-600 mr-4">{label}</Text>
                  <TouchableOpacity
                    onPress={() => handleToggleSetting(key, !val)}
                    className={`w-11 h-6 rounded-full relative ${
                      val ? 'bg-[#0068FF]' : 'bg-gray-300'
                    }`}
                    activeOpacity={0.8}
                  >
                    <View
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow ${
                        val ? 'right-1' : 'left-1'
                      }`}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Media / File / Link */}
        <ConversationMediaSections conversationId={conversationId} />

        {/* Bảng tin nhóm */}
        <View className="mt-2 border-t border-gray-100">
          <Text className="px-4 py-2 text-[13px] text-gray-500 font-medium uppercase">
            Bảng tin nhóm
          </Text>
          <TouchableOpacity
            className="flex-row items-center px-4 py-3"
            onPress={() => setShowReminderList(true)}
            activeOpacity={0.7}
          >
            <View className="w-9 h-9 rounded-full bg-blue-50 items-center justify-center mr-3">
              <Text style={{ fontSize: 18 }}>⏰</Text>
            </View>
            <Text className="flex-1 text-[15px] text-gray-800">Danh sách nhắc hẹn</Text>
            <ChevronRight size={16} color="#d1d5db" />
          </TouchableOpacity>
        </View>
        <View className="mt-4 border-t border-gray-100 pt-2 pb-8">
          {!isOwner && (
            <TouchableOpacity onPress={handleLeave} className="flex-row items-center px-4 py-3.5">
              <LogOut size={18} color="#ef4444" />
              <Text className="ml-3 text-[15px] text-red-500 font-medium">Rời nhóm</Text>
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity
              onPress={handleDissolve}
              className="flex-row items-center px-4 py-3.5"
            >
              <Trash2 size={18} color="#ef4444" />
              <Text className="ml-3 text-[15px] text-red-500 font-medium">Giải tán nhóm</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Member action modal */}
      {selectedMember && renderMemberActions()}

      {/* Add member modal */}
      {showAddMember && (
        <AddMemberModal
          conversationId={conversationId}
          existingMemberIds={members.map((m) => m.userId)}
          friends={friends}
          onAdd={async (ids) => {
            await addGroupMembers(conversationId, ids);
            await loadMembers();
            setShowAddMember(false);
          }}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {/* Edit group modal */}
      {showEditGroup && (
        <EditGroupModal
          name={conversation.name ?? ''}
          description={conversation.description ?? ''}
          avatar={conversation.avatar ?? undefined}
          onSave={async (data) => {
            await updateGroup(conversationId, data);
            setShowEditGroup(false);
          }}
          onClose={() => setShowEditGroup(false)}
        />
      )}

      {/* Reminder list modal */}
      {showReminderList && (
        <ReminderListModal
          conversationId={conversationId}
          currentUserId={user?.id ?? ''}
          onClose={() => setShowReminderList(false)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Add Member Modal ──
function AddMemberModal({
  conversationId,
  existingMemberIds,
  friends,
  onAdd,
  onClose,
}: {
  conversationId: string;
  existingMemberIds: string[];
  friends: FriendItem[];
  onAdd: (ids: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const available = useMemo(() => {
    const filtered = friends.filter((f) => !existingMemberIds.includes(f.user.id));
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((f) => f.user.fullName.toLowerCase().includes(q));
  }, [friends, existingMemberIds, search]);

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    setAdding(true);
    try {
      await onAdd(selectedIds);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể thêm thành viên');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-2xl" style={{ maxHeight: '80%' }}>
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <Text className="text-[16px] font-semibold text-gray-900">Thêm thành viên</Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={handleAdd}
                disabled={adding || selectedIds.length === 0}
                className={`px-3 py-1.5 rounded-full ${
                  selectedIds.length > 0 ? 'bg-[#0068FF]' : 'bg-gray-200'
                }`}
              >
                {adding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    className={`text-[13px] font-semibold ${
                      selectedIds.length > 0 ? 'text-white' : 'text-gray-400'
                    }`}
                  >
                    Thêm ({selectedIds.length})
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} className="p-1">
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

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

          <FlatList
            data={available}
            keyExtractor={(item) => item.user.id}
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item }) => {
              const sel = selectedIds.includes(item.user.id);
              return (
                <TouchableOpacity
                  onPress={() =>
                    setSelectedIds((prev) =>
                      sel ? prev.filter((id) => id !== item.user.id) : [...prev, item.user.id]
                    )
                  }
                  className="flex-row items-center px-4 py-3"
                >
                  <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
                      sel ? 'bg-[#0068FF] border-[#0068FF]' : 'border-gray-300'
                    }`}
                  >
                    {sel && <Check size={14} color="#fff" />}
                  </View>
                  <UserAvatar
                    user={{ fullName: item.user.fullName, avatar: item.user.avatar ?? undefined }}
                    size={36}
                  />
                  <Text className="ml-3 text-[15px] text-gray-800">{item.user.fullName}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View className="items-center py-8">
                <Text className="text-gray-400">Không có bạn bè để thêm</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Edit Group Modal ──
function EditGroupModal({
  name,
  description,
  avatar,
  onSave,
  onClose,
}: {
  name: string;
  description: string;
  avatar?: string;
  onSave: (data: { name?: string; description?: string; avatar?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState(name);
  const [newDesc, setNewDesc] = useState(description);
  const [newAvatar, setNewAvatar] = useState<string | undefined>(avatar);
  const [localAvatarUri, setLocalAvatarUri] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Cần quyền truy cập thư viện ảnh để đổi ảnh nhóm.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as ImagePicker.MediaType,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setLocalAvatarUri(asset.uri);
    setUploadingAvatar(true);
    try {
      const filename = asset.fileName || `group_avatar_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';
      const size = asset.fileSize || 0;
      const uploaded = await uploadFile(asset.uri, filename, mimeType, size);
      setNewAvatar(uploaded.url);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể tải ảnh lên');
      setLocalAvatarUri(undefined);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      Alert.alert('Lỗi', 'Tên nhóm không được để trống');
      return;
    }
    setSaving(true);
    try {
      const data: { name?: string; description?: string; avatar?: string } = {};
      if (trimmedName !== name) data.name = trimmedName;
      if (newDesc.trim() !== description) data.description = newDesc.trim();
      if (newAvatar !== avatar) data.avatar = newAvatar;
      if (Object.keys(data).length > 0) await onSave(data);
      else onClose();
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể cập nhật');
    } finally {
      setSaving(false);
    }
  };

  const avatarSource = localAvatarUri || newAvatar;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 bg-black/40 justify-end"
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View className="bg-white rounded-t-2xl px-4 pt-4 pb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-[16px] font-semibold text-gray-900">Chỉnh sửa nhóm</Text>
              <TouchableOpacity onPress={onClose} className="p-1">
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Avatar picker */}
            <View className="items-center mb-4">
              <TouchableOpacity
                onPress={handlePickAvatar}
                disabled={uploadingAvatar}
                className="relative"
              >
                {avatarSource ? (
                  <Image
                    source={{ uri: avatarSource }}
                    className="w-20 h-20 rounded-full bg-gray-200"
                    style={{ width: 80, height: 80, borderRadius: 40 }}
                  />
                ) : (
                  <View className="w-20 h-20 rounded-full bg-gray-200 items-center justify-center">
                    <Text className="text-2xl font-bold text-gray-500">
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#0068FF] items-center justify-center border-2 border-white">
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Camera size={14} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
              <Text className="text-[12px] text-gray-400 mt-1">Nhấn để đổi ảnh nhóm</Text>
            </View>

            <Text className="text-[13px] text-gray-500 mb-1">Tên nhóm</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              maxLength={100}
              className="bg-gray-50 rounded-xl px-4 py-3 text-[15px] border border-gray-100 mb-3"
            />

            <Text className="text-[13px] text-gray-500 mb-1">Mô tả</Text>
            <TextInput
              value={newDesc}
              onChangeText={setNewDesc}
              maxLength={500}
              multiline
              numberOfLines={3}
              className="bg-gray-50 rounded-xl px-4 py-3 text-[15px] border border-gray-100 mb-4"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || uploadingAvatar}
              className="bg-[#0068FF] rounded-xl py-3 items-center"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white text-[15px] font-semibold">Lưu</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
