import { useState, useEffect, useRef, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { createTransactionFn, updateTransactionFn, getReceiptFn } from "@/api/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { type TxType } from "@/lib/categories";
import { useCategories } from "@/lib/use-categories";
import { toast } from "sonner";
import { Plus, Paperclip, X, Eye } from "lucide-react";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

interface Props {
  onSaved?: () => void;
  initial?: {
    id: string;
    type: TxType;
    amount: number;
    category: string;
    description: string | null;
    transaction_date: string;
    has_receipt?: boolean;
  } | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}

export function TransactionForm({ onSaved, initial, trigger, open, onOpenChange }: Props) {
  const { user, token } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [type, setType] = useState<TxType>("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const [receiptData, setReceiptData] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [clearReceipt, setClearReceipt] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<{ data: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initial) {
        setType(initial.type);
        setAmount(String(initial.amount));
        setCategory(initial.category);
        setDescription(initial.description ?? "");
        setDate(initial.transaction_date);
      } else {
        setType("income");
        setAmount("");
        setCategory("");
        setDescription("");
        setDate(new Date().toISOString().slice(0, 10));
      }
      setReceiptData(null);
      setReceiptName(null);
      setClearReceipt(false);
    }
  }, [isOpen, initial]);

  const { merged } = useCategories();
  const categories = merged(type);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { toast.error("File too large — max 2 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptData(reader.result as string);
      setReceiptName(file.name);
      setClearReceipt(false);
    };
    reader.readAsDataURL(file);
  };

  const removeReceipt = () => {
    setReceiptData(null);
    setReceiptName(null);
    setClearReceipt(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const viewExistingReceipt = async () => {
    if (!initial?.has_receipt) return;
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    try {
      const r = await getReceiptFn({ data: { token: t, id: initial.id } });
      if (r) { setReceiptPreview({ data: r.receipt_data, name: r.receipt_name }); setViewingReceipt(true); }
    } catch { toast.error("Could not load receipt"); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    const num = parseFloat(amount);
    if (!num || num <= 0) return toast.error("Enter a valid amount");
    if (!category) return toast.error("Pick a category");

    setSaving(true);
    try {
      const payload = { token: t, type, amount: num, category, description: description.trim() || null, transaction_date: date };
      if (initial) {
        await updateTransactionFn({
          data: {
            ...payload, id: initial.id,
            ...(receiptData !== null ? { receipt_data: receiptData, receipt_name: receiptName } : {}),
            ...(clearReceipt ? { clear_receipt: true } : {}),
          },
        });
      } else {
        await createTransactionFn({
          data: { ...payload, ...(receiptData !== null ? { receipt_data: receiptData, receipt_name: receiptName } : {}) },
        });
      }
      toast.success(initial ? "Updated" : "Added");
      setOpen(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const hasExistingReceipt = initial?.has_receipt && !clearReceipt && receiptData === null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? <Button><Plus className="h-4 w-4 mr-1.5" /> New transaction</Button>}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {initial ? "Edit transaction" : "New transaction"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-lg">
              <button type="button" onClick={() => { setType("income"); setCategory(""); }}
                className={`py-2 rounded-md text-sm font-medium transition ${type === "income" ? "bg-card shadow-sm text-success" : "text-muted-foreground"}`}>
                Income
              </button>
              <button type="button" onClick={() => { setType("expense"); setCategory(""); }}
                className={`py-2 rounded-md text-sm font-medium transition ${type === "expense" ? "bg-card shadow-sm text-destructive" : "text-muted-foreground"}`}>
                Expense
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (SEK)</Label>
              <Input id="amount" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Notes (optional)</Label>
              <Textarea id="desc" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Receipt (optional · max 2 MB)</Label>
              {hasExistingReceipt ? (
                <div className="flex items-center gap-2 p-2 border border-border rounded-lg bg-secondary/40 text-sm">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-muted-foreground truncate">Receipt attached</span>
                  <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={viewExistingReceipt}>
                    <Eye className="h-3 w-3 mr-1" /> View
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={removeReceipt}>
                    <X className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              ) : receiptName ? (
                <div className="flex items-center gap-2 p-2 border border-border rounded-lg bg-secondary/40 text-sm">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-muted-foreground truncate">{receiptName}</span>
                  <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={removeReceipt}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 p-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-secondary/40 transition text-sm text-muted-foreground">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span>Attach image or PDF</span>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" className="sr-only"
                    onChange={(e) => handleFile(e.target.files?.[0])} />
                </label>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : initial ? "Save changes" : "Add transaction"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewingReceipt} onOpenChange={setViewingReceipt}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{receiptPreview?.name ?? "Receipt"}</DialogTitle>
          </DialogHeader>
          {receiptPreview && (
            receiptPreview.data.startsWith("data:image/") ? (
              <img src={receiptPreview.data} alt="Receipt" className="max-h-[70vh] object-contain rounded-lg" />
            ) : (
              <iframe src={receiptPreview.data} title="Receipt" className="w-full h-[70vh] rounded-lg border border-border" />
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
