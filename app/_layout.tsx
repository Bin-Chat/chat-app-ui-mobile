import '../global.css';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StatusBar as RNStatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';

SplashScreen.preventAutoHideAsync();

// ── In-app notification banner ────────────────────────────────────────────────
function NotificationBanner() {
  const notification = useChatStore((s) => s.inAppNotification);
  const clearInAppNotification = useChatStore((s) => s.clearInAppNotification);

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(-80)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIdRef = useRef<string | null>(null);

  const topOffset = Platform.OS === 'ios' ? 52 : (RNStatusBar.currentHeight ?? 24) + 8;

  useEffect(() => {
    if (!notification || notification.id === lastIdRef.current) return;
    lastIdRef.current = notification.id;

    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.spring(translateYAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(dismiss, 4000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification?.id]);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateYAnim, { toValue: -80, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => clearInAppNotification());
  };

  if (!notification) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: topOffset,
        left: 16,
        right: 16,
        zIndex: 9999,
        opacity: opacityAnim,
        transform: [{ translateY: translateYAnim }],
      }}
    >
      <TouchableOpacity
        onPress={dismiss}
        activeOpacity={0.92}
        style={{
          backgroundColor: '#1f2937',
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
          elevation: 8,
        }}
      >
        <Text
          style={{ color: '#fff', fontWeight: '600', fontSize: 13, marginBottom: 2 }}
          numberOfLines={1}
        >
          {notification.title}
        </Text>
        <Text style={{ color: '#d1d5db', fontSize: 12 }} numberOfLines={2}>
          {notification.body}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Auth guard ────────────────────────────────────────────────────────────────
// Handles fetchProfile + SplashScreen only.
// The actual auth redirects live in (app)/_layout.tsx and (auth) screens.
function AuthInit() {
  const { fetchProfile } = useAuthStore();

  React.useEffect(() => {
    fetchProfile().finally(() => SplashScreen.hideAsync());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <View style={{ flex: 1 }}>
      {/* Stack must always be mounted — never conditionally rendered */}
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="conversation/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="create-group" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="group-info/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="change-password" options={{ animation: 'slide_from_right' }} />
      </Stack>
      {/* AuthInit and NotificationBanner are siblings to Stack, not wrappers */}
      <AuthInit />
      <NotificationBanner />
    </View>
  );
}
