import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  return (
    <div className="mx-auto max-w-4xl py-12 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="surface-card p-8 md:p-12 text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary/80 px-3.5 py-1 text-xs font-medium text-primary mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Coming Soon • In Active Development</span>
        </div>

        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary mb-6">
          <Settings className="h-8 w-8" />
        </div>

        <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
          System Configuration &amp; Settings
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Advanced role-based access control, API rate limiting, and webhook configurations will be customizable here in Release 2.0.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-full px-6 bg-primary text-primary-foreground">
            <Link to="/admin">
              Admin Overview
            </Link>
          </Button>

          <Button asChild variant="outline" className="rounded-full px-6">
            <Link to="/admin/users">
              User Directory
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
