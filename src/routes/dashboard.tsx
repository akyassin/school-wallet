import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { isTokenExpired } from "@/lib/token-utils";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { listTransactionsFn } from "@/api/transactions";
import { Header } from "@/components/Header";
import { TransactionForm } from "@/components/TransactionForm";
import { CategoryManager } from "@/components/CategoryManager";
import { formatMoney } from "@/lib/format";
import { canWrite } from "@/lib/roles";
import { TrendingUp, TrendingDown, Wallet, ArrowRight } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    const refresh = localStorage.getItem("auth_refresh_token");
    if (!token || (isTokenExpired(token) && !refresh)) {
      throw redirect({ to: "/login", search: { from: window.location.pathname } } as any);
    }
  },
  component: Dashboard,
});

interface Tx {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  transaction_date: string;
}

function Dashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = canWrite(user?.role);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) { navigate({ to: "/login" }); return; }
    setLoading(true);
    try {
      const data = await listTransactionsFn({ data: { token: t } });
      setTxs(data);
    } catch {
      navigate({ to: "/login" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const totals = useMemo(() => {
    const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { income, expense, balance: income - expense };
  }, [txs]);

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expense: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, { month: d.toLocaleString("en", { month: "short" }), income: 0, expense: 0 });
    }
    txs.forEach((t) => {
      const key = t.transaction_date.slice(0, 7);
      const row = map.get(key);
      if (row) row[t.type] += Number(t.amount);
    });
    return Array.from(map.values());
  }, [txs]);

  const expenseByCat = useMemo(() => {
    const m = new Map<string, number>();
    txs.filter((t) => t.type === "expense").forEach((t) => {
      m.set(t.category, (m.get(t.category) ?? 0) + Number(t.amount));
    });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txs]);

  const PIE_COLORS = ["#8b7355", "#c9b99a", "#b08968", "#7a5d44", "#d4a574", "#a08566", "#5c4530"];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">An overview of your school's finances.</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <CategoryManager />
              <TransactionForm onSaved={load} />
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total income" value={totals.income} icon={TrendingUp} tone="success" />
          <StatCard label="Total expenses" value={totals.expense} icon={TrendingDown} tone="destructive" />
          <StatCard label="Balance" value={totals.balance} icon={Wallet} tone="primary" emphasize />
        </div>

        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <h3 className="font-display text-xl font-semibold mb-1">Last 6 months</h3>
            <p className="text-sm text-muted-foreground mb-6">Income vs expenses</p>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.02 80)" vertical={false} />
                  <XAxis dataKey="month" stroke="oklch(0.52 0.025 60)" fontSize={12} />
                  <YAxis stroke="oklch(0.52 0.025 60)" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.995 0.008 85)", border: "1px solid oklch(0.88 0.02 80)", borderRadius: 8 }}
                    formatter={(v: number) => formatMoney(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" fill="oklch(0.52 0.09 145)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" fill="oklch(0.55 0.18 28)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <h3 className="font-display text-xl font-semibold mb-1">Expenses by category</h3>
            <p className="text-sm text-muted-foreground mb-6">Where money goes</p>
            {expenseByCat.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                No expenses yet
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={expenseByCat} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} paddingAngle={2}>
                      {expenseByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatMoney(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl font-semibold">Recent transactions</h3>
            <Link to="/transactions" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : txs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No transactions yet.</p>
              <TransactionForm onSaved={load} />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {txs.slice(0, 5).map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.category}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.transaction_date).toLocaleDateString("sv-SE")}
                      {t.description ? ` · ${t.description}` : ""}
                    </div>
                  </div>
                  <div className={`font-semibold tabular-nums ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                    {t.type === "income" ? "+" : "−"} {formatMoney(Number(t.amount))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, tone, emphasize,
}: { label: string; value: number; icon: any; tone: "success" | "destructive" | "primary"; emphasize?: boolean }) {
  const toneClass = tone === "success" ? "text-success bg-success/10"
    : tone === "destructive" ? "text-destructive bg-destructive/10"
    : "text-primary bg-primary/10";
  return (
    <div className={`rounded-2xl border border-border p-6 shadow-[var(--shadow-soft)] ${emphasize ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <div className="flex items-center justify-between mb-4">
        <span className={`text-sm ${emphasize ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</span>
        <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${emphasize ? "bg-primary-foreground/15" : toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="font-display text-3xl md:text-4xl font-semibold tabular-nums">
        {formatMoney(value)}
      </div>
    </div>
  );
}
