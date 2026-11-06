import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [tsconfigPaths(), tailwindcss(), TanStackRouterVite(), react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["@tanstack/react-router"],
          charts: ["recharts"],
          ui: ["lucide-react", "sonner", "clsx", "tailwind-merge"],
        },
      },
    },
  },
});

