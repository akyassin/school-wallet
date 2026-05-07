export const CURRENCY = "SEK";

export const formatMoney = (n: number) =>
  new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 2,
  }).format(n);

export const formatDate = (d: string | Date) =>
  new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "short", day: "2-digit" }).format(
    typeof d === "string" ? new Date(d) : d
  );
