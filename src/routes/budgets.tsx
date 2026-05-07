import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { listBudgetsFn, upsertBudgetFn, deleteBudgetFn } from "@/api/budgets";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCategories } from "@/lib/use-categories";
import { formatMoney } from "@/lib/format";
import { canWrite } from "@/lib/roles";
import { Plus, Trash2, Target } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/budgets")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("auth_token")) throw redirect({ to: "/login" });
  },
  component: BudgetsPage,
});

interface Budget {
  id: string;
  category: string;
  type: "income" | "expense";
  amount: number;
  actual: number;
  period: "monthly" | "yearly";
  year: number;
  month: number | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function BudgetsPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = canWrite(user?.role);
  const now = new Date();

  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) { navigate({ to: "/login" }); return; }
    setLoading(true);
    try {
      const data = await listBudgetsFn({
        data: { token: t, period, year, ...(period === "monthly" ? { month } : {}) },
      });
      setBudgets(data);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token, period, year, month]);

  const remove = async (id: string) => {
    if (!confirm("Delete this budget?")) return;
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    try {
      await deleteBudgetFn({ data: { token: t, id } });
      toast.success("Budget deleted");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  };

  const income = budgets.filter((b) => b.type === "income");
  const expense = budgets.filter((b) => b.type === "expense");
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight">Budgets</h1>
            <p className="text-muted-foreground mt-2">Track spending against your targets.</p>
          </div>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1.5" /> New budget</Button>
              </DialogTrigger>
              <BudgetForm
                token={token}
                period={period}
                year={year}
                month={month}
                onSaved={() => { setDialogOpen(false); load(); }}
              />
            </Dialog>
          )}
        </div>

        {/* Period selector */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-[var(--shadow-soft)] mb-6 flex flex-wrap gap-3 items-end">
          <div className="flex gap-2">
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  period === p ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-secondary"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          {period === "monthly" && (
            <div className="flex gap-2">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {period === "yearly" && (
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading…</div>
        ) : budgets.length === 0 ? (
          <div className="text-center py-16">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-4">No budgets for this period.</p>
            {isAdmin && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-1.5" /> New budget</Button>
                </DialogTrigger>
                <BudgetForm token={token} period={period} year={year} month={month} onSaved={() => { setDialogOpen(false); load(); }} />
              </Dialog>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {[["expense", "Expense budgets", expense], ["income", "Income targets", income]] .filter(([, , list]) => (list as Budget[]).length > 0)
              .map(([type, title, list]) => (
                <div key={type as string} className="rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <h2 className="font-display text-lg font-semibold">{title as string}</h2>
                  </div>
                  <div className="divide-y divide-border">
                    {(list as Budget[]).map((b) => (
                      <BudgetRow key={b.id} budget={b} isAdmin={isAdmin} onDelete={remove} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}

function BudgetRow({ budget: b, isAdmin, onDelete }: { budget: Budget; isAdmin: boolean; onDelete: (id: string) => void }) {
  const pct = b.amount > 0 ? Math.min((b.actual / b.amount) * 100, 100) : 0;
  const over = b.actual > b.amount;
  const isExpense = b.type === "expense";

  let barColor = "bg-success";
  if (isExpense) {
    if (pct >= 100) barColor = "bg-destructive";
    else if (pct >= 80) barColor = "bg-amber-500";
  } else {
    if (pct >= 100) barColor = "bg-success";
    else if (pct >= 50) barColor = "bg-amber-500";
    else barColor = "bg-destructive";
  }

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="min-w-0">
          <span className="font-medium">{b.category}</span>
          {over && isExpense && (
            <span className="ml-2 text-xs text-destructive font-medium">Over budget</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatMoney(b.actual)} / {formatMoney(b.amount)}
          </span>
          {isAdmin && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(b.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-muted-foreground">{Math.round((b.actual / b.amount) * 100)}% used</span>
        {over && isExpense ? (
          <span className="text-xs text-destructive">{formatMoney(b.actual - b.amount)} over</span>
        ) : (
          <span className="text-xs text-muted-foreground">{formatMoney(b.amount - b.actual)} remaining</span>
        )}
      </div>
    </div>
  );
}

function BudgetForm({
  token, period, year, month, onSaved,
}: { token: string | null; period: "monthly" | "yearly"; year: number; month: number; onSaved: () => void }) {
  const { merged } = useCategories();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    const num = parseFloat(amount);
    if (!num || num <= 0) return toast.error("Enter a valid amount");
    if (!category) return toast.error("Pick a category");
    setSaving(true);
    try {
      await upsertBudgetFn({
        data: { token: t, category, type, amount: num, period, year, ...(period === "monthly" ? { month } : {}) },
      });
      toast.success("Budget saved");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const categories = merged(type);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">New budget</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-lg">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setCategory(""); }}
              className={`py-2 rounded-md text-sm font-medium transition ${
                type === t
                  ? `bg-card shadow-sm ${t === "income" ? "text-success" : "text-destructive"}`
                  : "text-muted-foreground"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="budget-amount">Budget amount (SEK)</Label>
          <Input id="budget-amount" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Saving…" : "Save budget"}
        </Button>
      </form>
    </DialogContent>
  );
}
