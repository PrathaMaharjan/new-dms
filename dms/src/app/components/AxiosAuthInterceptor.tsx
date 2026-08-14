"use client";

import axios, { InternalAxiosRequestConfig } from "axios";
import { useEffect } from "react";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type PendingRequest = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

const AUTH_EXCLUDED_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/logout",
]);

let isRefreshing = false;
let pendingRequests: PendingRequest[] = [];

const getPathname = (url?: string): string => {
  if (!url) return "";

  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
};

const isExcludedAuthEndpoint = (url?: string): boolean => {
  const pathname = getPathname(url);
  if (pathname.startsWith("/api/superadmin")) return true;
  return AUTH_EXCLUDED_PATHS.has(pathname);
};

const flushPendingRequests = (error?: unknown) => {
  pendingRequests.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
      return;
    }

    resolve();
  });

  pendingRequests = [];
};

export default function AxiosAuthInterceptor() {
  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error?.config as RetryableRequestConfig | undefined;
        const status = error?.response?.status as number | undefined;

        if (!originalRequest || status !== 401) {
          return Promise.reject(error);
        }

        if (originalRequest._retry || isExcludedAuthEndpoint(originalRequest.url)) {
          return Promise.reject(error);
        }

        originalRequest._retry = true;

        if (isRefreshing) {
          return new Promise<void>((resolve, reject) => {
            pendingRequests.push({ resolve, reject });
          }).then(() => axios(originalRequest));
        }

        isRefreshing = true;

        try {
          await axios.post("/api/auth/refresh");
          flushPendingRequests();
          return axios(originalRequest);
        } catch (refreshError) {
          flushPendingRequests(refreshError);
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, []);

  return null;
}
