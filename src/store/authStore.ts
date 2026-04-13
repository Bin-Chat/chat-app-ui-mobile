import { create } from 'zustand';
import { authServices } from '@/services/authServices';
import { clearCookies, getCookieHeader, setLogoutHandler } from '@/api/authorizedAxios';
import type { User } from '@/types/user';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  setAuth: (user: User) => void;
  setLoading: (v: boolean) => void;
  logout: () => Promise<void>;
  forceLogout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => {
  // Register logout handler for authorizedAxios 401/410 interceptor
  setLogoutHandler(async () => {
    await clearCookies();
    set({ user: null, isAuthenticated: false, isLoading: false });
  });

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,

    setAuth: (user: User) => set({ user, isAuthenticated: true, isLoading: false }),

    setLoading: (v: boolean) => set({ isLoading: v }),

    updateUser: (data: Partial<User>) => {
      const current = get().user;
      if (current) set({ user: { ...current, ...data } });
    },

    logout: async () => {
      try {
        await authServices.logout();
      } catch {
        // ignore network errors on logout
      } finally {
        await clearCookies();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    // Dùng khi bị kick bởi thiết bị khác — không gọi API vì JwtAuthGuard sẽ block
    forceLogout: async () => {
      await clearCookies();
      set({ user: null, isAuthenticated: false, isLoading: false });
    },

    fetchProfile: async () => {
      set({ isLoading: true });
      // Skip the API call if there are no cookies — user is not logged in.
      // This avoids triggering the 401 → refresh flow on a fresh app start.
      const cookie = await getCookieHeader();
      if (!cookie) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      try {
        const data = await authServices.getProfile();
        const user = (data as { user: User }).user ?? (data as unknown as User);
        set({ user, isAuthenticated: true, isLoading: false });
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },
  };
});
