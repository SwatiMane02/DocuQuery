import { motion } from "framer-motion";
import {
  FileText,
  BrainCircuit,
  Search,
  Sparkles,
  Briefcase,
  BarChart3,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingIcon {
  icon: typeof FileText;
  className: string;
  size?: "sm" | "md";
  delay: number;
  opacity: number;
}

const icons: FloatingIcon[] = [
  { icon: FileText, className: "left-[4%] top-[26%]", size: "md", delay: 0, opacity: 0.9 },
  { icon: Search, className: "left-[2%] top-[52%]", size: "sm", delay: 1.2, opacity: 0.7 },
  { icon: BrainCircuit, className: "right-[4%] top-[46%]", size: "md", delay: 0.6, opacity: 0.85 },
  { icon: Sparkles, className: "right-[10%] top-[12%]", size: "sm", delay: 1.8, opacity: 0.75 },
  { icon: Briefcase, className: "left-[13%] top-[6%]", size: "sm", delay: 2.4, opacity: 0.65 },
  { icon: BarChart3, className: "right-[16%] top-[58%]", size: "sm", delay: 0.9, opacity: 0.7 },
  { icon: MessageCircle, className: "left-[20%] top-[64%]", size: "sm", delay: 1.5, opacity: 0.6 },
];

export function FloatingIcons() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] hidden lg:block">
      {icons.map(({ icon: Icon, className, size = "md", delay, opacity }, i) => (
        <motion.div
          key={i}
          className={cn(
            "animate-float-slow glass-panel absolute grid place-items-center rounded-full shadow-soft",
            size === "md" ? "h-14 w-14" : "h-11 w-11",
            className,
          )}
          style={{ animationDelay: `${delay}s`, opacity }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4 + delay * 0.15 }}
        >
          <Icon
            className={size === "md" ? "h-6 w-6" : "h-4 w-4"}
            style={{ color: "var(--brand-secondary)" }}
          />
        </motion.div>
      ))}
    </div>
  );
}
