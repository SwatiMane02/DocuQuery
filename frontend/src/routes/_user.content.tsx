import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, Sparkles, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_user/content")({ component: Content });

function Content() {
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
          <span>Coming Soon • In Active Development</span>
        </div>

        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary mb-6">
          <BookOpen className="h-8 w-8" />
        </div>

        <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
          Knowledge Hub &amp; Insights
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Curated CEO interviews, market digests, and expert learning modules are in development. You can currently upload any PDF, Word, CSV, or Text file to perform instant semantic queries and grounded generative analysis.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-full px-6 bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/documents">
              <FileText className="mr-2 h-4 w-4" /> Upload Documents
            </Link>
          </Button>

          <Button asChild variant="outline" className="rounded-full px-6">
            <Link to="/ai-query">
              <Sparkles className="mr-2 h-4 w-4" /> Go to AI Query
            </Link>
          </Button>
        </div>

        <div className="mt-12 border-t border-border/60 pt-6 text-xs text-muted-foreground flex items-center justify-center gap-2">
          <span>Need help finding answers in your reports?</span>
          <Link to="/search" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
            Semantic Vector Search <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
