import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { BarChart2, Lock, Trash2, X, Plus, Pencil, Check } from 'lucide-react-native';
import { chatServices } from '@/services/chatServices';
import { useAuthStore } from '@/store/authStore';
import { useFriendStore } from '@/store/friendStore';
import { useChatStore } from '@/store/chatStore';
import type { Message } from '@/types/chat';
import type { PollView } from '@/types/poll.type';

interface Props {
  message: Message;
  conversationId: string;
  isMine: boolean;
}

type MiniProfile = { name: string; avatar?: string | null };

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Đã hết hạn';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `Còn ${mins} phút`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Còn ${hours} giờ`;
  const days = Math.floor(hours / 24);
  return `Còn ${days} ngày`;
}

export default function PollBubble({ message, conversationId, isMine }: Props) {
  const user = useAuthStore((s) => s.user);
  const friends = useFriendStore((s) => s.friends);
  const socketPollUpdated = useChatStore((s) => s.socketPollUpdated);

  const poll = (message.metadata as any)?.poll as PollView | undefined;
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const [newOptionText, setNewOptionText] = useState('');
  const [busy, setBusy] = useState(false);

  // Question editing
  const [editing, setEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState('');

  // Per-option editing
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editOptionText, setEditOptionText] = useState('');

  // Optimistic display overrides (key = optionId or 'question')
  const [optimisticOptionTexts, setOptimisticOptionTexts] = useState<Record<string, string>>({});
  const [optimisticQuestion, setOptimisticQuestion] = useState<string | null>(null);

  // Voter panel
  const [voterModalOptId, setVoterModalOptId] = useState<string | null>(null);
  const [localProfiles, setLocalProfiles] = useState<Record<string, MiniProfile>>({});

  const resolveVoterProfile = (uid: string): MiniProfile => {
    if (uid === user?.id) return { name: 'Bạn', avatar: user?.avatar };
    const friend = friends.find((f) => f.user.id === uid);
    if (friend) return { name: friend.user.fullName, avatar: friend.user.avatar };
    const cached = localProfiles[uid];
    if (cached) return cached;
    return { name: 'Thành viên', avatar: null };
  };

  const effectiveMyVotes = useMemo(() => {
    if (!poll) return [];
    if (pendingIds) return pendingIds;
    if (poll.myVotes && poll.myVotes.length > 0) return poll.myVotes;
    if (!poll.hideVoters && user?.id) {
      return poll.options.filter((o) => o.voters?.includes(user.id)).map((o) => o._id);
    }
    return [];
  }, [poll, pendingIds, user?.id]);

  // Clear optimistic overrides once socket/store delivers the real updated poll
  useEffect(() => {
    if (!poll) return;
    // Remove optimistic question if it matches the received value
    if (optimisticQuestion !== null && poll.question === optimisticQuestion) {
      setOptimisticQuestion(null);
    }
    // Remove optimistic option texts that now match the received values
    setOptimisticOptionTexts((prev) => {
      const next = { ...prev };
      poll.options.forEach((o) => {
        if (next[o._id] === o.text) delete next[o._id];
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll]);

  // Re-fetch personalized view for creator when canonical view hides results
  useEffect(() => {
    if (poll && poll.hideResultsUntilVoted && !poll.canSeeResults && user?.id === poll.createdBy) {
      chatServices
        .getPoll(poll._id)
        .then((freshPoll) => {
          socketPollUpdated({
            pollId: poll._id,
            messageId: message._id,
            conversationId,
            poll: freshPoll,
          });
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll?._id, poll?.canSeeResults]);

  // Fetch unknown voter profiles when modal opens
  useEffect(() => {
    if (!voterModalOptId || !poll) return;
    const opt = poll.options.find((o) => o._id === voterModalOptId);
    if (!opt) return;
    const unknownIds = (opt.voters ?? []).filter(
      (uid) => uid !== user?.id && !friends.find((f) => f.user.id === uid) && !localProfiles[uid]
    );
    if (unknownIds.length === 0) return;
    chatServices
      .getUsersByIds(unknownIds)
      .then((profiles) => {
        const map: Record<string, MiniProfile> = {};
        profiles.forEach((p) => {
          map[p.id] = { name: p.fullName, avatar: p.avatar };
        });
        setLocalProfiles((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voterModalOptId]);

  if (!poll) {
    return (
      <Text style={{ fontStyle: 'italic', color: '#9ca3af', fontSize: 12, padding: 8 }}>
        Bình chọn không khả dụng
      </Text>
    );
  }

  const isCreator = user?.id === poll.createdBy;
  const canManage = isCreator;
  const isActive = !poll.isClosed && !poll.isExpired;
  const canSeeResults = poll.canSeeResults || isCreator || !isActive;
  const showResults = canSeeResults;
  const totalVoters = poll.totalVoters || 0;
  const creatorName = isCreator ? 'Bạn' : 'Thành viên';

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleVote = async (optionId: string) => {
    if (!isActive || busy) return;
    let nextIds: string[];
    if (poll.allowMultiple) {
      nextIds = effectiveMyVotes.includes(optionId)
        ? effectiveMyVotes.filter((id) => id !== optionId)
        : [...effectiveMyVotes, optionId];
    } else {
      nextIds = effectiveMyVotes.includes(optionId) ? [] : [optionId];
    }
    setPendingIds(nextIds);
    setBusy(true);
    try {
      await chatServices.votePoll(poll._id, nextIds);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Bình chọn thất bại';
      Alert.alert('Lỗi', Array.isArray(msg) ? msg.join('\n') : String(msg));
      setPendingIds(null);
    } finally {
      setBusy(false);
    }
  };

  const handleAddOption = async () => {
    const text = newOptionText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await chatServices.addPollOption(poll._id, text);
      setNewOptionText('');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Không thể thêm phương án';
      Alert.alert('Lỗi', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setBusy(false);
    }
  };

  const handleEditQuestionSave = async () => {
    const trimmed = editQuestion.trim();
    if (!trimmed || trimmed === (optimisticQuestion ?? poll.question) || busy) return;
    // Optimistic update — close form & show new text immediately
    setEditing(false);
    setOptimisticQuestion(trimmed);
    setBusy(true);
    try {
      await chatServices.updatePoll(poll._id, trimmed);
    } catch (e: any) {
      // Revert on error
      setOptimisticQuestion(null);
      setEditing(true);
      const msg = e?.response?.data?.message ?? 'Không thể cập nhật';
      Alert.alert('Lỗi', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateOption = async () => {
    if (!editingOptionId) return;
    const trimmed = editOptionText.trim();
    const original =
      optimisticOptionTexts[editingOptionId] ??
      poll.options.find((o) => o._id === editingOptionId)?.text ??
      '';
    if (!trimmed || trimmed === original || busy) return;
    const savingId = editingOptionId;
    // Optimistic update — close form & show new text immediately
    setEditingOptionId(null);
    setOptimisticOptionTexts((prev) => ({ ...prev, [savingId]: trimmed }));
    setBusy(true);
    try {
      await chatServices.updatePollOption(poll._id, savingId, trimmed);
    } catch (e: any) {
      // Revert on error
      setOptimisticOptionTexts((prev) => {
        const next = { ...prev };
        delete next[savingId];
        return next;
      });
      setEditingOptionId(savingId);
      setEditOptionText(trimmed);
      const msg = e?.response?.data?.message ?? 'Không thể sửa phương án';
      Alert.alert('Lỗi', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteOption = (optionId: string) => {
    Alert.alert('Xóa phương án', 'Bạn chắc chắn muốn xóa?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await chatServices.deletePollOption(poll._id, optionId);
          } catch (e: any) {
            const msg = e?.response?.data?.message ?? 'Không thể xóa phương án';
            Alert.alert('Lỗi', Array.isArray(msg) ? msg.join('\n') : String(msg));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleClose = () => {
    Alert.alert('Kết thúc bình chọn', 'Bạn chắc chắn muốn kết thúc?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Kết thúc',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await chatServices.closePoll(poll._id);
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message ?? 'Không thể kết thúc');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Xóa bình chọn', 'Hành động không thể hoàn tác.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await chatServices.deletePoll(poll._id);
          } catch (e: any) {
            Alert.alert('Lỗi', e?.message ?? 'Không thể xóa');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  // ── Voter modal ────────────────────────────────────────────────────────────
  const voterModalOpt = voterModalOptId
    ? poll.options.find((o) => o._id === voterModalOptId)
    : null;
  const voterList = voterModalOpt ? (!poll.hideVoters ? (voterModalOpt.voters ?? []) : []) : [];

  return (
    <View
      style={{
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        marginVertical: 4,
        marginHorizontal: 10,
        maxWidth: '88%',
        width: 320,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#f3f4f6',
          backgroundColor: '#f5f9ff',
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: '#0068FF22',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BarChart2 size={14} color="#0068FF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: '500' }}>
            Bình chọn · {creatorName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <Text style={{ fontSize: 10, color: '#9ca3af' }}>
              {poll.allowMultiple ? 'Chọn nhiều' : 'Chọn một'}
            </Text>
            {poll.expiresAt && (
              <Text style={{ fontSize: 10, color: '#9ca3af' }}>
                · {formatRemaining(poll.expiresAt)}
              </Text>
            )}
            {poll.isClosed && (
              <>
                <Lock size={9} color="#9ca3af" />
                <Text style={{ fontSize: 10, color: '#9ca3af' }}>Đã kết thúc</Text>
              </>
            )}
          </View>
        </View>
        {canManage && isActive && (
          <TouchableOpacity
            onPress={() => {
              setEditing((v) => !v);
              setEditQuestion(poll.question);
            }}
            style={{ padding: 4 }}
          >
            <Pencil size={14} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Question */}
      <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
        {editing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TextInput
              autoFocus
              value={editQuestion}
              onChangeText={setEditQuestion}
              maxLength={200}
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: '600',
                color: '#111827',
                backgroundColor: '#f9fafb',
                borderWidth: 1,
                borderColor: '#0068FF66',
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            />
            <TouchableOpacity
              onPress={handleEditQuestionSave}
              disabled={!editQuestion.trim() || editQuestion.trim() === poll.question || busy}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: '#0068FF',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !editQuestion.trim() || editQuestion.trim() === poll.question ? 0.4 : 1,
              }}
            >
              <Check size={12} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEditing(false)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: '#f3f4f6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={12} color="#6b7280" />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
            {optimisticQuestion ?? poll.question}
          </Text>
        )}
      </View>

      {/* Options */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 8, gap: 6 }}>
        {poll.options.map((opt) => {
          const selected = effectiveMyVotes.includes(opt._id);
          const pct =
            showResults && totalVoters > 0 ? Math.round((opt.voteCount / totalVoters) * 100) : 0;
          const isEditingThis = editingOptionId === opt._id;
          const canDeleteThis =
            canManage && isActive && poll.options.length > 2 && opt.voteCount === 0;
          const optVoters = showResults && !poll.hideVoters ? (opt.voters ?? []) : [];

          return (
            <View key={opt._id}>
              <TouchableOpacity
                onPress={() => {
                  if (!isEditingThis) handleToggleVote(opt._id);
                }}
                disabled={!isActive || busy || isEditingThis}
                activeOpacity={0.7}
                style={{
                  borderWidth: 1,
                  borderColor: selected ? '#0068FF' : '#e5e7eb',
                  borderRadius: 10,
                  overflow: 'hidden',
                  backgroundColor: selected ? '#0068FF0d' : '#fff',
                  opacity: isActive ? 1 : 0.85,
                }}
              >
                {showResults && (
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${pct}%`,
                      backgroundColor: selected ? '#0068FF1a' : '#f3f4f6',
                    }}
                  />
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 9,
                    gap: 8,
                  }}
                >
                  {/* Checkbox/radio */}
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: poll.allowMultiple ? 3 : 8,
                      borderWidth: 2,
                      borderColor: selected ? '#0068FF' : '#cbd5e1',
                      backgroundColor: selected ? '#0068FF' : '#fff',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selected && (
                      <View
                        style={{
                          width: poll.allowMultiple ? 7 : 6,
                          height: poll.allowMultiple ? 7 : 6,
                          borderRadius: poll.allowMultiple ? 1 : 3,
                          backgroundColor: '#fff',
                        }}
                      />
                    )}
                  </View>

                  {/* Text or inline edit */}
                  {isEditingThis ? (
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TextInput
                        autoFocus
                        value={editOptionText}
                        onChangeText={setEditOptionText}
                        maxLength={100}
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: '#111827',
                          backgroundColor: '#fff',
                          borderWidth: 1,
                          borderColor: '#0068FF66',
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        }}
                      />
                      <TouchableOpacity
                        onPress={handleUpdateOption}
                        disabled={
                          !editOptionText.trim() ||
                          editOptionText.trim() ===
                            (optimisticOptionTexts[editingOptionId ?? ''] ??
                              poll.options.find((o) => o._id === editingOptionId)?.text ??
                              '') ||
                          busy
                        }
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: '#0068FF',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity:
                            !editOptionText.trim() ||
                            editOptionText.trim() ===
                              (optimisticOptionTexts[editingOptionId ?? ''] ??
                                poll.options.find((o) => o._id === editingOptionId)?.text ??
                                '')
                              ? 0.4
                              : 1,
                        }}
                      >
                        <Check size={10} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setEditingOptionId(null)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: '#f3f4f6',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <X size={10} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={{ flex: 1, fontSize: 13, color: '#111827' }}>
                      {optimisticOptionTexts[opt._id] ?? opt.text}
                    </Text>
                  )}

                  {/* Vote count + avatar stack */}
                  {showResults && !isEditingThis && (
                    <TouchableOpacity
                      onPress={() => {
                        if (!poll.hideVoters && optVoters.length > 0) {
                          setVoterModalOptId(opt._id);
                        }
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      activeOpacity={optVoters.length > 0 ? 0.7 : 1}
                    >
                      {!poll.hideVoters && optVoters.length > 0 && (
                        <View style={{ flexDirection: 'row' }}>
                          {optVoters.slice(0, 3).map((uid, i) => {
                            const { name, avatar } = resolveVoterProfile(uid);
                            return (
                              <View
                                key={uid}
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 9,
                                  borderWidth: 1.5,
                                  borderColor: '#fff',
                                  marginLeft: i === 0 ? 0 : -5,
                                  zIndex: 3 - i,
                                  overflow: 'hidden',
                                  backgroundColor: '#dbeafe',
                                }}
                              >
                                {avatar ? (
                                  <Image
                                    source={{ uri: avatar }}
                                    style={{ width: '100%', height: '100%' }}
                                  />
                                ) : (
                                  <View
                                    style={{
                                      flex: 1,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Text
                                      style={{ fontSize: 7, fontWeight: '700', color: '#0068FF' }}
                                    >
                                      {name.charAt(0).toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: opt.voteCount > 0 ? '#0068FF' : '#9ca3af',
                        }}
                      >
                        {opt.voteCount}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Creator: edit/delete option */}
                  {canManage && isActive && !isEditingThis && (
                    <View style={{ flexDirection: 'row', gap: 2, marginLeft: 2 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingOptionId(opt._id);
                          setEditOptionText(opt.text);
                        }}
                        style={{ padding: 3 }}
                      >
                        <Pencil size={12} color="#9ca3af" />
                      </TouchableOpacity>
                      {canDeleteThis && (
                        <TouchableOpacity
                          onPress={() => handleDeleteOption(opt._id)}
                          disabled={busy}
                          style={{ padding: 3 }}
                        >
                          <Trash2 size={12} color="#f87171" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Add option */}
      {poll.allowAddOptions && isActive && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 14,
            paddingBottom: 8,
          }}
        >
          <TextInput
            value={newOptionText}
            onChangeText={setNewOptionText}
            placeholder="Thêm phương án..."
            placeholderTextColor="#9ca3af"
            maxLength={100}
            style={{
              flex: 1,
              backgroundColor: '#f9fafb',
              borderWidth: 1,
              borderColor: '#e5e7eb',
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              fontSize: 12,
              color: '#111827',
            }}
          />
          <TouchableOpacity
            onPress={handleAddOption}
            disabled={!newOptionText.trim() || busy}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: newOptionText.trim() ? '#0068FF22' : '#f3f4f6',
            }}
          >
            <Plus size={14} color={newOptionText.trim() ? '#0068FF' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      )}

      {/* Footer */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6',
          backgroundColor: '#fafafa',
        }}
      >
        <Text style={{ fontSize: 11, color: '#6b7280' }}>{totalVoters} người đã bình chọn</Text>
        {canManage && (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {isActive && (
              <TouchableOpacity
                onPress={handleClose}
                disabled={busy}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
              >
                <X size={11} color="#6b7280" />
                <Text style={{ fontSize: 11, color: '#374151' }}>Kết thúc</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleDelete}
              disabled={busy}
              style={{
                paddingHorizontal: 7,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: '#fef2f2',
              }}
            >
              <Trash2 size={11} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
        {busy && <ActivityIndicator size="small" color="#0068FF" />}
      </View>

      {/* Voter Modal */}
      <Modal
        visible={!!voterModalOptId}
        transparent
        animationType="fade"
        onRequestClose={() => setVoterModalOptId(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: '#00000040',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
          onPress={() => setVoterModalOptId(null)}
        >
          <Pressable
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              overflow: 'hidden',
              maxHeight: 360,
            }}
            onPress={() => {}}
          >
            {/* Modal header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#f3f4f6',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                Đã bình chọn · {voterList.length}
              </Text>
              <TouchableOpacity onPress={() => setVoterModalOptId(null)} style={{ padding: 2 }}>
                <X size={16} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Voter list */}
            <ScrollView style={{ maxHeight: 280 }}>
              {voterList.map((uid) => {
                const { name, avatar } = resolveVoterProfile(uid);
                const isMe = uid === user?.id;
                return (
                  <View
                    key={uid}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: '#f9fafb',
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        overflow: 'hidden',
                        backgroundColor: '#dbeafe',
                      }}
                    >
                      {avatar ? (
                        <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <View
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#0068FF' }}>
                            {name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' }}>
                      {name}
                    </Text>
                    {isMe && (
                      <View
                        style={{
                          backgroundColor: '#EBF3FF',
                          borderRadius: 10,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ fontSize: 10, color: '#0068FF', fontWeight: '600' }}>
                          Bạn
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
