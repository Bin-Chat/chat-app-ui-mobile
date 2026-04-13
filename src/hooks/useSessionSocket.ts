import { useEffect } from 'react';
import { Alert } from 'react-native';
import { socketService } from '@/services/socket';
import { useAuthStore } from '@/store/authStore';

/**
 * Lắng nghe sự kiện 'session:kicked' từ server.
 * Khi thiết bị khác đăng nhập, server emit event này → logout ngay lập tức.
 * Mount một lần trong (app)/_layout.tsx.
 */
export function useSessionSocket() {
  const user = useAuthStore((s) => s.user);
  const forceLogout = useAuthStore((s) => s.forceLogout);

  useEffect(() => {
    if (!user?.id) return;

    const onSessionKicked = (payload: any) => {
      // Chỉ logout nếu event nhắm vào loại thiết bị 'mobile'
      if (payload?.deviceType && payload.deviceType !== 'mobile') return;
      socketService.disconnect();
      Alert.alert(
        'Phiên đăng nhập hết hiệu lực',
        payload?.reason ?? 'Tài khoản vừa đăng nhập ở thiết bị khác. Vui lòng đăng nhập lại.',
        // forceLogout: không gọi API (JwtAuthGuard sẽ block → 401) — chỉ xóa cookies + state
        [{ text: 'Đồng ý', onPress: () => forceLogout() }]
      );
    };

    socketService.on('session:kicked', onSessionKicked);

    return () => {
      socketService.off('session:kicked', onSessionKicked);
    };
  }, [user?.id, forceLogout]);
}
