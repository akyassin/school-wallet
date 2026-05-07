import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { changePasswordFn } from "@/api/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

export function ForcePasswordChange() {
  const { user, token, updateUser } = useAuth();
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (newPwd.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPwd !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    setLoading(true);
    try {
      await changePasswordFn({ data: { token: t, newPassword: newPwd } });
      updateUser({ must_change_password: false });
      setNewPwd("");
      setConfirm("");
      toast.success("Password updated successfully");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!user?.must_change_password}>
      <DialogContent
        className="[&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Set your new password</DialogTitle>
          </div>
          <DialogDescription>
            You're signed in with a temporary password. Please set a new password before continuing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="force-pwd">New password</Label>
            <Input
              id="force-pwd"
              type="password"
              placeholder="At least 8 characters"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="force-pwd-confirm">Confirm password</Label>
            <Input
              id="force-pwd-confirm"
              type="password"
              placeholder="Repeat your new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={loading || newPwd.length < 8 || confirm.length < 8}
          >
            {loading ? "Saving…" : "Set new password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
