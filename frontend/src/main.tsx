import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { authStore } from "./store/authStore";
import { AuthService } from "./services/authService";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import "./styles.css";

const router = getRouter();

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function AppInitializer() {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const token = authStore.getToken();
      if (token) {
        try {
          // Validate existing token with the backend, bounded by a 3.5s timeout
          const profile = await Promise.race([
            AuthService.getProfile(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Session check timed out")), 3500)
            ),
          ]);
          authStore.setUser(profile);
        } catch (err) {
          console.warn("Startup session verification failed or timed out:", err);
          authStore.logout(); // Clear invalid or expired token
        }
      }
      setIsInitializing(false);
    }
    initAuth();
  }, []);

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

const rootElement = document.getElementById("root")!;
let root = (window as unknown as { __reactRoot?: ReactDOM.Root }).__reactRoot;
if (!root) {
  root = ReactDOM.createRoot(rootElement);
  (window as unknown as { __reactRoot?: ReactDOM.Root }).__reactRoot = root;
}

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppInitializer />
    </ErrorBoundary>
  </React.StrictMode>,
);

