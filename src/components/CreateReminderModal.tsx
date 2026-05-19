import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { chatServices } from '@/services/chatServices';

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
  initialReminder?: Reminder;
  onClose: () => void;
  onSaved: (reminder: Reminder) => void;
}

const PRESETS = [
  { label: '15 phút', minutes: 15 },
  { label: '30 phút', minutes: 30 },
  { label: '9h sáng mai', minutes: -1 },
  { label: 'Tuỳ chọn', minutes: -2 },
];

const REPEATS: { label: string; value: RepeatType }[] = [
  { label: 'Không lặp', value: 'none' },
  { label: 'Hàng ngày', value: 'daily' },
  { label: 'Hàng tuần', value: 'weekly' },
  { label: 'Hàng tháng', value: 'monthly' },
];

function addMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function get9amTomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function toLocalDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeInput(s: string): Date {
  return new Date(s);
}

export default function CreateReminderModal({
  conversationId,
  initialReminder,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!initialReminder;
  const [content, setContent] = useState(initialReminder?.content ?? '');
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [customDateStr, setCustomDateStr] = useState('');
  const [repeat, setRepeat] = useState<RepeatType>(initialReminder?.repeat ?? 'none');
  const [saving, setSaving] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);

  useEffect(() => {
    if (initialReminder) {
      const d = new Date(initialReminder.remindAt);
      setCustomDateStr(toLocalDateTimeInput(d));
      setActivePreset(-2);
    } else {
      // default: 30 min
      const d = addMinutes(30);
      setCustomDateStr(toLocalDateTimeInput(d));
      setActivePreset(1);
    }
  }, []);

  const handlePreset = (idx: number, minutes: number) => {
    setActivePreset(idx);
    if (minutes === -2) return; // custom — user types manually
    if (minutes === -1) {
      setCustomDateStr(toLocalDateTimeInput(get9amTomorrow()));
    } else {
      setCustomDateStr(toLocalDateTimeInput(addMinutes(minutes)));
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập nội dung nhắc hẹn.');
      return;
    }
    const remindAt = fromLocalDateTimeInput(customDateStr);
    if (isNaN(remindAt.getTime()) || remindAt <= new Date()) {
      Alert.alert('Lỗi', 'Thời gian nhắc hẹn phải ở tương lai.');
      return;
    }
    setSaving(true);
    try {
      let result: Reminder;
      if (isEdit) {
        result = await chatServices.updateReminder(initialReminder!._id, {
          content: content.trim(),
          remindAt: remindAt.toISOString(),
          repeat,
        });
      } else {
        result = await chatServices.createReminder(conversationId, {
          content: content.trim(),
          remindAt: remindAt.toISOString(),
          repeat,
        });
      }
      onSaved(result);
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu nhắc hẹn. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const repeatLabel = REPEATS.find((r) => r.value === repeat)?.label ?? 'Không lặp';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? 'Sửa nhắc hẹn' : 'Tạo nhắc hẹn'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {/* Content */}
            <Text style={styles.label}>Nội dung</Text>
            <TextInput
              style={styles.textArea}
              value={content}
              onChangeText={setContent}
              placeholder="Nhập nội dung nhắc hẹn..."
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Presets */}
            <Text style={styles.label}>Thời gian</Text>
            <View style={styles.presetRow}>
              {PRESETS.map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.presetBtn, activePreset === idx && styles.presetBtnActive]}
                  onPress={() => handlePreset(idx, p.minutes)}
                >
                  <Text
                    style={[styles.presetText, activePreset === idx && styles.presetTextActive]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date/Time text input */}
            <Text style={[styles.label, { marginTop: 8 }]}>Ngày giờ (YYYY-MM-DDThh:mm)</Text>
            <TextInput
              style={styles.dateInput}
              value={customDateStr}
              onChangeText={(v) => {
                setCustomDateStr(v);
                setActivePreset(-2);
              }}
              placeholder="2025-12-31T09:00"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            />

            {/* Repeat */}
            <Text style={styles.label}>Lặp lại</Text>
            <TouchableOpacity
              style={styles.repeatSelector}
              onPress={() => setShowRepeat(!showRepeat)}
            >
              <Text style={styles.repeatText}>{repeatLabel}</Text>
              <Text style={styles.repeatChevron}>{showRepeat ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showRepeat && (
              <View style={styles.repeatDropdown}>
                {REPEATS.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.repeatOption, repeat === r.value && styles.repeatOptionActive]}
                    onPress={() => {
                      setRepeat(r.value);
                      setShowRepeat(false);
                    }}
                  >
                    <Text
                      style={[styles.repeatOptionText, repeat === r.value && { color: '#60a5fa' }]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveText}>{isEdit ? 'Cập nhật' : 'Tạo nhắc hẹn'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#6b7280', fontSize: 12 },
  body: { padding: 16 },
  label: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textArea: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    fontSize: 13,
    minHeight: 80,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  presetBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  presetText: { color: '#6b7280', fontSize: 12 },
  presetTextActive: { color: '#fff' },
  dateInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    fontSize: 13,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  repeatSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  repeatText: { color: '#111827', fontSize: 13 },
  repeatChevron: { color: '#9ca3af', fontSize: 11 },
  repeatDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  repeatOption: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  repeatOptionActive: { backgroundColor: '#eff6ff' },
  repeatOptionText: { color: '#374151', fontSize: 13 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  saveBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
