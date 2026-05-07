import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LogOut, Menu, Sun, Moon } from "lucide-react";
import ledgerLogo from "@/assets/school-wallet-logo.svg";

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={className}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const navLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/transactions", label: "Transactions" },
    { to: "/budgets", label: "Budgets" },
    { to: "/recurring", label: "Recurring" },
    { to: "/reports", label: "Reports" },
  ] as const;

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40">
      <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between gap-2 px-4">
        <Link to="/" className="flex items-center gap-2.5 group min-w-0">
          <img src={ledgerLogo} alt="SchoolWallet logo" className="h-9 w-9 shrink-0 object-contain" />
          <div className="leading-tight min-w-0">
            <div className="font-display text-base sm:text-lg font-semibold truncate">SchoolWallet</div>
            <div className="hidden sm:block text-xs text-muted-foreground truncate">Every krona, accounted for...</div>
          </div>
        </Link>

        {user ? (
          <>
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
                  activeProps={{ className: "px-3 py-2 text-sm rounded-md bg-secondary font-medium" }}
                >
                  {l.label}
                </Link>
              ))}
              <ThemeToggle className="ml-1" />
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="ml-1">
                <LogOut className="h-4 w-4 mr-1.5" />
                Sign out
              </Button>
            </nav>

            {/* Mobile nav */}
            <div className="flex items-center gap-1 md:hidden">
              <ThemeToggle />
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="font-display">Menu</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1">
                  {navLinks.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setOpen(false)}
                      className="px-3 py-2.5 text-base rounded-md hover:bg-secondary transition-colors"
                      activeProps={{ className: "px-3 py-2.5 text-base rounded-md bg-secondary font-medium" }}
                    >
                      {l.label}
                    </Link>
                  ))}
                  <Button variant="ghost" onClick={handleSignOut} className="mt-2 justify-start">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </Button>
                </nav>
              </SheetContent>
              </Sheet>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
