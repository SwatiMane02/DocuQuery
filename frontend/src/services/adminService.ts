import { apiClient } from "@/lib/api";
import { UserResponse } from "./authService";

export interface AdminStatsResponse {
  total_users: number;
  total_documents: number;
  total_conversations: number;
  total_queries: number;
  pro_users_count: number;
  admin_users_count: number;
  total_storage_bytes: number;
}

export interface AdminUserListResponse {
  users: UserResponse[];
  total: number;
}

export class AdminService {
  static async getStats(): Promise<AdminStatsResponse> {
    return apiClient<AdminStatsResponse>("/admin/stats", {
      method: "GET",
    });
  }

  static async getUsers(
    skip = 0,
    limit = 50,
    search?: string,
    role?: string,
  ): Promise<AdminUserListResponse> {
    const params = new URLSearchParams({
      skip: String(skip),
      limit: String(limit),
    });
    if (search) params.set("search", search);
    if (role && role !== "All") params.set("role", role);

    return apiClient<AdminUserListResponse>(`/admin/users?${params.toString()}`, {
      method: "GET",
    });
  }

  static async updateUser(
    userId: string,
    data: { role?: string; is_active?: boolean; documents_limit?: number },
  ): Promise<UserResponse> {
    return apiClient<UserResponse>(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  static async deleteUser(userId: string): Promise<{ message: string }> {
    return apiClient<{ message: string }>(`/admin/users/${userId}`, {
      method: "DELETE",
    });
  }
}
