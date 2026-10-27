import axios from 'axios';
import { clearAccessToken, getAccessToken } from './authToken';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL?.trim(),
});

export function getApiUrl(resourcePath) {
  const baseUrl = process.env.REACT_APP_API_URL?.trim();
  if (!baseUrl) return resourcePath;
  return `${baseUrl.replace(/\/+$/, '')}/${String(resourcePath).replace(/^\/+/, '')}`;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && config.url !== '/auth') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use((response) => response, (error) => {
  const hasAuthenticatedRequest = Boolean(error.config?.headers?.Authorization);
  if (error.response?.status === 401 && hasAuthenticatedRequest) {
    clearAccessToken();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('smartscan:session-expired'));
  }
  return Promise.reject(error);
});

export default api;
