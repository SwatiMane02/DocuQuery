import { GradientBlob } from "./GradientBlob";

export function HeroBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{ background: "var(--brand-light)" }}
    >
      {/* Base radial gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 0%, color-mix(in oklch, var(--brand-accent) 14%, var(--brand-light)) 0%, var(--brand-light) 55%, var(--brand-light) 100%)",
        }}
      />

      {/* Subtle grid */}
      <div className="bg-grid-soft absolute inset-0" />

      {/* Fine noise texture */}
      <div className="bg-noise-fine absolute inset-0 opacity-[0.35]" />

      {/* Ambient glow */}
      <div
        className="absolute left-1/2 top-0 h-[36rem] w-[70rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse, color-mix(in oklch, var(--brand-primary) 10%, transparent) 0%, transparent 70%)",
        }}
      />

      {/* Blurred gradient blobs */}
      <GradientBlob
        className="-left-24 top-10"
        color="var(--brand-secondary)"
        size={380}
        delay={0}
      />
      <GradientBlob
        className="-right-28 top-24"
        color="var(--brand-accent)"
        size={440}
        delay={2.5}
      />
      <GradientBlob
        className="left-1/3 top-[28rem]"
        color="var(--brand-primary)"
        size={320}
        delay={5}
      />
      <GradientBlob
        className="-left-16 top-[60%]"
        color="var(--brand-accent)"
        size={360}
        delay={4}
      />
      <GradientBlob
        className="right-[6%] top-[78%]"
        color="var(--brand-secondary)"
        size={340}
        delay={1.5}
      />
      <GradientBlob
        className="left-1/4 top-[95%]"
        color="var(--brand-primary)"
        size={300}
        delay={2}
      />
    </div>
  );
}
