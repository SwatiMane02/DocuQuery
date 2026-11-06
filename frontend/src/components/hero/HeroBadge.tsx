import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function HeroBadge() {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass-panel inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium shadow-soft"
      style={{ color: "var(--brand-primary)" }}
    >
      <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--brand-accent)" }} />
      AI-powered document intelligence
    </motion.span>
  );
}
