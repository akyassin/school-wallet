import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { listTransactionsByRangeFn } from "@/api/transactions";
import { isTokenExpired } from "@/lib/token-utils";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, formatDate } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Download, FileText, Calendar } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/reports")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    const refresh = localStorage.getItem("auth_refresh_token");
    if (!token || (isTokenExpired(token) && !refresh)) {
      throw redirect({ to: "/login", search: { from: window.location.pathname } } as any);
    }
  },
  component: Reports,
});

interface Tx {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  transaction_date: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthStartISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

type Preset = "this_month" | "last_month" | "ytd" | "last_30" | "last_90" | "custom";

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  switch (p) {
    case "this_month":
      return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: todayISO() };
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(first), to: fmt(last) };
    }
    case "ytd":
      return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: todayISO() };
    case "last_30":
      return { from: fmt(new Date(now.getTime() - 29 * 86400000)), to: todayISO() };
    case "last_90":
      return { from: fmt(new Date(now.getTime() - 89 * 86400000)), to: todayISO() };
    default:
      return { from: monthStartISO(), to: todayISO() };
  }
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function groupByMonth(txs: Tx[]) {
  const map = new Map<number, { income: number; expense: number }>();
  for (let i = 1; i <= 12; i++) map.set(i, { income: 0, expense: 0 });
  txs.forEach((t) => {
    const m = new Date(t.transaction_date).getMonth() + 1;
    const row = map.get(m)!;
    row[t.type] += Number(t.amount);
  });
  return map;
}

