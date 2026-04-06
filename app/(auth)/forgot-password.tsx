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
import { useRouter } from 'expo-router';
import { authServices } from '@/services/authServices';

type Step = 'email' | 'reset';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('email');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      Alert.alert('Lỗi', 'Vui lòng nhập email hợp lệ.');
      return;
    }
    setLoading(true);
    try {
      await authServices.forgotPassword(trimmed);
      setStep('reset');
    } catch (e: unknown) {
      Alert.alert(
        'Lỗi',
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Không thể gửi mã. Hãy kiểm tra email.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!code.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã xác thực.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Lỗi', 'Mật khẩu mới ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp.');
      return;
    }
    setLoading(true);
    try {
      await authServices.resetPassword(email.trim(), code.trim(), newPassword);
      Alert.alert('Thành công', 'Mật khẩu đã được đặt lại. Hãy đăng nhập.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (e: unknown) {
      Alert.alert(
        'Lỗi',
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Mã không hợp lệ hoặc đã hết hạn.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-12">
          {step === 'email' ? (
            <>
              <View className="mb-8">
                <Text className="text-2xl font-bold text-gray-900">Quên mật khẩu</Text>
                <Text className="text-gray-500 mt-2">Nhập email để nhận mã đặt lại mật khẩu</Text>
              </View>
              <View className="gap-4">
                <View>
                  <Text className="text-gray-700 font-medium mb-1.5">Email</Text>
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
                    placeholder="email@example.com"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
                <TouchableOpacity
                  onPress={handleSendCode}
                  disabled={loading}
                  className="bg-primary rounded-xl py-3.5 items-center"
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-semibold text-base">Gửi mã</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View className="mb-8">
                <Text className="text-2xl font-bold text-gray-900">Đặt lại mật khẩu</Text>
                <Text className="text-gray-500 mt-2">
                  Nhập mã vừa gửi tới <Text className="text-gray-800 font-medium">{email}</Text>
                </Text>
              </View>
              <View className="gap-4">
                {[
                  {
                    label: 'Mã xác thực',
                    value: code,
                    set: setCode,
                    keyboard: 'number-pad' as const,
                    secure: false,
                  },
                  {
                    label: 'Mật khẩu mới',
                    value: newPassword,
                    set: setNewPassword,
                    keyboard: 'default' as const,
                    secure: true,
                  },
                  {
                    label: 'Xác nhận mật khẩu mới',
                    value: confirmPassword,
                    set: setConfirmPassword,
                    keyboard: 'default' as const,
                    secure: true,
                  },
                ].map((f) => (
                  <View key={f.label}>
                    <Text className="text-gray-700 font-medium mb-1.5">{f.label}</Text>
                    <TextInput
                      className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
                      placeholder={f.secure ? '••••••••' : ''}
                      placeholderTextColor="#9ca3af"
                      keyboardType={f.keyboard}
                      secureTextEntry={f.secure}
                      value={f.value}
                      onChangeText={f.set}
                    />
                  </View>
                ))}
                <TouchableOpacity
                  onPress={handleReset}
                  disabled={loading}
                  className="bg-primary rounded-xl py-3.5 items-center mt-2"
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-semibold text-base">Đặt lại mật khẩu</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep('email')} className="items-center">
                  <Text className="text-primary text-sm">Nhập lại email</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
