export function AnimatedConnector() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1280 600"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      style={{ zIndex: 0 }}
    >
      <g
        fill="none"
        stroke="var(--brand-secondary)"
        strokeOpacity={0.35}
        strokeWidth={1.5}
        strokeDasharray="1 8"
        strokeLinecap="round"
      >
        <path
          className="animate-dash-flow"
          d="M 140 260 C 220 220, 260 180, 300 130"
        />
        <path
          className="animate-dash-flow"
          d="M 90 470 C 180 460, 240 420, 280 400"
          style={{ animationDelay: "-2s" }}
        />
        <path
          className="animate-dash-flow"
          d="M 1180 220 C 1100 200, 1060 170, 1000 130"
          style={{ animationDelay: "-4s" }}
        />
        <path
          className="animate-dash-flow"
          d="M 1220 470 C 1120 460, 1060 430, 1010 410"
          style={{ animationDelay: "-1s" }}
        />
      </g>
    </svg>
  );
}
