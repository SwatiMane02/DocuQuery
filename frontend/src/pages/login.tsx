import React, { useState } from "react";
import { Link, useRouter, useSearch } from "@tanstack/react-router";
import {
  Mail,
  Lock,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { AuthService } from "@/services/authService";
import { authStore } from "@/store/authStore";
import { toast } from "sonner";

export function LoginPage() {
  const router = useRouter();

  // Get search params for redirects after successful login
  const search = useSearch({ strict: false }) as { redirect?: string };
  const redirectPath = search.redirect || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email regex validation
  const isEmailValid = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate inputs
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

    setIsLoading(true);
    try {
      const response = await AuthService.login(email, password);
      authStore.setToken(response.access_token);

      // Fetch user profile immediately and save to store
      const profile = await AuthService.getProfile();
      authStore.setUser(profile);

      toast.success("Successfully logged in!", {
        description: "Welcome back to DocuQuery.",
      });

      // Navigate to destination
      await router.navigate({ to: redirectPath });
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message || "Invalid email or password. Please try again.");
      toast.error("Login failed", {
        description: errorObj.message || "Invalid credentials.",
      });
    } finally {
      setIsLoading(false);
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
        padding: "32px 16px",
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
          DOCUQUERY // AUTH
        </span>
      </div>

      {/* Center content container */}
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
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
          Welcome back
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
          Log in to continue to your workspace
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
            {/* EMAIL ADDRESS */}
            <div style={{ marginBottom: "20px" }}>
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
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <label
                  htmlFor="password"
                  style={{
                    fontSize: "10.5px",
                    fontFamily: "monospace",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#EDE7DC",
                    fontWeight: 600,
                  }}
                >
                  PASSWORD
                </label>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("Password reset", {
                      description: "Please contact support to reset your password.",
                    });
                  }}
                  style={{
                    fontSize: "11.5px",
                    color: "#E8913C",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  Forgot password?
                </a>
              </div>
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="Enter your password"
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

            {/* SIGN IN BUTTON */}
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
                  <span>SIGNING IN...</span>
                </>
              ) : (
                <>
                  <span>SIGN IN</span>
                  <span style={{ fontSize: "15px", fontWeight: "bold" }}>→</span>
                </>
              )}
            </button>
          </form>

          {/* OR CONTINUE WITH DIVIDER */}
          <div
            style={{
              position: "relative",
              margin: "24px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: "1px",
                backgroundColor: "rgba(237, 231, 220, 0.1)",
              }}
            />
            <span
              style={{
                position: "relative",
                backgroundColor: "#101317",
                padding: "0 12px",
                fontSize: "9.5px",
                fontFamily: "monospace",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#6C7378",
              }}
            >
              OR CONTINUE WITH
            </span>
          </div>

          {/* GOOGLE SIGN-IN BUTTON */}
          <button
            type="button"
            onClick={() => {
              toast.info("Google Authentication", {
                description: "Google OAuth is coming soon!",
              });
            }}
            style={{
              width: "100%",
              height: "46px",
              backgroundColor: "transparent",
              border: "1px solid rgba(237, 231, 220, 0.15)",
              borderRadius: "8px",
              color: "#EDE7DC",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              boxSizing: "border-box",
              transition: "border-color 0.2s ease, background-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(237, 231, 220, 0.3)";
              e.currentTarget.style.backgroundColor = "rgba(237, 231, 220, 0.03)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(237, 231, 220, 0.15)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {/* Official full-color Google G */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Footer / Create Account */}
        <div
          style={{
            marginTop: "28px",
            textAlign: "center",
            fontSize: "13px",
            color: "#8E9598",
          }}
        >
          <span>Don't have an account? </span>
          <Link
            to="/signup"
            search={search}
            style={{
              color: "#E8913C",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Create an account
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
