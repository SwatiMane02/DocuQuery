import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect, useRef } from "react";
import { authStore } from "@/store/authStore";
import { toast } from "sonner";

interface NavItem {
  to: string;
  label: string;
  icon: keyof typeof Icons;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { to: "/documents", label: "Documents", icon: "FileText" },
  { to: "/ai-query", label: "AI Query", icon: "Sparkles" },
  { to: "/search", label: "Search", icon: "Search" },
  { to: "/analytics", label: "Analytics", icon: "BarChart2" },
];

export function UserLayout() {
  const { pathname } = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const user = authStore.getUser();
  const userInitials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "DQ";

  // Global ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = () => {
    authStore.logout();
    toast.success("Successfully logged out", {
      description: "Come back soon!",
    });
    navigate({ to: "/login" });
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    navigate({
      to: "/search",
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0C0E] text-[#EDE7DC] flex flex-col font-['Sora',sans-serif] selection:bg-[#E8913C] selection:text-[#0A0C0E]">
      {/* Top Nav Header */}
      <header className="sticky top-0 z-40 border-b border-[rgba(237,231,220,0.08)] bg-[#0A0C0E]/95 backdrop-blur-xl">
        <div
          className="flex items-center justify-between max-w-[1360px] mx-auto w-full"
          style={{ height: "78px", paddingLeft: "32px", paddingRight: "32px" }}
        >
          {/* Left Group: Mobile trigger + Logo */}
          <div className="flex items-center gap-3.5 shrink-0">
            {/* Mobile Menu Trigger */}
            <div className="md:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="h-10 w-10 rounded-xl border border-[rgba(237,231,220,0.12)] bg-[#101317] flex items-center justify-center text-[#EDE7DC] hover:text-[#E8913C] transition-colors"
                    aria-label="Toggle navigation menu"
                  >
                    <Icons.Menu className="h-4 w-4" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-68 p-0 bg-[#0A0C0E] border-r border-[rgba(237,231,220,0.1)] text-[#EDE7DC]">
                  <div className="flex flex-col h-full font-['Sora',sans-serif]">
                    <div className="p-6 border-b border-[rgba(237,231,220,0.08)]">
                      <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-1.5"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <span className="font-['Syne',sans-serif] font-bold text-xl tracking-[-0.01em] text-[#EDE7DC]">
                          DocuQuery
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E8913C]" />
                      </Link>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                      <nav className="flex flex-col gap-2">
                        {NAV_ITEMS.map((item) => {
                          const active =
                            pathname === item.to ||
                            (item.to !== "/dashboard" && pathname.startsWith(item.to));
                          const IconComponent = Icons[item.icon] as React.ComponentType<{ className?: string }>;
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-[14px] font-medium transition-all duration-200 ${
                                active
                                  ? "bg-[rgba(232,145,60,0.14)] border border-[rgba(232,145,60,0.65)] text-[#E8913C]"
                                  : "text-[#9EA5A8] border border-transparent hover:text-[#EDE7DC] hover:bg-[rgba(232,145,60,0.08)] hover:border-[rgba(232,145,60,0.25)]"
                              }`}
                            >
                              {IconComponent && (
                                <IconComponent
                                  className={`h-[17px] w-[17px] ${active ? "text-[#E8913C]" : "text-[#8E9598]"}`}
                                />
                              )}
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </nav>
                    </div>
                    <div className="p-4 border-t border-[rgba(237,231,220,0.08)]">
                      <Link
                        to="/profile"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#101317] border border-[rgba(237,231,220,0.12)] py-2.5 text-xs font-medium text-[#EDE7DC] hover:border-[rgba(237,231,220,0.25)] transition-colors"
                      >
                        <Icons.User className="h-3.5 w-3.5 text-[#E8913C]" />
                        <span>Account Profile</span>
                      </Link>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Logo Wordmark */}
            <Link to="/dashboard" className="flex items-center gap-1.5 focus:outline-none">
              <span className="font-['Syne',sans-serif] font-bold text-2xl tracking-[-0.02em] text-[#EDE7DC]">
                DocuQuery
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8913C]" />
            </Link>
          </div>

          {/* Center Navigation Tabs (Spacious 24-28px gap, balanced alignment) */}
          <nav
            className="hidden md:flex items-center shrink-0"
            style={{ gap: "26px" }}
          >
            {NAV_ITEMS.map((n) => {
              const active =
                pathname === n.to ||
                (n.to !== "/dashboard" && pathname.startsWith(n.to));
              const IconComponent = Icons[n.icon] as React.ComponentType<{ className?: string }>;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2.5 rounded-full text-[14.5px] font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    active
                      ? "border border-[rgba(232,145,60,0.65)] bg-[rgba(232,145,60,0.14)] text-[#E8913C]"
                      : "text-[#9EA5A8] border border-transparent hover:text-[#EDE7DC] hover:bg-[rgba(232,145,60,0.08)] hover:border-[rgba(232,145,60,0.25)]"
                  }`}
                  style={{
                    paddingLeft: "14px",
                    paddingRight: "14px",
                    paddingTop: "8px",
                    paddingBottom: "8px",
                  }}
                >
                  {IconComponent && (
                    <IconComponent
                      className={`h-[17px] w-[17px] shrink-0 transition-colors duration-200 ${
                        active ? "text-[#E8913C]" : "text-[#8E9598] group-hover:text-[#EDE7DC]"
                      }`}
                    />
                  )}
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Controls: Search, Notification Bell, User Avatar */}
          <div className="flex items-center gap-3.5 shrink-0">
            {/* Search Input Box with explicit padding to prevent icon/text overlap */}
            <form onSubmit={handleGlobalSearch} className="relative hidden lg:block w-64 xl:w-72 shrink-0">
              <Icons.Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6C7378]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search your documents..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full h-[42px] rounded-xl bg-[#101317] border border-[rgba(237,231,220,0.14)] text-[13.5px] text-[#EDE7DC] placeholder-[#6C7378] focus:outline-none focus:border-[#E8913C] focus:ring-1 focus:ring-[#E8913C]/40 transition-all box-border"
                style={{ paddingLeft: "48px", paddingRight: "56px" }}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rounded border border-[rgba(237,231,220,0.15)] bg-[#0A0C0E] px-1.5 py-0.5 text-[10px] font-mono text-[#8E9598]">
                ⌘ K
              </span>
            </form>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => {
                toast.info("Notifications", {
                  description: "All document ingestion and embeddings are operational.",
                });
              }}
              className="relative h-[42px] w-[42px] rounded-xl border border-[rgba(237,231,220,0.12)] bg-[#101317] flex items-center justify-center text-[#8E9598] hover:text-[#EDE7DC] hover:border-[rgba(237,231,220,0.22)] transition-colors cursor-pointer shrink-0"
              aria-label="View notifications"
            >
              <Icons.Bell className="h-4 w-4" />
              <span className="absolute top-3 right-3 h-1.5 w-1.5 rounded-full bg-[#E8913C]" />
            </button>

            {/* Profile Dropdown with comfortable vertical spacing (5-7% more spacious) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-[42px] w-[42px] rounded-xl border border-[rgba(237,231,220,0.15)] bg-[#101317] hover:border-[#E8913C]/50 flex items-center justify-center text-[#EDE7DC] font-semibold text-xs transition-all cursor-pointer focus:outline-none shrink-0"
                  title="Open user profile menu"
                >
                  {userInitials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 bg-[#101317] border border-[rgba(237,231,220,0.16)] rounded-2xl text-[#EDE7DC] shadow-2xl font-['Sora',sans-serif]"
                style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <DropdownMenuLabel
                  className="text-[11.5px] text-[#9EA5A8] font-mono uppercase tracking-wider"
                  style={{ padding: "10px 14px 8px 14px" }}
                >
                  {user?.email || "My Account"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[rgba(237,231,220,0.08)] my-1.5" />
                <DropdownMenuItem asChild>
                  <Link
                    to="/profile"
                    className="flex items-center gap-3 rounded-xl text-[14px] font-medium text-[#EDE7DC] hover:text-[#E8913C] hover:bg-[#181E25] cursor-pointer transition-colors"
                    style={{ padding: "12px 16px" }}
                  >
                    <Icons.User className="h-4 w-4 text-[#E8913C] shrink-0" />
                    <span>Profile &amp; Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/analytics"
                    className="flex items-center gap-3 rounded-xl text-[14px] font-medium text-[#EDE7DC] hover:text-[#E8913C] hover:bg-[#181E25] cursor-pointer transition-colors"
                    style={{ padding: "12px 16px" }}
                  >
                    <Icons.BarChart2 className="h-4 w-4 text-[#2E6B72] shrink-0" />
                    <span>Analytics</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[rgba(237,231,220,0.08)] my-1.5" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-3 rounded-xl text-[14px] font-medium text-[#E5484D] hover:bg-[rgba(229,72,77,0.12)] cursor-pointer transition-colors"
                  style={{ padding: "12px 16px" }}
                >
                  <Icons.LogOut className="h-4 w-4 shrink-0" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main
        className="flex-1 w-full mx-auto box-border"
        style={{
          maxWidth: "1360px",
          paddingLeft: "clamp(24px, 4vw, 72px)",
          paddingRight: "clamp(24px, 4vw, 72px)",
          paddingTop: "40px",
          paddingBottom: "80px",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
