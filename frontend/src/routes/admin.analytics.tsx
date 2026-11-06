import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  FileText,
  MessageSquare,
  Sparkles,
  HardDrive,
  Crown,
  Loader2,
} from "lucide-react";
import { AdminService, AdminStatsResponse } from "@/services/adminService";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await AdminService.getStats();
        setStats(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load admin stats";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const kpis = [
    {
      icon: Users,
      label: "Total Users",
      value: stats ? stats.total_users.toLocaleString() : "0",
      sub: `${stats?.pro_users_count || 0} Pro, ${stats?.admin_users_count || 0} Admins`,
      tint: "bg-primary/10 text-primary",
    },
    {
      icon: FileText,
      label: "Documents Indexed",
      value: stats ? stats.total_documents.toLocaleString() : "0",
      sub: "Active in MongoDB",
      tint: "bg-sage/15 text-primary",
    },
    {
      icon: Sparkles,
      label: "AI Queries Executed",
      value: stats ? stats.total_queries.toLocaleString() : "0",
      sub: "RAG + Gemini answers",
      tint: "bg-gold/15 text-gold",
    },
    {
      icon: MessageSquare,
      label: "Active Conversations",
      value: stats ? stats.total_conversations.toLocaleString() : "0",
      sub: "Multi-turn sessions",
      tint: "bg-clay/15 text-clay",
    },
  ];

  const totalUsers = stats?.total_users || 1;
  const proPct = Math.round(((stats?.pro_users_count || 0) / totalUsers) * 100);
  const freePct = Math.max(0, 100 - proPct);

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-serif text-4xl font-semibold">System Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time metrics derived from your production MongoDB database.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="surface-card p-5"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {k.label}
              </span>
              <div className={`grid h-8 w-8 place-items-center rounded-lg ${k.tint}`}>
                <k.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-serif text-3xl font-semibold">
              {k.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {k.sub}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
              <Crown className="h-5 w-5 text-gold" /> Plan Distribution
            </h2>
          </div>
          <div className="mt-6 space-y-4">
            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-medium">Free Tier</span>
                <span className="text-muted-foreground">
                  {stats?.total_users ? stats.total_users - (stats?.pro_users_count || 0) : 0} ({freePct}%)
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${freePct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-medium">Pro Subscribers</span>
                <span className="text-muted-foreground">
                  {stats?.pro_users_count || 0} ({proPct}%)
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${proPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card p-6">
          <h2 className="font-serif text-xl font-semibold flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" /> Total Vector & Document Storage
          </h2>
          <div className="mt-4">
            <div className="font-serif text-3xl font-semibold text-primary">
              {formatBytes(stats?.total_storage_bytes || 0)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Cumulative file size of all indexed PDFs, Word documents, text files, and embeddings stored in MongoDB.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
