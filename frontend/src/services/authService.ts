import { apiClient } from "@/lib/api";

export interface UserResponse {
  _id?: string;
  id?: string;
  email: string;
  full_name: string;
  bio?: string | null;
  role: string;
  documents_limit: number;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user?: UserResponse | null;
}

export class AuthService {
  /**
   * Register a new user account.
   */
  static async signup(
    name: string,
    email: string,
    password: string,
  ): Promise<TokenResponse> {
    return apiClient<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        full_name: name.trim(),
      }),
    });
  }

  /**
   * Authenticate user credentials and retrieve a JWT token.
   */
  static async login(email: string, password: string): Promise<TokenResponse> {
    return apiClient<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });
  }

  /**
   * Fetch current user profile.
   */
  static async getProfile(): Promise<UserResponse> {
    return apiClient<UserResponse>("/auth/me", {
      method: "GET",
    });
  }

  /**
   * Update user profile (full name, bio).
   */
  static async updateProfile(data: {
    full_name?: string;
    bio?: string;
  }): Promise<UserResponse> {
    return apiClient<UserResponse>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * Change user password.
   */
  static async changePassword(
    current_password: string,
    new_password: string,
  ): Promise<{ message: string }> {
    return apiClient<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        current_password,
        new_password,
      }),
    });
  }
}
