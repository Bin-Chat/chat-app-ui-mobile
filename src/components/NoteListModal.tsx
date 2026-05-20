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
import { X, Pencil, Trash2, Pin, PinOff, StickyNote } from 'lucide-react-native';
import { chatServices } from '@/services/chatServices';
import type { Note } from '@/types/note.type';
import CreateNoteModal from './CreateNoteModal';

interface Props {
  conversationId: string;
  currentUserId: string;
  isAdmin?: boolean;
  onClose: () => void;
}

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Hôm nay ${time}`;
  return (
    d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    time
  );
}

export default function NoteListModal({ conversationId, currentUserId, isAdmin, onClose }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Note | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatServices.getNotes(conversationId);
      setNotes(sortNotes(data as Note[]));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  // Listen socket events
  useEffect(() => {
    const subCreated = DeviceEventEmitter.addListener('note:created', (data) => {
      if (data.conversationId !== conversationId || !data.note) return;
      setNotes((prev) => {
        if (prev.some((n) => n._id === data.note._id)) return prev;
        return sortNotes([...prev, data.note]);
      });
    });
    const subUpdated = DeviceEventEmitter.addListener('note:updated', (data) => {
      if (data.conversationId !== conversationId || !data.note) return;
      setNotes((prev) => {
        const idx = prev.findIndex((n) => n._id === data.note._id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data.note;
          return sortNotes(next);
        }
        return sortNotes([...prev, data.note]);
      });
    });
    const subDeleted = DeviceEventEmitter.addListener('note:deleted', (data) => {
      if (data.conversationId !== conversationId) return;
      setNotes((prev) => prev.filter((n) => n._id !== data.noteId));
    });
    return () => {
      subCreated.remove();
      subUpdated.remove();
      subDeleted.remove();
    };
  }, [conversationId]);

  const handleSaved = useCallback(
    (note: Note) => {
      setNotes((prev) => {
        const idx = prev.findIndex((n) => n._id === note._id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = note;
          return sortNotes(next);
        }
        return sortNotes([...prev, note]);
      });
      DeviceEventEmitter.emit('note:updated', { conversationId, note });
      setShowCreate(false);
      setEditTarget(null);
    },
    [conversationId]
  );

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert('Xóa ghi chú', 'Bạn có chắc muốn xóa ghi chú này?', [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatServices.deleteNote(id);
              setNotes((prev) => prev.filter((n) => n._id !== id));
              DeviceEventEmitter.emit('note:deleted', { conversationId, noteId: id });
            } catch {
              Alert.alert('Lỗi', 'Không thể xóa ghi chú.');
            }
          },
        },
      ]);
    },
    [conversationId]
  );

  const handleTogglePin = useCallback(async (note: Note) => {
    try {
      const updated = (await chatServices.updateNote(note._id, {
        isPinned: !note.isPinned,
      })) as Note;
      setNotes((prev) => sortNotes(prev.map((n) => (n._id === updated._id ? updated : n))));
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật ghi chú.');
    }
  }, []);

  const pinnedCount = notes.filter((n) => n.isPinned).length;
  const MAX_PINNED = 3;

  const renderItem = ({ item }: { item: Note }) => {
    const isOwner = item.createdBy === currentUserId;
    const canModify = isOwner || !!isAdmin;
    const pinDisabled = !item.isPinned && pinnedCount >= MAX_PINNED;
    return (
      <View style={[styles.item, item.isPinned && styles.itemPinned]}>
        {item.isPinned && (
          <View style={styles.pinnedBadge}>
            <Pin size={10} color="#b45309" />
            <Text style={styles.pinnedBadgeText}>Đã ghim</Text>
          </View>
        )}
        <Text style={styles.itemContent}>{item.content}</Text>
        <View style={styles.itemFooter}>
          <Text style={styles.itemTime}>{formatDate(item.updatedAt)}</Text>
          <View style={styles.itemActions}>
            {canModify && (
              <TouchableOpacity
                onPress={() => !pinDisabled && handleTogglePin(item)}
                style={[styles.actionBtn, pinDisabled && { opacity: 0.3 }]}
                disabled={pinDisabled}
              >
                {item.isPinned ? (
                  <PinOff size={15} color="#64748b" />
                ) : (
                  <Pin size={15} color={pinDisabled ? '#94a3b8' : '#64748b'} />
                )}
              </TouchableOpacity>
            )}
            {isOwner && (
              <TouchableOpacity onPress={() => setEditTarget(item)} style={styles.actionBtn}>
                <Pencil size={15} color="#64748b" />
              </TouchableOpacity>
            )}
            {canModify && (
              <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.actionBtn}>
                <Trash2 size={15} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
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
              <StickyNote size={16} color="#f59e0b" />
              <Text style={styles.title}>Ghi chú</Text>
              {notes.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notes.length}</Text>
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

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#f59e0b" />
            </View>
          ) : notes.length === 0 ? (
            <View style={styles.center}>
              <StickyNote size={40} color="#94a3b8" style={{ opacity: 0.6, marginBottom: 12 }} />
              <Text style={styles.emptyText}>Chưa có ghi chú nào</Text>
              <TouchableOpacity onPress={() => setShowCreate(true)}>
                <Text style={styles.emptyLink}>Tạo ghi chú đầu tiên</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={notes}
              keyExtractor={(item) => item._id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 12 }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          )}
        </View>
      </View>

      {showCreate && (
        <CreateNoteModal
          conversationId={conversationId}
          pinnedCount={pinnedCount}
          onClose={() => setShowCreate(false)}
          onSaved={handleSaved}
        />
      )}
      {editTarget && (
        <CreateNoteModal
          conversationId={conversationId}
          initialNote={editTarget}
          pinnedCount={pinnedCount}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </Modal>
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
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { color: '#fff', fontSize: 11 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: {
    backgroundColor: '#f59e0b',
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
  emptyLink: { color: '#f59e0b', fontSize: 12 },
  item: {
    backgroundColor: '#fafafa',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemPinned: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  pinnedBadgeText: { color: '#b45309', fontSize: 10, fontWeight: '500' },
  itemContent: { color: '#111827', fontSize: 14, lineHeight: 20 },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  itemTime: { color: '#9ca3af', fontSize: 11 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtn: { padding: 6 },
});