function Reports() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [preset, setPreset] = useState<Preset>("this_month");
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const [yoy1, setYoy1] = useState(now.getFullYear());
  const [yoy2, setYoy2] = useState(now.getFullYear() - 1);
  const [yoyTxs1, setYoyTxs1] = useState<Tx[]>([]);
  const [yoyTxs2, setYoyTxs2] = useState<Tx[]>([]);
  const [yoyLoading, setYoyLoading] = useState(false);

  const load = async () => {
    if (from > to) { toast.error("Start date must be before end date"); return; }
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) { navigate({ to: "/login" }); return; }
    setLoading(true);
    try {
      const data = await listTransactionsByRangeFn({ data: { token: t, from, to } });
      setTxs(data);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const loadYoY = async () => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    setYoyLoading(true);
    try {
      const [d1, d2] = await Promise.all([
        listTransactionsByRangeFn({ data: { token: t, from: `${yoy1}-01-01`, to: `${yoy1}-12-31` } }),
        listTransactionsByRangeFn({ data: { token: t, from: `${yoy2}-01-01`, to: `${yoy2}-12-31` } }),
      ]);
      setYoyTxs1(d1);
      setYoyTxs2(d2);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load comparison");
    } finally {
      setYoyLoading(false);
    }
  };

  useEffect(() => { load(); }, [from, to, token]);
  useEffect(() => { if (token) loadYoY(); }, [yoy1, yoy2, token]);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p === "custom") return;
    const r = presetRange(p);
    setFrom(r.from);
    setTo(r.to);
  };

  const totals = useMemo(() => {
    const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { income, expense, balance: income - expense };
  }, [txs]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { category: string; income: number; expense: number }>();
    txs.forEach((t) => {
      const row = map.get(t.category) ?? { category: t.category, income: 0, expense: 0 };
      row[t.type] += Number(t.amount);
      map.set(t.category, row);
    });
    return Array.from(map.values()).sort((a, b) => (b.income + b.expense) - (a.income + a.expense));
  }, [txs]);

  const dailyTrend = useMemo(() => {
    const map = new Map<string, { date: string; income: number; expense: number }>();
    txs.forEach((t) => {
      const row = map.get(t.transaction_date) ?? { date: t.transaction_date, income: 0, expense: 0 };
      row[t.type] += Number(t.amount);
      map.set(t.transaction_date, row);
    });
    return Array.from(map.values()).map((r) => ({
      ...r,
      label: new Date(r.date).toLocaleDateString("sv-SE", { month: "short", day: "2-digit" }),
    }));
  }, [txs]);

  const yoyData = useMemo(() => {
    const m1 = groupByMonth(yoyTxs1);
    const m2 = groupByMonth(yoyTxs2);
    return MONTH_LABELS.map((label, i) => ({
      label,
      [`${yoy1} income`]: m1.get(i + 1)!.income,
      [`${yoy1} expense`]: m1.get(i + 1)!.expense,
      [`${yoy2} income`]: m2.get(i + 1)!.income,
      [`${yoy2} expense`]: m2.get(i + 1)!.expense,
    }));
  }, [yoyTxs1, yoyTxs2, yoy1, yoy2]);

  const exportCSV = () => {
    const rows = [["Date", "Type", "Category", "Description", "Amount (SEK)"]];
    txs.forEach((t) => {
      rows.push([t.transaction_date, t.type, t.category, (t.description ?? "").replace(/"/g, '""'), String(t.amount)]);
    });
    rows.push([], ["Summary", "", "", "", ""]);
    rows.push(["Income", "", "", "", String(totals.income)]);
    rows.push(["Expense", "", "", "", String(totals.expense)]);
    rows.push(["Balance", "", "", "", String(totals.balance)]);
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `madrasa-report-${from}_to_${to}.csv`;
    a.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("SchoolWallet — Report", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${from} to ${to}`, 14, 25);
    doc.text(`Income: ${formatMoney(totals.income)}    Expenses: ${formatMoney(totals.expense)}    Balance: ${formatMoney(totals.balance)}`, 14, 32);
    autoTable(doc, {
      startY: 40,
      head: [["Category", "Income", "Expense", "Net"]],
      body: byCategory.map((c) => [c.category, formatMoney(c.income), formatMoney(c.expense), formatMoney(c.income - c.expense)]),
      headStyles: { fillColor: [107, 124, 80] },
      styles: { fontSize: 10 },
    });
    autoTable(doc, {
      head: [["Date", "Type", "Category", "Notes", "Amount"]],
      body: txs.map((t) => [t.transaction_date, t.type, t.category, t.description ?? "", `${t.type === "income" ? "+" : "-"} ${formatMoney(Number(t.amount))}`]),
      headStyles: { fillColor: [107, 124, 80] },
      styles: { fontSize: 9 },
    });
    doc.save(`madrasa-report-${from}_to_${to}.pdf`);
  };

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight">Reports</h1>
            <p className="text-muted-foreground mt-2">Analyze your finances over any period.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCSV} disabled={!txs.length}><Download className="h-4 w-4 mr-1.5" /> CSV</Button>
            <Button variant="outline" onClick={exportPDF} disabled={!txs.length}><FileText className="h-4 w-4 mr-1.5" /> PDF</Button>
          </div>
        </div>

        {/* Period filter */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-[var(--shadow-soft)] mb-6">
          <div className="-mx-4 sm:mx-0 mb-4 overflow-x-auto px-4 sm:px-0 sm:overflow-visible">
            <div className="flex gap-2 sm:flex-wrap min-w-max sm:min-w-0">
              {([
                ["this_month", "This month"],
                ["last_month", "Last month"],
                ["last_30", "Last 30 days"],
                ["last_90", "Last 90 days"],
                ["ytd", "Year to date"],
                ["custom", "Custom"],
              ] as [Preset, string][]).map(([p, label]) => (
                <button key={p} onClick={() => applyPreset(p)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition whitespace-nowrap ${
                    preset === p ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-secondary"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="from"><Calendar className="h-3.5 w-3.5 inline mr-1" />From</Label>
              <Input id="from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} className="w-full" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to"><Calendar className="h-3.5 w-3.5 inline mr-1" />To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} className="w-full" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 break-words">
            {formatDate(from)} → {formatDate(to)} · {txs.length} transactions
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <SummaryCard label="Income" value={totals.income} icon={TrendingUp} tone="success" />
          <SummaryCard label="Expenses" value={totals.expense} icon={TrendingDown} tone="destructive" />
          <SummaryCard label="Net balance" value={totals.balance} icon={Wallet} tone="primary" emphasize />
        </div>

        {/* Daily trend chart */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] mb-6">
          <h3 className="font-display text-xl font-semibold mb-1">Daily activity</h3>
          <p className="text-sm text-muted-foreground mb-4">Income vs expenses across the period</p>
          {dailyTrend.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              {loading ? "Loading…" : "No data for this period"}
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.02 80)" vertical={false} />
                  <XAxis dataKey="label" stroke="oklch(0.52 0.025 60)" fontSize={11} />
                  <YAxis stroke="oklch(0.52 0.025 60)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.995 0.008 85)", border: "1px solid oklch(0.88 0.02 80)", borderRadius: 8 }} formatter={(v: number) => formatMoney(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" fill="oklch(0.52 0.09 145)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" fill="oklch(0.55 0.18 28)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* By category */}
        <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden mb-6">
          <div className="p-6 pb-3">
            <h3 className="font-display text-xl font-semibold">By category</h3>
            <p className="text-sm text-muted-foreground">Breakdown across the selected period</p>
          </div>
          {byCategory.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No transactions in this range.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Income</th>
                    <th className="px-4 py-3 text-right">Expense</th>
                    <th className="px-4 py-3 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {byCategory.map((c) => {
                    const net = c.income - c.expense;
                    return (
                      <tr key={c.category} className="hover:bg-secondary/30">
                        <td className="px-4 py-3 font-medium">{c.category}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-success">{c.income ? formatMoney(c.income) : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-destructive">{c.expense ? formatMoney(c.expense) : "—"}</td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${net >= 0 ? "text-success" : "text-destructive"}`}>{formatMoney(net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-secondary/40 font-semibold">
                  <tr>
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums text-success">{formatMoney(totals.income)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-destructive">{formatMoney(totals.expense)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${totals.balance >= 0 ? "text-success" : "text-destructive"}`}>{formatMoney(totals.balance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Year-over-year comparison */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="font-display text-xl font-semibold">Year over year</h3>
              <p className="text-sm text-muted-foreground">Monthly income &amp; expenses compared</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Select value={String(yoy1)} onValueChange={(v) => setYoy1(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-muted-foreground">vs</span>
              <Select value={String(yoy2)} onValueChange={(v) => setYoy2(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {yoyLoading ? (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={yoyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.02 80)" vertical={false} />
                  <XAxis dataKey="label" stroke="oklch(0.52 0.025 60)" fontSize={11} />
                  <YAxis stroke="oklch(0.52 0.025 60)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.995 0.008 85)", border: "1px solid oklch(0.88 0.02 80)", borderRadius: 8 }} formatter={(v: number) => formatMoney(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey={`${yoy1} income`} stroke="oklch(0.52 0.09 145)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={`${yoy1} expense`} stroke="oklch(0.55 0.18 28)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={`${yoy2} income`} stroke="oklch(0.52 0.09 145)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  <Line type="monotone" dataKey={`${yoy2} expense`} stroke="oklch(0.55 0.18 28)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  label, value, icon: Icon, tone, emphasize,
}: { label: string; value: number; icon: any; tone: "success" | "destructive" | "primary"; emphasize?: boolean }) {
  const toneClass = tone === "success" ? "text-success bg-success/10"
    : tone === "destructive" ? "text-destructive bg-destructive/10"
    : "text-primary bg-primary/10";
  return (
    <div className={`rounded-2xl border border-border p-6 shadow-[var(--shadow-soft)] ${emphasize ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm ${emphasize ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</span>
        <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${emphasize ? "bg-primary-foreground/15" : toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="font-display text-3xl font-semibold tabular-nums">{formatMoney(value)}</div>
    </div>
  );
}
