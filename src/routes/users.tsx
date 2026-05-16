import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { isTokenExpired } from "@/lib/token-utils";
import {
  listUsersFn,
  updateUserRoleFn,
  toggleUserActiveFn,
  resetUserPasswordFn,
  deleteUserFn,
  approveUserFn,
} from "@/api/users";
import { Header } from "@/components/Header";
import { PENDING_COUNT_REFRESH_EVENT } from "@/lib/use-pending-count";
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
import { Users, KeyRound, Trash2, UserX, UserCheck, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/users")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    const refresh = localStorage.getItem("auth_refresh_token");
    if (!token || (isTokenExpired(token) && !refresh)) {
      throw redirect({ to: "/login", search: { from: window.location.pathname } } as any);
    }
  },
  component: UsersPage,
});

interface UserRow {
  id: string;
  email: string;
  role: string;
  active: boolean;
  approved: boolean;
  reset_requested: boolean;
  must_change_password: boolean;
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
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});

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

  const approveUser = async (userId: string, role: string) => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    try {
      await approveUserFn({ data: { token: t, userId, role } });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, approved: true, role } : u)));
      window.dispatchEvent(new CustomEvent(PENDING_COUNT_REFRESH_EVENT));
      toast.success("User approved");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to approve user");
    }
  };

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
      setUsers((prev) =>
        prev.map((u) =>
          u.id === resetTarget.id
            ? { ...u, reset_requested: false, must_change_password: true }
            : u,
        ),
      );
      window.dispatchEvent(new CustomEvent(PENDING_COUNT_REFRESH_EVENT));
      toast.success("Temporary password set. User will be prompted to choose a new password on next login.");
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
      window.dispatchEvent(new CustomEvent(PENDING_COUNT_REFRESH_EVENT));
      toast.success("User deleted");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete user");
    }
  };

  if (authLoading || (me && me.role !== "super_admin")) return null;

  const pendingUsers = users.filter((u) => !u.approved);
  const approvedUsers = users.filter((u) => u.approved);

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
        ) : (
          <>
            {/* Pending Approval Section */}
            {pendingUsers.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 overflow-hidden mb-8">
                <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                    Pending Approval ({pendingUsers.length})
                  </span>
                </div>
                <div className="divide-y divide-amber-100 dark:divide-amber-900">
                  {pendingUsers.map((u) => (
                    <div key={u.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{u.email}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          Registered {formatDate(u.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Select
                          value={pendingRoles[u.id] ?? "reviewer"}
                          onValueChange={(v) => setPendingRoles((r) => ({ ...r, [u.id]: v }))}
                        >
                          <SelectTrigger className="h-7 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="reviewer">Reviewer</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => approveUser(u.id, pendingRoles[u.id] ?? "reviewer")}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              title="Reject registration"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Reject registration?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently removes <strong>{u.email}</strong>'s pending
                                registration. They will need to sign up again.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteUser(u.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Reject
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved Users Table */}
            {approvedUsers.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">No approved users found.</div>
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
                      {approvedUsers.map((u) => {
                        const isMe = u.id === me?.id;
                        return (
                          <tr key={u.id} className={!u.active ? "opacity-50" : undefined}>
                            <td className="px-4 py-3">
                              <span className="font-medium">{u.email}</span>
                              {isMe && (
                                <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                              )}
                              {u.reset_requested && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-xs border-amber-300 text-amber-600 dark:text-amber-400"
                                >
                                  Reset Requested
                                </Badge>
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
                                    title="Set temporary password"
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
          </>
        )}
      </main>

      {/* Set temporary password dialog */}
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
            <DialogTitle>Set temporary password</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Setting a temporary password for <strong>{resetTarget?.email}</strong>. The user will be
            required to choose a new password on their next login.
          </p>
          <div className="space-y-2 py-1">
            <Label htmlFor="new-pwd">Temporary password</Label>
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
            <Button onClick={doResetPassword} disabled={newPassword.length < 8 || resetting}>
              {resetting ? "Saving…" : "Set password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
