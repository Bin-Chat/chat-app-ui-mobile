import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';
import { authServices } from '@/services/authServices';
import { UserAvatar } from '@/components/UserAvatar';
import { Camera, ChevronRight, Lock, LogOut } from 'lucide-react-native';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Tên ít nhất 2 ký tự').max(50),
  phone: z.string().optional(),
  bio: z.string().max(200, 'Tối đa 200 ký tự').optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

export default function SettingsScreen() {
  const { user, updateUser, logout } = useAuthStore();
  const router = useRouter();
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);

  // Profile form
  const {
    control: profileControl,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isSubmitting: profileSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      phone: user?.phone ?? '',
      bio: user?.bio ?? '',
    },
  });

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập', 'Hãy cho phép app truy cập thư viện ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as ImagePicker.MediaType,
      quality: 0.9,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const fileName = asset.uri.split('/').pop() ?? 'avatar.jpg';
    const mimeType = asset.mimeType ?? 'image/jpeg';

    setUploadingAvatar(true);
    try {
      // 1. Get presigned URL
      const presignRes = await authServices.presignUpload({
        category: 'avatar',
        filename: fileName,
        mimeType,
        fileSize: asset.fileSize ?? 0,
      });
      const { presignedUrl, objectKey } = presignRes;

      // 2. PUT file directly to S3 (works with ph:// URIs on iOS)
      const uploadResult = await FileSystem.uploadAsync(presignedUrl, asset.uri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': mimeType },
      });
      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`S3 upload failed: HTTP ${uploadResult.status}`);
      }

      // 3. Finalize → get final URL
      const finalRes = await authServices.finalizeUpload({ objectKey, category: 'avatar' });
      const avatarUrl = finalRes.cdnUrl;

      // 4. Update profile
      await authServices.updateProfile(user!.id, { avatar: avatarUrl });
      updateUser({ avatar: avatarUrl });
      Alert.alert('Thành công', 'Ảnh đại diện đã được cập nhật!');
    } catch {
      Alert.alert('Lỗi', 'Không thể tải ảnh. Vui lòng thử lại.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onProfileSave = async (data: ProfileForm) => {
    try {
      await authServices.updateProfile(user!.id, data);
      updateUser(data);
      Alert.alert('Thành công', 'Thông tin đã được cập nhật.');
    } catch (e: unknown) {
      Alert.alert(
        'Lỗi',
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Không thể cập nhật.'
      );
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* Avatar section */}
      <View className="bg-white px-5 py-6 items-center border-b border-gray-100 mb-3">
        <View className="relative">
          <UserAvatar user={user} size={88} variant="medium" />
          <TouchableOpacity
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full items-center justify-center border-2 border-white"
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Camera size={14} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
        <Text className="text-lg font-bold text-gray-900 mt-3">
          {user?.fullName ?? 'Người dùng'}
        </Text>
        <Text className="text-gray-400 text-sm">{user?.email}</Text>
      </View>

      {/* Profile form */}
      <View className="bg-white mx-4 rounded-2xl p-5 mb-4 gap-4">
        {(
          [
            {
              name: 'fullName' as const,
              label: 'Họ và tên',
              placeholder: 'Nguyễn Văn A',
            },
            {
              name: 'phone' as const,
              label: 'Số điện thoại',
              placeholder: '0901234567',
              keyboard: 'phone-pad' as const,
            },
            {
              name: 'bio' as const,
              label: 'Giới thiệu',
              placeholder: 'Viết gì đó về bạn...',
              multiline: true,
            },
          ] as const
        ).map((f) => (
          <View key={f.name}>
            <Text className="text-gray-700 font-medium mb-1.5">{f.label}</Text>
            <Controller
              control={profileControl}
              name={f.name}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className={`border rounded-xl px-4 py-3 text-gray-900 bg-gray-50 ${profileErrors[f.name] ? 'border-red-400' : 'border-gray-200'} ${'multiline' in f ? 'h-20 text-top' : ''}`}
                  placeholder={f.placeholder}
                  placeholderTextColor="#9ca3af"
                  keyboardType={'keyboard' in f ? f.keyboard : 'default'}
                  multiline={'multiline' in f}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value ?? ''}
                />
              )}
            />
            {profileErrors[f.name] && (
              <Text className="text-red-500 text-xs mt-1">{profileErrors[f.name]?.message}</Text>
            )}
          </View>
        ))}
        <TouchableOpacity
          onPress={handleProfileSubmit(onProfileSave)}
          disabled={profileSubmitting}
          className="bg-primary rounded-xl py-3.5 items-center mt-2"
          activeOpacity={0.85}
        >
          {profileSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Lưu thay đổi</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Security */}
      <TouchableOpacity
        onPress={() => router.push('/change-password')}
        className="mx-4 mb-4 bg-white border border-gray-100 rounded-2xl py-4 flex-row items-center px-5"
        activeOpacity={0.85}
      >
        <View className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center mr-3">
          <Lock size={16} color="#0068FF" />
        </View>
        <Text className="flex-1 text-gray-800 font-medium">Đổi mật khẩu</Text>
        <ChevronRight size={18} color="#9ca3af" />
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity
        onPress={() =>
          Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
            { text: 'Huỷ', style: 'cancel' },
            { text: 'Đăng xuất', style: 'destructive', onPress: logout },
          ])
        }
        className="mx-4 mb-10 bg-white border border-red-100 rounded-2xl py-4 flex-row items-center justify-center gap-2"
        activeOpacity={0.85}
      >
        <LogOut size={18} color="#ef4444" />
        <Text className="text-red-500 font-medium">Đăng xuất</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
