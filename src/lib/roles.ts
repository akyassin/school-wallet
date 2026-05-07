export type AppRole = "super_admin" | "admin" | "reviewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  reviewer: "Reviewer",
};

export const canWrite = (role?: string | null): boolean =>
  role === "super_admin" || role === "admin";

export const isSuperAdmin = (role?: string | null): boolean =>
  role === "super_admin";
