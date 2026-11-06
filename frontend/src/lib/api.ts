import { authStore } from "@/store/authStore";
import { toast } from "sonner";

// Support canonical VITE_API_URL with backward-compatible fallback to VITE_API_BASE_URL
const rawApiUrl =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

if (import.meta.env.PROD && !rawApiUrl) {
  console.warn(
    "DocuQuery Configuration Notice: Neither VITE_API_URL nor VITE_API_BASE_URL was configured at build time. In production, requests will use relative origin pathing rather than localhost."
  );
}

// In production, never silently fall back to localhost. Use normalized URL or relative origin.
export const API_BASE_URL = rawApiUrl
  ? rawApiUrl.replace(/\/+$/, "")
  : import.meta.env.PROD
    ? ""
    : "http://localhost:8000";

let isHandling401 = false;

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${cleanEndpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = authStore.getToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Network connection failed";
    throw new Error(`Unable to reach server (${errorMsg}). Please check your connection.`);
  }

  if (response.status === 401) {
    if (!isHandling401 && !window.location.pathname.includes("/login")) {
      isHandling401 = true;
      authStore.logout();
      toast.error("Your session has expired. Please sign in again.");
      setTimeout(() => {
        window.location.href = "/login";
        isHandling401 = false;
      }, 500);
    }
  }

  if (!response.ok) {
    let errorMessage = "An unexpected error occurred";
    try {
      const errorData = await response.json();
      errorMessage =
        errorData.detail ||
        (Array.isArray(errorData.errors) ? errorData.errors[0]?.msg : null) ||
        errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}
