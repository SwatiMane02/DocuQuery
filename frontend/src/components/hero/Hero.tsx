import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useCallback } from "react";
import { HeroBadge } from "./HeroBadge";
import { HeroButtons } from "./HeroButtons";
import { FloatingIcons } from "./FloatingIcons";
import { AnimatedConnector } from "./AnimatedConnector";
import { FloatingCards } from "./FloatingCards";

export function Hero() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 40, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 40, damping: 20 });
  const parallaxX = useTransform(springX, [-0.5, 0.5], [-10, 10]);
  const parallaxY = useTransform(springY, [-0.5, 0.5], [-10, 10]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
      mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [mouseX, mouseY],
  );

  return (
    <section
      onMouseMove={handleMouseMove}
      className="relative overflow-hidden pb-20 pt-16 sm:pt-24"
    >
      <motion.div style={{ x: parallaxX, y: parallaxY }} className="absolute inset-0">
        <AnimatedConnector />
        <FloatingIcons />
      </motion.div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <HeroBadge />

        <h1 className="mt-7 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          <span style={{ color: "#151b16" }}>Query any document.</span>
          <br />
          <span className="text-gradient-brand">Land your dream role.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Transform complex PDFs, research papers, and case studies into
          actionable insights. DocuQuery uses advanced LLMs to help you
          master any subject in seconds.
        </p>

        <HeroButtons />

        <FloatingCards />
      </div>
    </section>
  );
}
