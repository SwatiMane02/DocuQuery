import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/store/authStore";
import "../portal.css";

export const Route = createFileRoute("/")({ component: DocuQueryLanding });

interface DocumentSpecimen {
  code: string;
  name: string;
  type: string;
  size: string;
  chunks: number;
  format: "PDF" | "DOCX" | "TXT" | "CSV";
  image: string;
  accent: "amber" | "teal";
  relevance: string;
}

const SPECIMENS: DocumentSpecimen[] = [
  {
    code: "DOC-8942",
    name: "Q3_Financial_Performance.pdf",
    type: "Quarterly Earnings & Balance Sheet",
    size: "3.4 MB",
    chunks: 42,
    format: "PDF",
    image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=85",
    accent: "amber",
    relevance: "0.942 Similarity",
  },
  {
    code: "DOC-8941",
    name: "Distributed_Vector_Engine.docx",
    type: "High-Dimensional RAG Spec",
    size: "1.8 MB",
    chunks: 28,
    format: "DOCX",
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=85",
    accent: "teal",
    relevance: "0.918 Similarity",
  },
  {
    code: "DOC-8940",
    name: "Clinical_Trial_Protocol_v4.pdf",
    type: "Biomedical Research Study",
    size: "5.1 MB",
    chunks: 64,
    format: "PDF",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=85",
    accent: "amber",
    relevance: "0.965 Similarity",
  },
  {
    code: "DOC-8939",
    name: "Enterprise_Security_SLA.docx",
    type: "Compliance & Governance Terms",
    size: "920 KB",
    chunks: 18,
    format: "DOCX",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=85",
    accent: "teal",
    relevance: "0.884 Similarity",
  },
  {
    code: "DOC-8938",
    name: "Global_Supply_Ledger.csv",
    type: "Tabular Transaction Metrics",
    size: "2.6 MB",
    chunks: 35,
    format: "CSV",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=85",
    accent: "amber",
    relevance: "0.902 Similarity",
  },
];

const PLATFORM_PIPELINE = [
  {
    step: "01",
    title: "Secure Cloud Ingestion",
    description: "Multi-format documents (PDF, DOCX, TXT, CSV) are validated and stored in persistent Cloudinary storage with complete tenant isolation.",
    tag: "Cloudinary CDN",
  },
  {
    step: "02",
    title: "Adaptive Chunking & Parsing",
    description: "Proprietary parser extracts text, preserves structure, and segments documents into contextual chunks without losing semantic continuity.",
    tag: "Context Bounds",
  },
  {
    step: "03",
    title: "Vector Space Embeddings",
    description: "Each parsed chunk is converted into high-dimensional vector embeddings, indexed for sub-millisecond cosine similarity search.",
    tag: "768-Dim Space",
  },
  {
    step: "04",
    title: "Grounded Synthesis & Citations",
    description: "Queries retrieve the most relevant source passages. Our LLM synthesizes natural responses accompanied by verifiable source citations.",
    tag: "Zero Hallucination",
  },
];

const ARCHITECTURE_METRICS = [
  { metric: "Storage Infrastructure", value: "Cloudinary Persistent Storage", spec: "Direct asset persistence & deletion" },
  { metric: "Document Formats", value: "PDF • DOCX • TXT • CSV", spec: "Automated text extraction pipeline" },
  { metric: "Embedding Resolution", value: "768-Dimensional Dense Vectors", spec: "Cosine distance space indexing" },
  { metric: "Grounded Citations", value: "Chunk-Level Provenance", spec: "Verifiable page & passage citations" },
  { metric: "Tenant Isolation", value: "Strict Owner Scoping", spec: "Zero cross-user data leakage" },
  { metric: "AI Querying Engine", value: "Conversational RAG Workflow", spec: "Multi-turn context retention" },
];

