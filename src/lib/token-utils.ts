export function getTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const exp = getTokenExp(token);
  return exp === null || Date.now() >= exp * 1000;
}

export function getTokenRemainingMs(token: string): number {
  const exp = getTokenExp(token);
  if (exp === null) return 0;
  return Math.max(0, exp * 1000 - Date.now());
}
