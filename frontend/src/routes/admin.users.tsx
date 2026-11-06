import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Crown,
  ShieldCheck,
  Search,
  Loader2,
  Trash2,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminService,
  AdminStatsResponse,
} from "@/services/adminService";
import { UserResponse } from "@/services/authService";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

const roleTint: Record<string, string> = {
  admin: "bg-primary/15 text-primary border border-primary/20",
  pro: "bg-gold/15 text-gold border border-gold/20",
  free: "bg-muted text-muted-foreground",
};

function AdminUsers() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await AdminService.getStats();
      setStats(data);
    } catch {
      // Ignored for unauthenticated or non-admin view
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await AdminService.getUsers(
        0,
        50,
        search.trim() || undefined,
        roleFilter !== "All" ? roleFilter.toLowerCase() : undefined,
      );
      setUsers(data.users);
      setTotal(data.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load users";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(userId);
    try {
      await AdminService.updateUser(userId, { role: newRole });
      toast.success(`User role updated to ${newRole}`);
      await fetchUsers();
      await fetchStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update role";
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to permanently delete user ${email}? This will delete all their documents and conversations.`)) {
      return;
    }
    setActionLoading(userId);
    try {
      await AdminService.deleteUser(userId);
      toast.success("User deleted successfully");
      await fetchUsers();
      await fetchStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete user";
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const statCards = [
    {
      icon: Users,
      label: "Total Registered Users",
      value: stats ? stats.total_users.toLocaleString() : "—",
      tint: "bg-primary/10 text-primary",
    },
    {
      icon: Crown,
      label: "Pro Subscribers",
      value: stats ? stats.pro_users_count.toLocaleString() : "—",
      tint: "bg-gold/15 text-gold",
    },
    {
      icon: ShieldCheck,
      label: "Admin Accounts",
      value: stats ? stats.admin_users_count.toLocaleString() : "—",
      tint: "bg-sage/15 text-primary",
    },
  ];

  return (
    <div className="space-y-7">
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="surface-card p-5"
          >
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {s.label}
            </div>
            <div className="mt-2 flex items-end justify-between">
              <div className="font-serif text-3xl font-semibold">{s.value}</div>
              <div
                className={`grid h-10 w-10 place-items-center rounded-lg ${s.tint}`}
              >
                <s.icon className="h-4 w-4" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="font-serif text-xl font-semibold">User Directory</h2>
            <p className="text-xs text-muted-foreground">
              Showing {users.length} of {total} total users
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-64 rounded-full pl-8"
              />
            </div>
            <div className="inline-flex rounded-full border border-border p-0.5 text-xs bg-muted/40">
              {["All", "Free", "Pro", "Admin"].map((t) => (
                <button
                  key={t}
                  onClick={() => setRoleFilter(t)}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    roleFilter === t
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto h-8 w-8 opacity-40 mb-2" />
            <p className="font-medium text-foreground">No users found</p>
            <p className="text-xs mt-1">
              {search ? "Try adjusting your search criteria" : "No users registered yet"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">User</th>
                  <th className="px-5 py-3 text-left">Email</th>
                  <th className="px-5 py-3 text-left">Role</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Joined</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-t border-border transition hover:bg-muted/30"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sage to-primary flex items-center justify-center font-bold text-xs text-white">
                          {(u.full_name || u.email || "U").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">
                            {u.full_name || "Unnamed User"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Limit: {u.documents_limit || 20} docs
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{u.email}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          roleTint[u.role] || roleTint.free
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            u.is_active ? "bg-primary" : "bg-destructive"
                          }`}
                        />
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.role === "free" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full h-8 text-xs"
                            disabled={actionLoading === u.id}
                            onClick={() => handleRoleChange(u.id, "pro")}
                          >
                            <Crown className="mr-1 h-3.5 w-3.5 text-gold" /> Make Pro
                          </Button>
                        ) : u.role === "pro" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full h-8 text-xs"
                            disabled={actionLoading === u.id}
                            onClick={() => handleRoleChange(u.id, "free")}
                          >
                            Downgrade
                          </Button>
                        ) : null}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-full text-destructive hover:bg-destructive/10"
                          disabled={actionLoading === u.id}
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          title="Delete User"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="surface-card p-5">
          <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-gold" /> System Permissions
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            All administrative actions are logged in MongoDB. Modifying user roles updates
            storage limits and access privileges in real-time.
          </p>
        </div>
        <div className="surface-card p-5">
          <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" /> Active Management
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            User document embeddings and conversation histories are strictly isolated. Deleting a user purges all associated documents and vector chunks.
          </p>
        </div>
      </div>
    </div>
  );
}
