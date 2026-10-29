import axios from "axios";

const ACCESS = "psycare_access";
const REFRESH = "psycare_refresh";

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS);
  },
  get refresh() {
    return localStorage.getItem(REFRESH);
  },
  set(access, refresh) {
    localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

const isPublicAuth = (url) => url.includes("/auth/token/") || url.includes("/auth/phone/");

api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  const url = config.url || "";
  if (token && !isPublicAuth(url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const url = original.url || "";
    if (
      error.response?.status !== 401 ||
      original._retry ||
      isPublicAuth(url)
    ) {
      return Promise.reject(error);
    }
    if (!tokenStore.refresh) {
      return Promise.reject(error);
    }
    original._retry = true;
    try {
      refreshPromise =
        refreshPromise ||
        axios.post(`${api.defaults.baseURL}/auth/token/refresh/`, { refresh: tokenStore.refresh });
      const { data } = await refreshPromise;
      refreshPromise = null;
      tokenStore.set(data.access, data.refresh || tokenStore.refresh);
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${data.access}`;
      return api(original);
    } catch (refreshError) {
      refreshPromise = null;
      tokenStore.clear();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
      return Promise.reject(refreshError);
    }
  },
);

export function errorMessage(error) {
  const data = error?.response?.data;
  if (!data) return "Nuk u arrit lidhja me serverin.";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) return String(data.detail[0]);
  if (typeof data === "object") {
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && value.length) return String(value[0]);
      if (typeof value === "string") return value;
    }
  }
  return "Kërkesa dështoi.";
}

export default api;
