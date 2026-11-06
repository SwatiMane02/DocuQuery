import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Search as SearchIcon,
  FileText,
  Loader2,
  AlertCircle,
  Info,
  Zap,
  X,
  History,
  Lightbulb,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  BarChart2,
  Network,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import { DocumentService, SearchResultChunk, DocumentResponse } from "@/services/documentService";

export const Route = createFileRoute("/_user/search")({ component: Search });

interface RecentSearchItem {
  id: string;
  query: string;
  time: string;
}

const DEFAULT_RECENT_SEARCHES: RecentSearchItem[] = [
  { id: "1", query: "research methodology", time: "2 hours ago" },
  { id: "2", query: "system architecture", time: "5 hours ago" },
  { id: "3", query: "project scope and roadmap", time: "Yesterday" },
];

const SEARCH_TIPS = [
  "Use natural language questions",
  "Search for concepts, not just keywords",
  "Try different phrasings for better results",
  'Combine multiple ideas (e.g., "methodology and results")',
];

const SUGGESTION_CARDS = [
  {
    id: "findings",
    query: "What are the main research findings and outcomes?",
    title: "Find key research findings",
    description: "Discover the main outcomes and conclusions from your documents.",
    icon: SearchIcon,
    accent: "#35D3E0",
    bgBadge: "rgba(53, 211, 224, 0.15)",
    borderBadge: "rgba(53, 211, 224, 0.35)",
    cardBorderHover: "rgba(53, 211, 224, 0.5)",
  },
  {
    id: "metrics",
    query: "Compare important metrics and performance indicators",
    title: "Compare important metrics",
    description: "Identify and compare key performance indicators across documents.",
    icon: BarChart2,
    accent: "#F29A32",
    bgBadge: "rgba(242, 154, 50, 0.15)",
    borderBadge: "rgba(242, 154, 50, 0.35)",
    cardBorderHover: "rgba(242, 154, 50, 0.5)",
  },
  {
    id: "architecture",
    query: "Explain the system architecture and component design",
    title: "Explore system architecture",
    description: "Find details about the system design, components and workflow.",
    icon: Network,
    accent: "#A36BFA",
    bgBadge: "rgba(163, 107, 250, 0.15)",
    borderBadge: "rgba(163, 107, 250, 0.35)",
    cardBorderHover: "rgba(163, 107, 250, 0.5)",
  },
  {
    id: "requirements",
    query: "Extract key functional and non-functional requirements",
    title: "Find project requirements",
    description: "Extract functional and non-functional requirements from your documents.",
    icon: ListChecks,
    accent: "#36CF91",
    bgBadge: "rgba(54, 207, 145, 0.15)",
    borderBadge: "rgba(54, 207, 145, 0.35)",
    cardBorderHover: "rgba(54, 207, 145, 0.5)",
  },
];

const getDocBadge = (filename: string = "") => {
  const lower = filename.toLowerCase();
  if (lower.includes("pdf")) return { label: "PDF", bg: "#E5484D" };
  if (lower.includes("doc")) return { label: "DOCX", bg: "#2563EB" };
  if (lower.includes("txt")) return { label: "TXT", bg: "#475569" };
  if (lower.includes("csv")) return { label: "CSV", bg: "#10B981" };
  return { label: "DOC", bg: "#F29A32" };
};

