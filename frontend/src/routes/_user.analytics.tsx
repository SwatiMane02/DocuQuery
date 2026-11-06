import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  FileText,
  Zap,
  MessageSquare,
  HardDrive,
  Clock,
  Loader2,
  AlertCircle,
  Upload,
  Calendar,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { AnalyticsService, UserAnalyticsResponse } from "@/services/analyticsService";

export const Route = createFileRoute("/_user/analytics")({
  component: Analytics,
});

function Analytics() {
  const [data, setData] = useState<UserAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>("7d");

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await AnalyticsService.getUserAnalytics();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="w-full max-w-[1360px] mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center font-['Sora',sans-serif]"
        style={{ padding: "64px 24px" }}
      >
        <div className="w-14 h-14 rounded-2xl bg-[#E8913C]/12 border border-[#E8913C]/35 flex items-center justify-center mb-4 shadow-[0_0_24px_rgba(232,145,60,0.2)]">
          <Loader2 className="h-7 w-7 animate-spin text-[#E8913C]" />
        </div>
        <h3 className="font-['Syne',sans-serif] text-xl font-bold text-[#EDE7DC]">
          Loading Performance Analytics
        </h3>
        <p className="text-xs sm:text-sm text-[#9EA5A8] mt-2 max-w-sm leading-relaxed">
          Aggregating telemetry across your vector repository, conversations, and AI queries.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="w-full max-w-[1360px] mx-auto font-['Sora',sans-serif]"
        style={{ paddingTop: "32px", paddingBottom: "64px" }}
      >
        <div className="rounded-2xl bg-[#E5484D]/10 border border-[#E5484D]/35 p-6 flex items-start gap-4 text-[#EDE7DC] shadow-lg">
          <AlertCircle className="h-6 w-6 text-[#E5484D] shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-['Syne',sans-serif] text-lg font-bold text-[#EDE7DC]">
              Failed to load analytics
            </h3>
            <p className="text-xs sm:text-sm text-[#9EA5A8] mt-1 leading-relaxed">
              {error || "No data returned from the telemetry service."}
            </p>
            <button
              type="button"
              onClick={loadAnalytics}
              className="mt-4 px-4 py-2 rounded-xl bg-[#E8913C] hover:bg-[#ffa947] text-[#0A0C0E] font-bold text-xs transition-colors cursor-pointer"
            >
              Retry Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  const storageMB = (data.storage_used_bytes / (1024 * 1024)).toFixed(1);
  const storageLimitMB = (data.storage_limit_bytes / (1024 * 1024)).toFixed(0);

  const kpis = [
    {
      icon: FileText,
      label: "Total Documents",
      value: String(data.total_documents),
      delta: `${data.total_documents} uploaded`,
      accent: "#42C8D5", // Cyan
      bgBadge: "rgba(66, 200, 213, 0.14)",
      borderBadge: "rgba(66, 200, 213, 0.35)",
    },
    {
      icon: Zap,
      label: "Total AI Queries",
      value: String(data.total_queries),
      delta: `${data.total_queries} queries processed`,
      accent: "#9274F7", // Violet
      bgBadge: "rgba(146, 116, 247, 0.14)",
      borderBadge: "rgba(146, 116, 247, 0.35)",
    },
    {
      icon: MessageSquare,
      label: "Conversations",
      value: String(data.total_conversations),
      delta: `${data.total_conversations} threads`,
      accent: "#35B88A", // Emerald
      bgBadge: "rgba(53, 184, 138, 0.14)",
      borderBadge: "rgba(53, 184, 138, 0.35)",
    },
    {
      icon: HardDrive,
      label: "Storage Used",
      value: `${storageMB} MB`,
      delta: `of ${storageLimitMB} MB quota`,
      accent: "#E8913C", // Amber
      bgBadge: "rgba(232, 145, 60, 0.14)",
      borderBadge: "rgba(232, 145, 60, 0.35)",
    },
  ];

  const hasChartData = data.daily_queries && data.daily_queries.some((d) => d.queries > 0);

  return (
    <div
      className="w-full max-w-[1360px] mx-auto pb-24 font-['Sora',sans-serif] text-[#EDE7DC]"
      style={{ display: "flex", flexDirection: "column", gap: "32px" }}
    >
      {/* ====================================================================
          1. PAGE HEADER & DATE-RANGE SELECTOR
          ==================================================================== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-['Syne',sans-serif] text-[32px] sm:text-[38px] font-bold tracking-tight text-[#EDE7DC]">
            Performance Analytics
          </h1>
          <p className="mt-1.5 text-[13px] sm:text-[14.5px] text-[#9EA5A8] leading-relaxed">
            Live metrics, telemetry and audit activity derived from your knowledge repository.
          </p>
        </div>

        {/* Date-Range Selector Pill */}
        <div className="relative inline-flex items-center">
          <div
            className="flex items-center gap-2 rounded-full border border-[rgba(237,231,220,0.16)] bg-[#101317] hover:border-[rgba(237,231,220,0.3)] text-[13px] font-medium text-[#EDE7DC] transition-colors"
            style={{ paddingLeft: "16px", paddingRight: "34px", paddingTop: "8px", paddingBottom: "8px" }}
          >
            <Calendar className="h-3.5 w-3.5 text-[#E8913C] shrink-0" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="appearance-none bg-transparent text-[13px] font-semibold text-[#EDE7DC] focus:outline-none cursor-pointer pr-1"
            >
              <option value="7d" className="bg-[#101317] text-[#EDE7DC]">
                Last 7 Days
              </option>
              <option value="30d" className="bg-[#101317] text-[#EDE7DC]">
                Last 30 Days
              </option>
              <option value="all" className="bg-[#101317] text-[#EDE7DC]">
                All Time
              </option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9EA5A8]" />
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. KPI CARDS (4-Column Grid)
          Strict spacing: 22-24px internal padding, distinct accents
          ==================================================================== */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 w-full"
        style={{ gap: "22px" }}
      >
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-[#101317] border border-[rgba(237,231,220,0.13)] hover:border-[rgba(237,231,220,0.25)] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.25)] flex flex-col justify-between transition-all"
              style={{ padding: "22px 24px", minHeight: "136px" }}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-[12px] font-mono font-semibold uppercase tracking-[0.14em] text-[#9EA5A8]">
                  {k.label}
                </span>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{
                    backgroundColor: k.bgBadge,
                    border: `1px solid ${k.borderBadge}`,
                    color: k.accent,
                  }}
                >
                  <Icon className="h-5 w-5 stroke-[2.2]" />
                </div>
              </div>

              <div>
                <div className="font-['Syne',sans-serif] text-[32px] font-bold text-[#EDE7DC] mt-2 mb-1">
                  {k.value}
                </div>
                <div className="text-[13px] text-[#6C7378] font-medium">
                  {k.delta}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ====================================================================
          3. QUERY ACTIVITY VOLUME CHART CARD
          Proper height, subtle cyan/teal filled area, centered empty state
          ==================================================================== */}
      <div
        className="bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] w-full overflow-hidden"
        style={{ padding: "28px 30px" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-['Syne',sans-serif] text-[21.5px] font-bold text-[#EDE7DC]">
              Query Activity Volume
            </h2>
            <p className="text-[13px] text-[#9EA5A8] mt-1">
              Daily document questions asked over the past 7 days
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#42C8D5] shadow-[0_0_8px_rgba(66,200,213,0.6)]" />
            <span className="text-[13px] font-mono text-[#9EA5A8]">AI Telemetry</span>
          </div>
        </div>

        {/* Chart Viewport */}
        <div style={{ marginTop: "24px", height: "260px", width: "100%" }}>
          {!hasChartData ? (
            <div
              className="h-full border border-dashed border-[rgba(237,231,220,0.16)] bg-[#0A0C0E]/50 rounded-2xl flex flex-col items-center justify-center text-center p-6"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#E8913C]/12 border border-[#E8913C]/35 flex items-center justify-center mb-3">
                <Zap className="h-6 w-6 text-[#E8913C]" />
              </div>
              <h3 className="font-['Syne',sans-serif] text-[17px] font-bold text-[#EDE7DC]">
                No query activity in this period
              </h3>
              <p className="text-[13px] text-[#9EA5A8] mt-1 max-w-sm leading-relaxed">
                Ask questions in the AI Query page to generate query performance telemetry.
              </p>
              <Link
                to="/ai-query"
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full bg-[#E8913C]/15 border border-[#E8913C]/40 hover:bg-[#E8913C] hover:text-[#0A0C0E] text-[13px] font-semibold text-[#E8913C] transition-all cursor-pointer"
              >
                <span>Go to AI Query</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily_queries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsQueryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#42C8D5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#42C8D5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(237,231,220,0.08)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return d.toLocaleDateString([], { month: "short", day: "numeric" });
                  }}
                  stroke="#6C7378"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#6C7378"
                  fontSize={12}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#101317",
                    borderColor: "rgba(237,231,220,0.2)",
                    borderRadius: "12px",
                    color: "#EDE7DC",
                    fontSize: "13px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  formatter={(val: any) => [`${val} queries`, "Questions"]}
                />
                <Area
                  type="monotone"
                  dataKey="queries"
                  stroke="#42C8D5"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#analyticsQueryGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ====================================================================
          4. BOTTOM SECTION: 2-COLUMN GRID (Repository Docs + Activity Log)
          Clear 24px separation between cards
          ==================================================================== */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 w-full items-start"
        style={{ gap: "24px" }}
      >
        {/* Card 1: Repository Documents */}
        <div
          className="bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] w-full flex flex-col justify-between"
          style={{ padding: "26px 28px", minHeight: "340px" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-['Syne',sans-serif] text-[21.5px] font-bold text-[#EDE7DC]">
                  Repository Documents
                </h2>
                <p className="text-[13px] text-[#9EA5A8] mt-1">
                  Overview of uploaded knowledge assets
                </p>
              </div>
              <span className="text-[13px] font-mono text-[#9EA5A8]">
                {data.top_documents.length} files
              </span>
            </div>

            {data.top_documents.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[rgba(237,231,220,0.16)] bg-[#0A0C0E]/40 p-8 text-center text-[#9EA5A8]">
                <FileText className="h-8 w-8 mx-auto opacity-30 mb-2 text-[#42C8D5]" />
                <p className="text-[15px] font-medium text-[#EDE7DC]">No documents in repository</p>
                <p className="text-[13px] text-[#6C7378] mt-1">
                  Upload PDFs, DOCX, TXT or CSV files to build your knowledge base.
                </p>
                <Link to="/documents">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full bg-[#42C8D5]/15 border border-[#42C8D5]/40 text-[#42C8D5] hover:bg-[#42C8D5] hover:text-[#0A0C0E] text-[13px] font-semibold transition-all cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Files</span>
                  </button>
                </Link>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "20px" }}
              >
                {data.top_documents.map((doc, i) => (
                  <div
                    key={doc.id}
                    className="rounded-2xl bg-[#182028] border border-[rgba(237,231,220,0.15)] hover:border-[#42C8D5]/50 hover:bg-[#1D2630] flex items-center justify-between transition-all shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
                    style={{ padding: "17px 22px" }}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 pr-2">
                      <span className="font-mono text-[13px] font-bold text-[#42C8D5] shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-[13px] sm:text-[14.5px] text-[#EDE7DC] truncate max-w-xs sm:max-w-sm">
                          {doc.name}
                        </div>
                        <div className="text-[12.5px] text-[#9EA5A8] mt-0.5 font-mono">
                          {(doc.file_size / (1024 * 1024)).toFixed(1)} MB • {doc.chunk_count} chunks
                        </div>
                      </div>
                    </div>
                    <span className="text-[13px] text-[#6C7378] font-mono shrink-0 whitespace-nowrap">
                      {new Date(doc.upload_date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Activity Log */}
        <div
          className="bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] w-full flex flex-col justify-between"
          style={{ padding: "26px 28px", minHeight: "340px" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-['Syne',sans-serif] text-[21.5px] font-bold text-[#EDE7DC] flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-[#35B88A]" />
                  <span>Activity Log</span>
                </h2>
                <p className="text-[13px] text-[#9EA5A8] mt-1">
                  Audit trail of your recent document and AI interactions
                </p>
              </div>
              <span className="text-[13px] font-mono text-[#9EA5A8]">Live Audit</span>
            </div>

            {data.recent_activity.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[rgba(237,231,220,0.16)] bg-[#0A0C0E]/40 p-8 text-center text-[#9EA5A8]">
                <Clock className="h-8 w-8 mx-auto opacity-30 mb-2 text-[#35B88A]" />
                <p className="text-[15px] font-medium text-[#EDE7DC]">No recent activity</p>
                <p className="text-[13px] text-[#6C7378] mt-1">
                  Ingestion and query events will automatically appear here.
                </p>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "20px" }}
              >
                {data.recent_activity.map((act, i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-[#182028] border border-[rgba(237,231,220,0.15)] hover:border-[#35B88A]/50 hover:bg-[#1D2630] flex items-start gap-3.5 transition-all shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
                    style={{ padding: "17px 22px" }}
                  >
                    <span className="h-2 w-2 rounded-full bg-[#35B88A] mt-2 shrink-0 shadow-[0_0_8px_rgba(53,184,138,0.6)]" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[13px] sm:text-[14px] text-[#EDE7DC] truncate">
                        {act.title}
                      </div>
                      <div className="text-[12px] text-[#6C7378] font-mono mt-0.5">
                        {new Date(act.timestamp).toLocaleString()}
                      </div>
                    </div>
                    {act.meta && (
                      <span className="rounded-full bg-[#42C8D5]/15 border border-[#42C8D5]/35 px-2.5 py-0.5 text-[11.5px] font-mono text-[#42C8D5] shrink-0 whitespace-nowrap">
                        {act.meta}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
