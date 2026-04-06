import { Redirect } from 'expo-router';

// Root index defers to AuthGuard in _layout.tsx which redirects based on auth state.
export default function Index() {
  return <Redirect href="/(app)" />;
}