function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultChunk[]>([]);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [scope, setScope] = useState<"all" | "current">("all");
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [fileTypeFilter, setFileTypeFilter] = useState<"All" | "PDF" | "DOCX" | "TXT" | "CSV">("All");
  const [sortBy, setSortBy] = useState<"relevance" | "newest">("relevance");
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(DEFAULT_RECENT_SEARCHES);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const response = await DocumentService.listDocuments(0, 100);
        const docs = response?.documents || [];
        setDocuments(docs);
        if (docs.length > 0) {
          setSelectedDocId(docs[0].id);
        }
      } catch (err) {
        console.error("Failed to load documents for scoping:", err);
      }
    };
    fetchDocs();

    try {
      const stored = localStorage.getItem("docuquery_recent_searches");
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const saveRecentSearch = (text: string) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.query.toLowerCase() !== text.toLowerCase());
      const updated = [{ id: Date.now().toString(), query: text, time: "Just now" }, ...filtered].slice(0, 5);
      try {
        localStorage.setItem("docuquery_recent_searches", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleSearch = async (e?: React.FormEvent, explicitQuery?: string) => {
    e?.preventDefault();
    const q = (explicitQuery || query).trim();
    if (!q || isLoading) return;

    if (explicitQuery) {
      setQuery(explicitQuery);
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setSearchedQuery(q);
    saveRecentSearch(q);

    try {
      const docIdParam = scope === "current" ? (selectedDocId || undefined) : undefined;
      const response = await DocumentService.searchDocuments(q, docIdParam, 15);
      setResults(response?.matches || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Search failed. Please ensure embeddings are generated.",
      );
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getDocName = (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    return doc?.filename || `Doc: ${docId.slice(0, 8)}...`;
  };

  const handleQueryInChat = (chunk: SearchResultChunk) => {
    const matchedDoc = documents.find((d) => d.id === chunk.document_id);
    navigate({
      to: "/ai-query",
      state: (prev) => ({
        ...prev,
        selectedDocument: matchedDoc,
      }),
    });
  };

  // Filter results by file type if selected
  const filteredResults = results.filter((chunk) => {
    if (fileTypeFilter === "All") return true;
    const docName = getDocName(chunk.document_id).toLowerCase();
    if (fileTypeFilter === "PDF") return docName.endsWith(".pdf");
    if (fileTypeFilter === "DOCX") return docName.endsWith(".docx") || docName.endsWith(".doc");
    if (fileTypeFilter === "TXT") return docName.endsWith(".txt");
    if (fileTypeFilter === "CSV") return docName.endsWith(".csv");
    return true;
  });

  return (
    <div
      className="w-full max-w-[1360px] mx-auto pb-24 font-['Sora',sans-serif] text-[#EDE7DC]"
      style={{ display: "flex", flexDirection: "column", gap: "32px" }}
    >
      {/* ====================================================================
          1. HERO SEARCH PANEL
          Explicit vertical spacing: cards never touch each other
          ==================================================================== */}
      <section
        className="bg-[#101519] border border-[rgba(237,231,220,0.14)] rounded-3xl relative overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.36)] w-full"
        style={{ padding: "38px 42px 32px 42px", marginBottom: "0px" }}
      >
        {/* Subtle Ambient Wave in Background */}
        <div className="absolute top-0 right-0 w-[480px] h-full pointer-events-none overflow-hidden opacity-80">
          <svg className="w-full h-full" viewBox="0 0 480 240" fill="none">
            <path
              d="M80 220C180 160 280 240 430 130C490 85 530 65 570 75"
              stroke="url(#ambient_amber_trail)"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.65"
            />
            <path
              d="M130 240C240 170 320 220 460 120"
              stroke="url(#ambient_cyan_trail)"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.45"
            />
            <defs>
              <linearGradient id="ambient_amber_trail" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F29A32" stopOpacity="0" />
                <stop offset="50%" stopColor="#F29A32" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#35D3E0" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ambient_cyan_trail" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#35D3E0" stopOpacity="0" />
                <stop offset="60%" stopColor="#35D3E0" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#A36BFA" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Decorative Floating Document Cards - Positioned high to never overlap controls */}
        <div className="hidden lg:block absolute right-12 top-4 w-[230px] h-[115px] pointer-events-none scale-90 origin-top-right">
          {/* PDF Card */}
          <div
            className="absolute top-0 left-4 w-18 h-22 rounded-xl bg-[#161C22] border border-[rgba(237,231,220,0.18)] shadow-[0_12px_24px_rgba(0,0,0,0.5)] transform -rotate-12 p-1.5"
          >
            <div className="w-8 h-3 rounded bg-[#E5484D] text-[8px] font-bold text-white flex items-center justify-center uppercase tracking-wider">
              PDF
            </div>
            <div className="space-y-1 mt-2.5 px-1">
              <div className="h-0.5 bg-[rgba(237,231,220,0.2)] rounded-full w-4/5" />
              <div className="h-0.5 bg-[rgba(237,231,220,0.12)] rounded-full w-full" />
              <div className="h-0.5 bg-[rgba(237,231,220,0.12)] rounded-full w-2/3" />
            </div>
          </div>

          {/* DOCX Card */}
          <div
            className="absolute top-1 left-22 w-18 h-22 rounded-xl bg-[#161C22] border border-[rgba(237,231,220,0.18)] shadow-[0_12px_24px_rgba(0,0,0,0.5)] transform rotate-6 p-1.5"
          >
            <div className="w-8 h-3 rounded bg-[#2563EB] text-[8px] font-bold text-white flex items-center justify-center uppercase tracking-wider">
              DOCX
            </div>
            <div className="space-y-1 mt-2.5 px-1">
              <div className="h-0.5 bg-[rgba(237,231,220,0.2)] rounded-full w-3/4" />
              <div className="h-0.5 bg-[rgba(237,231,220,0.12)] rounded-full w-full" />
            </div>
          </div>

          {/* TXT Card */}
          <div
            className="absolute top-10 left-1 w-17 h-20 rounded-xl bg-[#12171D] border border-[rgba(237,231,220,0.14)] shadow-[0_14px_28px_rgba(0,0,0,0.6)] transform -rotate-6 p-1.5 z-10"
          >
            <div className="w-7 h-3 rounded bg-[#475569] text-[7.5px] font-bold text-white flex items-center justify-center uppercase tracking-wider">
              TXT
            </div>
            <div className="space-y-1 mt-2 px-1">
              <div className="h-0.5 bg-[rgba(237,231,220,0.18)] rounded-full w-5/6" />
              <div className="h-0.5 bg-[rgba(237,231,220,0.1)] rounded-full w-full" />
            </div>
          </div>

          {/* CSV Card */}
          <div
            className="absolute top-10 left-32 w-17 h-20 rounded-xl bg-[#12171D] border border-[rgba(237,231,220,0.14)] shadow-[0_14px_28px_rgba(0,0,0,0.6)] transform rotate-12 p-1.5 z-10"
          >
            <div className="w-7 h-3 rounded bg-[#10B981] text-[7.5px] font-bold text-white flex items-center justify-center uppercase tracking-wider">
              CSV
            </div>
            <div className="space-y-1 mt-2 px-1">
              <div className="h-0.5 bg-[rgba(237,231,220,0.18)] rounded-full w-4/5" />
              <div className="h-0.5 bg-[rgba(237,231,220,0.1)] rounded-full w-full" />
            </div>
          </div>
        </div>

        {/* Top Header Row: Icon + Title + Subtitle */}
        <div
          className="flex items-start gap-4.5 max-w-2xl"
          style={{ marginBottom: "26px" }}
        >
          <div className="w-13 h-13 rounded-2xl bg-[#35D3E0]/15 border border-[#35D3E0]/40 text-[#35D3E0] flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(53,211,224,0.22)]">
            <SearchIcon className="h-6.5 w-6.5 stroke-[2.3]" />
          </div>
          <div>
            <h1 className="font-['Syne',sans-serif] text-2xl sm:text-3xl font-bold tracking-tight text-[#EDE7DC]">
              Semantic Search
            </h1>
            <p className="mt-1.5 text-xs sm:text-[13.5px] text-[#A3ADB2] leading-relaxed">
              Query across all vector-embedded documents using natural language. Passages are ranked by cosine similarity score.
            </p>
          </div>
        </div>

        {/* Scope Row: Explicit vertical gap above and below */}
        <div
          className="flex flex-wrap items-center gap-3 sm:gap-4"
          style={{ marginBottom: "26px" }}
        >
          <span className="text-[11.5px] font-mono font-bold uppercase tracking-[0.16em] text-[#A3ADB2] mr-1">
            SCOPE:
          </span>

          {/* Scope Segmented Pill with proper padding & spacing */}
          <div
            className="inline-flex rounded-full border border-[rgba(237,231,220,0.18)] bg-[#080B0D] items-center"
            style={{ padding: "4px 6px", gap: "6px" }}
          >
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                scope === "all"
                  ? "bg-[#181D23] text-[#F29A32] border border-[#F29A32]/60 shadow-[0_0_12px_rgba(242,154,50,0.25)]"
                  : "text-[#A3ADB2] hover:text-[#EDE7DC]"
              }`}
              style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "7px", paddingBottom: "7px" }}
            >
              All My Documents
            </button>
            <button
              type="button"
              onClick={() => setScope("current")}
              className={`rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                scope === "current"
                  ? "bg-[#181D23] text-[#F29A32] border border-[#F29A32]/60 shadow-[0_0_12px_rgba(242,154,50,0.25)]"
                  : "text-[#A3ADB2] hover:text-[#EDE7DC]"
              }`}
              style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "7px", paddingBottom: "7px" }}
            >
              Single Document
            </button>
          </div>

          {/* Document Dropdown Pill with ample padding */}
          <div className="relative inline-flex items-center">
            <div
              className="flex items-center gap-2.5 rounded-full border border-[rgba(237,231,220,0.18)] bg-[#080B0D] hover:border-[rgba(237,231,220,0.3)] text-xs font-medium text-[#EDE7DC] transition-colors"
              style={{ paddingLeft: "16px", paddingRight: "36px", paddingTop: "7px", paddingBottom: "7px" }}
            >
              <FileText className="h-3.5 w-3.5 text-[#A3ADB2] shrink-0" />
              <select
                id="scope-select"
                value={selectedDocId}
                onChange={(e) => {
                  setSelectedDocId(e.target.value);
                  setScope("current");
                }}
                className="appearance-none bg-transparent text-xs font-medium text-[#EDE7DC] focus:outline-none cursor-pointer pr-2 truncate max-w-[210px]"
              >
                {documents.length === 0 ? (
                  <option value="" className="bg-[#101519] text-[#A3ADB2]">
                    Declarations Policy_DAV.pdf
                  </option>
                ) : (
                  documents.map((doc) => (
                    <option key={doc.id} value={doc.id} className="bg-[#101519] text-[#EDE7DC]">
                      {doc.filename}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A3ADB2]" />
            </div>
          </div>
        </div>

        {/* Large Search Input Bar with generous separation */}
        <form
          onSubmit={(e) => handleSearch(e)}
          className="relative"
          style={{ marginBottom: "26px" }}
        >
          <div className="relative flex items-center">
            <SearchIcon className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A3ADB2]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type what you want to find across your knowledge base..."
              className="w-full h-14 sm:h-15 rounded-full bg-[#080B0D] border border-[rgba(237,231,220,0.22)] text-sm sm:text-[14.5px] text-[#EDE7DC] placeholder-[#6C777D] focus:border-[#F29A32] focus:ring-1 focus:ring-[#F29A32]/40 focus:outline-none transition-all shadow-inner"
              style={{ paddingLeft: "54px", paddingRight: "140px" }}
              disabled={isLoading}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-34 top-1/2 -translate-y-1/2 text-[#A3ADB2] hover:text-[#EDE7DC] p-1.5 transition-colors cursor-pointer"
                title="Clear query"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-10.5 px-6 rounded-full bg-[#F29A32] hover:bg-[#ffa947] text-[#080B0D] font-bold text-xs sm:text-[13px] shadow-[0_2px_12px_rgba(242,154,50,0.3)] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:hover:bg-[#F29A32] active:scale-95 whitespace-nowrap"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#080B0D]" />
              ) : (
                <SearchIcon className="h-4 w-4 stroke-[2.4]" />
              )}
              <span>Search</span>
            </button>
          </div>
        </form>

        {/* Bottom Toolbar: Filter by Type + Sort by + Recent Searches */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 border-t border-[rgba(237,231,220,0.08)]"
          style={{ paddingTop: "22px" }}
        >
          {/* Left: Filter by Type pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-[#A3ADB2] font-medium mr-1.5">Filter by Type:</span>

            {/* All */}
            <button
              type="button"
              onClick={() => setFileTypeFilter("All")}
              className={`rounded-full text-xs font-semibold transition-all cursor-pointer ${
                fileTypeFilter === "All"
                  ? "bg-[#35D3E0]/15 text-[#35D3E0] border border-[#35D3E0]/50"
                  : "bg-[#080B0D] text-[#A3ADB2] border border-[rgba(237,231,220,0.12)] hover:text-[#EDE7DC]"
              }`}
              style={{ paddingLeft: "15px", paddingRight: "15px", paddingTop: "6px", paddingBottom: "6px" }}
            >
              All
            </button>

            {/* PDF */}
            <button
              type="button"
              onClick={() => setFileTypeFilter("PDF")}
              className={`rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                fileTypeFilter === "PDF"
                  ? "bg-[#E5484D]/20 text-[#E5484D] border border-[#E5484D]/60"
                  : "bg-[#080B0D] text-[#E5484D]/80 border border-[#E5484D]/30 hover:border-[#E5484D]/60 hover:text-[#E5484D]"
              }`}
              style={{ paddingLeft: "14px", paddingRight: "14px", paddingTop: "6px", paddingBottom: "6px" }}
            >
              <FileText className="h-3 w-3" />
              <span>PDF</span>
            </button>

            {/* DOCX */}
            <button
              type="button"
              onClick={() => setFileTypeFilter("DOCX")}
              className={`rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                fileTypeFilter === "DOCX"
                  ? "bg-[#2563EB]/20 text-[#60A5FA] border border-[#2563EB]/60"
                  : "bg-[#080B0D] text-[#60A5FA]/80 border border-[#2563EB]/30 hover:border-[#2563EB]/60 hover:text-[#60A5FA]"
              }`}
              style={{ paddingLeft: "14px", paddingRight: "14px", paddingTop: "6px", paddingBottom: "6px" }}
            >
              <FileText className="h-3 w-3" />
              <span>DOCX</span>
            </button>

            {/* TXT */}
            <button
              type="button"
              onClick={() => setFileTypeFilter("TXT")}
              className={`rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                fileTypeFilter === "TXT"
                  ? "bg-[#A36BFA]/20 text-[#C084FC] border border-[#A36BFA]/60"
                  : "bg-[#080B0D] text-[#C084FC]/80 border border-[#A36BFA]/30 hover:border-[#A36BFA]/60 hover:text-[#C084FC]"
              }`}
              style={{ paddingLeft: "14px", paddingRight: "14px", paddingTop: "6px", paddingBottom: "6px" }}
            >
              <FileText className="h-3 w-3" />
              <span>TXT</span>
            </button>

            {/* CSV */}
            <button
              type="button"
              onClick={() => setFileTypeFilter("CSV")}
              className={`rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                fileTypeFilter === "CSV"
                  ? "bg-[#36CF91]/20 text-[#36CF91] border border-[#36CF91]/60"
                  : "bg-[#080B0D] text-[#36CF91]/80 border border-[#36CF91]/30 hover:border-[#36CF91]/60 hover:text-[#36CF91]"
              }`}
              style={{ paddingLeft: "14px", paddingRight: "14px", paddingTop: "6px", paddingBottom: "6px" }}
            >
              <FileText className="h-3 w-3" />
              <span>CSV</span>
            </button>
          </div>

          {/* Right: Sort by dropdown + Recent Searches button */}
          <div className="flex items-center gap-4">
            <div className="h-4 w-px bg-[rgba(237,231,220,0.15)] hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#A3ADB2]">Sort by:</span>
              <div className="relative inline-flex items-center">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none rounded-full border border-[rgba(237,231,220,0.16)] bg-[#080B0D] text-xs font-medium text-[#EDE7DC] focus:outline-none cursor-pointer"
                  style={{ paddingLeft: "14px", paddingRight: "30px", paddingTop: "6px", paddingBottom: "6px" }}
                >
                  <option value="relevance" className="bg-[#101519] text-[#EDE7DC]">Relevance</option>
                  <option value="newest" className="bg-[#101519] text-[#EDE7DC]">Newest</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A3ADB2]" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const recentElement = document.getElementById("recent-searches-card");
                recentElement?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(237,231,220,0.16)] bg-[#080B0D] hover:bg-[#161C22] text-xs font-medium text-[#EDE7DC] transition-colors cursor-pointer"
              style={{ paddingLeft: "16px", paddingRight: "16px", paddingTop: "6px", paddingBottom: "6px" }}
            >
              <History className="h-3.5 w-3.5 text-[#A3ADB2]" />
              <span>Recent Searches</span>
            </button>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. ERROR BANNER
          ==================================================================== */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-[#E5484D]/10 border border-[#E5484D]/30 p-5 flex items-start gap-3.5 text-[#EDE7DC]"
          style={{ marginBottom: "0px" }}
        >
          <AlertCircle className="h-5 w-5 text-[#E5484D] shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-[#EDE7DC]">Search Error</h3>
            <p className="text-xs sm:text-[13px] text-[#A3ADB2] mt-1 leading-relaxed">{error}</p>
          </div>
        </motion.div>
      )}

      {/* ====================================================================
          3. MAIN CONTENT: 2-COLUMN GRID (Left approx 68% + Right approx 32%)
          Generous 32px vertical and horizontal gap between major sections
          ==================================================================== */}
      <div
        className="grid grid-cols-1 lg:grid-cols-12 items-start w-full"
        style={{ gap: "32px" }}
      >
        {/* ==================================================================
            LEFT COLUMN (approx 68%): Empty State / Results
            ================================================================== */}
        <div className="lg:col-span-8 w-full">
          {isLoading ? (
            /* Loading State */
            <div
              className="bg-[#101519] border border-[rgba(237,231,220,0.14)] rounded-3xl flex flex-col items-center justify-center text-center shadow-[0_8px_32px_rgba(0,0,0,0.3)] w-full"
              style={{ padding: "64px 32px" }}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#F29A32]/12 border border-[#F29A32]/35 flex items-center justify-center mb-4">
                <Loader2 className="h-7 w-7 animate-spin text-[#F29A32]" />
              </div>
              <h3 className="font-['Syne',sans-serif] text-xl font-bold text-[#EDE7DC]">
                Scanning Vector Embeddings...
              </h3>
              <p className="text-xs sm:text-sm text-[#A3ADB2] mt-2 max-w-sm leading-relaxed">
                Retrieving semantically relevant passages across your documents with cosine similarity.
              </p>
            </div>
          ) : hasSearched ? (
            /* Search Results View */
            <section
              className="w-full"
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="font-['Syne',sans-serif] text-xl font-bold text-[#EDE7DC]">
                  {filteredResults.length > 0
                    ? `${filteredResults.length} relevant match${filteredResults.length === 1 ? "" : "es"} for "${searchedQuery}"`
                    : `No matches found for "${searchedQuery}"`}
                </h2>
                <button
                  onClick={() => setHasSearched(false)}
                  className="text-xs text-[#F29A32] hover:underline cursor-pointer font-medium"
                >
                  ← Back to suggestions
                </button>
              </div>

              {filteredResults.length === 0 ? (
                <div
                  className="bg-[#101519] border border-[rgba(237,231,220,0.14)] rounded-3xl text-center shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                  style={{ padding: "56px 28px" }}
                >
                  <Info className="h-8 w-8 mx-auto text-[#6C777D] mb-3.5" />
                  <h3 className="font-['Syne',sans-serif] text-lg font-bold text-[#EDE7DC]">
                    No matching passages found
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A3ADB2] mt-1.5 max-w-sm mx-auto leading-relaxed">
                    Try different terminology or keywords, or make sure your files have embeddings generated.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {filteredResults.map((chunk, i) => {
                    const docName = getDocName(chunk.document_id);
                    const badge = getDocBadge(docName);

                    return (
                      <motion.div
                        key={`${chunk.document_id}-${chunk.chunk_index}-${i}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="bg-[#101519] border border-[rgba(237,231,220,0.14)] hover:border-[rgba(237,231,220,0.28)] rounded-2xl transition-all shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
                        style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "16px" }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm"
                              style={{ backgroundColor: badge.bg }}
                            >
                              {badge.label}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm sm:text-[14.5px] font-semibold text-[#EDE7DC] truncate">
                                {docName}
                              </div>
                              <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                                <span className="inline-flex items-center rounded-full bg-[#080B0D] border border-[rgba(237,231,220,0.12)] px-2.5 py-0.5 text-[10.5px] font-mono text-[#A3ADB2]">
                                  Chunk #{chunk.chunk_index}
                                </span>
                                {chunk.score !== undefined && (
                                  <span className="inline-flex items-center rounded-full border border-[#36CF91]/40 bg-[#064E3B]/40 px-2.5 py-0.5 text-[10.5px] font-semibold text-[#36CF91]">
                                    Match: {(chunk.score * 100).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleQueryInChat(chunk)}
                            className="h-9 px-4 rounded-xl bg-[#F29A32]/15 border border-[#F29A32]/40 text-[#F29A32] hover:bg-[#F29A32] hover:text-[#080B0D] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                          >
                            <Zap className="h-3.5 w-3.5" />
                            <span>Open in AI Chat</span>
                            <ArrowRight className="h-3 w-3 ml-0.5" />
                          </button>
                        </div>

                        <div className="rounded-xl bg-[#080B0D] border border-[rgba(237,231,220,0.08)] p-4 text-xs sm:text-[13px] text-[#EDE7DC] font-mono leading-relaxed whitespace-pre-wrap">
                          "{chunk.content}"
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : (
            /* Reference Empty State Card: "Search your knowledge base" */
            <div
              className="bg-[#101519] border border-[rgba(237,231,220,0.14)] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden w-full"
              style={{
                padding: "48px 36px 42px 36px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {/* Center Document-Search Illustration (CSS / SVG) */}
              <div
                className="flex justify-center items-center w-full"
                style={{ marginBottom: "24px" }}
              >
                <div className="relative w-28 h-26 flex items-center justify-center">
                  {/* Glowing backdrop aura */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#F29A32]/25 via-[#35D3E0]/15 to-transparent blur-xl rounded-full" />

                  {/* SVG Document Sheet with Lines */}
                  <svg className="w-20 h-22 relative z-10 drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)]" viewBox="0 0 80 90" fill="none">
                    <rect x="8" y="4" width="60" height="78" rx="8" fill="#181E25" stroke="#F29A32" strokeWidth="1.8" strokeOpacity="0.8" />
                    {/* Folded corner */}
                    <path d="M52 4V20H68" fill="#202730" stroke="#F29A32" strokeWidth="1.6" strokeOpacity="0.8" />
                    {/* Document Lines */}
                    <line x1="20" y1="32" x2="48" y2="32" stroke="#F29A32" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="20" y1="44" x2="56" y2="44" stroke="#F29A32" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.75" />
                    <line x1="20" y1="56" x2="44" y2="56" stroke="#F29A32" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.5" />
                  </svg>

                  {/* Overlapping Magnifying Glass */}
                  <div className="absolute -bottom-1 -right-1 z-20 w-11 h-11 rounded-full bg-[#12171E] border-2 border-[#35D3E0] shadow-[0_0_16px_rgba(53,211,224,0.4)] flex items-center justify-center text-[#35D3E0]">
                    <SearchIcon className="h-5 w-5 stroke-[2.4]" />
                  </div>
                </div>
              </div>

              {/* Title & Description: STRICTLY CENTERED */}
              <div
                className="w-full flex flex-col items-center justify-center text-center"
                style={{
                  maxWidth: "600px",
                  marginLeft: "auto",
                  marginRight: "auto",
                  marginBottom: "32px",
                  textAlign: "center",
                }}
              >
                <h2
                  className="font-['Syne',sans-serif] text-2xl sm:text-3xl font-bold text-[#EDE7DC]"
                  style={{ textAlign: "center", width: "100%" }}
                >
                  Search your knowledge base
                </h2>
                <p
                  className="mt-2.5 text-xs sm:text-[13.5px] text-[#A3ADB2] leading-relaxed"
                  style={{ textAlign: "center", width: "100%", margin: "10px auto 0 auto" }}
                >
                  DocuQuery finds semantic relationships across your uploaded documents rather than just literal keyword matches.
                </p>
              </div>

              {/* Decorative Divider: ——— ✦ Try these searches ✦ ——— */}
              <div
                className="flex items-center justify-center gap-4 text-xs font-mono uppercase tracking-[0.18em] text-[#A3ADB2] w-full"
                style={{ marginBottom: "30px", marginLeft: "auto", marginRight: "auto" }}
              >
                <div className="h-px bg-gradient-to-r from-transparent via-[rgba(237,231,220,0.2)] to-[rgba(237,231,220,0.2)] flex-1 max-w-[120px]" />
                <div className="flex items-center gap-2 text-[#EDE7DC]">
                  <span className="text-[#35D3E0]">✦</span>
                  <span className="font-semibold text-xs tracking-wider">Try these searches</span>
                  <span className="text-[#F29A32]">✦</span>
                </div>
                <div className="h-px bg-gradient-to-l from-transparent via-[rgba(237,231,220,0.2)] to-[rgba(237,231,220,0.2)] flex-1 max-w-[120px]" />
              </div>

              {/* 4 Interactive Suggestion Cards in a 2x2 Grid with generous gap & padding */}
              <div
                className="grid grid-cols-1 sm:grid-cols-2 w-full"
                style={{ gap: "20px" }}
              >
                {SUGGESTION_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.id}
                      onClick={() => handleSearch(undefined, card.query)}
                      className="group relative rounded-2xl bg-[#080B0D] border border-[rgba(237,231,220,0.14)] hover:bg-[#12171E] text-left transition-all cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.2)] flex items-center justify-between gap-3 active:scale-[0.99]"
                      style={{
                        padding: "20px 22px",
                        borderColor: `rgba(237, 231, 220, 0.14)`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = card.cardBorderHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(237, 231, 220, 0.14)";
                      }}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Icon Badge */}
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                          style={{
                            backgroundColor: card.bgBadge,
                            border: `1px solid ${card.borderBadge}`,
                            color: card.accent,
                          }}
                        >
                          <Icon className="h-5.5 w-5.5 stroke-[2.2]" />
                        </div>

                        {/* Title & Description */}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-sm sm:text-[14.5px] text-[#EDE7DC] group-hover:text-white transition-colors">
                            {card.title}
                          </h4>
                          <p className="mt-1 text-xs text-[#A3ADB2] leading-snug line-clamp-2">
                            {card.description}
                          </p>
                        </div>
                      </div>

                      {/* Right Arrow */}
                      <ChevronRight
                        className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1"
                        style={{ color: card.accent }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================
            RIGHT SIDEBAR (approx 32%): Recent Searches + Search Tips
            STRICT VERTICAL GAP: Cards never touch each other
            ================================================================== */}
        <div
          className="lg:col-span-4 w-full"
          style={{ display: "flex", flexDirection: "column", gap: "28px" }}
        >
          {/* Card 1: Recent Searches Card */}
          <div
            id="recent-searches-card"
            className="bg-[#101519] border border-[rgba(237,231,220,0.14)] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] w-full"
            style={{ padding: "28px 26px" }}
          >
            {/* Header: History icon + Recent Searches + View All */}
            <div
              className="flex items-center justify-between border-b border-[rgba(237,231,220,0.08)]"
              style={{ paddingBottom: "14px", marginBottom: "16px" }}
            >
              <div className="flex items-center gap-2.5">
                <History className="h-4.5 w-4.5 text-[#EDE7DC]" />
                <h3 className="font-['Syne',sans-serif] text-base font-bold text-[#EDE7DC]">
                  Recent Searches
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (recentSearches.length > 0) {
                    handleSearch(undefined, recentSearches[0].query);
                  }
                }}
                className="text-xs font-semibold text-[#F29A32] hover:text-[#ffa947] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View All</span>
                <span>→</span>
              </button>
            </div>

            {/* List of Recent Searches */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentSearches.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSearch(undefined, item.query)}
                  className="w-full group flex items-center justify-between rounded-xl p-3 hover:bg-[#080B0D] transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <SearchIcon className="h-3.5 w-3.5 text-[#A3ADB2] group-hover:text-[#F29A32] shrink-0 transition-colors" />
                    <span className="text-xs sm:text-[13px] text-[#EDE7DC] group-hover:text-[#F29A32] truncate transition-colors font-medium">
                      {item.query}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#6C777D] font-mono shrink-0 whitespace-nowrap">
                    {item.time}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Card 2: Search Tips Card */}
          <div
            className="bg-[#101519] border border-[rgba(237,231,220,0.14)] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden w-full"
            style={{ padding: "28px 26px" }}
          >
            {/* Header: Lightbulb icon + Search Tips */}
            <div
              className="flex items-center gap-2.5 border-b border-[rgba(237,231,220,0.08)]"
              style={{ paddingBottom: "14px", marginBottom: "18px" }}
            >
              <Lightbulb className="h-5 w-5 text-[#A36BFA]" />
              <h3 className="font-['Syne',sans-serif] text-base font-bold text-[#EDE7DC]">
                Search Tips
              </h3>
            </div>

            {/* 4 Tips with Green/Emerald Checkmark Icons and comfortable vertical gaps */}
            <ul style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {SEARCH_TIPS.map((tip, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="h-4.5 w-4.5 text-[#36CF91] shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-[13px] text-[#A3ADB2] leading-relaxed">
                    {tip}
                  </span>
                </li>
              ))}
            </ul>

            {/* Subtle Violet Decorative Accent Glow at Bottom Right */}
            <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-[#A36BFA]/15 blur-2xl pointer-events-none" />
            <svg
              className="absolute bottom-0 right-0 w-36 h-12 pointer-events-none opacity-60"
              viewBox="0 0 140 50"
              fill="none"
            >
              <path
                d="M10 45C50 45 80 15 140 2"
                stroke="url(#tip_violet_trail)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="tip_violet_trail" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#A36BFA" stopOpacity="0" />
                  <stop offset="100%" stopColor="#A36BFA" stopOpacity="0.8" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
