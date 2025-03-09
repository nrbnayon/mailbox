// src/lib/axios.ts
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { env } from "./env";

// Track if a refresh is already in progress
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

// Add a callback that resolves when the token refresh is complete
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

// Call all subscribers with the new token
function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

// If refresh fails, reject all subscribers
function onRefreshError(error: any) {
  refreshSubscribers.forEach((callback) => callback(error));
  refreshSubscribers = [];

  // Force logout and redirect on refresh failure
  document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/login";
  }
}

const instance = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor
instance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    // Get the original request config
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized errors only if not already trying to refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/api/auth/refresh") // Prevent infinite loops
    ) {
      if (isRefreshing) {
        // If a refresh is already in progress, wait for it to complete
        try {
          return new Promise((resolve, reject) => {
            subscribeTokenRefresh((token) => {
              if (token) {
                // Retry the original request
                resolve(instance(originalRequest));
              } else {
                // Token refresh failed
                reject(error);
              }
            });
          });
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }

      // No refresh in progress, so start one
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh token endpoint
        const { data } = await instance.post("/api/auth/refresh");
        isRefreshing = false;

        // Notify all waiting requests that token is refreshed
        onTokenRefreshed(data.token || "success");

        // Retry the original request
        return instance(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshError(refreshError);

        // Only redirect to login if not already there
        if (!window.location.pathname.includes("/login")) {
          console.log("Session expired. Redirecting to login page.");
          window.location.href = "/login";
        }

        return Promise.reject(refreshError);
      }
    }

    // Handle other errors or pass through if refresh failed
    return Promise.reject(error);
  }
);

export default instance;
