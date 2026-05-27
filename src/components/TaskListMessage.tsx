import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, DeviceEventEmitter, Alert } from 'react-native';
import { CheckSquare, Square, ListChecks, Calendar, User as UserIcon } from 'lucide-react-native';
import { chatServices } from '@/services/chatServices';
import type { Task, TaskPriority } from '@/types/task.type';

interface TaskMetadataItem {
  taskId: string;
  title: string;
  assigneeId?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
}

interface Props {
  conversationId: string;
  currentUserId: string;
  isAdmin?: boolean;
  metadata: {
    type: 'task_list_created';
    batchId?: string;
    actorName?: string;
    createdBy?: string;
    tasks?: TaskMetadataItem[];
  };
}

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: '#6b7280',
  medium: '#3b82f6',
  high: '#ef4444',
};

export default function TaskListMessage({
  conversationId,
  currentUserId,
  isAdmin,
  metadata,
}: Props) {
  const initialIds = useMemo(
    () => (metadata.tasks ?? []).map((t) => t.taskId),
    [metadata.tasks]
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (initialIds.length === 0) {
      setLoading(false);
      return;
    }
    try {
      const all = (await chatServices.getTasks(conversationId)) as Task[];
      const idSet = new Set(initialIds);
      setTasks(all.filter((t) => idSet.has(t._id)));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [conversationId, initialIds]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const idSet = new Set(initialIds);
    const subUpdated = DeviceEventEmitter.addListener('task:updated', (data) => {
      if (data.conversationId !== conversationId || !data.task) return;
      if (!idSet.has(data.task._id)) return;
      setTasks((prev) => prev.map((t) => (t._id === data.task._id ? data.task : t)));
    });
    const subCompleted = DeviceEventEmitter.addListener('task:completed', (data) => {
      if (data.conversationId !== conversationId || !data.task) return;
      if (!idSet.has(data.task._id)) return;
      setTasks((prev) => prev.map((t) => (t._id === data.task._id ? data.task : t)));
    });
    const subDeleted = DeviceEventEmitter.addListener('task:deleted', (data) => {
      if (data.conversationId !== conversationId) return;
      if (!idSet.has(data.taskId)) return;
      setTasks((prev) => prev.filter((t) => t._id !== data.taskId));
    });
    return () => {
      subUpdated.remove();
      subCompleted.remove();
      subDeleted.remove();
    };
  }, [conversationId, initialIds]);

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
          const updated = (await chatServices.updateTask(task._id, { status: 'todo' })) as Task;
          setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)));
        } else {
          const updated = (await chatServices.completeTask(task._id)) as Task;
          setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)));
        }
      } catch (e: any) {
        Alert.alert('Lỗi', e?.response?.data?.message ?? 'Không thể cập nhật');
      }
    },
    [currentUserId, isAdmin]
  );

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const total = tasks.length || (metadata.tasks?.length ?? 0);

  return (
    <View style={styles.container}>
      <View style={styles.headerStripe} />
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <ListChecks size={16} color="#2563eb" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tag}>DANH SÁCH CÔNG VIỆC</Text>
          <Text style={styles.title} numberOfLines={1}>
            {metadata.actorName ?? 'Bot'} đã tạo {total} công việc
          </Text>
        </View>
        {total > 0 && (
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>
              {doneCount}/{total}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <Text style={styles.empty}>Đang tải...</Text>
      ) : tasks.length === 0 ? (
        <Text style={styles.empty}>Công việc đã bị xoá</Text>
      ) : (
        <View style={{ paddingHorizontal: 12, paddingBottom: 10, gap: 6 }}>
          {tasks.map((task) => {
            const done = task.status === 'done';
            return (
              <TouchableOpacity
                key={task._id}
                onPress={() => handleToggle(task)}
                style={[styles.row, done && { opacity: 0.7 }]}
              >
                {done ? (
                  <CheckSquare size={16} color="#22c55e" />
                ) : (
                  <Square size={16} color="#94a3b8" />
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.rowTitle,
                      done && { textDecorationLine: 'line-through', color: '#9ca3af' },
                    ]}
                    numberOfLines={2}
                  >
                    {task.title}
                  </Text>
                  <View style={styles.metaRow}>
                    <View
                      style={[
                        styles.priorityDot,
                        { backgroundColor: PRIORITY_COLOR[task.priority] },
                      ]}
                    />
                    {task.assigneeId && (
                      <View style={styles.metaChip}>
                        <UserIcon size={9} color="#64748b" />
                        <Text style={styles.metaChipText} numberOfLines={1}>
                          {task.assigneeId === currentUserId ? 'Tôi' : 'Đã giao'}
                        </Text>
                      </View>
                    )}
                    {task.dueDate && (
                      <View style={styles.metaChip}>
                        <Calendar size={9} color="#64748b" />
                        <Text style={styles.metaChipText}>
                          {new Date(task.dueDate).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    alignSelf: 'center',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  headerStripe: { height: 3, backgroundColor: '#2563eb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    fontSize: 9,
    color: '#2563eb',
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: { fontSize: 12, color: '#374151', fontWeight: '500' },
  progressBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  progressText: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
  empty: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  rowTitle: { fontSize: 13, color: '#111827', fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaChipText: { fontSize: 9, color: '#475569' },
});
