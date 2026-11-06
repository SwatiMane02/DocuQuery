import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Briefcase, ArrowRight, Sparkles, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_user/careers")({ component: Careers });

function Careers() {
  return (
    <div className="mx-auto max-w-4xl py-12 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="surface-card p-8 md:p-12 text-center relative overflow-hidden"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary/80 px-3.5 py-1 text-xs font-medium text-primary mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Coming Soon • Planned for Release 2.0</span>
        </div>

        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary mb-6">
          <Briefcase className="h-8 w-8" />
        </div>

        <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
          Career &amp; Internship Intelligence
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Our automated career matching engine is currently under active development. Soon, DocuQuery will parse your research, resume, and uploaded technical documents to match you directly with high-impact internships and research fellowships.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-full px-6 bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/ai-query">
              <Sparkles className="mr-2 h-4 w-4" /> Try AI Query
            </Link>
          </Button>

          <Button asChild variant="outline" className="rounded-full px-6">
            <Link to="/documents">
              <FileText className="mr-2 h-4 w-4" /> Manage Documents
            </Link>
          </Button>
        </div>

        <div className="mt-12 border-t border-border/60 pt-6 text-xs text-muted-foreground flex items-center justify-center gap-2">
          <span>Looking for document analysis?</span>
          <Link to="/dashboard" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
            Back to Dashboard <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
