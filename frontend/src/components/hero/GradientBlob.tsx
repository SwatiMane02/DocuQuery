import { cn } from "@/lib/utils";

interface GradientBlobProps {
  className?: string;
  color?: string;
  size?: number;
  delay?: number;
}

export function GradientBlob({
  className,
  color = "var(--brand-accent)",
  size = 420,
  delay = 0,
}: GradientBlobProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-blob-drift absolute rounded-full blur-3xl",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${color} 0%, transparent 70%)`,
        opacity: 0.35,
        animationDelay: `${delay}s`,
      }}
    />
  );
}
