import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { isTokenExpired } from "@/lib/token-utils";
import {
  listTransactionsFn,
  deleteTransactionFn,
  deleteTransactionsBulkFn,
  getReceiptFn,
} from "@/api/transactions";
import { Header } from "@/components/Header";
import { TransactionForm } from "@/components/TransactionForm";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { formatMoney, formatDate } from "@/lib/format";
import { canWrite } from "@/lib/roles";
import {
  Pencil,
  Trash2,
  Download,
  FileText,
  Search,
  Paperclip,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronsLeft,
  ChevronsRight,
  CalendarIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

export const Route = createFileRoute("/transactions")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    const refresh = localStorage.getItem("auth_refresh_token");
    if (!token || (isTokenExpired(token) && !refresh)) {
      throw redirect({ to: "/login", search: { from: window.location.pathname } } as any);
    }
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

type SortCol = "date" | "category" | "amount";
type SortDir = "asc" | "desc";

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

function TxPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = canWrite(user?.role);

  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [appliedRange, setAppliedRange] = useState<DateRange | undefined>();
  const [calOpen, setCalOpen] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ data: string; name: string } | null>(null);

  // Selection & delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"single" | "bulk">("single");
  const [deleteSingleId, setDeleteSingleId] = useState<string | null>(null);

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

  useEffect(() => { setPage(1); }, [filterType, search, appliedRange, pageSize]);

  const filtered = useMemo(() => {
    const dateFrom = appliedRange?.from ? toISO(appliedRange.from) : "";
    const dateTo = appliedRange?.to ? toISO(appliedRange.to) : "";

    const result = txs.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (dateFrom && t.transaction_date < dateFrom) return false;
      if (dateTo && t.transaction_date > dateTo) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!t.category.toLowerCase().includes(s) && !(t.description ?? "").toLowerCase().includes(s))
          return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "date") cmp = a.transaction_date.localeCompare(b.transaction_date);
      else if (sortCol === "category") cmp = a.category.localeCompare(b.category);
      else if (sortCol === "amount") cmp = Number(a.amount) - Number(b.amount);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [txs, filterType, search, appliedRange, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Selection helpers
  const allPageSelected = paginated.length > 0 && paginated.every((t) => selectedIds.has(t.id));
  const somePageSelected = paginated.some((t) => selectedIds.has(t.id));

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40 inline-block" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 ml-1 inline-block" />
      : <ChevronDown className="h-3 w-3 ml-1 inline-block" />;
  };

  // Delete actions
  const openSingleDelete = (id: string) => {
    setDeleteSingleId(id);
    setDeleteMode("single");
    setDeleteOpen(true);
  };

  const openBulkDelete = () => {
    setDeleteMode("bulk");
    setDeleteOpen(true);
  };

  const handleTrashClick = (t: Tx) => {
    if (selectedIds.size > 0) {
      openBulkDelete();
    } else {
      openSingleDelete(t.id);
    }
  };

  const handleConfirmDelete = async () => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    const mode = deleteMode;
    const singleId = deleteSingleId;
    const bulkIds = [...selectedIds];
    try {
      if (mode === "bulk") {
        await deleteTransactionsBulkFn({ data: { token: t, ids: bulkIds } });
        setSelectedIds(new Set());
        toast.success(`Deleted ${bulkIds.length} transaction${bulkIds.length !== 1 ? "s" : ""}`);
      } else if (singleId) {
        await deleteTransactionFn({ data: { token: t, id: singleId } });
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(singleId); return n; });
        toast.success("Deleted");
      }
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

  const exportData = selectedIds.size > 0 ? filtered.filter((t) => selectedIds.has(t.id)) : filtered;

  const exportCSV = () => {
    const rows = [["Date", "Type", "Category", "Description", "Amount (SEK)"]];
    exportData.forEach((t) => {
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
    const income = exportData.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = exportData.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    doc.setFontSize(18);
    doc.text("SchoolWallet — Financial Report", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated ${new Date().toLocaleDateString("sv-SE")}`, 14, 25);
    doc.text(`Income: ${formatMoney(income)}    Expenses: ${formatMoney(expense)}    Balance: ${formatMoney(income - expense)}`, 14, 32);
    autoTable(doc, {
      startY: 40,
      head: [["Date", "Type", "Category", "Description", "Amount"]],
      body: exportData.map((t) => [t.transaction_date, t.type, t.category, t.description ?? "", `${t.type === "income" ? "+" : "-"} ${formatMoney(Number(t.amount))}`]),
      headStyles: { fillColor: [139, 115, 85] },
      styles: { fontSize: 9 },
    });
    doc.save(`madrasa-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const dateLabel = (() => {
    if (!appliedRange?.from) return null;
    if (!appliedRange.to) return format(appliedRange.from, "d MMM yyyy");
    return `${format(appliedRange.from, "d MMM yyyy")} – ${format(appliedRange.to, "d MMM yyyy")}`;
  })();

  const deleteDialogTitle =
    deleteMode === "bulk"
      ? `Delete ${selectedIds.size} transaction${selectedIds.size !== 1 ? "s" : ""}?`
      : "Delete transaction?";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground mt-2">
              {isAdmin
                ? <>{selectedIds.size} selected of {filtered.length}</>
                : <>{filtered.length} of {txs.length} entries</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCSV} disabled={!exportData.length}>
              <Download className="h-4 w-4 mr-1.5" />
              CSV{selectedIds.size > 0 && ` (${selectedIds.size})`}
            </Button>
            <Button variant="outline" onClick={exportPDF} disabled={!exportData.length}>
              <FileText className="h-4 w-4 mr-1.5" />
              PDF{selectedIds.size > 0 && ` (${selectedIds.size})`}
            </Button>
            {isAdmin && <TransactionForm onSaved={load} />}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
          {/* Filter bar */}
          <div className="p-4 border-b border-border flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search category or notes…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>

            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={`gap-2 ${dateLabel ? "text-foreground" : "text-muted-foreground"}`}>
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate max-w-44">{dateLabel ?? "Date range"}</span>
                  {dateLabel && (
                    <span role="button" className="ml-1 rounded hover:bg-muted p-0.5" onClick={(e) => { e.stopPropagation(); setDateRange(undefined); setAppliedRange(undefined); }}>
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} captionLayout="dropdown" />
                <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setDateRange(undefined); setAppliedRange(undefined); }}>Clear</Button>
                  <Button size="sm" onClick={() => { setAppliedRange(dateRange); setCalOpen(false); }}>OK</Button>
                </div>
              </PopoverContent>
            </Popover>

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
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      {isAdmin && (
                        <th className="pl-4 pr-2 py-3 w-12">
                          <Checkbox
                            checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                            onCheckedChange={toggleAll}
                            aria-label="Select all"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3">
                        <button className="flex items-center hover:text-foreground transition-colors" onClick={() => handleSort("date")}>
                          Date <SortIcon col="date" />
                        </button>
                      </th>
                      <th className="px-4 py-3">
                        <button className="flex items-center hover:text-foreground transition-colors" onClick={() => handleSort("category")}>
                          Category <SortIcon col="category" />
                        </button>
                      </th>
                      <th className="px-4 py-3 hidden md:table-cell">Notes</th>
                      <th className="px-4 py-3 text-right">
                        <button className="flex items-center ml-auto hover:text-foreground transition-colors" onClick={() => handleSort("amount")}>
                          Amount <SortIcon col="amount" />
                        </button>
                      </th>
                      <th className="px-4 py-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginated.map((t) => {
                      const isSelected = selectedIds.has(t.id);
                      return (
                        <tr key={t.id} className={`transition ${isSelected ? "bg-primary/[0.04] hover:bg-primary/[0.07]" : "hover:bg-secondary/30"}`}>
                          {isAdmin && (
                            <td className="pl-4 pr-2 py-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleRow(t.id)}
                                aria-label="Select row"
                              />
                            </td>
                          )}
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
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleTrashClick(t)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination bar */}
              <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="ml-2">
                    {filtered.length === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)}`} of {filtered.length}
                  </span>
                </div>

                <Pagination className="mx-0 w-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationLink href="#" aria-label="First page" onClick={(e) => { e.preventDefault(); setPage(1); }} className={page === 1 ? "pointer-events-none opacity-40" : ""}>
                        <ChevronsLeft className="h-4 w-4" />
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }} className={page === 1 ? "pointer-events-none opacity-40" : ""} />
                    </PaginationItem>
                    {getPageNumbers(page, totalPages).map((n, i) =>
                      n === "..." ? (
                        <PaginationItem key={`ellipsis-${i}`}><PaginationEllipsis /></PaginationItem>
                      ) : (
                        <PaginationItem key={n}>
                          <PaginationLink href="#" isActive={page === n} onClick={(e) => { e.preventDefault(); setPage(n as number); }}>{n}</PaginationLink>
                        </PaginationItem>
                      )
                    )}
                    <PaginationItem>
                      <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }} className={page === totalPages ? "pointer-events-none opacity-40" : ""} />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink href="#" aria-label="Last page" onClick={(e) => { e.preventDefault(); setPage(totalPages); }} className={page === totalPages ? "pointer-events-none opacity-40" : ""}>
                        <ChevronsRight className="h-4 w-4" />
                      </PaginationLink>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </>
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

        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onConfirm={handleConfirmDelete}
          title={deleteDialogTitle}
          description="This action cannot be undone."
        />

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
