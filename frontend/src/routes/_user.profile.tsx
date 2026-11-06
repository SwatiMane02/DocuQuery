import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  User as UserIcon,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HardDrive,
  FileText,
  Calendar,
  Sparkles,
  Lock,
  Mail,
  RotateCcw,
  Save,
} from "lucide-react";
import { AuthService, UserResponse } from "@/services/authService";
import { AnalyticsService, UserAnalyticsResponse } from "@/services/analyticsService";
import { authStore } from "@/store/authStore";
import { toast } from "sonner";

export const Route = createFileRoute("/_user/profile")({ component: Profile });

function Profile() {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [analytics, setAnalytics] = useState<UserAnalyticsResponse | null>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    loadProfileAndStats();
  }, []);

  const loadProfileAndStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [profileResult, analyticsResult] = await Promise.allSettled([
        AuthService.getProfile(),
        AnalyticsService.getUserAnalytics(),
      ]);

      if (profileResult.status === "fulfilled") {
        const profile = profileResult.value;
        setUser(profile);
        setFullName(profile.full_name || "");
        setBio(profile.bio || "");
        authStore.setUser(profile);
      } else {
        throw new Error(profileResult.reason?.message || "Failed to load profile");
      }

      if (analyticsResult.status === "fulfilled") {
        setAnalytics(analyticsResult.value);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full name cannot be empty");
      return;
    }

    try {
      setIsSaving(true);
      const updated = await AuthService.updateProfile({
        full_name: fullName.trim(),
        bio: bio.trim(),
      });
      setUser(updated);
      authStore.setUser(updated);
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update profile",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (user) {
      setFullName(user.full_name || "");
      setBio(user.bio || "");
      toast.info("Changes discarded");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    try {
      setIsChangingPassword(true);
      await AuthService.changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to change password",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0.0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${mb.toFixed(2)} MB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div
        className="w-full max-w-[1200px] mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center font-['Sora',sans-serif]"
        style={{ padding: "64px 24px" }}
      >
        <div className="w-14 h-14 rounded-2xl bg-[#E8913C]/10 border border-[#E8913C]/25 flex items-center justify-center mb-4 text-[#E8913C]">
          <Loader2 className="h-7 w-7 animate-spin stroke-[2]" />
        </div>
        <h3 className="font-['Syne',sans-serif] text-xl font-bold text-[#EDE7DC]">
          Loading Profile &amp; Settings
        </h3>
        <p className="text-sm text-[#9EA5A8] mt-1.5">
          Retrieving your account credentials and subscription status...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="w-full max-w-[1200px] mx-auto py-12 font-['Sora',sans-serif]"
        style={{ paddingLeft: "24px", paddingRight: "24px" }}
      >
        <div
          className="rounded-2xl bg-[#101317] border border-[rgba(229,72,77,0.35)] flex flex-col sm:flex-row items-start gap-4 shadow-xl"
          style={{ padding: "28px" }}
        >
          <div className="w-12 h-12 rounded-xl bg-[rgba(229,72,77,0.15)] border border-[rgba(229,72,77,0.3)] flex items-center justify-center text-[#E5484D] shrink-0">
            <AlertCircle className="h-6 w-6 stroke-[2]" />
          </div>
          <div className="flex-1">
            <h3 className="font-['Syne',sans-serif] text-lg font-bold text-[#EDE7DC]">
              Failed to load profile
            </h3>
            <p className="text-sm text-[#9EA5A8] mt-1">{error}</p>
            <button
              onClick={loadProfileAndStats}
              className="mt-4 px-5 py-2.5 rounded-xl bg-[#E8913C] hover:bg-[#f39c4a] text-[#0A0C0E] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nameParts = (user?.full_name || "").trim().split(" ");
  const initials =
    nameParts.length > 1
      ? `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase()
      : (user?.full_name || user?.email || "U").slice(0, 2).toUpperCase();

  const isPro = user?.role?.toLowerCase() === "pro";
  const usedStorage = analytics?.storage_used_bytes || 0;
  const limitStorage = analytics?.storage_limit_bytes || 500 * 1024 * 1024;
  const storagePercent = Math.min(
    100,
    Math.max(0, (usedStorage / (limitStorage || 1)) * 100),
  );

  const passwordsMatch =
    newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordsMismatch =
    newPassword && confirmPassword && newPassword !== confirmPassword;

  return (
    <div
      className="w-full max-w-[1200px] mx-auto font-['Sora',sans-serif] flex flex-col box-border"
      style={{ gap: "30px" }}
    >
      {/* ====================================================================
          PAGE HEADER: Title, Description
          ==================================================================== */}
      <div className="flex flex-col gap-2">
        <h1 className="font-['Syne',sans-serif] text-[28px] sm:text-[32px] md:text-[34px] font-bold tracking-[-0.02em] text-[#EDE7DC]">
          Profile &amp; Account Settings
        </h1>
        <p className="text-sm sm:text-[14.5px] text-[#9EA5A8] max-w-2xl leading-relaxed">
          Manage your personal details, workspace authentication credentials, and subscription status.
        </p>
      </div>

      {/* ====================================================================
          PROFILE SUMMARY CARD (Full Width Header)
          ==================================================================== */}
      <section
        aria-label="Profile summary"
        className="w-full bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.35)] relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        style={{ padding: "32px 34px" }}
      >
        {/* Subtle decorative background gradient */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 w-80 h-80 rounded-full bg-[#42C8D5]/5 blur-3xl"
        />

        {/* User Identity: Avatar, Name, Email, Role */}
        <div className="flex items-center gap-6 relative z-10">
          <div
            className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-gradient-to-br from-[#162B30] to-[#0E1A1D] border-2 border-[#42C8D5]/40 flex items-center justify-center font-['Syne',sans-serif] text-2xl sm:text-3xl font-bold text-[#42C8D5] shadow-[0_0_24px_rgba(66,200,213,0.16)] shrink-0"
          >
            {initials}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-['Syne',sans-serif] text-2xl sm:text-[26px] font-bold text-[#EDE7DC] tracking-[-0.01em]">
                {user?.full_name || "DocuQuery User"}
              </h2>
              {isPro ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#E8913C]/15 border border-[#E8913C]/40 text-[#E8913C] uppercase tracking-wider whitespace-nowrap min-w-fit">
                  <Sparkles className="h-3.5 w-3.5" /> Pro Tier
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#42C8D5]/15 border border-[#42C8D5]/35 text-[#42C8D5] uppercase tracking-wider whitespace-nowrap min-w-fit">
                  Free Tier
                </span>
              )}
            </div>

            <p className="text-xs sm:text-[13.5px] text-[#9EA5A8] flex flex-wrap items-center gap-2.5 font-mono">
              <span className="flex items-center gap-1.5 text-[#EDE7DC]/85">
                <Mail className="h-3.5 w-3.5 text-[#6C7378]" />
                {user?.email}
              </span>
              <span className="text-[#6C7378]">•</span>
              <span className="text-[#9EA5A8]">
                Member since {formatDate(user?.created_at)}
              </span>
            </p>
          </div>
        </div>

        {/* Badges / Quick Status Pill */}
        <div className="flex items-center gap-3 relative z-10 self-stretch md:self-auto justify-end">
          <span
            className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap min-w-fit ${
              user?.is_active
                ? "bg-[#35B88A]/12 border border-[#35B88A]/35 text-[#35B88A]"
                : "bg-[rgba(229,72,77,0.12)] border border-[rgba(229,72,77,0.35)] text-[#E5484D]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                user?.is_active ? "bg-[#35B88A] animate-pulse" : "bg-[#E5484D]"
              }`}
            />
            <span>{user?.is_active ? "Active Account" : "Account Suspended"}</span>
          </span>
        </div>
      </section>

      {/* ====================================================================
          TWO-COLUMN BALANCED LAYOUT:
          Left (approx 63%): Personal Information Form
          Right (approx 37%): Account Overview + Change Password
          ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ==================================================================
            LEFT COLUMN (lg:col-span-7): PERSONAL INFORMATION CARD
            ================================================================== */}
        <section
          aria-label="Personal information"
          className="lg:col-span-7 bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.35)] flex flex-col box-border"
          style={{ padding: "34px 34px" }}
        >
          {/* Card Title & Subtitle with increased bottom gap to labels */}
          <div className="flex items-center gap-3.5" style={{ paddingBottom: "18px" }}>
            <div className="w-11 h-11 rounded-xl bg-[#42C8D5]/10 border border-[#42C8D5]/25 flex items-center justify-center text-[#42C8D5] shrink-0">
              <UserIcon className="h-5 w-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="font-['Syne',sans-serif] text-[19px] font-bold text-[#EDE7DC]">
                Personal Information
              </h2>
              <p className="text-xs text-[#9EA5A8]" style={{ marginTop: "4px" }}>
                Update your identity details and public display settings.
              </p>
            </div>
          </div>

          {/* Explicit Divider Line with guaranteed vertical margins */}
          <div
            className="w-full h-[1px] bg-[rgba(237,231,220,0.08)]"
            style={{ marginBottom: "26px" }}
          />

          <form onSubmit={handleSaveProfile} className="flex flex-col" style={{ gap: "28px" }}>
            {/* Field: Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="text-xs sm:text-[13px] font-semibold text-[#EDE7DC] uppercase tracking-wider"
                style={{ marginBottom: "14px", display: "block" }}
              >
                Full Name <span className="text-[#E8913C]">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Kate Montgomery"
                className="h-[48px] w-full rounded-xl bg-[#171D21] border border-[rgba(237,231,220,0.14)] text-[#EDE7DC] placeholder-[#6C7378] text-sm px-4 focus:outline-none focus:border-[#E8913C] focus:ring-1 focus:ring-[#E8913C]/40 transition-all box-border"
                required
              />
            </div>

            {/* Field: Email Address (Read-only) */}
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: "14px" }}>
                <label
                  htmlFor="emailAddress"
                  className="block text-xs sm:text-[13px] font-semibold text-[#EDE7DC] uppercase tracking-wider"
                >
                  Email Address
                </label>
                <span className="text-[11px] font-mono text-[#6C7378] flex items-center gap-1.5">
                  <Lock className="h-3 w-3" /> Managed by auth
                </span>
              </div>
              <input
                id="emailAddress"
                type="email"
                value={user?.email || ""}
                disabled
                className="h-[48px] w-full rounded-xl bg-[#080B0D] border border-[rgba(237,231,220,0.08)] text-[#9EA5A8] text-sm px-4 cursor-not-allowed select-none box-border font-mono"
              />
              <p className="text-[11.5px] text-[#6C7378] mt-2.5">
                Your email address is tied to your login identity and cannot be altered directly.
              </p>
            </div>

            {/* Field: Biography */}
            <div>
              <label
                htmlFor="bio"
                className="text-xs sm:text-[13px] font-semibold text-[#EDE7DC] uppercase tracking-wider"
                style={{ marginBottom: "14px", display: "block" }}
              >
                Biography
              </label>
              <textarea
                id="bio"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about your research focus, projects, or organization..."
                className="w-full rounded-xl bg-[#171D21] border border-[rgba(237,231,220,0.14)] text-[#EDE7DC] placeholder-[#6C7378] text-sm p-4 focus:outline-none focus:border-[#E8913C] focus:ring-1 focus:ring-[#E8913C]/40 transition-all resize-y min-h-[135px] box-border leading-relaxed"
              />
              <p className="text-[11.5px] text-[#6C7378] mt-2.5">
                Brief description displayed alongside your generated research summaries.
              </p>
            </div>

            {/* Bottom Form Actions: Discard & Save Buttons with widened pills to prevent text overflow */}
            <div
              className="flex flex-wrap items-center justify-end gap-3.5 pt-6 border-t border-[rgba(237,231,220,0.08)] mt-3"
            >
              <button
                type="button"
                onClick={handleDiscard}
                disabled={isSaving}
                className="h-11 px-7 min-w-[160px] rounded-xl border border-[rgba(237,231,220,0.14)] bg-transparent hover:bg-[#181D23] text-[#9EA5A8] hover:text-[#EDE7DC] text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap text-center"
              >
                Discard Changes
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="h-11 px-8 min-w-[175px] rounded-xl bg-[#E8913C] hover:bg-[#f39c4a] text-[#0A0C0E] font-bold text-xs uppercase tracking-wider transition-all shadow-[0_2px_14px_rgba(232,145,60,0.32)] cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-60 active:scale-[0.98] whitespace-nowrap text-center"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 stroke-[2.4] shrink-0" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ==================================================================
            RIGHT COLUMN (lg:col-span-5): ACCOUNT OVERVIEW + CHANGE PASSWORD
            Strict 24px vertical separation between the two cards!
            ================================================================== */}
        <div className="lg:col-span-5 flex flex-col" style={{ gap: "24px" }}>
          {/* ================================================================
              CARD 1: ACCOUNT OVERVIEW
              ================================================================ */}
          <section
            aria-label="Account overview"
            className="w-full bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.35)] flex flex-col box-border"
            style={{ padding: "34px 30px" }}
          >
            {/* Header with clear bottom padding */}
            <div className="flex items-center gap-3.5" style={{ paddingBottom: "18px" }}>
              <div className="w-11 h-11 rounded-xl bg-[#35B88A]/10 border border-[#35B88A]/25 flex items-center justify-center text-[#35B88A] shrink-0">
                <ShieldCheck className="h-5 w-5 stroke-[2]" />
              </div>
              <div>
                <h2 className="font-['Syne',sans-serif] text-[19px] font-bold text-[#EDE7DC]">
                  Account Overview
                </h2>
                <p className="text-xs text-[#9EA5A8]" style={{ marginTop: "4px" }}>
                  Subscription plan &amp; capacity limits
                </p>
              </div>
            </div>

            {/* Explicit Divider Line with guaranteed vertical margins */}
            <div
              className="w-full h-[1px] bg-[rgba(237,231,220,0.08)]"
              style={{ marginBottom: "22px" }}
            />

            {/* Key-Value Details with guaranteed vertical spacing and clear gap after header */}
            <ul className="flex flex-col text-xs sm:text-[13px]">
              {/* Row: Plan */}
              <li
                className="flex items-center justify-between"
                style={{ paddingTop: "16px", paddingBottom: "16px", borderBottom: "1px solid rgba(237,231,220,0.06)" }}
              >
                <span className="text-[#9EA5A8] flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 text-[#E8913C]" />
                  Subscription Plan
                </span>
                <span
                  style={{ padding: "6px 16px", borderRadius: "8px", minWidth: "96px", textAlign: "center" }}
                  className="font-semibold text-[#EDE7DC] capitalize bg-[#0A0C0E] border border-[rgba(237,231,220,0.14)] text-xs whitespace-nowrap"
                >
                  {user?.role || "Free"} Tier
                </span>
              </li>

              {/* Row: Document Limit */}
              <li
                className="flex items-center justify-between"
                style={{ paddingTop: "16px", paddingBottom: "16px", borderBottom: "1px solid rgba(237,231,220,0.06)" }}
              >
                <span className="text-[#9EA5A8] flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-[#42C8D5]" />
                  Document Limit
                </span>
                <span className="font-semibold text-[#EDE7DC] font-mono">
                  {analytics?.total_documents || 0} / {user?.documents_limit || 10} docs
                </span>
              </li>

              {/* Row: Storage Quota */}
              <li
                className="flex flex-col gap-3"
                style={{ paddingTop: "16px", paddingBottom: "16px", borderBottom: "1px solid rgba(237,231,220,0.06)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[#9EA5A8] flex items-center gap-2.5">
                    <HardDrive className="h-4 w-4 text-[#35B88A]" />
                    Storage Used
                  </span>
                  <span className="font-semibold text-[#EDE7DC] font-mono">
                    {formatBytes(usedStorage)} / {formatBytes(limitStorage)}
                  </span>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full h-2 rounded-full bg-[#0A0C0E] border border-[rgba(237,231,220,0.08)] overflow-hidden my-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#42C8D5] to-[#35B88A] transition-all duration-500"
                    style={{ width: `${Math.max(2, storagePercent)}%` }}
                  />
                </div>
              </li>

              {/* Row: Member Since */}
              <li
                className="flex items-center justify-between"
                style={{ paddingTop: "16px", paddingBottom: "16px", borderBottom: "1px solid rgba(237,231,220,0.06)" }}
              >
                <span className="text-[#9EA5A8] flex items-center gap-2.5">
                  <Calendar className="h-4 w-4 text-[#9274F7]" />
                  Member Since
                </span>
                <span className="font-semibold text-[#EDE7DC] font-mono">
                  {formatDate(user?.created_at)}
                </span>
              </li>

              {/* Row: Status */}
              <li
                className="flex items-center justify-between"
                style={{ paddingTop: "16px", paddingBottom: "4px" }}
              >
                <span className="text-[#9EA5A8] flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#35B88A]" />
                  Account Status
                </span>
                <span
                  style={{ padding: "6px 16px", borderRadius: "8px", minWidth: "120px" }}
                  className="inline-flex items-center justify-center gap-2 text-[#35B88A] font-semibold text-xs bg-[#35B88A]/10 border border-[#35B88A]/25 whitespace-nowrap"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#35B88A]" />
                  {user?.is_active ? "Operational" : "Inactive"}
                </span>
              </li>
            </ul>
          </section>

          {/* ================================================================
              CARD 2: CHANGE PASSWORD
              Strict separation, completely independent card
              ================================================================ */}
          <section
            aria-label="Change password"
            className="w-full bg-[#101317] border border-[rgba(237,231,220,0.13)] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.35)] flex flex-col box-border"
            style={{ padding: "34px 30px" }}
          >
            {/* Header with clear separation below to divider */}
            <div className="flex items-center gap-3.5" style={{ paddingBottom: "18px" }}>
              <div className="w-11 h-11 rounded-xl bg-[#E8913C]/10 border border-[#E8913C]/25 flex items-center justify-center text-[#E8913C] shrink-0">
                <KeyRound className="h-5 w-5 stroke-[2]" />
              </div>
              <div>
                <h2 className="font-['Syne',sans-serif] text-[19px] font-bold text-[#EDE7DC]">
                  Change Password
                </h2>
                <p className="text-xs text-[#9EA5A8]" style={{ marginTop: "4px" }}>
                  Ensure account security with a strong password
                </p>
              </div>
            </div>

            {/* Explicit Divider Line with guaranteed vertical margins */}
            <div
              className="w-full h-[1px] bg-[rgba(237,231,220,0.08)]"
              style={{ marginBottom: "26px" }}
            />

            <form onSubmit={handleChangePassword} className="flex flex-col" style={{ gap: "24px" }}>
              {/* Field: Current Password */}
              <div>
                <label
                  htmlFor="currentPassword"
                  className="text-xs font-semibold text-[#EDE7DC] uppercase tracking-wider"
                  style={{ marginBottom: "14px", display: "block" }}
                >
                  Current Password <span className="text-[#E8913C]">*</span>
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="h-[46px] w-full rounded-xl bg-[#171D21] border border-[rgba(237,231,220,0.14)] text-[#EDE7DC] placeholder-[#6C7378] text-xs px-4 pr-11 focus:outline-none focus:border-[#E8913C] focus:ring-1 focus:ring-[#E8913C]/40 transition-all box-border"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8E9598] hover:text-[#EDE7DC] transition-colors cursor-pointer p-1"
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Field: New Password */}
              <div>
                <label
                  htmlFor="newPassword"
                  className="text-xs font-semibold text-[#EDE7DC] uppercase tracking-wider"
                  style={{ marginBottom: "14px", display: "block" }}
                >
                  New Password <span className="text-[#E8913C]">*</span>
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="h-[46px] w-full rounded-xl bg-[#171D21] border border-[rgba(237,231,220,0.14)] text-[#EDE7DC] placeholder-[#6C7378] text-xs px-4 pr-11 focus:outline-none focus:border-[#E8913C] focus:ring-1 focus:ring-[#E8913C]/40 transition-all box-border"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8E9598] hover:text-[#EDE7DC] transition-colors cursor-pointer p-1"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-[#6C7378] mt-2">
                  Must be at least 8 characters long.
                </p>
              </div>

              {/* Field: Confirm New Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="text-xs font-semibold text-[#EDE7DC] uppercase tracking-wider"
                  style={{ marginBottom: "14px", display: "block" }}
                >
                  Confirm New Password <span className="text-[#E8913C]">*</span>
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={`h-[44px] w-full rounded-xl bg-[#171D21] border text-[#EDE7DC] placeholder-[#6C7378] text-xs px-4 pr-11 focus:outline-none transition-all box-border ${
                      passwordsMismatch
                        ? "border-[#E5484D] focus:border-[#E5484D] focus:ring-1 focus:ring-[#E5484D]/40"
                        : passwordsMatch
                        ? "border-[#35B88A] focus:border-[#35B88A] focus:ring-1 focus:ring-[#35B88A]/40"
                        : "border-[rgba(237,231,220,0.14)] focus:border-[#E8913C] focus:ring-1 focus:ring-[#E8913C]/40"
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8E9598] hover:text-[#EDE7DC] transition-colors cursor-pointer p-1"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {passwordsMatch && (
                  <p className="text-[11px] text-[#35B88A] mt-2 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match
                  </p>
                )}
                {passwordsMismatch && (
                  <p className="text-[11px] text-[#E5484D] mt-2 flex items-center gap-1.5 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" /> Passwords do not match
                  </p>
                )}
              </div>

              {/* Submit Button with increased padding and comfortable height */}
              <button
                type="submit"
                disabled={isChangingPassword}
                className="mt-3 h-11 w-full px-6 rounded-xl bg-[#182028] border border-[#E8913C]/40 text-[#E8913C] hover:bg-[#E8913C] hover:text-[#0A0C0E] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50 active:scale-[0.98] whitespace-nowrap"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 shrink-0" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
