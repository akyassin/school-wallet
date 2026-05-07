import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  listRecurringFn, createRecurringFn, toggleRecurringFn, deleteRecurringFn, applyDueRecurringFn,
} from "@/api/recurring";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCategories } from "@/lib/use-categories";
import { formatMoney, formatDate } from "@/lib/format";
import { canWrite } from "@/lib/roles";
import { Plus, Trash2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/recurring")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("auth_token")) throw redirect({ to: "/login" });
  },
  component: RecurringPage,
});

interface Recurring {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  frequency: "weekly" | "monthly" | "yearly";
  start_date: string;
  next_due_date: string;
  active: boolean;
}

const FREQ_LABEL: Record<string, string> = { weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };

function RecurringPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = canWrite(user?.role);

  const [items, setItems] = useState<Recurring[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) { navigate({ to: "/login" }); return; }
    setLoading(true);
    try {
      setItems(await listRecurringFn({ data: { token: t } }));
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load recurring transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const applyDue = async () => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    setApplying(true);
    try {
      const { count } = await applyDueRecurringFn({ data: { token: t } });
      if (count > 0) {
        toast.success(`${count} transaction${count > 1 ? "s" : ""} created`);
      } else {
        toast.info("No recurring transactions are due");
      }
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const toggle = async (id: string, active: boolean) => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    try {
      await toggleRecurringFn({ data: { token: t, id, active } });
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this recurring transaction?")) return;
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    try {
      await deleteRecurringFn({ data: { token: t, id } });
      toast.success("Deleted");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const due = items.filter((r) => r.active && r.next_due_date <= today);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight">Recurring</h1>
            <p className="text-muted-foreground mt-2">Auto-generate repeating income and expenses.</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && due.length > 0 && (
              <Button variant="outline" onClick={applyDue} disabled={applying}>
                <RotateCcw className={`h-4 w-4 mr-1.5 ${applying ? "animate-spin" : ""}`} />
                Apply due ({due.length})
              </Button>
            )}
            {isAdmin && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-1.5" /> New recurring</Button>
                </DialogTrigger>
                <RecurringForm
                  token={token}
                  onSaved={() => { setDialogOpen(false); load(); }}
                />
              </Dialog>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground mb-4">No recurring transactions set up yet.</p>
            {isAdmin && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-1.5" /> New recurring</Button>
                </DialogTrigger>
                <RecurringForm token={token} onSaved={() => { setDialogOpen(false); load(); }} />
              </Dialog>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Frequency</th>
                    <th className="px-4 py-3 hidden md:table-cell">Next due</th>
                    <th className="px-4 py-3">Status</th>
                    {isAdmin && <th className="px-4 py-3 w-16"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((r) => {
                    const overdue = r.active && r.next_due_date <= today;
                    return (
                      <tr key={r.id} className={`hover:bg-secondary/30 transition ${!r.active ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${r.type === "income" ? "bg-success" : "bg-destructive"}`} />
                            <div>
                              <div className="font-medium">{r.category}</div>
                              {r.description && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{r.description}</div>}
                            </div>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold tabular-nums ${r.type === "income" ? "text-success" : "text-destructive"}`}>
                          {r.type === "income" ? "+" : "−"} {formatMoney(r.amount)}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{FREQ_LABEL[r.frequency]}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={overdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {formatDate(r.next_due_date)}
                            {overdue && " ·  due"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isAdmin ? (
                            <button
                              onClick={() => toggle(r.id, !r.active)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition ${
                                r.active
                                  ? "bg-success/10 text-success border-success/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                                  : "bg-secondary text-muted-foreground border-border hover:bg-success/10 hover:text-success"
                              }`}
                            >
                              {r.active ? "Active" : "Paused"}
                            </button>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${r.active ? "bg-success/10 text-success border-success/20" : "bg-secondary text-muted-foreground border-border"}`}>
                              {r.active ? "Active" : "Paused"}
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(r.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function RecurringForm({ token, onSaved }: { token: string | null; onSaved: () => void }) {
  const { merged } = useCategories();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
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
      await createRecurringFn({
        data: { token: t, type, amount: num, category, description: description.trim() || null, frequency, start_date: startDate },
      });
      toast.success("Recurring transaction created");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">New recurring transaction</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4 mt-2">
        <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-lg">
          {(["income", "expense"] as const).map((tx) => (
            <button
              key={tx}
              type="button"
              onClick={() => { setType(tx); setCategory(""); }}
              className={`py-2 rounded-md text-sm font-medium transition ${
                type === tx ? `bg-card shadow-sm ${tx === "income" ? "text-success" : "text-destructive"}` : "text-muted-foreground"
              }`}
            >
              {tx.charAt(0).toUpperCase() + tx.slice(1)}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="rec-amount">Amount (SEK)</Label>
          <Input id="rec-amount" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
            <SelectContent>
              {merged(type).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rec-start">First occurrence</Label>
          <Input id="rec-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rec-desc">Notes (optional)</Label>
          <Textarea id="rec-desc" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Saving…" : "Create recurring transaction"}
        </Button>
      </form>
    </DialogContent>
  );
}
