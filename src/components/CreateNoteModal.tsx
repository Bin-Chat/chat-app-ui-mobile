import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { chatServices } from '@/services/chatServices';
import type { Note } from '@/types/note.type';

interface Props {
  conversationId: string;
  initialNote?: Note;
  pinnedCount?: number;
  onClose: () => void;
  onSaved: (note: Note) => void;
}

const MAX_LEN = 2000;
const MAX_PINNED = 3;

export default function CreateNoteModal({
  conversationId,
  initialNote,
  pinnedCount = 0,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!initialNote;
  const [content, setContent] = useState(initialNote?.content ?? '');
  const [isPinned, setIsPinned] = useState(initialNote?.isPinned ?? false);
  const [submitting, setSubmitting] = useState(false);

  // Disable pin if at limit — unless this note is already pinned
  const pinLimitReached = pinnedCount >= MAX_PINNED && !initialNote?.isPinned;

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      Alert.alert('Lỗi', 'Vui lòng nhập nội dung ghi chú.');
      return;
    }
    setSubmitting(true);
    try {
      let result: Note;
      if (isEdit) {
        result = (await chatServices.updateNote(initialNote!._id, {
          content: trimmed,
          isPinned,
        })) as Note;
      } else {
        result = (await chatServices.createNote(conversationId, {
          content: trimmed,
          isPinned,
        })) as Note;
      }
      onSaved(result);
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu ghi chú. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>{isEdit ? 'Chỉnh sửa ghi chú' : 'Tạo ghi chú'}</Text>

          <View style={styles.inputBox}>
            <TextInput
              value={content}
              onChangeText={(v) => setContent(v.slice(0, MAX_LEN))}
              placeholder="Nhập nội dung ghi chú..."
              placeholderTextColor="#6b7280"
              multiline
              autoFocus
              style={styles.input}
              maxLength={MAX_LEN}
            />
            <Text style={styles.counter}>
              {content.length}/{MAX_LEN}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => !pinLimitReached && setIsPinned((p) => !p)}
            style={[styles.checkboxRow, pinLimitReached && { opacity: 0.5 }]}
            activeOpacity={pinLimitReached ? 1 : 0.7}
            disabled={pinLimitReached}
          >
            <View style={[styles.checkbox, isPinned && styles.checkboxOn]}>
              {isPinned && <Check size={14} color="#fff" />}
            </View>
            <Text style={styles.checkboxLabel}>Ghim lên đầu trò chuyện</Text>
            {pinLimitReached && <Text style={styles.pinLimitText}>Đã ghim tối đa 3</Text>}
          </TouchableOpacity>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              style={[styles.btn, styles.btnGhost]}
            >
              <Text style={styles.btnGhostText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting || !content.trim()}
              style={[
                styles.btn,
                styles.btnPrimary,
                (submitting || !content.trim()) && { opacity: 0.6 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>{isEdit ? 'Lưu' : 'Tạo ghi chú'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: { color: '#111827', fontSize: 16, fontWeight: '600', marginBottom: 14 },
  inputBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 14,
  },
  input: {
    color: '#111827',
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    padding: 0,
  },
  counter: { color: '#9ca3af', fontSize: 11, textAlign: 'right', marginTop: 6 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkboxLabel: { color: '#374151', fontSize: 13, flex: 1 },
  pinLimitText: { color: '#d97706', fontSize: 11, fontWeight: '500' as const },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  btnGhost: { backgroundColor: 'transparent' },
  btnGhostText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  btnPrimary: { backgroundColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
