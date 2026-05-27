import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, Calendar, User as UserIcon } from 'lucide-react-native';
import { chatServices } from '@/services/chatServices';
import type { Task, TaskPriority } from '@/types/task.type';
import type { Participant } from '@/types/chat';

interface Props {
  conversationId: string;
  members: Participant[];
  initial?: Task | null;
  onClose: () => void;
  onSaved?: (task: Task) => void;
}

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Thấp', color: '#6b7280' },
  { value: 'medium', label: 'Trung bình', color: '#3b82f6' },
  { value: 'high', label: 'Cao', color: '#ef4444' },
];

export default function CreateTaskModal({
  conversationId,
  members,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [assigneeId, setAssigneeId] = useState<string | null>(initial?.assigneeId ?? null);
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState<Date | null>(
    initial?.dueDate ? new Date(initial.dueDate) : null
  );
  const [dueDateStr, setDueDateStr] = useState<string>(() => {
    if (!initial?.dueDate) return '';
    const d = new Date(initial.dueDate);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberMap, setMemberMap] = useState<Record<string, { fullName: string; avatar?: string | null }>>({});

  const memberIds = useMemo(() => members.map((m) => m.userId), [members]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (memberIds.length === 0) return;
      try {
        const users = await chatServices.getUsersByIds(memberIds);
        if (cancelled) return;
        const map: Record<string, { fullName: string; avatar?: string | null }> = {};
        for (const u of users) map[u.id] = { fullName: u.fullName, avatar: u.avatar };
        setMemberMap(map);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberIds]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Lỗi', 'Tiêu đề không được trống');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId: assigneeId ?? null,
        priority,
        dueDate: dueDate ? dueDate.toISOString() : null,
      };
      let saved: Task;
      if (initial) {
        saved = (await chatServices.updateTask(initial._id, payload)) as Task;
      } else {
        saved = (await chatServices.createTask(conversationId, payload)) as Task;
      }
      onSaved?.(saved);
      onClose();
    } catch (e: any) {
      Alert.alert('Lỗi', e?.response?.data?.message ?? 'Không thể lưu công việc');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{initial ? 'Sửa công việc' : 'Tạo công việc'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={16} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <View>
              <Text style={styles.label}>Tiêu đề *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Việc cần làm..."
                style={styles.input}
                maxLength={200}
              />
            </View>

            <View>
              <Text style={styles.label}>Mô tả</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Chi tiết (tuỳ chọn)"
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                multiline
                maxLength={1000}
              />
            </View>

            <View>
              <Text style={styles.label}>Giao cho</Text>
              <TouchableOpacity
                onPress={() => setShowAssigneePicker((v) => !v)}
                style={styles.selectBtn}
              >
                <UserIcon size={14} color="#64748b" />
                <Text style={styles.selectText}>
                  {assigneeId ? (memberMap[assigneeId]?.fullName ?? 'Thành viên') : 'Chưa giao'}
                </Text>
              </TouchableOpacity>
              {showAssigneePicker && (
                <View style={styles.dropdown}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setAssigneeId(null);
                      setShowAssigneePicker(false);
                    }}
                  >
                    <Text style={styles.dropdownText}>— Không giao —</Text>
                  </TouchableOpacity>
                  {members.map((m) => (
                    <TouchableOpacity
                      key={m.userId}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setAssigneeId(m.userId);
                        setShowAssigneePicker(false);
                      }}
                    >
                      <Text style={styles.dropdownText}>
                        {memberMap[m.userId]?.fullName ?? m.userId}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View>
              <Text style={styles.label}>Ưu tiên</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PRIORITIES.map((p) => {
                  const active = priority === p.value;
                  return (
                    <TouchableOpacity
                      key={p.value}
                      onPress={() => setPriority(p.value)}
                      style={[
                        styles.priorityChip,
                        active && { backgroundColor: p.color, borderColor: p.color },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: active ? '#fff' : p.color,
                          fontWeight: '600',
                        }}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={styles.label}>Hạn chót</Text>
              <View style={styles.selectBtn}>
                <Calendar size={14} color="#64748b" />
                <TextInput
                  value={dueDateStr}
                  onChangeText={(s) => {
                    setDueDateStr(s);
                    // Try to parse: YYYY-MM-DD HH:mm
                    const m = s.match(
                      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/
                    );
                    if (m) {
                      const d = new Date(
                        Number(m[1]),
                        Number(m[2]) - 1,
                        Number(m[3]),
                        Number(m[4]),
                        Number(m[5])
                      );
                      if (!isNaN(d.getTime())) setDueDate(d);
                    } else if (s.trim() === '') {
                      setDueDate(null);
                    }
                  }}
                  placeholder="YYYY-MM-DD HH:mm"
                  style={{ flex: 1, fontSize: 14, color: '#111827' }}
                />
              </View>
              {dueDate && (
                <TouchableOpacity
                  onPress={() => {
                    setDueDate(null);
                    setDueDateStr('');
                  }}
                >
                  <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>Xoá hạn</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={[styles.btn, styles.btnSecondary]}>
              <Text style={{ color: '#374151', fontWeight: '600' }}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={saving}
              style={[styles.btn, styles.btnPrimary, saving && { opacity: 0.6 }]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {initial ? 'Lưu' : 'Tạo'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
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
  title: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectText: { fontSize: 14, color: '#111827' },
  dropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    maxHeight: 180,
    backgroundColor: '#f9fafb',
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dropdownText: { fontSize: 13, color: '#111827' },
  priorityChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: { backgroundColor: '#f3f4f6' },
  btnPrimary: { backgroundColor: '#2563eb' },
});