export function DocuQueryLanding() {
  const { isAuthenticated, getUser, logout } = useAuth();
  const user = getUser();
  const isAdmin = user?.role === "admin";

  // References for Portal Hero Scroll
  const heroRef = useRef<HTMLElement>(null);
  const panelLeftRef = useRef<HTMLDivElement>(null);
  const panelRightRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const duotoneRef = useRef<HTMLDivElement>(null);
  const dotAmberRef = useRef<HTMLDivElement>(null);
  const dotTealRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const wordLeftRef = useRef<HTMLSpanElement>(null);
  const wordRightRef = useRef<HTMLSpanElement>(null);
  const centerContentRef = useRef<HTMLDivElement>(null);
  const scrollCueRef = useRef<HTMLDivElement>(null);

  // References for Statement Fold parallax disc
  const discRef = useRef<HTMLDivElement>(null);
  const statementRef = useRef<HTMLElement>(null);

  // Deck State
  const deckStageRef = useRef<HTMLDivElement>(null);
  const [stackOrder, setStackOrder] = useState<number[]>([0, 1, 2, 3, 4]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [thrownCard, setThrownCard] = useState<{ index: number; dir: number } | null>(null);
  const [isDeckPaused, setIsDeckPaused] = useState(false);

  const stackOrderRef = useRef(stackOrder);
  stackOrderRef.current = stackOrder;

  const isAnimatingRef = useRef(isAnimating);
  isAnimatingRef.current = isAnimating;

  // Drag interaction state
  const dragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    currentDeltaX: number;
    currentDeltaY: number;
    element: HTMLElement | null;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    currentDeltaX: 0,
    currentDeltaY: 0,
    element: null,
  });

  /* -------------------------------------------------------------------------
     THROW CARD LOGIC (PHYSICAL CARD STACK)
     ------------------------------------------------------------------------- */
  const throwCard = useCallback((direction: number = 1) => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    setIsAnimating(true);
    const topIndex = stackOrderRef.current[0];
    setThrownCard({ index: topIndex, dir: direction });

    setTimeout(() => {
      setStackOrder((prev) => {
        const next = [...prev];
        const removed = next.shift();
        if (removed !== undefined) next.push(removed);
        return next;
      });
      setThrownCard(null);
      setIsAnimating(false);
      isAnimatingRef.current = false;
    }, 450);
  }, []);

  /* -------------------------------------------------------------------------
     AUTOMATED SPECIMEN DECK AUTOPLAY
     Cycles through specimen cards one by one automatically,
     pausing when the user hovers or is dragging.
     ------------------------------------------------------------------------- */
  useEffect(() => {
    if (isDeckPaused) return;

    const interval = setInterval(() => {
      if (!isAnimatingRef.current && !dragRef.current.isDragging) {
        throwCard(1);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isDeckPaused, throwCard]);

  /* -------------------------------------------------------------------------
     POINTER DRAG HANDLERS
     ------------------------------------------------------------------------- */
  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (isAnimating) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const el = e.currentTarget;
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      currentDeltaX: 0,
      currentDeltaY: 0,
      element: el,
    };

    el.setPointerCapture(e.pointerId);
    el.style.transition = "none";
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag.isDragging || !drag.element) return;

    drag.currentDeltaX = e.clientX - drag.startX;
    drag.currentDeltaY = e.clientY - drag.startY;

    const deckWidth = deckStageRef.current?.offsetWidth || 340;
    const rotate = (drag.currentDeltaX / deckWidth) * 18;
    const scale = 1.025;

    drag.element.style.transform = `translate3d(${drag.currentDeltaX}px, ${drag.currentDeltaY * 0.35}px, 0) rotate(${rotate}deg) scale(${scale})`;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag.isDragging || !drag.element) return;
    drag.isDragging = false;

    try {
      drag.element.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const deckWidth = deckStageRef.current?.offsetWidth || 340;
    const threshold = deckWidth * 0.12;

    if (Math.abs(drag.currentDeltaX) > threshold) {
      const dir = drag.currentDeltaX > 0 ? 1 : -1;
      drag.element.style.transition = "";
      throwCard(dir);
    } else {
      drag.element.style.transition = "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)";
      drag.element.style.transform = "translate3d(0, 0, 0) rotate(0deg) scale(1)";
    }
    drag.element = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      throwCard(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      throwCard(-1);
    }
  };

  /* -------------------------------------------------------------------------
     PORTAL SCROLL-BOUND ENGINE (REVERSIBLE)
     ------------------------------------------------------------------------- */
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReduced) {
      document.body.classList.add("reveal-ready");
    }

    const updatePortal = () => {
      if (!heroRef.current || prefersReduced) return;

      const rect = heroRef.current.getBoundingClientRect();
      const heroTop = rect.top;
      const heroHeight = rect.height;
      const windowHeight = window.innerHeight;
      const scrollDistance = heroHeight - windowHeight;

      if (scrollDistance <= 0) return;

      const scrolled = -heroTop;
      const rawProgress = scrolled / scrollDistance;
      const progress = Math.min(Math.max(rawProgress, 0), 1);

      // 1. Two panels parting outward > 100%
      const panelTranslate = progress * 105;
      if (panelLeftRef.current) panelLeftRef.current.style.transform = `translateX(-${panelTranslate}%)`;
      if (panelRightRef.current) panelRightRef.current.style.transform = `translateX(${panelTranslate}%)`;

      // 2. Full-bleed background image settling from 1.18 to 1.00
      const imgScale = 1.18 - progress * 0.18;
      if (imgRef.current) imgRef.current.style.transform = `scale(${imgScale})`;

      // 3. Duotone wash overlay from 0 to 0.38
      if (duotoneRef.current) duotoneRef.current.style.opacity = (progress * 0.38).toString();

      // 4. Accent dots traveling outward
      const dotAmberX = -progress * 44;
      const dotAmberY = -progress * 38;
      const dotTealX = progress * 44;
      const dotTealY = progress * 38;
      if (dotAmberRef.current) dotAmberRef.current.style.transform = `translate(${dotAmberX}vw, ${dotAmberY}vh)`;
      if (dotTealRef.current) dotTealRef.current.style.transform = `translate(${dotTealX}vw, ${dotTealY}vh)`;

      // 5. Signature Title: grows + tightens + halves translate outward to edges
      const titleScale = 1 + progress * 0.22;
      const tracking = -0.02 - progress * 0.025;
      if (titleRef.current) {
        titleRef.current.style.transform = `scale(${titleScale})`;
        titleRef.current.style.letterSpacing = `${tracking}em`;
      }
      // Word halves travel outward toward opposite screen edges
      const wordSeparationVw = progress * 36;
      if (wordLeftRef.current) wordLeftRef.current.style.transform = `translateX(-${wordSeparationVw}vw)`;
      if (wordRightRef.current) wordRightRef.current.style.transform = `translateX(${wordSeparationVw}vw)`;

      // Supporting subtitle and CTAs smoothly fade out as the portal opens
      if (centerContentRef.current) {
        centerContentRef.current.style.opacity = Math.max(0, 1 - progress * 2.8).toString();
        centerContentRef.current.style.transform = `translateY(${progress * 24}px)`;
      }

      // 6. Fade scroll cue
      if (scrollCueRef.current) {
        scrollCueRef.current.style.opacity = Math.max(0, 1 - progress * 3.5).toString();
      }

      // 7. Statement fold drifting rotating disc
      if (statementRef.current && discRef.current) {
        const sRect = statementRef.current.getBoundingClientRect();
        if (sRect.top < windowHeight && sRect.bottom > 0) {
          const relY = (windowHeight - sRect.top) / (windowHeight + sRect.height);
          const translateY = (relY - 0.5) * 160;
          const rotation = relY * 65;
          discRef.current.style.transform = `translateY(calc(-50% + ${translateY}px)) rotate(${rotation}deg)`;
        }
      }
    };

    window.addEventListener("scroll", updatePortal, { passive: true });
    window.addEventListener("resize", updatePortal, { passive: true });
    updatePortal();

    // IntersectionObserver for one-time entry reveals
    let observer: IntersectionObserver | null = null;
    if (!prefersReduced && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-revealed");
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
      );

      document.querySelectorAll(".reveal-item").forEach((el) => {
        observer?.observe(el);
      });
    }

    return () => {
      window.removeEventListener("scroll", updatePortal);
      window.removeEventListener("resize", updatePortal);
      observer?.disconnect();
    };
  }, []);

  return (
    <div className="bg-[#0A0C0E] text-[#EDE7DC] min-h-screen selection:bg-[#E8913C] selection:text-[#0A0C0E] font-['Sora',sans-serif]">
      {/* ====================================================================
          FIXED 58PX TOP NAVIGATION
          ==================================================================== */}
      <header className="navbar" role="banner">
        <Link to="/" className="nav-brand" aria-label="DocuQuery AI Document Intelligence">
          <span>DOCUQUERY</span>
          <span className="period">.</span>
        </Link>

        <nav className="nav-center" aria-label="Main Navigation">
          <a href="#hero" className="nav-link">Home</a>
          <a href="#intelligence" className="nav-link">Features</a>
          <Link to="/documents" className="nav-link">Documents</Link>
          <Link to="/ai-query" className="nav-link">AI Query</Link>
          <Link to="/search" className="nav-link">Search</Link>
          <Link to="/analytics" className="nav-link">Analytics</Link>
          {isAdmin && (
            <Link to="/admin" className="nav-link" style={{ color: "var(--teal)" }}>
              Admin
            </Link>
          )}
        </nav>

        <div className="nav-right" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="btn-pill" aria-label="Open Dashboard">
                <span>Dashboard</span>
                <span className="teal-text">●</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="nav-link"
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link" style={{ marginRight: "6px" }}>
                Sign In
              </Link>
              <Link to="/signup" className="btn-pill" aria-label="Create DocuQuery Account">
                <span>Get Started</span>
                <span className="amber-text">●</span>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ====================================================================
          PORTAL HERO (STICKY 100VH STAGE OVER 2.5 VIEWPORTS)
          ==================================================================== */}
      <section id="hero" className="portal-hero" ref={heroRef} aria-label="DocuQuery Hero">
        <div className="portal-stage">
          {/* Layer 1: Monumental document vault & knowledge archive covering the entire viewport */}
          <div className="portal-image-wrap">
            <img
              ref={imgRef}
              className="portal-image"
              src="/hero-bg.jpg"
              onError={(e) => {
                e.currentTarget.src =
                  "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=2400&q=95";
              }}
              alt="Monumental document vault and archival knowledge repository with illuminated multi-tier shelves"
              loading="eager"
            />
          </div>

          {/* Layer 2: Amber & teal duotone wash */}
          <div ref={duotoneRef} className="portal-duotone" aria-hidden="true" />

          {/* Layer 3: Radial veil darkening edges */}
          <div className="portal-veil" aria-hidden="true" />

          {/* Layer 4: Two solid panels meeting in middle */}
          <div ref={panelLeftRef} className="portal-panel portal-panel-left" aria-hidden="true" />
          <div ref={panelRightRef} className="portal-panel portal-panel-right" aria-hidden="true" />

          {/* Layer 5: Accent dots traveling outward */}
          <div ref={dotAmberRef} className="portal-dot portal-dot-amber" aria-hidden="true" />
          <div ref={dotTealRef} className="portal-dot portal-dot-teal" aria-hidden="true" />

          {/* Pinned Top Metadata */}
          <div className="portal-meta portal-meta-top">
            <div className="meta-tag">
              <span className="mono-label">DOCUQUERY // RAG SYSTEM</span>
              <span className="teal-text" style={{ fontSize: "8px" }}>●</span>
              <span className="mono-label" style={{ color: "var(--muted)" }}>PROD READINESS</span>
            </div>
            <div className="meta-tag">
              <span className="mono-label">MULTI-FORMAT PARSING &bull; GEMINI EMBEDDINGS</span>
            </div>
          </div>

          {/* Layer 6: Signature Title and Supporting Content */}
          <div className="hero-center-content">
            <h1 ref={titleRef} className="portal-title" aria-label="DocuQuery">
              <span ref={wordLeftRef} className="portal-word-left">DOCU</span>
              <span ref={wordRightRef} className="portal-word-right">QUERY</span>
            </h1>

            <div ref={centerContentRef} className="hero-center-supporting">
              <div className="hero-headline-sub">
                YOUR DOCUMENTS. YOUR INTELLIGENCE.
              </div>

              <p className="hero-subtitle">
                Upload, understand, search and discover insights from your documents with AI.
              </p>

              <div className="hero-cta-group">
                <Link to="/documents" className="btn-pill-solid">
                  <span>Explore DocuQuery</span>
                  <span style={{ fontSize: "12px" }}>→</span>
                </Link>
                <Link to="/ai-query" className="btn-pill-outline">
                  <span>Start Asking AI</span>
                  <span className="amber-text">●</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Pinned Bottom Metadata */}
          <div className="portal-meta portal-meta-bottom">
            <div className="meta-tag">
              <span className="mono-label" style={{ color: "var(--amber)" }}>SUPPORTED: PDF &bull; DOCX &bull; TXT &bull; CSV</span>
            </div>

            <div ref={scrollCueRef} className="scroll-indicator">
              <span className="mono-label" style={{ fontSize: "9px", letterSpacing: "0.2em" }}>
                SCROLL TO EXPLORE
              </span>
              <div className="scroll-line" />
            </div>

            <div className="meta-tag">
              <span className="mono-label" style={{ color: "var(--teal)" }}>GROUNDED CITATIONS &bull; 0% HALLUCINATION</span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 1: AI DOCUMENT INTELLIGENCE (STATEMENT FOLD - LIGHT THEME)
          ==================================================================== */}
      <section
        id="intelligence"
        className="statement-section light-theme-section"
        ref={statementRef}
        aria-label="AI Document Intelligence"
      >
        <div className="statement-grid">
          <span className="mono-label reveal-item" style={{ color: "#B56015" }}>
            [01] // INTELLIGENCE ARCHITECTURE
          </span>

          <span className="statement-numeral reveal-item" aria-hidden="true">
            01
          </span>

          <p className="statement-text reveal-item">
            Transform passive document archives into active, verifiable{" "}
            <span style={{ color: "#B56015" }}>intelligence engines</span>.
          </p>

          <p className="statement-footnote reveal-item">
            DocuQuery couples document ingestion with automated structural chunking and high-dimensional
            dense vector representations. Every answer generated by our AI is rigorously anchored to
            verifiable source text passages with zero speculation.
          </p>
        </div>

        {/* Floating circular vector radar disc drifting/rotating on scroll */}
        <div className="floating-disc-wrap" ref={discRef}>
          <img
            className="floating-disc-img"
            src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85"
            alt="High-dimensional neural vector space representation"
            loading="lazy"
            style={{ border: "1px solid rgba(10, 12, 14, 0.15)", filter: "grayscale(0.2) contrast(1.15)" }}
          />
        </div>

        {/* Monochromatic Grounding Waveform & Precision Metric (PLINTH Style) */}
        <div
          className="statement-grid reveal-item"
          style={{
            marginTop: "64px",
            paddingTop: "48px",
            borderTop: "1px solid rgba(10, 12, 14, 0.12)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "48px",
              alignItems: "center",
            }}
          >
            <div>
              <span className="mono-label" style={{ color: "#B56015", fontSize: "10.5px" }}>
                GROUNDING ACCURACY // RETRIEVAL PRECISION
              </span>
              <div className="metric-hero-numeral" style={{ color: "#0A0C0E", margin: "14px 0 8px" }}>
                0.00<span style={{ fontSize: "0.45em", color: "#1F5359" }}>%</span>
              </div>
              <span className="mono-label" style={{ color: "#4E5356", fontSize: "10px" }}>
                HALLUCINATION DRIFT &bull; ZERO FABRICATED PASSAGES
              </span>
              <p
                style={{
                  marginTop: "16px",
                  fontSize: "13.5px",
                  color: "#3F4448",
                  lineHeight: 1.6,
                  maxWidth: "44ch",
                }}
              >
                Standard LLMs drift across ungrounded tokens when context is missing. DocuQuery verifies
                every response coordinate within dense source chunks before generation.
              </p>
            </div>

            <div>
              <svg className="waveform-svg" viewBox="0 0 600 140" fill="none">
                {/* Baseline grid rules */}
                <line
                  x1="0"
                  y1="70"
                  x2="600"
                  y2="70"
                  stroke="rgba(10, 12, 14, 0.1)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1="0"
                  y1="35"
                  x2="600"
                  y2="35"
                  stroke="rgba(10, 12, 14, 0.05)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1="0"
                  y1="105"
                  x2="600"
                  y2="105"
                  stroke="rgba(10, 12, 14, 0.05)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />

                {/* Oscillating ungrounded wave (grey) */}
                <path
                  className="waveform-raw"
                  d="M0,70 Q40,15 80,70 T160,115 T240,25 T320,105 T400,30 T480,95 T560,40 T600,70"
                  stroke="rgba(10, 12, 14, 0.35)"
                  strokeWidth="1.5"
                  fill="none"
                />

                {/* Razor-flat grounded line (teal laser) */}
                <path
                  className="waveform-corrected"
                  d="M0,70 L600,70"
                  stroke="#1F5359"
                  strokeWidth="2.5"
                  fill="none"
                />
              </svg>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "20px",
                  marginTop: "12px",
                  fontSize: "10px",
                }}
              >
                <span className="mono-label" style={{ color: "rgba(10, 12, 14, 0.5)" }}>
                  — UNGROUNDED MODEL (DRIFTING)
                </span>
                <span className="mono-label" style={{ color: "#1F5359" }}>
                  — DOCUQUERY RAG (GROUNDED ZERO-DRIFT)
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 2: DOCUMENT UPLOAD & MANAGEMENT (INTERACTIVE SPECIMEN DECK)
          ==================================================================== */}
      <section id="management" className="releases-section" aria-label="Document Upload and Management">
        <div className="releases-layout">
          {/* Column 1: Info & Real Actions */}
          <div className="releases-info">
            <span className="mono-label reveal-item" style={{ color: "var(--teal)" }}>
              STORAGE &bull; INGESTION // CLOUDINARY ENGINE
            </span>
            <h2 className="display-heading reveal-item">Tactile Document Registry.</h2>
            <p className="lede reveal-item">
              Upload PDF, DOCX, TXT, or CSV files directly into persistent Cloudinary storage with
              zero local filesystem dependency. Our pipeline handles parsing, metadata preservation,
              and structured chunk generation automatically.
            </p>

            <div className="btn-row reveal-item">
              <Link to="/documents" className="btn-pill">
                <span>Upload Document</span>
                <span className="amber-text">→</span>
              </Link>
              <button
                type="button"
                onClick={() => throwCard(1)}
                className="btn-pill btn-accent-rule"
              >
                <span>Cycle Specimen Sleeve</span>
              </button>
            </div>
          </div>

          {/* Column 2: Physical Throwable Specimen Stack (Automated Cycle) */}
          <div
            className="deck-container"
            onMouseEnter={() => setIsDeckPaused(true)}
            onMouseLeave={() => setIsDeckPaused(false)}
            onTouchStart={() => setIsDeckPaused(true)}
            onTouchEnd={() => setIsDeckPaused(false)}
          >
            <div
              className="deck-stage"
              ref={deckStageRef}
              tabIndex={0}
              role="region"
              onKeyDown={handleKeyDown}
              aria-label="Document Specimen Stack. Auto-cycling one by one. Use Left and Right Arrow keys or drag to toss aside."
              style={{ touchAction: "pan-y" }}
            >
              {stackOrder.map((cardIndex, depth) => {
                const item = SPECIMENS[cardIndex];
                const isTop = depth === 0;
                const isBeingThrown = thrownCard?.index === cardIndex;

                let transform = "translate3d(0, 0, 0) rotate(0deg) scale(1)";
                let opacity = "1";

                if (isBeingThrown) {
                  const dist = 480 * (thrownCard?.dir || 1);
                  const rot = 24 * (thrownCard?.dir || 1);
                  transform = `translate3d(${dist}px, -28px, 0) rotate(${rot}deg) scale(1.04)`;
                  opacity = "0";
                } else if (depth === 1) {
                  transform = "translate3d(12px, -8px, 0) rotate(2.4deg) scale(0.97)";
                  opacity = "0.9";
                } else if (depth === 2) {
                  transform = "translate3d(-10px, -16px, 0) rotate(-2.6deg) scale(0.94)";
                  opacity = "0.78";
                } else if (depth === 3) {
                  transform = "translate3d(18px, -24px, 0) rotate(3.8deg) scale(0.91)";
                  opacity = "0.55";
                } else if (depth >= 4) {
                  transform = "translate3d(0px, -30px, 0) rotate(-1.5deg) scale(0.88)";
                  opacity = "0.35";
                }

                return (
                  <article
                    key={item.code}
                    className={`deck-card ${isBeingThrown ? "is-thrown" : ""}`}
                    style={{
                      zIndex: SPECIMENS.length - depth,
                      transform,
                      opacity,
                      pointerEvents: isTop ? "auto" : "none",
                    }}
                    onPointerDown={isTop ? handlePointerDown : undefined}
                    onPointerMove={isTop ? handlePointerMove : undefined}
                    onPointerUp={isTop ? handlePointerUp : undefined}
                    onPointerCancel={isTop ? handlePointerUp : undefined}
                    aria-hidden={!isTop}
                  >
                    <div className="card-artwork-box">
                      <img src={item.image} alt={`${item.name} specimen`} />
                      <div className="card-spine-badge">
                        <span
                          className="mono-label"
                          style={{
                            color: item.accent === "amber" ? "var(--amber)" : "var(--teal)",
                            fontSize: "9.5px",
                          }}
                        >
                          {item.format} // {item.code}
                        </span>
                      </div>
                      <div className="card-vinyl-peek" aria-hidden="true">
                        <div
                          className="card-vinyl-center"
                          style={{
                            background: item.accent === "amber" ? "var(--amber)" : "var(--teal)",
                          }}
                        />
                      </div>
                    </div>

                    <div className="card-details">
                      <div className="card-title-row">
                        <div className="card-title" style={{ fontSize: "15px" }}>{item.name}</div>
                        <span
                          className="mono-label"
                          style={{
                            color: item.accent === "amber" ? "var(--amber)" : "var(--teal)",
                          }}
                        >
                          {item.size}
                        </span>
                      </div>
                      <div className="card-artist">{item.type}</div>
                      <div className="card-format-row">
                        <span>{item.chunks} Extracted Chunks</span>
                        <span style={{ color: "var(--amber)" }}>{item.relevance}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Hint & Progress Dots */}
            <div className="deck-footer">
              <div className="deck-hint">
                <span className="deck-hint-arrow" style={{ color: "var(--teal)" }}>●</span>
                <span>Auto-cycling specimens &bull; Hover or drag to pause &amp; inspect</span>
                <span className="deck-hint-arrow" style={{ color: "var(--amber)" }}>→</span>
              </div>
              <div className="deck-dots" aria-label="Specimen Indicators">
                {SPECIMENS.map((_, idx) => (
                  <span
                    key={idx}
                    className={`deck-dot ${stackOrder[0] === idx ? "active" : ""}`}
                    onClick={() => {
                      if (isAnimating) return;
                      const pos = stackOrder.indexOf(idx);
                      if (pos > 0) {
                        setStackOrder((prev) => {
                          const copy = [...prev];
                          for (let i = 0; i < pos; i++) {
                            const first = copy.shift();
                            if (first !== undefined) copy.push(first);
                          }
                          return copy;
                        });
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 3: AI-POWERED DOCUMENT CHAT WITH CITATIONS (LIGHT THEME)
          ==================================================================== */}
      <section className="editorial-section light-theme-section" aria-label="AI Document Chat with Citations">
        <div className="editorial-grid-2">
          <div className="editorial-col-lead">
            <span className="mono-label reveal-item" style={{ color: "#B56015" }}>
              [02] // VERIFIABLE GROUNDING
            </span>
            <h2 className="display-heading reveal-item" style={{ fontSize: "clamp(32px, 4vw, 56px)" }}>
              Conversational queries anchored by source citations.
            </h2>
            <p className="lede reveal-item">
              Generic LLMs guess when context is missing. DocuQuery enforces strict retrieval-augmented
              generation: responses are generated solely from your document chunks, with traceable page
              references and direct quotation spans.
            </p>
            <div className="reveal-item" style={{ marginTop: "12px" }}>
              <Link to="/ai-query" className="btn-pill">
                <span>Start Asking AI</span>
                <span style={{ color: "#B56015" }}>→</span>
              </Link>
            </div>
          </div>

          {/* Interactive Specimen Citation Box */}
          <div className="reveal-item" style={{ width: "100%" }}>
            <div className="citation-box">
              <div className="citation-header">
                <span className="mono-label" style={{ color: "#1F5359" }}>
                  QUERY PROTOCOL // ACTIVE SESSION
                </span>
                <span className="citation-source-tag">
                  Cosine Match &bull; 0.942
                </span>
              </div>

              <div style={{ marginBottom: "18px" }}>
                <span className="mono-label" style={{ color: "#555B60", fontSize: "10px" }}>PROMPT:</span>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 600, color: "#0A0C0E", marginTop: "4px" }}>
                  "What specific revenue drivers and risk factors were reported for international operations?"
                </p>
              </div>

              <div className="citation-body hairline-t" style={{ paddingTop: "16px" }}>
                <span className="mono-label" style={{ color: "#555B60", fontSize: "10px" }}>SYNTHESIZED GROUNDED RESPONSE:</span>
                <p style={{ marginTop: "8px", color: "#0A0C0E" }}>
                  International revenue expanded 28.4% year-over-year, anchored by APAC enterprise deployments.
                  However, operating margin was compressed by 140 basis points due to cross-border logistics tariffs and foreign currency volatility.
                </p>

                <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <span className="citation-source-tag">
                    Ref: Q3_Financial_Performance.pdf &bull; Chunk #14 [Page 6]
                  </span>
                  <span className="citation-source-tag" style={{ color: "#1F5359" }}>
                    Ref: Q3_Financial_Performance.pdf &bull; Chunk #22 [Page 11]
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 4: SEMANTIC SEARCH
          ==================================================================== */}
      <section className="editorial-section" aria-label="Semantic Search Engine">
        <div className="editorial-grid-2">
          {/* Comparison spec */}
          <div className="reveal-item" style={{ order: 2 }}>
            <div className="citation-box">
              <div className="citation-header">
                <span className="mono-label">KEYWORD MATCH VS VECTOR SPACE</span>
                <span className="mono-label" style={{ color: "var(--amber)" }}>768-DIM INDEX</span>
              </div>

              <div style={{ padding: "8px 0" }}>
                <div style={{ paddingBottom: "16px", borderBottom: "1px solid var(--hairline)" }}>
                  <span className="mono-label" style={{ color: "var(--muted)" }}>LEXICAL KEYWORD SEARCH:</span>
                  <p style={{ fontSize: "13px", color: "var(--sec-ink)", marginTop: "4px" }}>
                    Fails when synonyms differ (e.g., searching for "operating efficiency" misses passages titled "throughput ratio" or "lean operational cadence").
                  </p>
                </div>

                <div style={{ paddingTop: "16px" }}>
                  <span className="mono-label" style={{ color: "var(--teal)" }}>DOCUQUERY SEMANTIC SEARCH:</span>
                  <p style={{ fontSize: "13px", color: "var(--ink)", marginTop: "4px" }}>
                    Navigates semantic vector space. Queries are mapped to contextual coordinates, finding relevant paragraphs across hundreds of pages regardless of terminology.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="editorial-col-lead" style={{ order: 1 }}>
            <span className="mono-label reveal-item" style={{ color: "var(--teal)" }}>
              [03] // VECTOR RETRIEVAL
            </span>
            <h2 className="display-heading reveal-item" style={{ fontSize: "clamp(32px, 4vw, 56px)" }}>
              Find meaning, not merely keyword occurrences.
            </h2>
            <p className="lede reveal-item">
              Surface critical disclosures, technical schematics, and clauses hidden deep within
              voluminous multi-page documents. DocuQuery ranks every passage by semantic proximity.
            </p>
            <div className="reveal-item" style={{ marginTop: "12px" }}>
              <Link to="/search" className="btn-pill btn-accent-rule">
                <span>Explore Semantic Search</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 5: ANALYTICS & OPERATIONAL TELEMETRY (LIGHT THEME)
          ==================================================================== */}
      <section className="roster-dates-section light-theme-section" id="analytics" aria-label="Analytics and System Metrics">
        <div className="roster-header">
          <span className="mono-label reveal-item" style={{ color: "#B56015" }}>
            [04] // SYSTEM TELEMETRY
          </span>
          <h2 className="display-heading reveal-item">Production Architecture Metrics</h2>
        </div>

        <div className="dates-table-container reveal-item">
          <table className="dates-table">
            <thead>
              <tr>
                <th scope="col">Architecture Subsystem</th>
                <th scope="col">Runtime Value / Metric</th>
                <th scope="col">Specification &amp; Guarantee</th>
                <th scope="col" style={{ textAlign: "right" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {ARCHITECTURE_METRICS.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#0A0C0E" }}>
                    {row.metric}
                  </td>
                  <td className="date-time" style={{ color: "#B56015" }}>
                    {row.value}
                  </td>
                  <td className="venue">
                    {row.spec}
                  </td>
                  <td className="ticket-cell">
                    <span className="mono-label" style={{ color: "#1F5359" }}>
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="reveal-item" style={{ marginTop: "28px", display: "flex", justifyContent: "flex-end" }}>
          <Link to="/analytics" className="btn-pill">
            <span>Open Analytics Dashboard</span>
            <span style={{ color: "#1F5359" }}>→</span>
          </Link>
        </div>
      </section>

      {/* ====================================================================
          SECTION 6: HOW DOCUQUERY WORKS (PIPELINE SEQUENCE)
          ==================================================================== */}
      <section className="editorial-section" aria-label="How DocuQuery Works">
        <div className="roster-header">
          <span className="mono-label reveal-item" style={{ color: "var(--teal)" }}>
            [05] // PIPELINE SPECIFICATION
          </span>
          <h2 className="display-heading reveal-item">How DocuQuery Processes Documents</h2>
        </div>

        <div className="roster-list" role="list">
          {PLATFORM_PIPELINE.map((p) => (
            <div key={p.step} className="pipeline-step-item reveal-item" role="listitem">
              <span className="mono-label" style={{ color: "var(--amber)", fontSize: "14px" }}>
                {p.step}
              </span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "var(--ink)" }}>
                {p.title}
              </span>
              <span style={{ fontSize: "13px", color: "var(--sec-ink)", lineHeight: 1.6 }}>
                {p.description}
              </span>
              <span className="mono-label" style={{ color: "var(--teal)", textAlign: "right", fontSize: "10px" }}>
                {p.tag}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ====================================================================
          SECTION 7: FINAL CTA & EDITORIAL CLOSE
          ==================================================================== */}
      <footer className="close-section" id="archive" aria-label="Close and Navigation">
        <div className="close-content">
          <div className="close-lead">
            <span className="mono-label reveal-item" style={{ color: "var(--amber)" }}>
              [06] // INTELLIGENCE READY
            </span>
            <h2 className="display-heading reveal-item">
              Turn your archives into living intelligence.
            </h2>
            <p className="fine-print reveal-item">
              Production-ready RAG platform with dedicated tenant isolation, authenticated session
              controls, and Cloudinary document storage. Upload your first document and start querying in seconds.
            </p>
          </div>

          <div className="close-actions reveal-item">
            <div className="btn-row">
              <Link to="/signup" className="btn-pill">
                <span>Create Free Account</span>
                <span className="amber-text">●</span>
              </Link>
              <Link to="/login" className="btn-pill btn-accent-rule">
                <span>Sign In</span>
              </Link>
              <a href="#hero" className="btn-pill btn-accent-rule">
                <span>Back to Summit ↑</span>
              </a>
            </div>
            <span className="mono-label" style={{ color: "var(--muted)", fontSize: "9.5px" }}>
              REST APIS &bull; CLOUDINARY STORAGE &bull; GROUNDED RETRIEVAL &bull; ATLAS READY
            </span>
          </div>
        </div>

        {/* Hairline Footer Strip */}
        <div className="footer-strip">
          <div>
            <span>DOCUQUERY AI DOCUMENT INTELLIGENCE © {new Date().getFullYear()}</span>
            <span style={{ margin: "0 10px", color: "var(--hairline)" }}>|</span>
            <span style={{ color: "var(--teal)" }}>ALL RIGHTS RESERVED</span>
          </div>

          <nav className="footer-nav" aria-label="Secondary links">
            <a href="#hero">Home</a>
            <Link to="/documents">Documents</Link>
            <Link to="/ai-query">AI Query</Link>
            <Link to="/search">Search</Link>
            <Link to="/analytics">Analytics</Link>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/login">Login</Link>
            <Link to="/signup">Sign Up</Link>
          </nav>

          <div>
            <span>PRODUCTION-READY RAG PLATFORM</span>
          </div>
        </div>

        {/* Signature Cropped Display Wordmark at Bottom Page Edge */}
        <div className="close-wordmark-wrap" aria-hidden="true">
          <div className="close-wordmark">DOCUQUERY</div>
        </div>
      </footer>
    </div>
  );
}
