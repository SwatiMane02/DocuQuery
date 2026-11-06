import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileText,
  X,
  Trash2,
  AlertCircle,
  Download,
  Search,
  ArrowUpDown,
  ChevronDown,
  Zap,
  Info,
  HardDrive,
  FileType,
  FileCode,
  FileEdit,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { DocumentService, DocumentResponse } from "@/services/documentService";
import { toast } from "sonner";

export const Route = createFileRoute("/_user/documents")({
  component: Documents,
});

interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: "uploading" | "extracting" | "chunking" | "ready" | "error";
  error?: string;
}

// Rich badge and icon styling matching DocuQuery dark editorial palette
const getDocBadge = (type: string = "", filename: string = "") => {
  const lower = ((type || "") + " " + (filename || "")).toLowerCase();
  if (lower.includes("pdf")) return { label: "PDF", bg: "#E5484D", text: "#FFFFFF", icon: FileType };
  if (lower.includes("doc")) return { label: "DOCX", bg: "#2563EB", text: "#FFFFFF", icon: FileEdit };
  if (lower.includes("txt")) return { label: "TXT", bg: "#475569", text: "#FFFFFF", icon: FileCode };
  if (lower.includes("csv")) return { label: "CSV", bg: "#10B981", text: "#FFFFFF", icon: FileText };
  return { label: "DOC", bg: "#E8913C", text: "#FFFFFF", icon: FileText };
};

