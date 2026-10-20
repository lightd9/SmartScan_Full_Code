import axios from 'axios';

const AUTH_STORAGE_KEY = 'smartscan_auth';

function getToken() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw)?.token : null;
  } catch {
    return null;
  }
}

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL?.trim(),
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
