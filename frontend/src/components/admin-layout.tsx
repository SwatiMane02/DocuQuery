import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { adminNav } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { authStore } from "@/store/authStore";
import { toast } from "sonner";

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (
    Icons as unknown as Record<
      string,
      React.ComponentType<{ className?: string }>
    >
  )[name];
  return C ? <C className={className} /> : null;
}

export function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [adminSearch, setAdminSearch] = useState("");
  const user = authStore.getUser();

  const handleAdminSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/admin/users" });
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-border bg-sidebar p-5 lg:flex">
        <div>
          <Link to="/admin" className="mb-8 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Icons.Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="font-serif text-lg font-semibold text-primary">
                DocuQuery
              </div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                Admin Console
              </div>
            </div>
          </Link>

          <Link to="/admin/reports" className="block mb-6">
            <Button
              className="w-full justify-center rounded-lg cursor-pointer bg-primary text-primary-foreground"
              variant="default"
            >
              <Icons.FileBarChart className="mr-1.5 h-4 w-4" /> View Reports
            </Button>
          </Link>

          <nav className="flex flex-col gap-1">
            {adminNav.map((item) => {
              const active =
                item.to === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                >
                  {active && (
                    <motion.span
                      layoutId="admin-sidebar-active"
                      className="absolute inset-0 rounded-lg bg-primary/10 ring-1 ring-primary/15"
                      transition={{
                        type: "spring",
                        duration: 0.45,
                        bounce: 0.2,
                      }}
                    />
                  )}
                  <Icon
                    name={item.icon}
                    className={`relative h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className={`relative ${active ? "text-primary font-medium" : ""}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition"
          >
            <Icons.ArrowLeft className="h-3.5 w-3.5 text-primary" />
            <span>Return to User Dashboard</span>
          </Link>

          <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">{user?.full_name || "Admin User"}</div>
            <div className="text-[10px] text-primary font-semibold uppercase">{user?.role || "Administrator"}</div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-6 backdrop-blur-xl">
          <form onSubmit={handleAdminSearch} className="relative w-full max-w-md">
            <Icons.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users and platform..."
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              className="h-9 rounded-full bg-muted/50 pl-9 text-xs"
            />
          </form>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => toast.info("No unread system alerts.")}
              className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="System Alerts"
            >
              <Icons.Bell className="h-4 w-4" />
            </button>

            <Link
              to="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full border border-border bg-muted/30"
            >
              <Icons.LayoutDashboard className="h-3.5 w-3.5" /> App Dashboard
            </Link>

            <div
              className="h-9 w-9 rounded-full bg-gradient-to-br from-sage to-primary flex items-center justify-center text-white text-xs font-bold"
              title={user?.email || "Admin"}
            >
              AD
            </div>
          </div>
        </header>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="px-6 lg:px-8 py-8"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
}
