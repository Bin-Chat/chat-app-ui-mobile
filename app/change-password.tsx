import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authServices } from '@/services/authServices';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
    newPassword: z.string().min(8, 'Mật khẩu mới ít nhất 8 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

const FIELDS = [
  { name: 'currentPassword' as const, label: 'Mật khẩu hiện tại' },
  { name: 'newPassword' as const, label: 'Mật khẩu mới' },
  { name: 'confirmPassword' as const, label: 'Xác nhận mật khẩu mới' },
];

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: PasswordForm) => {
    try {
      await authServices.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      reset();
      Alert.alert('Thành công', 'Mật khẩu đã được đổi.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      const resp = (e as any)?.response?.data;
      const msg =
        (Array.isArray(resp?.message) ? resp.message[0] : resp?.message) ??
        resp?.error ??
        (e as any)?.message ??
        'Không thể đổi mật khẩu.';
      Alert.alert('Lỗi', msg);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="bg-white px-4 py-3 flex-row items-center border-b border-gray-100"
      >
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2" hitSlop={8}>
          <ChevronLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900 ml-2">Đổi mật khẩu</Text>
      </View>

      {/* Form */}
      <View className="bg-white mx-4 mt-4 rounded-2xl p-5 gap-4">
        {FIELDS.map((f) => (
          <View key={f.name}>
            <Text className="text-gray-700 font-medium mb-1.5">{f.label}</Text>
            <Controller
              control={control}
              name={f.name}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className={`border rounded-xl px-4 py-3 text-gray-900 bg-gray-50 ${
                    errors[f.name] ? 'border-red-400' : 'border-gray-200'
                  }`}
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors[f.name] && (
              <Text className="text-red-500 text-xs mt-1">{errors[f.name]?.message}</Text>
            )}
          </View>
        ))}

        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="bg-primary rounded-xl py-3.5 items-center mt-2"
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Đổi mật khẩu</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
