import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { Alert } from 'react-native';
import { saveCookies, getCookieHeader, clearCookies } from './cookieStorage';
import { getApiUrl } from './getApiUrl';
import { attachClientRateLimiter, attachRetry3s } from './apiFaultTolerance';

export { saveCookies, getCookieHeader, clearCookies };

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Lazy import để tránh circular dependency
type LogoutFn = () => void;
let _logout: LogoutFn | null = null;

export const setLogoutHandler = (fn: LogoutFn) => {
  _logout = fn;
};

const authorizedAxios = axios.create({
  baseURL: getApiUrl(),
  timeout: 1000 * 60 * 10,
  withCredentials: false,
  // Force XHR adapter — axios 1.7+ auto-selects fetch adapter in RN 0.81+
  // because global fetch is available, but RN's fetch throws
  // "Body is unusable: Body has already been read" on retry/intercept flows.
  adapter: 'xhr',
});

attachClientRateLimiter(authorizedAxios);

// ── Request interceptor: attach cookies ──────────────────────────────────────

authorizedAxios.interceptors.request.use(
  async (config) => {
    const cookie = await getCookieHeader();
    if (cookie) {
      config.headers['Cookie'] = cookie;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: persist cookies + refresh flow ─────────────────────

let refreshTokenPromise: Promise<unknown> | null = null;
let subscribers: ((ok: boolean) => void)[] = [];

function onRefreshed(success: boolean) {
  subscribers.forEach((cb) => cb(success));
  subscribers = [];
}

authorizedAxios.interceptors.response.use(
  async (response) => {
    // Persist any new cookies from response
    await saveCookies(response.headers as Record<string, string | string[]>);
    return response;
  },
  async (error) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;
    await saveCookies((error.response?.headers ?? {}) as Record<string, string | string[]>);

    // 410 — token completely expired, force logout
    if (error.response?.status === 410 && !originalRequest._retry) {
      _logout?.();
      return Promise.reject(error);
    }

    // 401 handling with refresh
    if (error.response?.status === 401) {
      if (originalRequest?.url?.includes('/api/auth/refresh')) {
        _logout?.();
        return Promise.reject(error);
      }

      // Single Session: bị kick bởi thiết bị khác — thông báo và force logout ngay
      const errMsg = (error.response?.data as any)?.message as string | undefined;
      if (errMsg?.includes('thiết bị khác')) {
        Alert.alert('Phiên đăng nhập hết hiệu lực', errMsg, [
          { text: 'Đồng ý', onPress: () => _logout?.() },
        ]);
        return Promise.reject(error);
      }

      if (originalRequest._retry) {
        _logout?.();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (!refreshTokenPromise) {
        refreshTokenPromise = import('./publicAxios')
          .then(({ default: pub }) => pub.post('/api/auth/refresh'))
          .then(async (res) => {
            await saveCookies(res.headers as Record<string, string | string[]>);
            onRefreshed(true);
          })
          .catch(() => {
            // Don't return Promise.reject — that would leave refreshTokenPromise as
            // a rejected promise with no handler (unhandled rejection crash).
            // The actual error is forwarded to callers via onRefreshed(false) → subscribers.
            _logout?.();
            onRefreshed(false);
          })
          .finally(() => {
            refreshTokenPromise = null;
          });
      }

      return new Promise((resolve, reject) => {
        subscribers.push((success) => {
          if (success) {
            resolve(authorizedAxios(originalRequest));
          } else {
            reject(error);
          }
        });
      });
    }

    return Promise.reject(error);
  }
);

attachRetry3s(authorizedAxios);

export default authorizedAxios;
