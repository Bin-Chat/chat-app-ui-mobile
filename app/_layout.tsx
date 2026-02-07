import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Chat App' }} />
        <Stack.Screen name="login" options={{ title: 'Login' }} />
        <Stack.Screen name="chat" options={{ title: 'Chat' }} />
      </Stack>
    </>
  );
}