export function Documents() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search, filter, sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "size_desc" | "size_asc">("newest");

  // Selected document info modal
  const [selectedInfoDoc, setSelectedInfoDoc] = useState<DocumentResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await DocumentService.listDocuments(0, 100);
      setDocuments(response?.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (files: FileList) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = `${file.name}-${Date.now()}-${i}`;

      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/csv",
      ];

      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|docx|txt|csv)$/i)) {
        setUploadProgress((prev) => {
          const newMap = new Map(prev);
          newMap.set(fileId, {
            fileId,
            fileName: file.name,
            progress: 0,
            status: "error",
            error: "File type not supported. Use PDF, DOCX, TXT, or CSV.",
          });
          return newMap;
        });
        toast.error(`"${file.name}" is not a supported file type`);
        continue;
      }

      // Check file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        setUploadProgress((prev) => {
          const newMap = new Map(prev);
          newMap.set(fileId, {
            fileId,
            fileName: file.name,
            progress: 0,
            status: "error",
            error: "File exceeds 50MB limit",
          });
          return newMap;
        });
        toast.error(`"${file.name}" exceeds 50MB limit`);
        continue;
      }

      // Start upload
      setUploadProgress((prev) => {
        const newMap = new Map(prev);
        newMap.set(fileId, {
          fileId,
          fileName: file.name,
          progress: 0,
          status: "uploading",
        });
        return newMap;
      });

      try {
        const uploadResult = await DocumentService.uploadDocument(file, (progress) => {
          setUploadProgress((prev) => {
            const newMap = new Map(prev);
            const current = newMap.get(fileId) || {
              fileId,
              fileName: file.name,
              progress: 0,
              status: "uploading",
            };
            newMap.set(fileId, { ...current, progress });
            return newMap;
          });
        });

        setUploadProgress((prev) => {
          const newMap = new Map(prev);
          newMap.set(fileId, {
            fileId,
            fileName: file.name,
            progress: 100,
            status: "extracting",
          });
          return newMap;
        });

        // Trigger embeddings in background
        try {
          await DocumentService.generateEmbeddings(uploadResult.document_id);
        } catch (embeddingErr) {
          console.warn("Embedding generation delayed:", embeddingErr);
        }

        setUploadProgress((prev) => {
          const newMap = new Map(prev);
          newMap.set(fileId, {
            fileId,
            fileName: file.name,
            progress: 100,
            status: "ready",
          });
          return newMap;
        });

        toast.success(`"${file.name}" uploaded and indexed successfully!`);
        await loadDocuments();
      } catch (err) {
        setUploadProgress((prev) => {
          const newMap = new Map(prev);
          newMap.set(fileId, {
            fileId,
            fileName: file.name,
            progress: 0,
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          });
          return newMap;
        });
        toast.error(`Failed to upload "${file.name}"`);
      }
    }
  };

  const handleDeleteDocument = async (documentId: string, filename: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${filename}"?`)) return;

    try {
      await DocumentService.deleteDocument(documentId);
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      toast.success(`"${filename}" deleted successfully`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  const handleDownload = async (doc: DocumentResponse) => {
    try {
      toast.info(`Downloading ${doc.filename}...`);
      await DocumentService.downloadDocument(doc.id, doc.filename);
      toast.success("Download started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.currentTarget.files) {
      handleFileSelect(e.currentTarget.files);
    }
    e.currentTarget.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Filter and sort documents
  const filteredDocuments = (documents || [])
    .filter((doc) => {
      const filename = doc?.filename || "";
      const fileType = doc?.file_type || "";
      const matchesSearch = filename.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        typeFilter === "All" ||
        (typeFilter === "PDF" && fileType.includes("pdf")) ||
        (typeFilter === "Word" && (fileType.includes("doc") || fileType.includes("officedocument"))) ||
        (typeFilter === "Text" && (fileType.includes("text") || fileType.includes("txt"))) ||
        (typeFilter === "CSV" && (fileType.includes("csv") || filename.endsWith(".csv")));
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b?.upload_date || 0).getTime() - new Date(a?.upload_date || 0).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a?.upload_date || 0).getTime() - new Date(b?.upload_date || 0).getTime();
      }
      if (sortBy === "size_desc") {
        return (b?.file_size || 0) - (a?.file_size || 0);
      }
      if (sortBy === "size_asc") {
        return (a?.file_size || 0) - (b?.file_size || 0);
      }
      return 0;
    });

  const storageUsedMB = (documents || []).reduce((sum, doc) => sum + (doc?.file_size || 0), 0) / (1024 * 1024);
  const storageQuotaMB = 2048; // 2GB quota
  const storagePercent = Math.min(100, (storageUsedMB / storageQuotaMB) * 100);

  return (
    <div
      className="w-full flex flex-col font-['Sora',sans-serif] text-[#EDE7DC] pb-16"
      style={{ gap: "32px" }}
    >
      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-[#E5484D]/10 border border-[#E5484D]/30 p-4 sm:p-5 flex items-start justify-between gap-3 text-[#EDE7DC]"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[#E5484D] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-[#EDE7DC]">Error loading documents</h3>
              <p className="text-xs text-[#9EA5A8] mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={loadDocuments}
            className="px-4 py-1.5 rounded-xl border border-[rgba(237,231,220,0.2)] bg-[#101317] hover:bg-[#161A20] text-xs font-medium text-[#EDE7DC] transition-all"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* ====================================================================
          1. PAGE HEADER (TITLE, SUBTITLE & UPLOAD BUTTON)
          ==================================================================== */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#42C8D5] shadow-[0_0_8px_#42C8D5] shrink-0" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#9EA5A8] font-semibold">
              REPOSITORY STORAGE
            </span>
          </div>
          <h1 className="font-['Syne',sans-serif] text-3xl sm:text-4xl font-bold tracking-tight text-[#EDE7DC]">
            Knowledge Base
          </h1>
          <p className="mt-1.5 text-sm sm:text-[15px] text-[#9EA5A8] leading-relaxed max-w-2xl">
            Upload and manage your research papers, books, reports, and reference documents.
          </p>
        </div>

        <button
          onClick={handleBrowseClick}
          className="inline-flex items-center justify-center gap-2.5 h-12 rounded-xl bg-[#E8913C] hover:bg-[#f39c4a] text-[#0A0C0E] font-semibold text-[14.5px] transition-all shadow-[0_4px_18px_rgba(232,145,60,0.32)] active:scale-[0.98] cursor-pointer whitespace-nowrap min-w-[195px]"
          style={{ paddingLeft: "26px", paddingRight: "26px" }}
        >
          <UploadCloud className="h-5 w-5 stroke-[2.3] shrink-0" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* ====================================================================
          2. DRAG AND DROP UPLOAD ZONE
          ==================================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        className={`rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center relative overflow-hidden group shadow-[0_4px_20px_rgba(0,0,0,0.25)] ${
          isDragging
            ? "border-[#42C8D5] bg-[#121B24]/90 shadow-[0_0_24px_rgba(66,200,213,0.3)] scale-[1.005]"
            : "border-[rgba(237,231,220,0.18)] hover:border-[#42C8D5]/60 bg-[#101317] hover:bg-[#13171D]"
        }`}
        style={{ padding: "40px 24px" }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.csv"
          onChange={handleInputChange}
          className="hidden"
          aria-label="Upload files"
        />

        {/* Ambient Subtle Glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#42C8D5]/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Icon Badge */}
        <div className="w-14 h-14 rounded-2xl bg-[#42C8D5]/12 border border-[#42C8D5]/30 flex items-center justify-center text-[#42C8D5] shadow-[0_0_16px_rgba(66,200,213,0.2)] mb-3.5 transition-transform group-hover:scale-105">
          <UploadCloud className="h-7 w-7 stroke-[2]" />
        </div>

        <h3 className="font-['Syne',sans-serif] text-xl sm:text-2xl font-bold text-[#EDE7DC]">
          Drop files here or click to browse
        </h3>
        <p className="mt-1.5 text-xs sm:text-sm text-[#9EA5A8] max-w-md">
          Supports <span className="text-[#EDE7DC] font-medium">PDF, DOCX, TXT</span>, and{" "}
          <span className="text-[#EDE7DC] font-medium">CSV</span> files up to 50MB each
        </p>
      </motion.div>

      {/* ====================================================================
          UPLOAD PROGRESS QUEUE
          ==================================================================== */}
      {uploadProgress.size > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#9EA5A8]">
            Upload Queue
          </h3>
          <ul className="space-y-2.5">
            {Array.from(uploadProgress.values()).map((item) => (
              <li
                key={item.fileId}
                className="bg-[#101317] border border-[rgba(237,231,220,0.12)] rounded-xl p-3.5 sm:p-4 flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-[#42C8D5]/10 border border-[#42C8D5]/30 flex items-center justify-center shrink-0">
                    <FileText className="h-4.5 w-4.5 text-[#42C8D5]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#EDE7DC] truncate">
                      {item.fileName}
                    </div>
                    {item.error ? (
                      <div className="text-xs text-[#E5484D] mt-0.5">
                        {item.error}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-[#0A0C0E] border border-[rgba(237,231,220,0.08)] overflow-hidden">
                          <div
                            className="h-full bg-[#E8913C] transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono text-[#9EA5A8] capitalize">
                          {item.status} ({item.progress}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setUploadProgress((prev) => {
                      const next = new Map(prev);
                      next.delete(item.fileId);
                      return next;
                    });
                  }}
                  className="text-[#9EA5A8] hover:text-[#EDE7DC] p-1.5 rounded-lg hover:bg-[#161B22] transition-colors"
                  title="Remove from queue"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ====================================================================
          3. SEARCH AND FILTERS BAR
          ==================================================================== */}
      <div
        className="bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
        style={{ padding: "16px 20px" }}
      >
        {/* Search Input Box */}
        <div className="relative w-full sm:min-w-[280px] md:min-w-[340px] max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9EA5A8]" />
          <input
            type="text"
            placeholder="Search by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 rounded-xl bg-[#0A0C0E] border border-[rgba(237,231,220,0.15)] text-xs sm:text-[13px] text-[#EDE7DC] placeholder-[#6C7378] focus:border-[#E8913C] focus:outline-none transition-colors"
            style={{ paddingLeft: "46px", paddingRight: "38px" }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6C7378] hover:text-[#EDE7DC] p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills and Sort Menu */}
        <div className="flex flex-wrap items-center gap-3.5 w-full sm:w-auto justify-between sm:justify-end">
          {/* File Type Filter Pills */}
          <div
            className="inline-flex rounded-xl border border-[rgba(237,231,220,0.15)] bg-[#0A0C0E] items-center"
            style={{ padding: "4px", gap: "6px" }}
          >
            {["All", "PDF", "Word", "Text", "CSV"].map((t) => {
              const active = typeFilter === t;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-[#E8913C] text-[#0A0C0E] font-semibold shadow-sm"
                      : "text-[#9EA5A8] hover:text-[#EDE7DC] hover:bg-[#161B22]"
                  }`}
                  style={{ paddingLeft: "15px", paddingRight: "15px", paddingTop: "7px", paddingBottom: "7px" }}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Sort Dropdown */}
          <div className="relative inline-flex items-center">
            <div
              className="flex items-center gap-2 bg-[#0A0C0E] border border-[rgba(237,231,220,0.15)] rounded-xl text-xs font-medium text-[#EDE7DC] h-11"
              style={{ paddingLeft: "16px", paddingRight: "38px" }}
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-[#9EA5A8] shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none bg-transparent border-0 text-xs text-[#EDE7DC] focus:outline-none cursor-pointer pr-1 whitespace-nowrap"
              >
                <option value="newest" className="bg-[#101317] text-[#EDE7DC]">Newest First</option>
                <option value="oldest" className="bg-[#101317] text-[#EDE7DC]">Oldest First</option>
                <option value="size_desc" className="bg-[#101317] text-[#EDE7DC]">Size: Largest</option>
                <option value="size_asc" className="bg-[#101317] text-[#EDE7DC]">Size: Smallest</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9EA5A8]" />
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          4. DOCUMENT LIST VIEW
          ==================================================================== */}
      <div>
        {isLoading ? (
          <div
            className="bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl flex flex-col items-center justify-center py-20 text-center"
            style={{ padding: "40px 24px" }}
          >
            <Loader2 className="h-7 w-7 animate-spin text-[#E8913C] mb-3" />
            <span className="text-sm text-[#9EA5A8]">Loading repository documents...</span>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div
            className="bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl text-center py-16 px-6"
            style={{ padding: "48px 24px" }}
          >
            <div className="w-14 h-14 rounded-2xl bg-[#161B22] border border-[rgba(237,231,220,0.1)] flex items-center justify-center mx-auto mb-3.5">
              <FileText className="h-7 w-7 text-[#6C7378]" />
            </div>
            <h3 className="font-['Syne',sans-serif] text-xl font-bold text-[#EDE7DC]">
              {searchQuery || typeFilter !== "All"
                ? "No matching documents found"
                : "No documents in your repository yet"}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-[#9EA5A8] max-w-md mx-auto">
              {searchQuery || typeFilter !== "All"
                ? "Try adjusting your search terms or filter criteria."
                : "Upload your first PDF, Word document, or text file to start asking questions with AI."}
            </p>
            {!searchQuery && typeFilter === "All" ? (
              <button
                onClick={handleBrowseClick}
                className="mt-5 inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-[#E8913C] hover:bg-[#f39c4a] text-[#0A0C0E] font-semibold text-xs sm:text-sm transition-all"
              >
                <UploadCloud className="h-4 w-4" />
                <span>Upload First Document</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("All");
                }}
                className="mt-5 inline-flex items-center gap-2 h-10 px-5 rounded-xl border border-[rgba(237,231,220,0.2)] bg-[#0A0C0E] hover:bg-[#161B22] text-[#EDE7DC] text-xs font-medium transition-all"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <ul
            className="w-full"
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {filteredDocuments.map((doc, i) => {
              const badge = getDocBadge(doc.file_type, doc.filename);
              const fileSizeMB = (doc.file_size / (1024 * 1024)).toFixed(2);
              const formattedDate = new Date(doc.upload_date).toLocaleDateString("en-GB", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });

              return (
                <motion.li
                  key={doc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="bg-[#101317] border border-[rgba(237,231,220,0.16)] hover:border-[#E8913C]/60 hover:bg-[#14191F] rounded-2xl flex flex-wrap items-center justify-between gap-4 transition-all shadow-[0_4px_18px_rgba(0,0,0,0.28)] group"
                  style={{ padding: "19px 26px" }}
                >
                  {/* Left Document Identity */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Badge Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm font-bold text-xs text-white"
                      style={{ backgroundColor: badge.bg }}
                    >
                      {badge.label}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className="truncate text-[15.5px] font-semibold text-[#EDE7DC] group-hover:text-[#E8913C] transition-colors cursor-pointer max-w-sm sm:max-w-md"
                          onClick={() =>
                            navigate({
                              to: "/ai-query",
                              state: (prev) => ({
                                ...prev,
                                selectedDocument: doc,
                              }),
                            })
                          }
                        >
                          {doc.filename}
                        </span>
                        <span
                          className="inline-flex items-center justify-center rounded-full border border-[#10B981]/40 bg-[#064E3B]/40 text-[11.5px] font-medium text-[#34D399] capitalize shrink-0 whitespace-nowrap"
                          style={{ paddingLeft: "14px", paddingRight: "14px", paddingTop: "3px", paddingBottom: "3px" }}
                        >
                          {doc.status || "Uploaded"}
                        </span>
                      </div>
                      <div className="text-[13px] text-[#9EA5A8] mt-1 font-mono">
                        {fileSizeMB} MB • Uploaded {formattedDate}
                      </div>
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-2.5">
                    {/* Query AI Button */}
                    <button
                      onClick={() =>
                        navigate({
                          to: "/ai-query",
                          state: (prev) => ({
                            ...prev,
                            selectedDocument: doc,
                          }),
                        })
                      }
                      className="h-9.5 px-4 rounded-xl bg-[#E8913C]/15 border border-[#E8913C]/40 text-[#E8913C] hover:bg-[#E8913C] hover:text-[#0A0C0E] text-[12.5px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Ask AI questions about this document"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      <span>Query AI</span>
                    </button>

                    {/* Info Details Button */}
                    <button
                      onClick={() => setSelectedInfoDoc(doc)}
                      className="h-9 w-9 rounded-xl border border-[rgba(237,231,220,0.12)] bg-[#0A0C0E]/50 text-[#9EA5A8] hover:text-[#EDE7DC] hover:border-[rgba(237,231,220,0.3)] flex items-center justify-center transition-all cursor-pointer"
                      title="View Details"
                    >
                      <Info className="h-4 w-4" />
                    </button>

                    {/* Download Button */}
                    <button
                      onClick={() => handleDownload(doc)}
                      className="h-9 w-9 rounded-xl border border-[rgba(237,231,220,0.12)] bg-[#0A0C0E]/50 text-[#9EA5A8] hover:text-[#EDE7DC] hover:border-[rgba(237,231,220,0.3)] flex items-center justify-center transition-all cursor-pointer"
                      title="Download original file"
                    >
                      <Download className="h-4 w-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                      className="h-9 w-9 rounded-xl border border-[rgba(237,231,220,0.12)] bg-[#0A0C0E]/50 text-[#9EA5A8] hover:text-[#E5484D] hover:border-[#E5484D]/40 hover:bg-[#E5484D]/10 flex items-center justify-center transition-all cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ====================================================================
          5. BOTTOM SECTION: AI PROMO BANNER + STORAGE QUOTA PANEL
          ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Instant AI Document Intelligence Card (~66% width) */}
        <div
          className="lg:col-span-8 bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl relative overflow-hidden flex flex-col justify-center min-h-[200px] shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
          style={{ padding: "30px 32px" }}
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-[#42C8D5]/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-xl my-auto">
            <h3 className="font-['Syne',sans-serif] text-xl font-bold text-[#EDE7DC] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#42C8D5]/12 border border-[#42C8D5]/35 flex items-center justify-center shrink-0">
                <Zap className="h-4.5 w-4.5 text-[#42C8D5]" />
              </div>
              <span>Instant AI Document Intelligence</span>
            </h3>
            <p className="mt-2.5 text-xs sm:text-sm text-[#9EA5A8] leading-relaxed">
              Every file uploaded is parsed, segmented into semantic text chunks, and embedded with sentence-transformers.
              Ask targeted questions with real citation backings.
            </p>
            <div className="mt-4 sm:mt-5">
              <button
                onClick={() => navigate({ to: "/ai-query" })}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#E8913C] hover:text-[#f3a458] transition-colors group cursor-pointer"
              >
                <span>Open Chat Studio</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Storage Quota Panel (~34% width) */}
        <div
          className="lg:col-span-4 bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl flex flex-col justify-between min-h-[200px] shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
          style={{ padding: "28px 24px" }}
        >
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-[#9EA5A8] flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-[#E8913C]" />
              <span>STORAGE QUOTA</span>
            </div>
            <div className="mt-3 font-['Syne',sans-serif] text-3xl font-bold text-[#EDE7DC]">
              {storageUsedMB.toFixed(1)}{" "}
              <span className="text-sm font-sans font-normal text-[#6C7378]">
                MB / {storageQuotaMB} MB
              </span>
            </div>

            {/* Custom High-Contrast Progress Bar */}
            <div className="mt-4 w-full h-2 rounded-full bg-[#0A0C0E] border border-[rgba(237,231,220,0.1)] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#42C8D5] to-[#E8913C] transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(2, storagePercent)}%` }}
              />
            </div>
          </div>

          <div className="mt-5 text-xs text-[#9EA5A8] flex items-center justify-between border-t border-[rgba(237,231,220,0.06)] pt-3.5">
            <span>{documents.length} files stored</span>
            <span className="font-mono text-[#EDE7DC]">{storagePercent.toFixed(1)}% quota used</span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          6. DOCUMENT INFO MODAL
          Spacious width & height, ample vertical spacing, enhanced font sizes
          ==================================================================== */}
      <AnimatePresence>
        {selectedInfoDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#101317] border border-[rgba(237,231,220,0.18)] rounded-3xl w-full max-w-[560px] shadow-[0_20px_60px_rgba(0,0,0,0.7)] text-[#EDE7DC]"
              style={{
                padding: "36px 34px",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
              }}
            >
              {/* Header: Badge + Filename + Close */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-[12.5px] text-white shrink-0 shadow-md"
                    style={{ backgroundColor: getDocBadge(selectedInfoDoc.file_type, selectedInfoDoc.filename).bg }}
                  >
                    {getDocBadge(selectedInfoDoc.file_type, selectedInfoDoc.filename).label}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-['Syne',sans-serif] text-[18px] font-bold text-[#EDE7DC] truncate">
                      {selectedInfoDoc.filename || "Untitled"}
                    </h3>
                    <p className="text-[12px] font-mono text-[#9EA5A8] mt-0.5">
                      ID: {selectedInfoDoc.id ? selectedInfoDoc.id.slice(0, 16) : "N/A"}...
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedInfoDoc(null)}
                  className="text-[#9EA5A8] hover:text-[#EDE7DC] p-2 rounded-xl hover:bg-[#161B22] transition-colors cursor-pointer shrink-0"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Document Metadata Table with increased vertical spacing and font size */}
              <div
                className="w-full rounded-2xl bg-[#080B0D] border border-[rgba(237,231,220,0.08)] p-4 text-[13.5px]"
                style={{ display: "flex", flexDirection: "column", gap: "14px" }}
              >
                <div className="flex justify-between items-center py-1 border-b border-[rgba(237,231,220,0.06)]">
                  <span className="text-[#9EA5A8] font-medium">MIME Type</span>
                  <span className="font-mono text-[#EDE7DC] font-medium">{selectedInfoDoc.file_type || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[rgba(237,231,220,0.06)]">
                  <span className="text-[#9EA5A8] font-medium">File Size</span>
                  <span className="text-[#EDE7DC] font-medium">
                    {((selectedInfoDoc.file_size || 0) / (1024 * 1024)).toFixed(2)} MB ({(selectedInfoDoc.file_size || 0).toLocaleString()} bytes)
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[rgba(237,231,220,0.06)]">
                  <span className="text-[#9EA5A8] font-medium">Status</span>
                  <span className="font-semibold text-[#34D399] capitalize">{selectedInfoDoc.status || "Processed"}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#9EA5A8] font-medium">Uploaded Date</span>
                  <span className="text-[#EDE7DC] font-mono">{selectedInfoDoc.upload_date ? new Date(selectedInfoDoc.upload_date).toLocaleString() : "N/A"}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  className="flex-1 h-11 rounded-xl bg-[#E8913C] hover:bg-[#ffa947] text-[#0A0C0E] font-bold text-[13.5px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  onClick={() => {
                    const target = selectedInfoDoc;
                    setSelectedInfoDoc(null);
                    navigate({
                      to: "/ai-query",
                      state: (prev) => ({ ...prev, selectedDocument: target }),
                    });
                  }}
                >
                  <Zap className="h-4 w-4" />
                  <span>Start Chat</span>
                </button>
                <button
                  className="h-11 px-6 rounded-xl border border-[rgba(237,231,220,0.2)] bg-[#161B22] hover:bg-[#202730] text-[#EDE7DC] text-[13.5px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  onClick={() => handleDownload(selectedInfoDoc)}
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
