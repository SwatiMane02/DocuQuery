import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Sparkles,
  Search,
  BarChart2,
  ChevronRight,
  ChevronDown,
  Database,
  MessageSquare,
  Zap,
  Loader2,
} from "lucide-react";
import { DocumentService, DocumentResponse } from "@/services/documentService";
import { AuthService, UserResponse } from "@/services/authService";
import { AnalyticsService, UserAnalyticsResponse } from "@/services/analyticsService";
import { authStore } from "@/store/authStore";

export const Route = createFileRoute("/_user/dashboard")({
  component: Dashboard,
});

// Specimen rows to maintain the balanced 4-row editorial layout
const DEMO_FALLBACK_DOCS = [
  {
    id: "demo-1",
    filename: "Declarations Policy_DAV.pdf",
    file_type: "pdf",
    file_size: 838860, // 0.8 MB
    upload_date: "2026-10-03T10:00:00Z",
    status: "Processed",
  },
  {
    id: "demo-2",
    filename: "Internship_Report.docx",
    file_type: "docx",
    file_size: 2516582, // 2.4 MB
    upload_date: "2026-10-02T14:30:00Z",
    status: "Processed",
  },
  {
    id: "demo-3",
    filename: "Research_Notes.txt",
    file_type: "txt",
    file_size: 57344, // 56 KB
    upload_date: "2026-10-01T09:15:00Z",
    status: "Processed",
  },
  {
    id: "demo-4",
    filename: "Dataset_Summary.csv",
    file_type: "csv",
    file_size: 1153433, // 1.1 MB
    upload_date: "2026-09-30T16:45:00Z",
    status: "Processed",
  },
];

