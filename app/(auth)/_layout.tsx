import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: '',
        headerStyle: { backgroundColor: '#fff' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#fff' },
      }}
    />
  );
}
