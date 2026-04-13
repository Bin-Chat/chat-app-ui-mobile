import publicAxios from '@/api/publicAxios';
import authorizedAxios from '@/api/authorizedAxios';
import type { User } from '@/types/user';

export const authServices = {
  login: (data: { email: string; password: string; deviceName?: string }) =>
    publicAxios
      .post('/api/auth/login', {
        ...data,
        deviceType: 'mobile',
        deviceName: data.deviceName ?? 'Điện thoại',
      })
      .then((r) => r.data),

  register: (data: { email: string; password: string; fullName: string }) =>
    publicAxios.post('/api/auth/register', data).then((r) => r.data),

  verifyRegistration: (email: string, otp: string) =>
    publicAxios.post('/api/auth/verify-registration', { email, otp }).then((r) => r.data),

  resendVerification: (email: string) =>
    publicAxios.post('/api/auth/resend-verification', { email }).then((r) => r.data),

  logout: () => publicAxios.post('/api/auth/logout').then((r) => r.data),

  forgotPassword: (email: string) =>
    publicAxios.post('/api/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (email: string, otp: string, newPassword: string) =>
    publicAxios.post('/api/auth/reset-password', { email, otp, newPassword }).then((r) => r.data),

  getProfile: () => authorizedAxios.get<{ user: User }>('/api/auth/profile').then((r) => r.data),

  updateProfile: (
    id: string,
    data: { fullName?: string; avatar?: string; phone?: string; bio?: string }
  ) => authorizedAxios.patch<User>(`/api/users/${id}/profile`, data).then((r) => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    authorizedAxios.patch('/api/auth/change-password', data).then((r) => r.data),

  // ── Device Management ───────────────────────────────────────────────────

  getDevices: () =>
    authorizedAxios
      .get<
        {
          deviceId: string;
          deviceType: string;
          deviceName?: string;
          loginAt: string;
          isCurrent: boolean;
        }[]
      >('/api/auth/devices')
      .then((r) => r.data),

  remoteLogout: (deviceId: string) =>
    authorizedAxios
      .delete<{ message: string }>(`/api/auth/devices/${deviceId}`)
      .then((r) => r.data),

  presignUpload: (data: {
    category: 'avatar' | 'image' | 'video' | 'document';
    filename: string;
    mimeType: string;
    fileSize: number;
  }) =>
    authorizedAxios
      .post<{ presignedUrl: string; objectKey: string }>('/api/uploads/presign', data)
      .then((r) => r.data),

  finalizeUpload: (data: { objectKey: string; category: string }) =>
    authorizedAxios
      .post<{ objectKey: string; cdnUrl: string }>('/api/uploads/finalize', data)
      .then((r) => r.data),
};
