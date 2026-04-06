import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { MessageCircle, Users, Settings } from 'lucide-react-native';
import { useFriendSocket } from '@/hooks/useFriendSocket';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useAuthStore } from '@/store/authStore';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  // Wire realtime events for the entire (app) group
  useFriendSocket();
  useChatSocket();

  // Auth guard: redirect after render (avoids useFocusEffect → useNavigation timing issues)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading]);

  // While profile is loading, render nothing (SplashScreen is still visible)
  if (isLoading) return null;

  // Not authenticated → return null (redirect handled in useEffect above)
  if (!isAuthenticated) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0068FF',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          borderTopColor: '#f3f4f6',
          backgroundColor: '#fff',
        },
        headerStyle: { backgroundColor: '#fff' },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tin nhắn',
          tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Danh bạ',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Cài đặt',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
