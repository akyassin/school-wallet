import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  listUsersFn,
  updateUserRoleFn,
  toggleUserActiveFn,
  resetUserPasswordFn,
  deleteUserFn,
} from "@/api/users";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/format";
import { type AppRole, ROLE_LABELS } from "@/lib/roles";
import { Users, KeyRound, Trash2, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/users")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("auth_token")) throw redirect({ to: "/login" });
  },
  component: UsersPage,
});

interface UserRow {
  id: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
}

const ROLE_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  admin: "secondary",
  reviewer: "outline",
};

function UsersPage() {
  const { token, user: me, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!authLoading && me && me.role !== "super_admin") {
      navigate({ to: "/dashboard" });
    }
  }, [me, authLoading, navigate]);

  const load = async () => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) { navigate({ to: "/login" }); return; }
    try {
      const data = await listUsersFn({ data: { token: t } });
      setUsers(data);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && me?.role === "super_admin") load();
  }, [authLoading, me]);

  const changeRole = async (userId: string, role: string) => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    try {
      await updateUserRoleFn({ data: { token: t, userId, role } });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update role");
    }
  };

  const toggleActive = async (u: UserRow) => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    const next = !u.active;
    try {
      await toggleUserActiveFn({ data: { token: t, userId: u.id, active: next } });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: next } : x)));
      toast.success(next ? "User activated" : "User deactivated");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update status");
    }
  };

  const doResetPassword = async () => {
    if (!resetTarget) return;
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    setResetting(true);
    try {
      await resetUserPasswordFn({ data: { token: t, userId: resetTarget.id, newPassword } });
      toast.success("Password reset successfully");
      setResetTarget(null);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  const deleteUser = async (userId: string) => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    try {
      await deleteUserFn({ data: { token: t, userId } });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User deleted");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete user");
    }
  };

  if (authLoading || (me && me.role !== "super_admin")) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-semibold">User Management</h1>
            <p className="text-muted-foreground mt-0.5">Manage roles, passwords, and access.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading…</div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No users found.</div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                      Joined
                    </th>
                    <th className="px-4 py-3 w-32"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => {
                    const isMe = u.id === me?.id;
                    return (
                      <tr key={u.id} className={!u.active ? "opacity-50" : undefined}>
                        <td className="px-4 py-3">
                          <span className="font-medium">{u.email}</span>
                          {isMe && (
                            <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isMe ? (
                            <Badge variant={ROLE_BADGE[u.role] ?? "outline"}>
                              {ROLE_LABELS[u.role as AppRole] ?? u.role}
                            </Badge>
                          ) : (
                            <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)}>
                              <SelectTrigger className="h-7 w-36 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="super_admin">Super Admin</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="reviewer">Reviewer</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge variant={u.active ? "default" : "outline"}>
                            {u.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground tabular-nums">
                          {formatDate(u.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {!isMe && (
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title={u.active ? "Deactivate user" : "Activate user"}
                                onClick={() => toggleActive(u)}
                              >
                                {u.active ? (
                                  <UserX className="h-3.5 w-3.5" />
                                ) : (
                                  <UserCheck className="h-3.5 w-3.5" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Reset password"
                                onClick={() => {
                                  setResetTarget(u);
                                  setNewPassword("");
                                }}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    title="Delete user"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete user?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This permanently deletes <strong>{u.email}</strong> and all
                                      their transactions, budgets, and data. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteUser(u.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete permanently
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Reset password dialog */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setNewPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Setting a new password for <strong>{resetTarget?.email}</strong>.
          </p>
          <div className="space-y-2 py-1">
            <Label htmlFor="new-pwd">New password</Label>
            <Input
              id="new-pwd"
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newPassword.length >= 8 && doResetPassword()}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetTarget(null);
                setNewPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={doResetPassword}
              disabled={newPassword.length < 8 || resetting}
            >
              {resetting ? "Resetting…" : "Reset password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