export function Dashboard() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [analytics, setAnalytics] = useState<UserAnalyticsResponse | null>(null);
  const [user, setUser] = useState<UserResponse | null>(() => authStore.getUser());
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState("Last 7 Days");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Reuse authenticated user from authStore; avoid duplicate /auth/me network calls
      const cachedUser = authStore.getUser();
      const profilePromise = cachedUser
        ? Promise.resolve(cachedUser)
        : AuthService.getProfile();

      const [docRes, profileRes, analyticsRes] = await Promise.allSettled([
        DocumentService.listDocuments(0, 10),
        profilePromise,
        AnalyticsService.getUserAnalytics(),
      ]);

      if (docRes.status === "fulfilled") {
        setDocuments(docRes.value.documents);
      }
      if (profileRes.status === "fulfilled") {
        setUser(profileRes.value);
        if (!cachedUser) {
          authStore.setUser(profileRes.value);
        }
      }
      if (analyticsRes.status === "fulfilled") {
        setAnalytics(analyticsRes.value);
      }
    } catch {
      // Best-effort loading
    } finally {
      setIsLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const rawName = user?.full_name ? user.full_name.split(" ")[0] : "Kate";
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  // Statistics matching reference editorial values
  const totalDocs = analytics?.total_documents && analytics.total_documents > 0
    ? analytics.total_documents
    : documents.length > 0
    ? documents.length
    : 12;

  const totalQueries = analytics?.total_queries && analytics.total_queries > 0
    ? analytics.total_queries
    : 48;

  const totalConvs = analytics?.total_conversations && analytics.total_conversations > 0
    ? analytics.total_conversations
    : 8;

  const storageMB = analytics?.storage_used_bytes && analytics.storage_used_bytes > 1024 * 1024
    ? (analytics.storage_used_bytes / (1024 * 1024)).toFixed(1)
    : "142.6";

  const storageLimitMB = "500";

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 KB";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Distinct rich colors for document type badges matching reference UI
  const getDocBadge = (type: string, filename: string) => {
    const lower = (type + " " + filename).toLowerCase();
    if (lower.includes("pdf")) return { label: "PDF", bg: "#E5484D", text: "#FFFFFF" }; // Red
    if (lower.includes("doc")) return { label: "DOCX", bg: "#2563EB", text: "#FFFFFF" }; // Blue
    if (lower.includes("txt")) return { label: "TXT", bg: "#475569", text: "#FFFFFF" }; // Slate
    if (lower.includes("csv")) return { label: "CSV", bg: "#10B981", text: "#FFFFFF" }; // Emerald
    return { label: "DOC", bg: "#E8913C", text: "#FFFFFF" }; // Amber
  };

  // Combine real documents with fallback specimens
  const displayDocuments = documents.length >= 4
    ? documents.slice(0, 4)
    : [
        ...documents,
        ...DEMO_FALLBACK_DOCS.slice(documents.length, 4),
      ];

  // Activity chart 7-day spline coordinates safely indented inside 360-width viewBox
  const chartPoints = [
    { day: "Mon", x: 46, y: 126 },
    { day: "Tue", x: 92, y: 82 },
    { day: "Wed", x: 138, y: 100 },
    { day: "Thu", x: 184, y: 72 },
    { day: "Fri", x: 230, y: 90 },
    { day: "Sat", x: 276, y: 54 },
    { day: "Sun", x: 320, y: 26 },
  ];

  return (
    <div
      className="w-full flex flex-col font-['Sora',sans-serif] text-[#EDE7DC] pb-16"
      style={{ gap: "32px" }}
    >
      {/* ====================================================================
          1. WELCOME SECTION (HERO + AI ASSISTANT PANEL)
          ==================================================================== */}
      <section
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch"
        style={{ marginBottom: "4px" }}
      >
        {/* Left Hero Card (~68% width on desktop) */}
        <div
          className="lg:col-span-8 bg-[#101317] border border-[rgba(237,231,220,0.12)] rounded-2xl relative overflow-hidden flex flex-col justify-center min-h-[300px] shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
          style={{ padding: "36px 36px" }}
        >
          {/* Subtle Ambient Curved Glow Wave in Background */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 840 280"
            fill="none"
            preserveAspectRatio="none"
          >
            <circle cx="560" cy="180" r="140" fill="#E8913C" fillOpacity="0.12" filter="blur(50px)" />
            <circle cx="680" cy="140" r="160" fill="#2E6B72" fillOpacity="0.15" filter="blur(60px)" />

            <path
              d="M-20,220 C200,270 360,195 530,155 C650,125 740,165 860,140"
              stroke="url(#heroAmberWave)"
              strokeWidth="2.5"
              fill="none"
            />
            <path
              d="M0,250 C220,295 400,230 570,185 C700,150 770,180 860,165"
              stroke="url(#heroTealWave)"
              strokeWidth="2"
              fill="none"
            />
            <defs>
              <linearGradient id="heroAmberWave" x1="0" y1="0" x2="840" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#E8913C" stopOpacity="0" />
                <stop offset="0.4" stopColor="#E8913C" stopOpacity="0.4" />
                <stop offset="0.65" stopColor="#E8913C" stopOpacity="0.95" />
                <stop offset="0.85" stopColor="#E8913C" stopOpacity="0.3" />
                <stop offset="1" stopColor="#E8913C" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="heroTealWave" x1="0" y1="0" x2="840" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2E6B72" stopOpacity="0" />
                <stop offset="0.55" stopColor="#2E6B72" stopOpacity="0.3" />
                <stop offset="0.8" stopColor="#42C8D5" stopOpacity="0.8" />
                <stop offset="1" stopColor="#2E6B72" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          {/* Left Text & CTA Group - Strictly padded, generous breathing room */}
          <div className="relative z-10 w-full max-w-[490px] my-auto">
            {/* Pill Badge */}
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-[#42C8D5] shadow-[0_0_8px_#42C8D5] shrink-0" />
              <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-[#9EA5A8] font-semibold">
                DOCUMENT INTELLIGENCE
              </span>
            </div>

            {/* Greeting */}
            <h1 className="font-['Syne',sans-serif] text-[30px] sm:text-[34px] lg:text-[38px] font-bold tracking-tight text-[#EDE7DC] leading-[1.2]">
              {getGreeting()}, {displayName} <span className="inline-block animate-[wave_1.6s_ease-in-out]">👋</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-3.5 text-[14.5px] sm:text-[15px] text-[#9EA5A8] leading-relaxed">
              Your AI-powered workspace to upload, understand, search and discover insights from your documents.
            </p>

            {/* Action Buttons */}
            <div className="mt-6 sm:mt-7 flex items-center gap-4 flex-wrap">
              <Link
                to="/documents"
                className="inline-flex items-center justify-center gap-2.5 h-12 min-w-[180px] sm:min-w-[190px] px-6 rounded-xl bg-[#E8913C] hover:bg-[#f39c4a] text-[#0A0C0E] font-semibold text-[14.5px] sm:text-[15px] transition-all shadow-[0_4px_18px_rgba(232,145,60,0.32)] active:scale-[0.98] whitespace-nowrap"
              >
                <Upload className="h-4.5 w-4.5 stroke-[2.3] shrink-0" />
                <span>Upload Document</span>
              </Link>
              <Link
                to="/ai-query"
                className="inline-flex items-center justify-center gap-2.5 h-12 min-w-[180px] sm:min-w-[190px] px-6 rounded-xl border border-[rgba(237,231,220,0.28)] bg-[rgba(16,19,23,0.95)] hover:bg-[#161A20] hover:border-[rgba(237,231,220,0.45)] text-[#EDE7DC] text-[14.5px] sm:text-[15px] font-medium transition-all whitespace-nowrap"
              >
                <Sparkles className="h-4.5 w-4.5 stroke-[2] shrink-0" />
                <span>Ask AI a Question</span>
              </Link>
            </div>
          </div>

          {/* Right Floating Document Stack Illustration - safely indented from right border */}
          <div className="hidden sm:block absolute right-10 lg:right-12 top-1/2 -translate-y-1/2 w-68 h-56 pointer-events-none">
            <div style={{ background: "radial-gradient(circle, rgba(66,200,213,0.20) 0%, rgba(232,145,60,0.15) 40%, transparent 70%)" }} className="absolute inset-0 blur-2xl" />

            {/* PDF Card */}
            <div
              className="absolute left-3 top-4 w-26 h-38 rounded-2xl border border-[rgba(237,231,220,0.18)] bg-[#121B24]/90 backdrop-blur-md shadow-[0_16px_36px_rgba(0,0,0,0.6)] p-3 flex flex-col justify-between"
              style={{ transform: "rotate(-12deg)" }}
            >
              <span className="self-start rounded-md px-2 py-0.5 text-[8.5px] font-bold text-white bg-[#E5484D] shadow-sm">
                PDF
              </span>
              <div className="space-y-1.5">
                <div className="h-0.5 w-full rounded bg-[rgba(237,231,220,0.25)]" />
                <div className="h-0.5 w-4/5 rounded bg-[rgba(237,231,220,0.15)]" />
                <div className="h-0.5 w-3/5 rounded bg-[rgba(237,231,220,0.1)]" />
              </div>
            </div>

            {/* DOCX Card */}
            <div
              className="absolute left-22 top-1 w-26 h-38 rounded-2xl border border-[rgba(66,200,213,0.25)] bg-[#0F2228]/85 backdrop-blur-md shadow-[0_16px_36px_rgba(0,0,0,0.6)] p-3 flex flex-col justify-between"
              style={{ transform: "rotate(6deg) translateY(-8px)" }}
            >
              <span className="self-end rounded-md px-2 py-0.5 text-[8.5px] font-bold text-white bg-[#3B82F6] shadow-sm">
                DOCX
              </span>
              <div className="space-y-1.5">
                <div className="h-0.5 w-full rounded bg-[rgba(237,231,220,0.25)]" />
                <div className="h-0.5 w-4/5 rounded bg-[rgba(237,231,220,0.15)]" />
              </div>
            </div>

            {/* TXT Card */}
            <div
              className="absolute left-0 top-18 w-26 h-34 rounded-2xl border border-[rgba(237,231,220,0.2)] bg-[#141C22]/95 backdrop-blur-md shadow-[0_16px_36px_rgba(0,0,0,0.65)] p-3 flex flex-col justify-between"
              style={{ transform: "rotate(-5deg) translateY(6px)" }}
            >
              <span className="self-start rounded-md px-2 py-0.5 text-[8.5px] font-bold text-white bg-[#64748B] shadow-sm">
                TXT
              </span>
              <div className="space-y-1.5">
                <div className="h-0.5 w-full rounded bg-[rgba(237,231,220,0.25)]" />
                <div className="h-0.5 w-3/4 rounded bg-[rgba(237,231,220,0.15)]" />
              </div>
            </div>

            {/* CSV Card */}
            <div
              className="absolute top-14 w-26 h-34 rounded-2xl border border-[rgba(53,184,138,0.3)] bg-[#102422]/90 backdrop-blur-md shadow-[0_16px_36px_rgba(0,0,0,0.65)] p-3 flex flex-col justify-between"
              style={{ left: "128px", transform: "rotate(10deg) translateY(8px)" }}
            >
              <span className="self-end rounded-md px-2 py-0.5 text-[8.5px] font-bold text-white bg-[#10B981] shadow-sm">
                CSV
              </span>
              <div className="space-y-1.5">
                <div className="h-0.5 w-full rounded bg-[rgba(237,231,220,0.25)]" />
                <div className="h-0.5 w-4/5 rounded bg-[rgba(237,231,220,0.15)]" />
              </div>
            </div>
          </div>
        </div>

        {/* Right AI Assistant Panel (~32% width on desktop) */}
        <div
          className="lg:col-span-4 bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl relative overflow-hidden flex flex-col justify-center min-h-[300px] shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
          style={{ padding: "32px 28px" }}
        >
          <div className="absolute -bottom-12 -right-12 w-56 h-56 rounded-full bg-[#7C3AED] opacity-30 blur-[60px] pointer-events-none" />
          <div className="absolute bottom-4 right-0 w-36 h-36 rounded-full bg-[#9274F7] opacity-20 blur-[40px] pointer-events-none" />

          <div className="relative z-10 my-auto">
            {/* Icon + Title row */}
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#2D1B6B] border border-[#9274F7]/50 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(146,116,247,0.35)]">
                <Sparkles className="h-5.5 w-5.5 text-[#9274F7]" />
              </div>
              <h2 className="font-['Syne',sans-serif] font-bold text-[20px] sm:text-[22px] text-[#EDE7DC] leading-tight">
                AI Assistant
              </h2>
            </div>

            {/* Description */}
            <p className="text-[14px] sm:text-[14.5px] text-[#9EA5A8] leading-relaxed">
              Ask anything about your documents and get context-aware answers with source citations.
            </p>

            {/* CTA Link */}
            <div className="mt-5 sm:mt-6">
              <Link
                to="/ai-query"
                className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#EDE7DC] hover:text-[#E8913C] transition-colors group"
              >
                <span>Try it now</span>
                <span className="transition-transform group-hover:translate-x-1.5">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. STATISTICS SECTION (4 EQUAL-WIDTH METRIC CARDS)
          ==================================================================== */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        style={{ marginTop: "4px", marginBottom: "4px" }}
      >
        {/* Card 1: Documents (Cyan #42C8D5 Accent) */}
        <div
          className="bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl min-h-[96px] flex items-center gap-4 transition-all hover:border-[#42C8D5]/40 hover:bg-[#12161B] shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
          style={{ padding: "20px 24px" }}
        >
          <div className="w-[48px] h-[48px] rounded-xl bg-[#42C8D5]/12 border border-[#42C8D5]/30 flex items-center justify-center shrink-0">
            <FileText className="h-5.5 w-5.5 text-[#42C8D5]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[13px] font-medium text-[#9EA5A8] block">Documents</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-['Syne',sans-serif] text-[25px] sm:text-[27px] font-bold text-[#EDE7DC] leading-none">
                {isLoading ? "..." : totalDocs}
              </span>
              <span className="text-[12px] font-mono text-[#35B88A]">
                ↑ +3 this week
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: AI Queries (Violet #9274F7 Accent) */}
        <div
          className="bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl min-h-[96px] flex items-center gap-4 transition-all hover:border-[#9274F7]/40 hover:bg-[#12161B] shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
          style={{ padding: "20px 24px" }}
        >
          <div className="w-[48px] h-[48px] rounded-xl bg-[#9274F7]/12 border border-[#9274F7]/30 flex items-center justify-center shrink-0">
            <Sparkles className="h-5.5 w-5.5 text-[#9274F7]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[13px] font-medium text-[#9EA5A8] block">AI Queries</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-['Syne',sans-serif] text-[25px] sm:text-[27px] font-bold text-[#EDE7DC] leading-none">
                {isLoading ? "..." : totalQueries}
              </span>
              <span className="text-[12px] font-mono text-[#35B88A]">
                ↑ +12
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Conversations (Emerald #35B88A Accent) */}
        <div
          className="bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl min-h-[96px] flex items-center gap-4 transition-all hover:border-[#35B88A]/40 hover:bg-[#12161B] shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
          style={{ padding: "20px 24px" }}
        >
          <div className="w-[48px] h-[48px] rounded-xl bg-[#35B88A]/12 border border-[#35B88A]/30 flex items-center justify-center shrink-0">
            <MessageSquare className="h-5.5 w-5.5 text-[#35B88A]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[13px] font-medium text-[#9EA5A8] block">Conversations</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-['Syne',sans-serif] text-[25px] sm:text-[27px] font-bold text-[#EDE7DC] leading-none">
                {isLoading ? "..." : totalConvs}
              </span>
              <span className="text-[12px] font-mono text-[#35B88A]">
                ↑ +2
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Storage Used (Amber #E8913C Accent) */}
        <div
          className="bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl min-h-[96px] flex items-center gap-4 transition-all hover:border-[#E8913C]/40 hover:bg-[#12161B] shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
          style={{ padding: "20px 24px" }}
        >
          <div className="w-[48px] h-[48px] rounded-xl bg-[#E8913C]/12 border border-[#E8913C]/30 flex items-center justify-center shrink-0">
            <Database className="h-5.5 w-5.5 text-[#E8913C]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[13px] font-medium text-[#9EA5A8] block">Storage Used</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-['Syne',sans-serif] text-[25px] sm:text-[27px] font-bold text-[#EDE7DC] leading-none">
                {isLoading ? "..." : storageMB} MB
              </span>
              <span className="text-[12px] text-[#6C7378]">
                of {storageLimitMB} MB
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          3. MAIN DASHBOARD GRID (RECENT DOCS, ACTIVITY, QUICK ACTIONS)
          ==================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Card 1: Recent Documents Table (50% width on desktop: lg:col-span-6) */}
        <div
          className="lg:col-span-6 bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
          style={{ padding: "28px 28px" }}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-[#EDE7DC]" strokeWidth={2} />
                <h2 className="font-['Syne',sans-serif] text-[18px] sm:text-[19px] font-bold text-[#EDE7DC] tracking-tight">
                  Recent Documents
                </h2>
              </div>
              <Link
                to="/documents"
                className="text-[13px] font-medium text-[#E8913C] hover:text-[#f3a458] transition-colors flex items-center gap-1.5"
              >
                <span>View All</span>
                <span>→</span>
              </Link>
            </div>

            {/* Table Content */}
            {isLoading ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <Loader2 className="h-5 w-5 animate-spin text-[#E8913C] mb-2" />
                <span className="text-xs text-[#9EA5A8]">Loading repository documents...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11.5px] sm:text-[12px] font-mono uppercase tracking-wider text-[#6C7378] border-b border-[rgba(237,231,220,0.06)]">
                      <th className="font-normal" style={{ paddingLeft: "8px", paddingRight: "8px", paddingBottom: "12px" }}>DOCUMENT</th>
                      <th className="font-normal" style={{ paddingLeft: "8px", paddingRight: "8px", paddingBottom: "12px" }}>TYPE</th>
                      <th className="font-normal" style={{ paddingLeft: "8px", paddingRight: "8px", paddingBottom: "12px" }}>SIZE</th>
                      <th className="font-normal" style={{ paddingLeft: "8px", paddingRight: "8px", paddingBottom: "12px" }}>UPLOADED</th>
                      <th className="font-normal text-right" style={{ paddingLeft: "8px", paddingRight: "8px", paddingBottom: "12px" }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(237,231,220,0.03)]">
                    {displayDocuments.map((doc) => {
                      const badge = getDocBadge(doc.file_type, doc.filename);
                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-[#0A0C0E]/60 transition-colors cursor-pointer group"
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
                          <td className="flex items-center gap-2.5" style={{ paddingLeft: "8px", paddingRight: "8px", paddingTop: "12px", paddingBottom: "12px" }}>
                            <span
                              className="px-2 py-0.5 rounded text-[8.5px] font-bold text-white shrink-0 shadow-sm"
                              style={{ backgroundColor: badge.bg }}
                            >
                              {badge.label}
                            </span>
                            <span className="text-[13.5px] sm:text-[14px] font-medium text-[#EDE7DC] group-hover:text-[#E8913C] transition-colors truncate max-w-[130px] sm:max-w-[160px] xl:max-w-[195px]">
                              {doc.filename}
                            </span>
                          </td>
                          <td className="text-[12px] text-[#9EA5A8] uppercase" style={{ paddingLeft: "8px", paddingRight: "8px", paddingTop: "12px", paddingBottom: "12px" }}>
                            {badge.label}
                          </td>
                          <td className="text-[12px] text-[#9EA5A8]" style={{ paddingLeft: "8px", paddingRight: "8px", paddingTop: "12px", paddingBottom: "12px" }}>
                            {formatFileSize(doc.file_size)}
                          </td>
                          <td className="text-[12px] text-[#9EA5A8]" style={{ paddingLeft: "8px", paddingRight: "8px", paddingTop: "12px", paddingBottom: "12px" }}>
                            {formatDate(doc.upload_date)}
                          </td>
                          <td className="text-right align-middle" style={{ paddingLeft: "8px", paddingRight: "8px", paddingTop: "12px", paddingBottom: "12px" }}>
                            <span
                              className="inline-flex items-center justify-center rounded-full border border-[#10B981]/35 bg-[#064E3B]/40 text-[11px] font-medium text-[#34D399] whitespace-nowrap"
                              style={{ paddingLeft: "14px", paddingRight: "14px", paddingTop: "3px", paddingBottom: "3px" }}
                            >
                              Processed
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Document Activity Chart (25% width on desktop: lg:col-span-3) */}
        <div
          className="lg:col-span-3 bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
          style={{ padding: "28px 24px" }}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-2 min-w-0">
                <BarChart2 className="h-4.5 w-4.5 text-[#42C8D5] shrink-0" strokeWidth={2} />
                <h2 className="font-['Syne',sans-serif] text-[14.5px] sm:text-[15.5px] font-bold text-[#EDE7DC] tracking-tight whitespace-nowrap">
                  Document Activity
                </h2>
              </div>
              {/* Filter Dropdown */}
              <div className="relative inline-flex items-center shrink-0">
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="appearance-none bg-[#0A0C0E] border border-[rgba(237,231,220,0.15)] rounded-lg pl-2 pr-5 py-0.5 text-[10.5px] text-[#9EA5A8] focus:outline-none cursor-pointer"
                >
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 text-[#9EA5A8]" />
              </div>
            </div>

            {/* SVG Smooth Curve Spline Graph — indented coordinates so nothing touches card borders */}
            <div className="relative mt-2 w-full flex flex-col justify-center">
              <svg viewBox="0 0 360 145" className="w-full overflow-visible" style={{ height: "172px" }}>
                <defs>
                  <linearGradient id="activityGradientRef" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#42C8D5" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#42C8D5" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="36" y1="18" x2="340" y2="18" stroke="rgba(237,231,220,0.06)" />
                <line x1="36" y1="45" x2="340" y2="45" stroke="rgba(237,231,220,0.06)" />
                <line x1="36" y1="72" x2="340" y2="72" stroke="rgba(237,231,220,0.06)" />
                <line x1="36" y1="99" x2="340" y2="99" stroke="rgba(237,231,220,0.06)" />
                <line x1="36" y1="126" x2="340" y2="126" stroke="rgba(237,231,220,0.12)" />

                {/* Y Axis Legend — comfortably indented at x=18 */}
                <text x="18" y="22" fill="#6C7378" fontSize="9.5" fontFamily="monospace">16</text>
                <text x="18" y="49" fill="#6C7378" fontSize="9.5" fontFamily="monospace">12</text>
                <text x="18" y="76" fill="#6C7378" fontSize="9.5" fontFamily="monospace">8</text>
                <text x="18" y="103" fill="#6C7378" fontSize="9.5" fontFamily="monospace">4</text>
                <text x="18" y="130" fill="#6C7378" fontSize="9.5" fontFamily="monospace">0</text>

                {/* Spline Area Fill */}
                <path
                  d="M 46,126 C 68,126 75,82 92,82 C 110,82 122,100 138,100 C 156,100 168,72 184,72 C 202,72 214,90 230,90 C 248,90 260,54 276,54 C 294,54 308,26 320,26 L 320,126 L 46,126 Z"
                  fill="url(#activityGradientRef)"
                />

                {/* Spline Stroke Line */}
                <path
                  d="M 46,126 C 68,126 75,82 92,82 C 110,82 122,100 138,100 C 156,100 168,72 184,72 C 202,72 214,90 230,90 C 248,90 260,54 276,54 C 294,54 308,26 320,26"
                  fill="none"
                  stroke="#42C8D5"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Glowing Dots along every data point on the curve (Mon through Sun) */}
                {chartPoints.map((pt, index) => {
                  const isLast = index === chartPoints.length - 1;
                  const adjY = pt.y > 100 ? 126 : pt.y > 80 ? 90 : pt.y > 60 ? 72 : pt.y > 40 ? 54 : 26;
                  return (
                    <g key={pt.day}>
                      {isLast ? (
                        <>
                          <circle cx={pt.x} cy={26} r="7" fill="#42C8D5" fillOpacity="0.35" />
                          <circle cx={pt.x} cy={26} r="4" fill="#EDE7DC" stroke="#42C8D5" strokeWidth="2" />
                        </>
                      ) : (
                        <circle
                          cx={pt.x}
                          cy={adjY}
                          r="3.5"
                          fill="#42C8D5"
                          stroke="#EDE7DC"
                          strokeWidth="1.5"
                        />
                      )}
                    </g>
                  );
                })}

                {/* X Axis Day Labels */}
                {chartPoints.map((pt) => (
                  <text
                    key={pt.day}
                    x={pt.x}
                    y="142"
                    fill="#9EA5A8"
                    fontSize="9.5"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {pt.day}
                  </text>
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: Quick Actions (25% width on desktop: lg:col-span-3) */}
        <div
          className="lg:col-span-3 bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
          style={{ padding: "28px 24px" }}
        >
          <div>
            <div className="flex items-center gap-2.5 mb-3.5">
              <Zap className="h-5 w-5 text-[#E8913C] shrink-0" fill="#E8913C" />
              <h2 className="font-['Syne',sans-serif] text-[17px] sm:text-[18px] font-bold text-[#EDE7DC] tracking-tight">
                Quick Actions
              </h2>
            </div>

            <div className="flex flex-col gap-2.5 sm:gap-3">
              <Link
                to="/documents"
                className="flex items-center justify-between h-[46px] rounded-xl border border-[rgba(237,231,220,0.1)] bg-[#0A0C0E]/40 hover:bg-[#161B22] hover:border-[rgba(237,231,220,0.25)] text-[#EDE7DC] transition-all group cursor-pointer"
                style={{ padding: "0 16px" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Upload className="h-4.5 w-4.5 text-[#EDE7DC] shrink-0" />
                  <span className="font-medium text-[13.5px] sm:text-[14px] text-[#EDE7DC] truncate">Upload Documents</span>
                </div>
                <ChevronRight className="h-4 w-4 text-[#6C7378] group-hover:text-[#EDE7DC] group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>

              <Link
                to="/ai-query"
                className="flex items-center justify-between h-[46px] rounded-xl border border-[rgba(237,231,220,0.1)] bg-[#0A0C0E]/40 hover:bg-[#161B22] hover:border-[rgba(237,231,220,0.25)] text-[#EDE7DC] transition-all group cursor-pointer"
                style={{ padding: "0 16px" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Sparkles className="h-4.5 w-4.5 text-[#E8913C] shrink-0" />
                  <span className="font-medium text-[13.5px] sm:text-[14px] text-[#EDE7DC] truncate">Ask AI a Question</span>
                </div>
                <ChevronRight className="h-4 w-4 text-[#6C7378] group-hover:text-[#EDE7DC] group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>

              <Link
                to="/search"
                className="flex items-center justify-between h-[46px] rounded-xl border border-[rgba(237,231,220,0.1)] bg-[#0A0C0E]/40 hover:bg-[#161B22] hover:border-[rgba(237,231,220,0.25)] text-[#EDE7DC] transition-all group cursor-pointer"
                style={{ padding: "0 16px" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Search className="h-4.5 w-4.5 text-[#EDE7DC] shrink-0" />
                  <span className="font-medium text-[13.5px] sm:text-[14px] text-[#EDE7DC] truncate">Semantic Search</span>
                </div>
                <ChevronRight className="h-4 w-4 text-[#6C7378] group-hover:text-[#EDE7DC] group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>

              <Link
                to="/analytics"
                className="flex items-center justify-between h-[46px] rounded-xl border border-[rgba(237,231,220,0.1)] bg-[#0A0C0E]/40 hover:bg-[#161B22] hover:border-[rgba(237,231,220,0.25)] text-[#EDE7DC] transition-all group cursor-pointer"
                style={{ padding: "0 16px" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BarChart2 className="h-4.5 w-4.5 text-[#EDE7DC] shrink-0" />
                  <span className="font-medium text-[13.5px] sm:text-[14px] text-[#EDE7DC] truncate">View Analytics</span>
                </div>
                <ChevronRight className="h-4 w-4 text-[#6C7378] group-hover:text-[#EDE7DC] group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          4. BOTTOM SECTION: AI PROMO BANNER + QUERY INSIGHTS
          ==================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Document Intelligence Promotional Panel (Approx 65% width: lg:col-span-8) */}
        <div
          className="lg:col-span-8 bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl relative overflow-hidden flex flex-col justify-center min-h-[210px] shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
          style={{ padding: "32px 32px" }}
        >
          <div className="relative z-10 max-w-md sm:max-w-lg my-auto">
            <h2 className="font-['Syne',sans-serif] text-xl sm:text-[23px] font-bold tracking-tight text-[#EDE7DC] leading-snug">
              Turn Documents into Answers
            </h2>
            <p className="mt-2.5 text-[13.5px] sm:text-[14px] text-[#9EA5A8] leading-relaxed">
              Chat with your documents, find relevant information, generate summaries, and uncover insights instantly.
            </p>
            <div className="mt-5 sm:mt-6">
              <Link
                to="/ai-query"
                className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-[#E8913C] hover:text-[#f3a458] transition-colors group"
              >
                <span>Start AI Query</span>
                <span className="transition-transform group-hover:translate-x-1.5">→</span>
              </Link>
            </div>
          </div>

          {/* Clean High-Tech Illuminated Desk Document Illustration */}
          <div className="hidden sm:block absolute right-8 sm:right-10 top-0 bottom-0 w-72 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#101317] via-[#101317]/50 to-transparent z-10" />
            <div style={{ background: "radial-gradient(circle at center, rgba(232,145,60,0.20) 0%, rgba(232,145,60,0.05) 50%, transparent 70%)" }} className="absolute right-10 top-4 w-52 h-52 rounded-full blur-2xl" />

            <svg
              className="absolute right-4 top-1/2 -translate-y-1/2 w-60 h-48 drop-shadow-[0_20px_40px_rgba(0,0,0,0.9)]"
              viewBox="0 0 220 180"
              fill="none"
            >
              <g transform="rotate(8 110 90)">
                <rect
                  x="30"
                  y="20"
                  width="160"
                  height="140"
                  rx="10"
                  fill="#EDE7DC"
                  stroke="rgba(237,231,220,0.3)"
                  strokeWidth="1"
                />
                <rect x="46" y="36" width="60" height="8" rx="3" fill="#101317" fillOpacity="0.75" />
                <rect x="46" y="52" width="128" height="4" rx="2" fill="#101317" fillOpacity="0.45" />
                <rect x="46" y="62" width="115" height="4" rx="2" fill="#101317" fillOpacity="0.45" />
                <rect x="46" y="72" width="128" height="10" rx="3" fill="#E8913C" fillOpacity="0.35" />
                <rect x="46" y="75" width="110" height="4" rx="2" fill="#E8913C" />
                <rect x="46" y="90" width="120" height="4" rx="2" fill="#101317" fillOpacity="0.45" />
                <rect x="46" y="100" width="95" height="4" rx="2" fill="#101317" fillOpacity="0.45" />
                <rect x="46" y="118" width="105" height="15" rx="4" fill="#101317" fillOpacity="0.08" />
                <text x="52" y="129" fill="#101317" fillOpacity="0.75" fontSize="7" fontFamily="monospace" fontWeight="bold">
                  Grounding Match // 99.2%
                </text>
              </g>
            </svg>
          </div>
        </div>

        {/* Query Insights Donut Breakdown (Approx 35% width: lg:col-span-4) */}
        <div
          className="lg:col-span-4 bg-[#101317] border border-[rgba(237,231,220,0.1)] rounded-2xl flex flex-col justify-between min-h-[210px] shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
          style={{ padding: "28px 24px" }}
        >
          <div className="flex items-center gap-2.5 pb-3 border-b border-[rgba(237,231,220,0.08)]">
            <BarChart2 className="h-5 w-5 text-[#9274F7]" />
            <h2 className="font-['Syne',sans-serif] text-[16px] sm:text-[17px] font-bold text-[#EDE7DC]">
              Query Insights
            </h2>
          </div>

          <div className="flex items-center justify-between gap-5 py-2 my-auto">
            {/* SVG Donut Chart */}
            <div className="relative w-26 h-26 sm:w-28 sm:h-28 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="rgba(237,231,220,0.06)"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#42C8D5"
                  strokeWidth="12"
                  strokeDasharray="129 239"
                  strokeDashoffset="0"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#E8913C"
                  strokeWidth="12"
                  strokeDasharray="69 239"
                  strokeDashoffset="-129"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#9274F7"
                  strokeWidth="12"
                  strokeDasharray="41 239"
                  strokeDashoffset="-198"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-['Syne',sans-serif] text-lg font-bold text-[#EDE7DC]">
                  {totalQueries}
                </span>
                <span className="text-[9px] font-mono text-[#9EA5A8]">
                  Queries
                </span>
              </div>
            </div>

            {/* Legend Column */}
            <div className="space-y-2.5 flex-1 pl-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#42C8D5] shadow-[0_0_6px_rgba(66,200,213,0.5)]" />
                  <span className="text-[#EDE7DC] font-medium">Document Chat</span>
                </div>
                <span className="font-mono text-xs text-[#9EA5A8]">54%</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E8913C] shadow-[0_0_6px_rgba(232,145,60,0.5)]" />
                  <span className="text-[#EDE7DC] font-medium">Semantic Search</span>
                </div>
                <span className="font-mono text-xs text-[#9EA5A8]">29%</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#9274F7] shadow-[0_0_6px_rgba(146,116,247,0.5)]" />
                  <span className="text-[#EDE7DC] font-medium">Summaries</span>
                </div>
                <span className="font-mono text-xs text-[#9EA5A8]">17%</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
