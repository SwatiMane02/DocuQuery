import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Users,
  FileText,
  MessageSquare,
  Zap,
  Crown,
  HardDrive,
  Loader2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminService, AdminStatsResponse } from "@/services/adminService";

export const Route = createFileRoute("/admin/")({ component: Overview });

function Overview() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await AdminService.getStats();
      setStats(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin stats");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading system overview metrics...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="py-12">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Failed to load admin data</h3>
            <p className="text-sm text-red-700 mt-0.5">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={loadStats}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const storageMB = (stats.total_storage_bytes / (1024 * 1024)).toFixed(1);

  const kpis = [
    {
      icon: Users,
      label: "Total Users",
      value: String(stats.total_users),
      delta: `${stats.admin_users_count} admin(s)`,
      tint: "bg-primary/10 text-primary",
    },
    {
      icon: FileText,
      label: "Total Documents",
      value: String(stats.total_documents),
      delta: "In knowledge base",
      tint: "bg-sage/15 text-primary",
    },
    {
      icon: MessageSquare,
      label: "Conversations",
      value: String(stats.total_conversations),
      delta: "Active chat sessions",
      tint: "bg-gold/15 text-gold",
    },
    {
      icon: Zap,
      label: "AI Queries Run",
      value: String(stats.total_queries),
      delta: "RAG questions answered",
      tint: "bg-clay/15 text-clay",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl font-semibold">
          System Overview
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live administrative analytics and MongoDB metrics.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="surface-card p-5"
          >
            <div className="flex items-start justify-between">
              <div
                className={`grid h-10 w-10 place-items-center rounded-lg ${s.tint}`}
              >
                <s.icon className="h-4 w-4" />
              </div>
              <span className="text-xs text-muted-foreground">{s.delta}</span>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">{s.label}</div>
            <div className="font-serif text-3xl font-semibold">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Storage and Plan Distribution */}
        <div className="surface-card p-6">
          <h2 className="font-serif text-xl font-semibold">
            Platform Resource Usage
          </h2>
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3 text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" /> Total Storage Footprint
              </span>
              <span className="font-semibold">{storageMB} MB</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3 text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Crown className="h-4 w-4 text-gold" /> Pro Plan Subscribers
              </span>
              <span className="font-semibold">{stats.pro_users_count}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3 text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Free Tier Users
              </span>
              <span className="font-semibold">
                {stats.total_users - stats.pro_users_count}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Admin Actions */}
        <div className="surface-card p-6">
          <h2 className="font-serif text-xl font-semibold">
            Administrative Directory
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage user accounts, roles, access permissions, and storage limits.
          </p>
          <div className="mt-5 space-y-3">
            <Link to="/admin/users">
              <Button className="w-full rounded-full cursor-pointer">
                <Users className="mr-2 h-4 w-4" /> Open User Directory ({stats.total_users} Users)
              </Button>
            </Link>
            <Link to="/documents">
              <Button variant="outline" className="w-full rounded-full cursor-pointer">
                <FileText className="mr-2 h-4 w-4" /> View Knowledge Base Assets
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
