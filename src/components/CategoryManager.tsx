import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCategories } from "@/lib/use-categories";
import { createCategoryFn, deleteCategoryFn } from "@/api/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, type TxType } from "@/lib/categories";
import { toast } from "sonner";
import { Plus, Trash2, Tag } from "lucide-react";

export function CategoryManager({ trigger }: { trigger?: React.ReactNode }) {
  const { user, token } = useAuth();
  const { custom, reload } = useCategories();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<TxType>("expense");
  const [saving, setSaving] = useState(false);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const defaults = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (defaults.includes(trimmed) || custom.some((c) => c.type === type && c.name.toLowerCase() === trimmed.toLowerCase())) {
      return toast.error("That category already exists");
    }
    setSaving(true);
    try {
      await createCategoryFn({ data: { token: t, name: trimmed, type } });
      setName("");
      toast.success("Category added");
      reload();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add category");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    try {
      await deleteCategoryFn({ data: { token: t, id } });
      toast.success("Removed");
      reload();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to remove category");
    }
  };

  const incomeCustom = custom.filter((c) => c.type === "income");
  const expenseCustom = custom.filter((c) => c.type === "expense");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Tag className="h-4 w-4 mr-1.5" /> Categories
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Manage categories</DialogTitle>
        </DialogHeader>

        <form onSubmit={add} className="grid grid-cols-[1fr_auto_auto] gap-2 mt-2">
          <div className="space-y-1">
            <Label htmlFor="cat-name" className="sr-only">Name</Label>
            <Input id="cat-name" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <Select value={type} onValueChange={(v) => setType(v as TxType)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={saving || !name.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="grid grid-cols-2 gap-4 mt-4 max-h-[50vh] overflow-y-auto">
          <CategoryList title="Income" tone="success" items={incomeCustom} onRemove={remove} />
          <CategoryList title="Expense" tone="destructive" items={expenseCustom} onRemove={remove} />
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Defaults are always available. You can only delete your own added categories.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function CategoryList({
  title, tone, items, onRemove,
}: { title: string; tone: "success" | "destructive"; items: { id: string; name: string }[]; onRemove: (id: string) => void }) {
  const dotClass = tone === "success" ? "bg-success" : "bg-destructive";
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No custom ones yet.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-secondary/60">
              <span className="flex items-center gap-2 text-sm truncate">
                <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                {c.name}
              </span>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onRemove(c.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
