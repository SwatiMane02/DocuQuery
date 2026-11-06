import { apiClient } from "@/lib/api";

export interface DailyQueryMetric {
  date: string;
  queries: number;
}

export interface DocumentMetric {
  id: string;
  name: string;
  file_size: number;
  chunk_count: number;
  upload_date: string;
}

export interface ActivityMetric {
  title: string;
  timestamp: string;
  meta?: string | null;
}

export interface UserAnalyticsResponse {
  total_documents: number;
  total_queries: number;
  total_conversations: number;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  daily_queries: DailyQueryMetric[];
  top_documents: DocumentMetric[];
  recent_activity: ActivityMetric[];
}

export class AnalyticsService {
  static async getUserAnalytics(): Promise<UserAnalyticsResponse> {
    return apiClient<UserAnalyticsResponse>("/analytics/user", {
      method: "GET",
    });
  }
}
