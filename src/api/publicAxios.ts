import axios from 'axios';
import { saveCookies } from './cookieStorage';
import { getApiUrl } from './getApiUrl';

const publicAxios = axios.create({
  baseURL: getApiUrl(),
  timeout: 10_000,
  withCredentials: false, // Cookies managed manually via AsyncStorage
  // Force XHR adapter — prevent axios 1.7+ from selecting fetch adapter in RN 0.81
  adapter: 'xhr',
});

// Save any Set-Cookie headers from responses (e.g. after login)
publicAxios.interceptors.response.use(
  async (response) => {
    await saveCookies(response.headers as Record<string, string | string[]>);
    return response;
  },
  (error) => Promise.reject(error)
);

export default publicAxios;
