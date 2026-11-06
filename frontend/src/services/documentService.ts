import { apiClient, API_BASE_URL } from "@/lib/api";
import { authStore } from "@/store/authStore";

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface DocumentResponse {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  upload_date: string;
  status: string;
}

export interface UploadResponse {
  message: string;
  document_id: string;
  filename: string;
  file_size: number;
  file_type: string;
  status: string;
}

export interface DocumentListResponse {
  documents: DocumentResponse[];
  total: number;
  skip: number;
  limit: number;
}

export interface EmbeddingResponse {
  message: string;
  document_id: string;
  chunks_embedded: number;
  embedding_model: string;
}

export interface SearchResultChunk {
  chunk_index: number;
  score: number;
  content: string;
  document_id: string;
  chunk_size: number;
}

export interface SearchResponse {
  query: string;
  matches: SearchResultChunk[];
}

export interface ChatSourceMetadata {
  document_id: string;
  chunk_index: number;
  score: number;
  content?: string | null;
  document_name?: string | null;
}

export interface ChatResponse {
  query: string;
  answer: string;
  sources: ChatSourceMetadata[];
  model: string;
  num_chunks: number;
}

// ============================================================================
// DOCUMENT SERVICE
// ============================================================================

export class DocumentService {
  /**
   * Upload a document file.
   *
   * Sends multipart/form-data with the file to POST /documents/upload.
   * Automatically triggers text extraction and chunking on backend.
   *
   * @param file - The file to upload
   * @param onProgress - Optional callback for upload progress
   * @returns Upload response with document_id and metadata
   * @throws Error if upload fails
   */
  static async uploadDocument(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    // Create XMLHttpRequest for progress tracking if callback provided
    if (onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const token = authStore.getToken();

        // Track upload progress
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        });

        // Handle completion
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText) as UploadResponse;
              resolve(response);
            } catch {
              reject(new Error("Failed to parse upload response"));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.detail || "Upload failed"));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        // Handle errors
        xhr.addEventListener("error", () => {
          reject(new Error("Upload request failed. Please check your network connection."));
        });

        // Configure and send request
        xhr.open("POST", `${API_BASE_URL}/documents/upload`);
        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }
        xhr.send(formData);
      });
    }

    // Without progress tracking, use apiClient
    return apiClient<UploadResponse>("/documents/upload", {
      method: "POST",
      body: formData,
    });
  }

  /**
   * List documents for the current user.
   *
   * @param skip - Number of documents to skip (for pagination)
   * @param limit - Maximum documents to return (default 10)
   * @returns List of documents and pagination info
   * @throws Error if request fails
   */
  static async listDocuments(
    skip: number = 0,
    limit: number = 10,
  ): Promise<DocumentListResponse> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });

    const rawResponse = await apiClient<any>(
      `/documents?${params.toString()}`,
      { method: "GET" },
    );

    // Normalise: backend may return a flat array OR { documents: [...], total, skip, limit }
    const docArray: any[] = Array.isArray(rawResponse)
      ? rawResponse
      : Array.isArray(rawResponse?.documents)
        ? rawResponse.documents
        : [];

    const total: number = Array.isArray(rawResponse)
      ? rawResponse.length
      : rawResponse?.total ?? rawResponse?.length ?? docArray.length;

    // Always map _id → id so the UI's selectedDocId is never undefined
    const normalised = docArray.map((doc: any) => ({
      ...doc,
      id: doc.id ?? doc._id ?? "",
    }));

    return {
      documents: normalised,
      total,
      skip: rawResponse?.skip ?? 0,
      limit: rawResponse?.limit ?? limit,
    } as DocumentListResponse;
  }

  /**
   * Delete a document.
   *
   * Removes document metadata, chunks, and uploaded file.
   *
   * @param documentId - The ID of the document to delete
   * @returns Deletion confirmation
   * @throws Error if deletion fails
   */
  static async deleteDocument(
    documentId: string,
  ): Promise<{ message: string }> {
    return apiClient<{ message: string }>(`/documents/${documentId}`, {
      method: "DELETE",
    });
  }

  /**
   * Download original document file.
   */
  static getDownloadUrl(documentId: string): string {
    const token = authStore.getToken();
    return `${API_BASE_URL}/documents/${documentId}/download${token ? `?token=${token}` : ""}`;
  }

  static async downloadDocument(documentId: string, filename: string): Promise<void> {
    const token = authStore.getToken();
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      let msg = "Failed to download file";
      try {
        const data = await response.json();
        msg = data.detail || msg;
      } catch {}
      throw new Error(msg);
    }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }

  /**
   * Generate embeddings for a document's chunks.
   *
   * @param documentId - The ID of the document
   * @returns Embedding generation confirmation
   * @throws Error if embedding generation fails
   */
  static async generateEmbeddings(
    documentId: string,
  ): Promise<EmbeddingResponse> {
    return apiClient<EmbeddingResponse>(
      `/documents/${documentId}/generate-embeddings`,
      { method: "POST" },
    );
  }

  /**
   * Perform semantic search across all documents.
   *
   * @param query - The search query
   * @param documentId - Optional document ID filter
   * @param topK - Number of top results to return (default 10)
   * @returns Search results with matched chunks
   * @throws Error if search fails
   */
  static async searchDocuments(
    query: string,
    documentId?: string,
    topK: number = 10,
  ): Promise<SearchResponse> {
    return apiClient<SearchResponse>(`/documents/search?top_k=${topK}`, {
      method: "POST",
      body: JSON.stringify({ query, document_id: documentId }),
    });
  }

  /**
   * RAG Chat - Answer questions using document context.
   *
   * @param query - The question to answer
   * @param documentId - Optional document ID to restrict chat context
   * @param topK - Number of context chunks to use (default 10)
   * @returns RAG response with answer and sources
   * @throws Error if chat/LLM fails
   */
  static async chatWithDocuments(
    query: string,
    documentId?: string,
    topK: number = 10,
  ): Promise<ChatResponse> {
    return apiClient<ChatResponse>(`/documents/chat?top_k=${topK}`, {
      method: "POST",
      body: JSON.stringify({ query, document_id: documentId }),
    });
  }
}

