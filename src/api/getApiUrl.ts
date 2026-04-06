import Constants from 'expo-constants';

/**
 * Trả về base URL của API backend.
 *
 * Khi chạy trong Expo dev mode (Expo Go hoặc dev client trên thiết bị vật lý /
 * Android emulator), `Constants.expoConfig.hostUri` chứa địa chỉ IP LAN của
 * máy host Metro (VD: "192.168.1.100:8081"). Ta strip port Metro và gán port 3000
 * → kết nối đúng máy đang chạy backend, không dùng localhost của thiết bị.
 *
 * Ưu tiên lookup:
 *  1. Expo dev + hostUri có sẵn  → http://<LAN_IP>:3000
 *  2. EXPO_PUBLIC_API_URL env var → giá trị theo .env
 *  3. Fallback                   → http://localhost:3000
 */
export function getApiUrl(): string {
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.100:8081"
    if (hostUri) {
      const host = hostUri.split(':')[0]; // strip Metro port
      return `http://${host}:3000`;
    }
  }
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
}
