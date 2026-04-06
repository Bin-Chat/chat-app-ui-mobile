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

const schema = z
  .object({
    fullName: z.string().min(2, 'Tên ít nhất 2 ký tự').max(50, 'Tên tối đa 50 ký tự'),
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(8, 'Mật khẩu ít nhất 8 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });
type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const router = useRouter();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await authServices.register({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      });
      router.push({
        pathname: '/(auth)/verify-email',
        params: { email: data.email },
      });
    } catch (e: unknown) {
      Alert.alert(
        'Đăng ký thất bại',
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Vui lòng thử lại.'
      );
    }
  };

  const fields: {
    name: keyof FormData;
    label: string;
    placeholder: string;
    secure?: boolean;
    keyboardType?: 'default' | 'email-address';
  }[] = [
    { name: 'fullName', label: 'Họ và tên', placeholder: 'Nguyễn Văn A' },
    {
      name: 'email',
      label: 'Email',
      placeholder: 'email@example.com',
      keyboardType: 'email-address',
    },
    {
      name: 'password',
      label: 'Mật khẩu',
      placeholder: '••••••••',
      secure: true,
    },
    {
      name: 'confirmPassword',
      label: 'Xác nhận mật khẩu',
      placeholder: '••••••••',
      secure: true,
    },
  ];

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-12">
          <View className="mb-8">
            <Text className="text-2xl font-bold text-gray-900">Tạo tài khoản</Text>
            <Text className="text-gray-400 mt-1">Điền thông tin để đăng ký</Text>
          </View>

          <View className="gap-4">
            {fields.map((f) => (
              <View key={f.name}>
                <Text className="text-gray-700 font-medium mb-1.5">{f.label}</Text>
                <Controller
                  control={control}
                  name={f.name}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className={`border rounded-xl px-4 py-3 text-gray-900 bg-gray-50 ${errors[f.name] ? 'border-red-400' : 'border-gray-200'}`}
                      placeholder={f.placeholder}
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={f.secure}
                      keyboardType={f.keyboardType ?? 'default'}
                      autoCapitalize={f.keyboardType === 'email-address' ? 'none' : 'words'}
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
                <Text className="text-white font-semibold text-base">Đăng ký</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-center mt-8">
            <Text className="text-gray-500">Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-primary font-medium">Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
