import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { loginFn, signUpFn, requestPasswordResetFn } from "@/api/auth";
import { isTokenExpired } from "@/lib/token-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import schoolWalletLogo from "@/assets/school-wallet-logo.svg";
import { Clock, Mail, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    if (token && !isTokenExpired(token)) {
      const dest = search.from?.startsWith("/") ? search.from : "/dashboard";
      throw redirect({ to: dest as any });
    }
  },
  component: LoginPage,
});

type Mode = "tabs" | "pending" | "forgot" | "forgotSent";

function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("tabs");

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await loginFn({ data: { email, password } });
      signIn(result.token, result.user, result.refreshToken);
      toast.success("Welcome back");
      const dest = search.from?.startsWith("/") ? search.from : "/dashboard";
      if (dest === "/dashboard") {
        navigate({ to: "/dashboard" });
      } else {
        window.location.href = dest;
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUpFn({ data: { email, password } });
      setMode("pending");
    } catch (err: any) {
      toast.error(err?.message ?? "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordResetFn({ data: { email } });
    } catch {
      // Intentional: don't reveal whether the email exists
    } finally {
      setLoading(false);
      setMode("forgotSent");
    }
  };

  const backToTabs = () => {
    setMode("tabs");
    setPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <img src={schoolWalletLogo} alt="SchoolWallet logo" className="h-10 w-10" />
          <span className="font-display text-xl font-semibold">SchoolWallet</span>
        </Link>

        <div className="bg-card border border-border rounded-2xl p-7 shadow-[var(--shadow-warm)]">
          {/* ── Registration pending ── */}
          {mode === "pending" && (
            <div className="text-center py-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold font-display mb-2">Registration submitted</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your account is pending approval. An administrator will review your registration and
                assign you a role. You'll be able to sign in once approved.
              </p>
              <Button variant="outline" className="mt-6" onClick={backToTabs}>
                Back to sign in
              </Button>
            </div>
          )}

          {/* ── Reset request sent ── */}
          {mode === "forgotSent" && (
            <div className="text-center py-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-semibold font-display mb-2">Request submitted</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If your account is registered and active, a reset request has been sent to the
                administrator. They will set a temporary password and contact you.
              </p>
              <Button variant="outline" className="mt-6" onClick={backToTabs}>
                Back to sign in
              </Button>
            </div>
          )}

          {/* ── Forgot password form ── */}
          {mode === "forgot" && (
            <div>
              <button
                onClick={backToTabs}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <h2 className="text-lg font-semibold font-display mb-1">Reset password</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Enter your email and the administrator will be notified to set a temporary password for you.
              </p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-forgot">Email</Label>
                  <Input
                    id="email-forgot"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending…" : "Request reset"}
                </Button>
              </form>
            </div>
          )}

          {/* ── Sign in / Sign up tabs ── */}
          {mode === "tabs" && (
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 mb-6 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-in">Email</Label>
                    <Input
                      id="email-in"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pwd-in">Password</Label>
                    <Input
                      id="pwd-in"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
                  >
                    Forgot password?
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-up">Email</Label>
                    <Input
                      id="email-up"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pwd-up">Password</Label>
                    <Input
                      id="pwd-up"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
