import { apiClient } from "@/lib/api";
import { ChatSourceMetadata } from "./documentService";

export interface ConversationResponse {
  id: string;
  user_id: string;
  title: string;
  document_id?: string | null;
  document_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  from_user: "user" | "ai";
  content: string;
  sources?: ChatSourceMetadata[] | null;
  created_at: string;
}

export interface ConversationListResponse {
  conversations: ConversationResponse[];
  total: number;
}

export interface ConversationDetailResponse {
  conversation: ConversationResponse;
  messages: MessageResponse[];
}

export class ConversationService {
  static async listConversations(
    skip = 0,
    limit = 50,
  ): Promise<ConversationListResponse> {
    return apiClient<ConversationListResponse>(
      `/conversations?skip=${skip}&limit=${limit}`,
      { method: "GET" },
    );
  }

  static async createConversation(
    title?: string,
    documentId?: string,
    documentName?: string,
  ): Promise<ConversationResponse> {
    return apiClient<ConversationResponse>("/conversations", {
      method: "POST",
      body: JSON.stringify({
        title,
        document_id: documentId,
        document_name: documentName,
      }),
    });
  }

  static async getConversation(
    conversationId: string,
  ): Promise<ConversationDetailResponse> {
    return apiClient<ConversationDetailResponse>(
      `/conversations/${conversationId}`,
      { method: "GET" },
    );
  }

  static async renameConversation(
    conversationId: string,
    title: string,
  ): Promise<ConversationResponse> {
    return apiClient<ConversationResponse>(
      `/conversations/${conversationId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ title }),
      },
    );
  }

  static async clearConversationMessages(
    conversationId: string,
  ): Promise<{ message: string; id: string }> {
    return apiClient<{ message: string; id: string }>(
      `/conversations/${conversationId}/messages`,
      { method: "DELETE" },
    );
  }

  static async deleteConversation(
    conversationId: string,
  ): Promise<{ message: string; id: string }> {
    return apiClient<{ message: string; id: string }>(
      `/conversations/${conversationId}`,
      { method: "DELETE" },
    );
  }

  static async sendMessage(
    conversationId: string,
    query: string,
    documentId?: string,
  ): Promise<MessageResponse> {
    return apiClient<MessageResponse>(
      `/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ query, document_id: documentId }),
      },
    );
  }
}
