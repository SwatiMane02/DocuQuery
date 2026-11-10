import React, { useState } from "react";
import { Link, useRouter, useSearch } from "@tanstack/react-router";
import {
  User,
  Mail,
  Lock,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { AuthService } from "@/services/authService";
import { toast } from "sonner";

export function SignupPage() {
  const router = useRouter();

  // Get search params for redirects after successful sign up
  const search = useSearch({ strict: false }) as { redirect?: string };

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email regex validation
  const isEmailValid = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) {
      return; // Prevent duplicate form submissions
    }
    setError(null);

    // Validate inputs
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!email) {
      setError("Email address is required.");
      return;
    }
    if (!isEmailValid(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setIsWakingUp(false);
    // After 3 seconds, inform the user that the free-tier backend may be waking up
    const wakeTimer = setTimeout(() => {
      setIsWakingUp(true);
    }, 3000);

    try {
      await AuthService.signup(name, email, password);

      toast.success("Account created successfully!", {
        description: "Please sign in with your credentials.",
      });

      // Navigate to login page
      await router.navigate({
        to: "/login",
        search: { redirect: search.redirect },
      });
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message || "Email address already registered.");
      toast.error("Registration failed", {
        description: errorObj.message || "Please check your inputs and try again.",
      });
    } finally {
      clearTimeout(wakeTimer);
      setIsLoading(false);
      setIsWakingUp(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0A0C0E",
        color: "#EDE7DC",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 16px",
        position: "relative",
        boxSizing: "border-box",
        fontFamily: "'Sora', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Background center vertical hairline */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          width: "1px",
          backgroundColor: "rgba(237, 231, 220, 0.05)",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Top amber vertical tick */}
      <div
        style={{
          position: "absolute",
          top: "82px",
          left: "50%",
          width: "2px",
          height: "20px",
          backgroundColor: "#E8913C",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Top bar: Left Home link */}
      <div style={{ position: "absolute", top: "28px", left: "32px", zIndex: 10 }}>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "11px",
            fontFamily: "monospace",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#EDE7DC",
            textDecoration: "none",
          }}
        >
          <span style={{ color: "#E8913C", fontSize: "14px", fontWeight: "bold" }}>←</span>
          <span>HOME</span>
        </Link>
      </div>

      {/* Top bar: Right Auth tag */}
      <div
        style={{
          position: "absolute",
          top: "28px",
          right: "32px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "#2E6B72",
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontSize: "11px",
            fontFamily: "monospace",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#8E9598",
          }}
        >
          DOCUQUERY // REGISTER
        </span>
      </div>

      {/* Center content container */}
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Logo Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "6px",
          }}
        >
          <span
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "26px",
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: "#EDE7DC",
              textTransform: "uppercase",
            }}
          >
            DOCUQUERY
          </span>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#E8913C",
              display: "inline-block",
            }}
          />
        </div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "36px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#EDE7DC",
            margin: "0 0 6px 0",
            textAlign: "center",
          }}
        >
          Create account
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "13.5px",
            color: "#8E9598",
            margin: "0 0 28px 0",
            textAlign: "center",
          }}
        >
          Start querying your documents with AI today
        </p>

        {/* Card Box */}
        <div
          style={{
            width: "100%",
            backgroundColor: "#101317",
            border: "1px solid rgba(237, 231, 220, 0.12)",
            borderRadius: "14px",
            padding: "32px 30px",
            boxSizing: "border-box",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
          }}
        >
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: "20px",
                borderRadius: "8px",
                backgroundColor: "rgba(232, 145, 60, 0.1)",
                border: "1px solid rgba(232, 145, 60, 0.35)",
                padding: "12px 14px",
                fontSize: "12px",
                color: "#EDE7DC",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ color: "#E8913C", fontWeight: "bold" }}>!</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ width: "100%" }}>
            {/* FULL NAME */}
            <div style={{ marginBottom: "18px" }}>
              <label
                htmlFor="name"
                style={{
                  display: "block",
                  fontSize: "10.5px",
                  fontFamily: "monospace",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#EDE7DC",
                  marginBottom: "8px",
                  fontWeight: 600,
                }}
              >
                FULL NAME
              </label>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    color: "#8E9598",
                  }}
                >
                  <User size={16} strokeWidth={1.75} />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  placeholder="John Doe"
                  style={{
                    width: "100%",
                    height: "46px",
                    backgroundColor: "#0D0F12",
                    border: "1px solid rgba(237, 231, 220, 0.15)",
                    borderRadius: "8px",
                    paddingLeft: "44px",
                    paddingRight: "14px",
                    color: "#EDE7DC",
                    fontSize: "13.5px",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#E8913C";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(237, 231, 220, 0.15)";
                  }}
                />
              </div>
            </div>

            {/* EMAIL ADDRESS */}
            <div style={{ marginBottom: "18px" }}>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  fontSize: "10.5px",
                  fontFamily: "monospace",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#EDE7DC",
                  marginBottom: "8px",
                  fontWeight: 600,
                }}
              >
                EMAIL ADDRESS
              </label>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    color: "#8E9598",
                  }}
                >
                  <Mail size={16} strokeWidth={1.75} />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  placeholder="name@example.com"
                  style={{
                    width: "100%",
                    height: "46px",
                    backgroundColor: "#0D0F12",
                    border: "1px solid rgba(237, 231, 220, 0.15)",
                    borderRadius: "8px",
                    paddingLeft: "44px",
                    paddingRight: "14px",
                    color: "#EDE7DC",
                    fontSize: "13.5px",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#E8913C";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(237, 231, 220, 0.15)";
                  }}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div style={{ marginBottom: "18px" }}>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  fontSize: "10.5px",
                  fontFamily: "monospace",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#EDE7DC",
                  marginBottom: "8px",
                  fontWeight: 600,
                }}
              >
                PASSWORD
              </label>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    color: "#8E9598",
                  }}
                >
                  <Lock size={16} strokeWidth={1.75} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="At least 8 characters"
                  style={{
                    width: "100%",
                    height: "46px",
                    backgroundColor: "#0D0F12",
                    border: "1px solid rgba(237, 231, 220, 0.15)",
                    borderRadius: "8px",
                    paddingLeft: "44px",
                    paddingRight: "44px",
                    color: "#EDE7DC",
                    fontSize: "13.5px",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#E8913C";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(237, 231, 220, 0.15)";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#8E9598",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* CONFIRM PASSWORD */}
            <div style={{ marginBottom: "26px" }}>
              <label
                htmlFor="confirmPassword"
                style={{
                  display: "block",
                  fontSize: "10.5px",
                  fontFamily: "monospace",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#EDE7DC",
                  marginBottom: "8px",
                  fontWeight: 600,
                }}
              >
                CONFIRM PASSWORD
              </label>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    color: "#8E9598",
                  }}
                >
                  <Lock size={16} strokeWidth={1.75} />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="Re-enter your password"
                  style={{
                    width: "100%",
                    height: "46px",
                    backgroundColor: "#0D0F12",
                    border: "1px solid rgba(237, 231, 220, 0.15)",
                    borderRadius: "8px",
                    paddingLeft: "44px",
                    paddingRight: "14px",
                    color: "#EDE7DC",
                    fontSize: "13.5px",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#E8913C";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(237, 231, 220, 0.15)";
                  }}
                />
              </div>
            </div>

            {/* CREATE ACCOUNT BUTTON */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "100%",
                height: "46px",
                backgroundColor: "#E8913C",
                color: "#0A0C0E",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: isLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxSizing: "border-box",
                transition: "opacity 0.2s ease, filter 0.2s ease",
                opacity: isLoading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.filter = "brightness(1.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "none";
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" color="#0A0C0E" />
                  <span>CREATING ACCOUNT...</span>
                </>
              ) : (
                <>
                  <span>CREATE ACCOUNT</span>
                  <span style={{ fontSize: "15px", fontWeight: "bold" }}>→</span>
                </>
              )}
            </button>

            {/* Waking Up Notice for Free Tier Cold Starts */}
            {isWakingUp && (
              <div
                style={{
                  marginTop: "12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(232, 145, 60, 0.08)",
                  border: "1px solid rgba(232, 145, 60, 0.3)",
                  padding: "10px 14px",
                  fontSize: "12px",
                  color: "#E8913C",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  textAlign: "center",
                  animation: "fadeIn 0.3s ease-in-out",
                }}
              >
                <Loader2 size={14} className="animate-spin" color="#E8913C" />
                <span>Connecting to server. The backend may be waking up...</span>
              </div>
            )}
          </form>
        </div>

        {/* Footer / Log In Link */}
        <div
          style={{
            marginTop: "28px",
            textAlign: "center",
            fontSize: "13px",
            color: "#8E9598",
          }}
        >
          <span>Already have an account? </span>
          <Link
            to="/login"
            search={search}
            style={{
              color: "#E8913C",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Log in
          </Link>
        </div>
      </div>

      {/* Bottom amber vertical tick */}
      <div
        style={{
          position: "absolute",
          bottom: "32px",
          left: "50%",
          width: "2px",
          height: "20px",
          backgroundColor: "#E8913C",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
    </div>
  );
}
