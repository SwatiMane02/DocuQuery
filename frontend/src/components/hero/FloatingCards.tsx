import { motion } from "framer-motion";
import { Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface CapabilityCard {
  tag: string;
  question: string;
  preview: string;
  answers: number;
  views: string;
  isAi?: boolean;
  rotate: number;
  x: number;
  z: number;
}

const cards: CapabilityCard[] = [
  {
    tag: "Research",
    question: "What are the key findings from this research paper?",
    preview:
      "The study identifies three core findings across methodology, results, and long-term impact on the field.",
    answers: 24,
    views: "1.2k",
    rotate: -8,
    x: -240,
    z: 10,
  },
  {
    tag: "Summary",
    question: "Summarize this document",
    preview:
      "A concise, structured summary covering objectives, methods, and conclusions in seconds.",
    answers: 18,
    views: "890",
    isAi: true,
    rotate: 0,
    x: 0,
    z: 20,
  },
  {
    tag: "Data",
    question: "Extract important statistics",
    preview:
      "Automatically pulls tables, figures, and key metrics into a clean, structured dataset.",
    answers: 32,
    views: "1.6k",
    rotate: 8,
    x: 240,
    z: 10,
  },
];

function CardBody({ card }: { card: CapabilityCard }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{
            background: card.isAi
              ? "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))"
              : "color-mix(in oklch, var(--brand-accent) 20%, white)",
          }}
        >
          {card.isAi ? (
            <Sparkles className="h-4 w-4 text-white" />
          ) : (
            <User className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
          )}
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide"
          style={{
            background: "color-mix(in oklch, var(--brand-accent) 16%, white)",
            color: "var(--brand-primary)",
          }}
        >
          {card.tag}
        </span>
      </div>
      <p
        className="mt-4 text-sm font-semibold leading-snug"
        style={{ color: "var(--brand-primary)" }}
      >
        {card.question}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {card.preview}
      </p>
      <div className="mt-4 h-px w-full" style={{ background: "color-mix(in oklch, var(--brand-primary) 10%, transparent)" }} />
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{card.answers} answers</span>
        <span
          className="h-1 w-1 rounded-full"
          style={{ background: "var(--brand-accent)" }}
        />
        <span>{card.views} views</span>
        <span
          className="h-1 w-1 rounded-full"
          style={{ background: "var(--brand-accent)" }}
        />
        <span>Updated today</span>
      </div>
    </>
  );
}

export function FloatingCards() {
  return (
    <>
      {/* Mobile: stacked */}
      <div className="mx-auto mt-12 flex max-w-sm flex-col gap-4 sm:hidden">
        {cards.map((card, i) => (
          <motion.div
            key={card.question}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
            className="glass-panel rounded-2xl p-5 text-left shadow-lift"
          >
            <CardBody card={card} />
          </motion.div>
        ))}
      </div>

      {/* Desktop: overlapping fan */}
      <div className="relative mx-auto mt-16 hidden h-[30rem] max-w-3xl items-start justify-center sm:mt-20 sm:flex sm:h-[34rem]">
        {cards.map((card, i) => (
          <motion.div
            key={card.question}
            initial={{ opacity: 0, y: 40, x: card.x, rotate: 0, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, x: card.x, rotate: card.rotate, scale: 1 }}
            whileHover={{ y: -10, scale: 1.05, zIndex: 30 }}
            transition={{ duration: 0.6, delay: 0.5 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "glass-panel absolute w-80 rounded-2xl p-6 text-left shadow-lift sm:w-96",
              i === 1 ? "top-0" : "top-8",
            )}
            style={{ zIndex: card.z, transformOrigin: "bottom center" }}
          >
            <CardBody card={card} />
          </motion.div>
        ))}
      </div>
    </>
  );
}
