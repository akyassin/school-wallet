import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCategories, type UserCategory } from "@/lib/use-categories";
import { createCategoryFn, updateCategoryFn, deleteCategoryFn } from "@/api/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Tag, Pencil, Check, X, Shield } from "lucide-react";
import type { TxType } from "@/lib/categories";

export function CategoryManager({ trigger }: { trigger?: React.ReactNode }) {
  const { user, token } = useAuth();
  const { defaults, custom, reload } = useCategories();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<TxType>("expense");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  const getToken = () => token ?? localStorage.getItem("auth_token");

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const t = getToken();
    if (!t || !user) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const allNames = [...defaults, ...custom]
      .filter((c) => c.type === type)
      .map((c) => c.name.toLowerCase());
    if (allNames.includes(trimmed.toLowerCase()))
      return toast.error("That category already exists");
    setSaving(true);
    try {
      await createCategoryFn({ data: { token: t, name: trimmed, type, is_default: isDefault } });
      setName("");
      toast.success("Category added");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat: UserCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async (id: string) => {
    const t = getToken();
    if (!t) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      await updateCategoryFn({ data: { token: t, id, name: trimmed } });
      toast.success("Category renamed");
      setEditingId(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename category");
    }
  };

  const remove = async (id: string) => {
    const t = getToken();
    if (!t) return;
    try {
      await deleteCategoryFn({ data: { token: t, id } });
      toast.success("Removed");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove category");
    }
  };

  const incomeDefaults = defaults.filter((c) => c.type === "income");
  const expenseDefaults = defaults.filter((c) => c.type === "expense");
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Manage categories</DialogTitle>
        </DialogHeader>

        <form onSubmit={add} className="grid gap-2 mt-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="cat-name" className="sr-only">
                Name
              </Label>
              <Input
                id="cat-name"
                placeholder="New category name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
              />
            </div>
            <Select value={type} onValueChange={(v) => setType(v as TxType)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={saving || !name.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {isSuperAdmin && (
            <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded"
              />
              <Shield className="h-3.5 w-3.5 text-primary" />
              Save as system default (visible to all users)
            </label>
          )}
        </form>

        <div className="mt-4 max-h-[55vh] overflow-y-auto space-y-5">
          {isSuperAdmin && (incomeDefaults.length > 0 || expenseDefaults.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  System defaults
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <CategoryList
                  title="Income"
                  tone="success"
                  items={incomeDefaults}
                  editingId={editingId}
                  editName={editName}
                  onEditName={setEditName}
                  onStartEdit={startEdit}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onRemove={remove}
                  canEdit
                />
                <CategoryList
                  title="Expense"
                  tone="destructive"
                  items={expenseDefaults}
                  editingId={editingId}
                  editName={editName}
                  onEditName={setEditName}
                  onStartEdit={startEdit}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onRemove={remove}
                  canEdit
                />
              </div>
            </div>
          )}

          <div>
            {incomeCustom.length > 0 || expenseCustom.length > 0 ? (
              <>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                  Custom
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <CategoryList
                    title="Income"
                    tone="success"
                    items={incomeCustom}
                    editingId={editingId}
                    editName={editName}
                    onEditName={setEditName}
                    onStartEdit={startEdit}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                    onRemove={remove}
                    canEdit
                  />
                  <CategoryList
                    title="Expense"
                    tone="destructive"
                    items={expenseCustom}
                    editingId={editingId}
                    editName={editName}
                    onEditName={setEditName}
                    onStartEdit={startEdit}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                    onRemove={remove}
                    canEdit
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">No custom categories yet.</p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          {isSuperAdmin
            ? "System defaults are visible to all users. You can add, rename, or delete them."
            : "System defaults are set by your administrator. You can add your own custom categories."}
        </p>
      </DialogContent>
    </Dialog>
  );
}

interface CategoryListProps {
  title: string;
  tone: "success" | "destructive";
  items: UserCategory[];
  editingId: string | null;
  editName: string;
  onEditName: (v: string) => void;
  onStartEdit: (cat: UserCategory) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onRemove: (id: string) => void;
  canEdit: boolean;
}

function CategoryList({
  title,
  tone,
  items,
  editingId,
  editName,
  onEditName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  canEdit,
}: CategoryListProps) {
  const dotClass = tone === "success" ? "bg-success" : "bg-destructive";
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">None yet.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/60"
            >
              {editingId === c.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => onEditName(e.target.value)}
                    className="h-7 text-sm flex-1"
                    autoFocus
                    maxLength={60}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSaveEdit(c.id);
                      }
                      if (e.key === "Escape") onCancelEdit();
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-success"
                    onClick={() => onSaveEdit(c.id)}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancelEdit}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />
                  <span className="text-sm truncate flex-1">{c.name}</span>
                  {canEdit && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onStartEdit(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => onRemove(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
