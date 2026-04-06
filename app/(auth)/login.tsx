import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { authServices } from '@/services/authServices';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types/user';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
});
type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth, fetchProfile } = useAuthStore();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authServices.login({ email: data.email, password: data.password });
      const user = (res as { user: User }).user ?? (res as unknown as User);
      // Cookies are saved automatically by publicAxios response interceptor
      setAuth(user as Parameters<typeof setAuth>[0]);
      fetchProfile(); // refresh full profile in background
      router.replace('/(app)');
    } catch (e: unknown) {
      Alert.alert(
        'Đăng nhập thất bại',
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Kiểm tra email và mật khẩu.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-12">
          {/* Logo / title */}
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center mb-4">
              <Text className="text-white text-3xl font-bold">B</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900">BinChat</Text>
            <Text className="text-gray-400 mt-1">Đăng nhập để tiếp tục</Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            <View>
              <Text className="text-gray-700 font-medium mb-1.5">Email</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`border rounded-xl px-4 py-3 text-gray-900 bg-gray-50 ${errors.email ? 'border-red-400' : 'border-gray-200'}`}
                    placeholder="email@example.com"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {errors.email && (
                <Text className="text-red-500 text-xs mt-1">{errors.email.message}</Text>
              )}
            </View>

            <View>
              <Text className="text-gray-700 font-medium mb-1.5">Mật khẩu</Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className={`border rounded-xl px-4 py-3 text-gray-900 bg-gray-50 ${errors.password ? 'border-red-400' : 'border-gray-200'}`}
                    placeholder="••••••••"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              {errors.password && (
                <Text className="text-red-500 text-xs mt-1">{errors.password.message}</Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              className="self-end"
            >
              <Text className="text-primary text-sm">Quên mật khẩu?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="bg-primary rounded-xl py-3.5 items-center mt-2"
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Đăng nhập</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Register link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-gray-500">Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text className="text-primary font-medium">Đăng ký</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
