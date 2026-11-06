import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";

export function HeroButtons() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
      className="mt-8 flex flex-wrap items-center justify-center gap-3"
    >
      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
        <Link
          to="/documents"
          className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition-shadow hover:shadow-xl cursor-pointer"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))",
            boxShadow: "0 10px 30px -8px color-mix(in oklch, var(--brand-primary) 55%, transparent)",
          }}
        >
          Upload a Document
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </motion.div>

      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
        <Link
          to="/ai-query"
          className="glass-panel inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold shadow-soft transition-colors hover:bg-white/60 cursor-pointer"
          style={{ color: "var(--brand-primary)" }}
        >
          <Sparkles className="h-4 w-4" />
          Try AI Query
        </Link>
      </motion.div>
    </motion.div>
  );
}
