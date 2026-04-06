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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authServices } from '@/services/authServices';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [countdown, setCountdown] = React.useState(60);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    startCountdown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã xác thực.');
      return;
    }
    setLoading(true);
    try {
      await authServices.verifyRegistration(email!, code.trim());
      Alert.alert('Thành công', 'Tài khoản đã được xác thực. Hãy đăng nhập.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (e: unknown) {
      Alert.alert(
        'Xác thực thất bại',
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Mã không hợp lệ hoặc đã hết hạn.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authServices.resendVerification(email!);
      startCountdown();
      Alert.alert('Đã gửi', 'Mã xác thực mới đã được gửi tới email của bạn.');
    } catch {
      Alert.alert('Lỗi', 'Không thể gửi lại. Vui lòng thử lại sau.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-12">
          <View className="mb-8">
            <Text className="text-2xl font-bold text-gray-900">Xác thực email</Text>
            <Text className="text-gray-500 mt-2 leading-5">
              Chúng tôi đã gửi mã 6 chữ số tới{' '}
              <Text className="text-gray-800 font-medium">{email}</Text>
            </Text>
          </View>

          <View className="gap-4">
            <View>
              <Text className="text-gray-700 font-medium mb-1.5">Mã xác thực</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-gray-50 text-center text-2xl tracking-widest"
                placeholder="······"
                placeholderTextColor="#d1d5db"
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
              />
            </View>

            <TouchableOpacity
              onPress={handleVerify}
              disabled={loading}
              className="bg-primary rounded-xl py-3.5 items-center"
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Xác thực</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row justify-center items-center mt-2">
              {countdown > 0 ? (
                <Text className="text-gray-500 text-sm">
                  Gửi lại sau <Text className="text-primary font-medium">{countdown}s</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResend} disabled={resending}>
                  {resending ? (
                    <ActivityIndicator size="small" color="#0068FF" />
                  ) : (
                    <Text className="text-primary text-sm font-medium">Gửi lại mã</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
