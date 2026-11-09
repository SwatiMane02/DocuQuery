import { useState, useEffect } from "react";
import { UserResponse } from "@/services/authService";

type Listener = (isAuthenticated: boolean) => void;
let listeners: Listener[] = [];

function getStoredUser(): UserResponse | null {
  try {
    const raw = localStorage.getItem("user_profile");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let currentUser: UserResponse | null = getStoredUser();

export const authStore = {
  /**
   * Retrieves the access token from localStorage.
   */
  getToken(): string | null {
    return localStorage.getItem("access_token");
  },

  /**
   * Sets the access token in localStorage and notifies all subscribers.
   */
  setToken(token: string): void {
    localStorage.setItem("access_token", token);
    listeners.forEach((listener) => listener(this.isAuthenticated()));
  },

  /**
   * Sets the current user object in-memory and in localStorage, and notifies subscribers.
   */
  setUser(user: UserResponse): void {
    currentUser = user;
    try {
      localStorage.setItem("user_profile", JSON.stringify(user));
    } catch {
      // ignore
    }
    listeners.forEach((listener) => listener(this.isAuthenticated()));
  },

  /**
   * Retrieves the current user object.
   */
  getUser(): UserResponse | null {
    return currentUser;
  },

  /**
   * Clears the access token from localStorage, clears user, and notifies all subscribers.
   */
  logout(): void {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_profile");
    currentUser = null;
    listeners.forEach((listener) => listener(false));
  },

  /**
   * Checks if the user is currently authenticated (token exists and user loaded).
   */
  isAuthenticated(): boolean {
    return !!this.getToken() && !!currentUser;
  },

  /**
   * Subscribes to changes in authentication state.
   * Returns an unsubscribe function.
   */
  subscribe(listener: Listener): () => void {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};

/**
 * A custom React hook to access authentication state and status reactively.
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    authStore.isAuthenticated(),
  );

  useEffect(() => {
    setIsAuthenticated(authStore.isAuthenticated());

    // Subscribe to state updates (e.g., login, logout events)
    const unsubscribe = authStore.subscribe((status) => {
      setIsAuthenticated(status);
    });

    return unsubscribe;
  }, []);

  return {
    isAuthenticated,
    getToken: authStore.getToken,
    getUser: authStore.getUser,
    logout: () => authStore.logout(),
  };
}

