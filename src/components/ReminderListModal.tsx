import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
} from 'react-native';
import { X, Pencil, Trash2, CheckCircle2, Circle, Bell, Clock } from 'lucide-react-native';
import { chatServices } from '@/services/chatServices';
import CreateReminderModal from './CreateReminderModal';

type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly';

interface Reminder {
  _id: string;
  conversationId: string;
  createdBy: string;
  content: string;
  remindAt: string;
  repeat: RepeatType;
  isCompleted: boolean;
  lastFiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  conversationId: string;
  currentUserId: string;
  onClose: () => void;
}

const REPEAT_LABEL: Record<RepeatType, string> = {
  none: '',
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
};

function formatRemindAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();

  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hôm nay lúc ${timeStr}`;
  if (isTomorrow) return `Ngày mai lúc ${timeStr}`;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReminderListModal({ conversationId, currentUserId, onClose }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Reminder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatServices.getReminders(conversationId);
      setReminders(
        (data as Reminder[]).sort(
          (a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()
        )
      );
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  // Sync with socket events from the other user (via DeviceEventEmitter from useChatSocket)
  useEffect(() => {
    const subUpdated = DeviceEventEmitter.addListener('reminder:updated', (data) => {
      const reminder: Reminder = data.reminder;
      if (!reminder) return;
      setReminders((prev) => {
        const idx = prev.findIndex((r) => r._id === reminder._id);
        let next: Reminder[];
        if (idx >= 0) {
          next = [...prev];
          next[idx] = reminder;
        } else if (reminder.conversationId === conversationId) {
          next = [...prev, reminder];
        } else {
          return prev;
        }
        return next.sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());
      });
    });
    const subDeleted = DeviceEventEmitter.addListener('reminder:deleted', (data) => {
      if (data.reminderId) setReminders((prev) => prev.filter((r) => r._id !== data.reminderId));
    });
    return () => {
      subUpdated.remove();
      subDeleted.remove();
    };
  }, [conversationId]);

  const handleSaved = useCallback((reminder: Reminder) => {
    setReminders((prev) => {
      const idx = prev.findIndex((r) => r._id === reminder._id);
      let next: Reminder[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = reminder;
      } else {
        next = [...prev, reminder];
      }
      return next.sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());
    });
    DeviceEventEmitter.emit('reminder:updated', { reminder });
    setShowCreate(false);
    setEditTarget(null);
  }, []);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Xóa nhắc hẹn', 'Bạn có chắc muốn xóa nhắc hẹn này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await chatServices.deleteReminder(id);
            setReminders((prev) => prev.filter((r) => r._id !== id));
            DeviceEventEmitter.emit('reminder:deleted', { reminderId: id });
          } catch {
            Alert.alert('Lỗi', 'Không thể xóa nhắc hẹn.');
          }
        },
      },
    ]);
  }, []);

  const handleComplete = useCallback(async (reminder: Reminder) => {
    if (reminder.isCompleted) return;
    try {
      const updated = (await chatServices.completeReminder(reminder._id)) as Reminder;
      setReminders((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
    } catch {
      Alert.alert('Lỗi', 'Không thể đánh dấu hoàn thành.');
    }
  }, []);

  const pending = reminders.filter((r) => !r.isCompleted);
  const completed = reminders.filter((r) => r.isCompleted);

  const renderItem = ({ item }: { item: Reminder }) => {
    const isOwner = item.createdBy === currentUserId;
    const isPast = !item.isCompleted && new Date(item.remindAt) < new Date();
    return (
      <View
        style={[styles.item, item.isCompleted && styles.itemCompleted, isPast && styles.itemPast]}
      >
        <TouchableOpacity
          onPress={() => handleComplete(item)}
          disabled={item.isCompleted}
          style={styles.checkBtn}
        >
          {item.isCompleted ? (
            <CheckCircle2 size={18} color="#22c55e" />
          ) : (
            <Circle size={18} color={isPast ? '#f87171' : '#94a3b8'} />
          )}
        </TouchableOpacity>
        <View style={styles.itemBody}>
          <Text style={[styles.itemContent, item.isCompleted && styles.itemContentDone]}>
            {item.content}
          </Text>
          <View style={styles.itemMeta}>
            <Text style={[styles.itemTime, isPast && !item.isCompleted && { color: '#f87171' }]}>
              {formatRemindAt(item.remindAt)}
            </Text>
            {item.repeat !== 'none' && (
              <Text style={styles.repeatBadge}>↻ {REPEAT_LABEL[item.repeat]}</Text>
            )}
          </View>
        </View>
        {isOwner && !item.isCompleted && (
          <TouchableOpacity onPress={() => setEditTarget(item)} style={styles.actionBtn}>
            <Pencil size={15} color="#64748b" />
          </TouchableOpacity>
        )}
        {isOwner && (
          <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.actionBtn}>
            <Trash2 size={15} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <>
      <Modal visible transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Bell size={16} color="#2563eb" />
                <Text style={styles.title}>Danh sách nhắc hẹn</Text>
                {pending.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pending.length}</Text>
                  </View>
                )}
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addBtn}>
                  <Text style={styles.addBtnText}>+ Thêm</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={14} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Body */}
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color="#3b82f6" />
              </View>
            ) : reminders.length === 0 ? (
              <View style={styles.center}>
                <Bell size={40} color="#94a3b8" style={{ opacity: 0.6, marginBottom: 12 }} />
                <Text style={styles.emptyText}>Chưa có nhắc hẹn nào</Text>
                <TouchableOpacity onPress={() => setShowCreate(true)}>
                  <Text style={styles.emptyLink}>Tạo nhắc hẹn đầu tiên</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={[
                  { _id: '__pending_header__' } as unknown as Reminder,
                  ...pending,
                  ...(completed.length > 0
                    ? [{ _id: '__separator__' } as unknown as Reminder, ...completed]
                    : []),
                ]}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => {
                  if (item._id === '__pending_header__') {
                    return (
                      <View style={styles.sectionLabelRow}>
                        <Clock size={11} color="#64748b" />
                        <Text style={styles.sectionLabel}>Sắp đến ({pending.length})</Text>
                      </View>
                    );
                  }
                  if (item._id === '__separator__') {
                    return (
                      <View style={styles.sectionLabelRow}>
                        <CheckCircle2 size={11} color="#64748b" />
                        <Text style={styles.sectionLabel}>Đã hoàn thành ({completed.length})</Text>
                      </View>
                    );
                  }
                  return renderItem({ item });
                }}
                contentContainerStyle={{ paddingVertical: 8 }}
              />
            )}
          </View>
        </View>

        {showCreate && (
          <CreateReminderModal
            conversationId={conversationId}
            onClose={() => setShowCreate(false)}
            onSaved={handleSaved}
          />
        )}
        {editTarget && (
          <CreateReminderModal
            conversationId={conversationId}
            initialReminder={editTarget}
            onClose={() => setEditTarget(null)}
            onSaved={handleSaved}
          />
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: '80%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
  badge: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { color: '#fff', fontSize: 11 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: '#64748b', fontSize: 13, marginBottom: 10 },
  emptyLink: { color: '#60a5fa', fontSize: 12 },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemCompleted: { opacity: 0.65 },
  itemPast: { backgroundColor: 'rgba(239,68,68,0.06)' },
  checkBtn: { marginRight: 10, marginTop: 2 },
  itemBody: { flex: 1 },
  itemContent: { color: '#111827', fontSize: 13, lineHeight: 18 },
  itemContentDone: { textDecorationLine: 'line-through', color: '#9ca3af' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  itemTime: { color: '#6b7280', fontSize: 11 },
  repeatBadge: { color: '#60a5fa', fontSize: 10 },
  actionBtn: { padding: 6 },
  actionIcon: { fontSize: 14 },
});
