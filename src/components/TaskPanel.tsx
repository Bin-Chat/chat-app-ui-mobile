import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { X, CheckSquare, Square, Pencil, Trash2, Calendar, User as UserIcon } from 'lucide-react-native';
import { chatServices } from '@/services/chatServices';
import type { Task, TaskStatus, TaskPriority } from '@/types/task.type';
import type { Participant } from '@/types/chat';
import CreateTaskModal from './CreateTaskModal';

interface Props {
  conversationId: string;
  currentUserId: string;
  members: Participant[];
  isAdmin?: boolean;
  onClose: () => void;
}

const STATUS_TABS: { key: 'all' | TaskStatus; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'todo', label: 'Chưa làm' },
  { key: 'in_progress', label: 'Đang làm' },
  { key: 'done', label: 'Hoàn thành' },
];

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: '#6b7280',
  medium: '#3b82f6',
  high: '#ef4444',
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Thấp',
  medium: 'TB',
  high: 'Cao',
};

function sortTasks(list: Task[]): Task[] {
  const order: Record<TaskStatus, number> = { todo: 0, in_progress: 1, done: 2 };
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return order[a.status] - order[b.status];
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default function TaskPanel({
  conversationId,
  currentUserId,
  members,
  isAdmin,
  onClose,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | TaskStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Task | null>(null);
  const [memberMap, setMemberMap] = useState<Record<string, { fullName: string }>>({});

  const memberIds = useMemo(() => members.map((m) => m.userId), [members]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (memberIds.length === 0) return;
      try {
        const users = await chatServices.getUsersByIds(memberIds);
        if (cancelled) return;
        const map: Record<string, { fullName: string }> = {};
        for (const u of users) map[u.id] = { fullName: u.fullName };
        setMemberMap(map);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberIds]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatServices.getTasks(conversationId);
      setTasks(sortTasks(data as Task[]));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const subCreated = DeviceEventEmitter.addListener('task:created', (data) => {
      if (data.conversationId !== conversationId || !data.task) return;
      setTasks((prev) => {
        if (prev.some((t) => t._id === data.task._id)) return prev;
        return sortTasks([...prev, data.task]);
      });
    });
    const subBatch = DeviceEventEmitter.addListener('task:batch_created', (data) => {
      if (data.conversationId !== conversationId || !Array.isArray(data.tasks)) return;
      setTasks((prev) => {
        const existing = new Set(prev.map((t) => t._id));
        const next = [...prev];
        for (const t of data.tasks) if (!existing.has(t._id)) next.push(t);
        return sortTasks(next);
      });
    });
    const subUpdated = DeviceEventEmitter.addListener('task:updated', (data) => {
      if (data.conversationId !== conversationId || !data.task) return;
      setTasks((prev) => sortTasks(prev.map((t) => (t._id === data.task._id ? data.task : t))));
    });
    const subCompleted = DeviceEventEmitter.addListener('task:completed', (data) => {
      if (data.conversationId !== conversationId || !data.task) return;
      setTasks((prev) => sortTasks(prev.map((t) => (t._id === data.task._id ? data.task : t))));
    });
    const subDeleted = DeviceEventEmitter.addListener('task:deleted', (data) => {
      if (data.conversationId !== conversationId) return;
      setTasks((prev) => prev.filter((t) => t._id !== data.taskId));
    });
    return () => {
      subCreated.remove();
      subBatch.remove();
      subUpdated.remove();
      subCompleted.remove();
      subDeleted.remove();
    };
  }, [conversationId]);

  const counts = useMemo(() => {
    const c = { all: tasks.length, todo: 0, in_progress: 0, done: 0 };
    for (const t of tasks) c[t.status]++;
    return c;
  }, [tasks]);

  const filtered = useMemo(() => {
    if (tab === 'all') return tasks;
    return tasks.filter((t) => t.status === tab);
  }, [tasks, tab]);

  const handleToggle = useCallback(
    async (task: Task) => {
      const canToggle =
        task.assigneeId === currentUserId || task.createdBy === currentUserId || isAdmin;
      if (!canToggle) {
        Alert.alert('Không có quyền', 'Bạn không thể đánh dấu công việc này.');
        return;
      }
      try {
        if (task.status === 'done') {
          const updated = (await chatServices.updateTask(task._id, {
            status: 'todo',
          })) as Task;
          setTasks((prev) => sortTasks(prev.map((t) => (t._id === task._id ? updated : t))));
        } else {
          const updated = (await chatServices.completeTask(task._id)) as Task;
          setTasks((prev) => sortTasks(prev.map((t) => (t._id === task._id ? updated : t))));
        }
      } catch (e: any) {
        Alert.alert('Lỗi', e?.response?.data?.message ?? 'Không thể cập nhật');
      }
    },
    [currentUserId, isAdmin]
  );

  const handleDelete = useCallback((task: Task) => {
    Alert.alert('Xoá công việc', `Xoá "${task.title}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          try {
            await chatServices.deleteTask(task._id);
            setTasks((prev) => prev.filter((t) => t._id !== task._id));
          } catch (e: any) {
            Alert.alert('Lỗi', e?.response?.data?.message ?? 'Không thể xoá');
          }
        },
      },
    ]);
  }, []);

  const handleSaved = useCallback((task: Task) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t._id === task._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = task;
        return sortTasks(next);
      }
      return sortTasks([...prev, task]);
    });
  }, []);

  const renderItem = ({ item }: { item: Task }) => {
    const done = item.status === 'done';
    const overdue =
      !done && item.dueDate && new Date(item.dueDate).getTime() < Date.now();
    const canDelete = item.createdBy === currentUserId || isAdmin;
    const assigneeName = item.assigneeId ? memberMap[item.assigneeId]?.fullName : null;
    return (
      <View style={[styles.item, overdue && styles.itemOverdue, done && { opacity: 0.7 }]}>
        <TouchableOpacity onPress={() => handleToggle(item)} style={styles.checkBtn}>
          {done ? (
            <CheckSquare size={20} color="#22c55e" />
          ) : (
            <Square size={20} color="#94a3b8" />
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.itemTitle,
              done && { textDecorationLine: 'line-through', color: '#9ca3af' },
            ]}
          >
            {item.title}
          </Text>
          {item.description ? (
            <Text style={styles.itemDesc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View
              style={[
                styles.priorityPill,
                { backgroundColor: PRIORITY_COLOR[item.priority] + '20' },
              ]}
            >
              <Text style={{ color: PRIORITY_COLOR[item.priority], fontSize: 10, fontWeight: '600' }}>
                {PRIORITY_LABEL[item.priority]}
              </Text>
            </View>
            {assigneeName && (
              <View style={styles.metaChip}>
                <UserIcon size={10} color="#64748b" />
                <Text style={styles.metaChipText}>{assigneeName}</Text>
              </View>
            )}
            {item.dueDate && (
              <View style={[styles.metaChip, overdue && { backgroundColor: '#fee2e2' }]}>
                <Calendar size={10} color={overdue ? '#ef4444' : '#64748b'} />
                <Text style={[styles.metaChipText, overdue && { color: '#ef4444' }]}>
                  {new Date(item.dueDate).toLocaleString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'column', gap: 4 }}>
          {(item.createdBy === currentUserId || isAdmin) && (
            <TouchableOpacity onPress={() => setEditTarget(item)} style={styles.iconBtn}>
              <Pencil size={14} color="#64748b" />
            </TouchableOpacity>
          )}
          {canDelete && (
            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
              <Trash2 size={14} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <CheckSquare size={16} color="#2563eb" />
              <Text style={styles.title}>Công việc</Text>
              {counts.all > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{counts.all}</Text>
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addBtn}>
                <Text style={styles.addBtnText}>+ Tạo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={14} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tabs}>
            {STATUS_TABS.map((t) => {
              const active = tab === t.key;
              const c = (counts as any)[t.key];
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active && { color: '#2563eb' }]}>
                    {t.label} ({c})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#2563eb" />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.center}>
              <CheckSquare size={40} color="#94a3b8" style={{ opacity: 0.6, marginBottom: 12 }} />
              <Text style={styles.emptyText}>Chưa có công việc</Text>
              <TouchableOpacity onPress={() => setShowCreate(true)}>
                <Text style={styles.emptyLink}>Tạo công việc đầu tiên</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item._id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 12 }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          )}
        </View>
      </View>

      {showCreate && (
        <CreateTaskModal
          conversationId={conversationId}
          members={members}
          onClose={() => setShowCreate(false)}
          onSaved={handleSaved}
        />
      )}
      {editTarget && (
        <CreateTaskModal
          conversationId={conversationId}
          members={members}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '55%',
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
  badge: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { color: '#fff', fontSize: 11 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  tabActive: { backgroundColor: '#dbeafe' },
  tabText: { fontSize: 11, color: '#475569', fontWeight: '500' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: '#64748b', fontSize: 13, marginBottom: 10 },
  emptyLink: { color: '#2563eb', fontSize: 12 },
  item: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fafafa',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'flex-start',
  },
  itemOverdue: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  checkBtn: { paddingTop: 2 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  priorityPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaChipText: { fontSize: 10, color: '#475569' },
  iconBtn: { padding: 6 },
});
