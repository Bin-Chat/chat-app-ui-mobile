import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Plus, Trash2, BarChart2 } from 'lucide-react-native';
import { chatServices } from '@/services/chatServices';

interface Props {
  conversationId: string;
  onClose: () => void;
  onCreated?: () => void;
}

const EXPIRY_PRESETS: { key: string; label: string; hours: number | null }[] = [
  { key: 'none', label: 'Không hết hạn', hours: null },
  { key: '1h', label: '1 giờ', hours: 1 },
  { key: '24h', label: '24 giờ', hours: 24 },
  { key: '3d', label: '3 ngày', hours: 72 },
];

export default function CreatePollModal({ conversationId, onClose, onCreated }: Props) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [allowAddOptions, setAllowAddOptions] = useState(false);
  const [hideResultsUntilVoted, setHideResultsUntilVoted] = useState(false);
  const [hideVoters, setHideVoters] = useState(false);
  const [expiryKey, setExpiryKey] = useState<string>('none');
  const [submitting, setSubmitting] = useState(false);

  const setOption = (i: number, val: string) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  };
  const addOption = () => {
    if (options.length >= 20) return;
    setOptions((prev) => [...prev, '']);
  };
  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    const q = question.trim();
    if (!q) {
      Alert.alert('Lỗi', 'Vui lòng nhập câu hỏi.');
      return;
    }
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      Alert.alert('Lỗi', 'Cần ít nhất 2 phương án.');
      return;
    }
    if (new Set(cleanOptions).size !== cleanOptions.length) {
      Alert.alert('Lỗi', 'Các phương án không được trùng nhau.');
      return;
    }

    const preset = EXPIRY_PRESETS.find((p) => p.key === expiryKey);
    let expiresAt: string | undefined;
    if (preset?.hours) {
      expiresAt = new Date(Date.now() + preset.hours * 3_600_000).toISOString();
    }

    setSubmitting(true);
    try {
      await chatServices.createPoll(conversationId, {
        question: q,
        options: cleanOptions,
        allowMultiple,
        allowAddOptions,
        hideResultsUntilVoted,
        hideVoters,
        expiresAt,
      });
      onCreated?.();
      onClose();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ?? e?.message ?? 'Không thể tạo bình chọn';
      Alert.alert('Lỗi', Array.isArray(msg) ? msg.join('\n') : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '92%',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#f3f4f6',
              }}
            >
              <BarChart2 size={20} color="#0068FF" />
              <Text
                style={{
                  flex: 1,
                  marginLeft: 8,
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#111827',
                }}
              >
                Tạo bình chọn
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
              {/* Question */}
              <Text
                style={{ marginTop: 12, fontSize: 13, color: '#6b7280', fontWeight: '500' }}
              >
                Câu hỏi
              </Text>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder="Bạn muốn hỏi gì?"
                placeholderTextColor="#9ca3af"
                maxLength={200}
                multiline
                style={{
                  marginTop: 6,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: '#111827',
                  minHeight: 60,
                }}
              />
              <Text
                style={{ textAlign: 'right', fontSize: 11, color: '#9ca3af', marginTop: 2 }}
              >
                {question.length}/200
              </Text>

              {/* Options */}
              <Text
                style={{ marginTop: 8, fontSize: 13, color: '#6b7280', fontWeight: '500' }}
              >
                Phương án ({options.length}/20)
              </Text>
              {options.map((opt, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}
                >
                  <TextInput
                    value={opt}
                    onChangeText={(v) => setOption(i, v)}
                    placeholder={`Phương án ${i + 1}`}
                    placeholderTextColor="#9ca3af"
                    maxLength={100}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: '#e5e7eb',
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      fontSize: 14,
                      color: '#111827',
                    }}
                  />
                  {options.length > 2 && (
                    <TouchableOpacity
                      onPress={() => removeOption(i)}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: '#fef2f2',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={14} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {options.length < 20 && (
                <TouchableOpacity
                  onPress={addOption}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 10,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: '#0068FF',
                    borderStyle: 'dashed',
                    borderRadius: 10,
                    gap: 6,
                  }}
                >
                  <Plus size={16} color="#0068FF" />
                  <Text style={{ color: '#0068FF', fontSize: 13, fontWeight: '500' }}>
                    Thêm phương án
                  </Text>
                </TouchableOpacity>
              )}

              {/* Expiry */}
              <Text
                style={{ marginTop: 16, fontSize: 13, color: '#6b7280', fontWeight: '500' }}
              >
                Thời gian
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {EXPIRY_PRESETS.map((p) => {
                  const active = expiryKey === p.key;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      onPress={() => setExpiryKey(p.key)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: active ? '#0068FF' : '#e5e7eb',
                        backgroundColor: active ? '#0068FF15' : '#fff',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: active ? '#0068FF' : '#374151',
                          fontWeight: active ? '600' : '500',
                        }}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Advanced */}
              <Text
                style={{ marginTop: 16, fontSize: 13, color: '#6b7280', fontWeight: '500' }}
              >
                Tùy chọn nâng cao
              </Text>
              {[
                {
                  label: 'Cho phép chọn nhiều phương án',
                  value: allowMultiple,
                  set: setAllowMultiple,
                },
                {
                  label: 'Cho phép thêm phương án mới',
                  value: allowAddOptions,
                  set: setAllowAddOptions,
                },
                {
                  label: 'Ẩn kết quả cho đến khi bình chọn',
                  value: hideResultsUntilVoted,
                  set: setHideResultsUntilVoted,
                },
                {
                  label: 'Ẩn người bình chọn',
                  value: hideVoters,
                  set: setHideVoters,
                },
              ].map((row) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ flex: 1, fontSize: 13, color: '#374151' }}>{row.label}</Text>
                  <Switch
                    value={row.value}
                    onValueChange={row.set}
                    trackColor={{ true: '#0068FF', false: '#d1d5db' }}
                  />
                </View>
              ))}

              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Footer */}
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: '#f3f4f6',
                gap: 10,
              }}
            >
              <TouchableOpacity
                onPress={onClose}
                disabled={submitting}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: '#f3f4f6',
                }}
              >
                <Text style={{ color: '#374151', fontSize: 14, fontWeight: '500' }}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: submitting ? '#93c5fd' : '#0068FF',
                }}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                    Tạo bình chọn
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
