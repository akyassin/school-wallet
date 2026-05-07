import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { listTransactionsFn, deleteTransactionFn, getReceiptFn } from "@/api/transactions";
import { Header } from "@/components/Header";
import { TransactionForm } from "@/components/TransactionForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, formatDate } from "@/lib/format";
import { Pencil, Trash2, Download, FileText, Search, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/transactions")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("auth_token")) throw redirect({ to: "/login" });
  },
  component: TxPage,
});

interface Tx {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  transaction_date: string;
  has_receipt: boolean;
}

function TxPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Tx | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ data: string; name: string } | null>(null);

  const load = async () => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) { navigate({ to: "/login" }); return; }
    setLoading(true);
    try {
      const data = await listTransactionsFn({ data: { token: t } });
      setTxs(data);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (search) {
        const s = search.toLowerCase();
        return t.category.toLowerCase().includes(s) || (t.description ?? "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [txs, filterType, search]);

  const remove = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    try {
      await deleteTransactionFn({ data: { token: t, id } });
      toast.success("Deleted");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    }
  };

  const viewReceipt = async (id: string) => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    try {
      const r = await getReceiptFn({ data: { token: t, id } });
      if (r) setReceipt({ data: r.receipt_data, name: r.receipt_name });
    } catch { toast.error("Could not load receipt"); }
  };

  const exportCSV = () => {
    const rows = [["Date", "Type", "Category", "Description", "Amount (SEK)"]];
    filtered.forEach((t) => {
      rows.push([t.transaction_date, t.type, t.category, (t.description ?? "").replace(/"/g, '""'), String(t.amount)]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `madrasa-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    doc.setFontSize(18);
    doc.text("SchoolWallet — Financial Report", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated ${new Date().toLocaleDateString("sv-SE")}`, 14, 25);
    doc.text(`Income: ${formatMoney(income)}    Expenses: ${formatMoney(expense)}    Balance: ${formatMoney(income - expense)}`, 14, 32);
    autoTable(doc, {
      startY: 40,
      head: [["Date", "Type", "Category", "Description", "Amount"]],
      body: filtered.map((t) => [t.transaction_date, t.type, t.category, t.description ?? "", `${t.type === "income" ? "+" : "-"} ${formatMoney(Number(t.amount))}`]),
      headStyles: { fillColor: [139, 115, 85] },
      styles: { fontSize: 9 },
    });
    doc.save(`madrasa-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground mt-2">{filtered.length} of {txs.length} entries</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}><Download className="h-4 w-4 mr-1.5" /> CSV</Button>
            <Button variant="outline" onClick={exportPDF} disabled={!filtered.length}><FileText className="h-4 w-4 mr-1.5" /> PDF</Button>
            {isAdmin && <TransactionForm onSaved={load} />}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
          <div className="p-4 border-b border-border flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search category or notes…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income only</SelectItem>
                <SelectItem value="expense">Expenses only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="p-12 text-center text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No transactions found.</p>
              {isAdmin && <TransactionForm onSaved={load} />}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 hidden md:table-cell">Notes</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-secondary/30 transition">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(t.transaction_date)}</td>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${t.type === "income" ? "bg-success" : "bg-destructive"}`} />
                          {t.category}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground max-w-xs truncate">{t.description ?? "—"}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                        {t.type === "income" ? "+" : "−"} {formatMoney(Number(t.amount))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {t.has_receipt && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => viewReceipt(t.id)}>
                              <Paperclip className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isAdmin && (
                            <>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(t); setEditOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(t.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isAdmin && editing && (
          <TransactionForm
            initial={editing}
            open={editOpen}
            onOpenChange={(o) => { setEditOpen(o); if (!o) setEditing(null); }}
            onSaved={load}
            trigger={<span className="hidden" />}
          />
        )}

        <Dialog open={!!receipt} onOpenChange={(o) => { if (!o) setReceipt(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-display">{receipt?.name ?? "Receipt"}</DialogTitle>
            </DialogHeader>
            {receipt && (
              receipt.data.startsWith("data:image/") ? (
                <img src={receipt.data} alt="Receipt" className="max-h-[70vh] object-contain rounded-lg" />
              ) : (
                <iframe src={receipt.data} title="Receipt" className="w-full h-[70vh] rounded-lg border border-border" />
              )
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
