import AsyncStorage from '@react-native-async-storage/async-storage';

const COOKIE_KEY = 'auth_cookies';

export async function saveCookies(headers: Record<string, string | string[]>): Promise<void> {
  const raw = headers['set-cookie'];
  if (!raw) return;
  const cookies = Array.isArray(raw) ? raw : [raw];
  const parsed = cookies.map((c) => c.split(';')[0]).filter(Boolean);
  if (parsed.length === 0) return;

  // Merge with existing cookies so we don't lose unrelated ones
  const existing = (await AsyncStorage.getItem(COOKIE_KEY)) ?? '';
  const map = new Map<string, string>(
    existing
      .split('; ')
      .filter(Boolean)
      .map((c) => [c.split('=')[0], c] as [string, string])
  );
  for (const c of parsed) {
    map.set(c.split('=')[0], c);
  }
  await AsyncStorage.setItem(COOKIE_KEY, [...map.values()].join('; '));
}

export async function getCookieHeader(): Promise<string> {
  return (await AsyncStorage.getItem(COOKIE_KEY)) ?? '';
}

export async function clearCookies(): Promise<void> {
  await AsyncStorage.removeItem(COOKIE_KEY);
}
