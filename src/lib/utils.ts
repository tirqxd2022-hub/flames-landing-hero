import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Split a cart item name like "Naan Curry (Choice of Bread: Naan)" into
 *  { title: "Naan Curry", addons: "Choice of Bread: Naan" }. */
export function splitProductName(name: string): { title: string; addons: string } {
  const m = /^(.*)\s+\(([^()]+)\)\s*$/.exec(name || "");
  if (!m) return { title: name || "", addons: "" };
  return { title: m[1].trim(), addons: m[2].trim() };
}

/** Display an order number with a leading "#" (idempotent). */
export function fmtOrderNo(n: string | null | undefined): string {
  const s = String(n ?? "").trim();
  if (!s) return "";
  return s.startsWith("#") ? s : `#${s}`;
}
