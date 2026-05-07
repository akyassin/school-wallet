import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { BookOpen, BarChart3, Download, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("auth_token")) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-hero)" }}>
      <Header />
      <main className="flex-1">
        <section className="container mx-auto px-4 pt-20 pb-16 md:pt-32 md:pb-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border text-xs text-muted-foreground mb-8 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Built for Quran schools
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-semibold tracking-tight text-foreground leading-[1.05]">
              Calm, careful bookkeeping for your <em className="text-accent-foreground/80">madrasa</em>.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Track tuition, donations, salaries and supplies in one quiet place. See where every krona goes,
              and export clean reports whenever you need them.
            </p>
            <div className="mt-10 flex items-center justify-center gap-3">
              <Link to="/login">
                <Button size="lg" className="h-12 px-6 shadow-md">
                  Get started
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-24">
          <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              { icon: BookOpen, title: "Income & expenses", body: "Log every transaction with category, date and notes." },
              { icon: BarChart3, title: "Clear reports", body: "Monthly trends and category breakdowns at a glance." },
              { icon: Download, title: "Export anytime", body: "Download your records as CSV or PDF for your records." },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
              >
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-border py-8">
          <div className="container mx-auto px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Your data is private and secured per user
          </div>
        </footer>
      </main>
    </div>
  );
}
