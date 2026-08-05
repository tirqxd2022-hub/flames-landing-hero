/**
 * Single source of truth for order presentation logic.
 *
 * Both the admin (`src/pages/admin/Orders.tsx`) and the staff/customer
 * (`src/pages/ViewOrders.tsx`) surfaces render the exact same view-order
 * modal and thermal receipt. Any logic that decides what to show for a
 * given order (totals, order-type badge, staff-name visibility, labels)
 * lives here so the two surfaces can never drift apart again.
 */
import type { AdminOrder, SiteSettings } from "@/lib/api";

export const PAY_LABEL: Record<string, string> = {
  cash: "Cash",
  debit: "Debit Card",
  credit: "Credit Card",
};

export const DINING_LABEL: Record<string, string> = {
  to_go: "To Go",
  to_stay: "To Stay",
  delivery: "Delivery",
};

export type OrderTotals = {
  taxRate: number;
  taxLabel: string;
  discount: number;
  taxableBase: number;
  tax: number;
  isDelivery: boolean;
  deliveryFee: number;
  packagingFee: number;
  grand: number;
};

export function computeOrderTotals(o: AdminOrder, s: SiteSettings): OrderTotals {
  const taxRate = parseFloat(s.gst_rate_percent || s.tax_rate || "0") || 0;
  const taxLabel = s.tax_label || (taxRate ? "GST/HST" : "Tax");
  const discount = Number(o.discount || 0);
  const taxableBase = Math.max(0, o.subtotal - discount);
  const tax = Math.round(taxableBase * (taxRate / 100) * 100) / 100;
  const isDelivery = o.diningOption === "delivery";
  const deliveryFee = isDelivery ? Number(o.deliveryFee || 0) : 0;
  const packagingFee = isDelivery
    ? (parseFloat(s.delivery_packaging_fee || "0") || 0)
    : 0;
  const grand = Math.round((taxableBase + tax + deliveryFee + packagingFee) * 100) / 100;
  return { taxRate, taxLabel, discount, taxableBase, tax, isDelivery, deliveryFee, packagingFee, grand };
}

export type OrderTypeInfo = {
  key: "delivery" | "to_stay" | "to_go" | "pickup";
  label: string;
  cls: string;
};

/**
 * Delivery/pickup are customer-facing; to_go/to_stay are counter-punched.
 * Classify by dining_option first so a delivery order stays "Delivery" even
 * when a staff member entered it on the customer's behalf.
 */
export function getOrderType(o: AdminOrder): OrderTypeInfo {
  if (o.diningOption === "delivery") return { key: "delivery", label: "Delivery", cls: "bg-purple-500/20 text-purple-300" };
  if (o.diningOption === "to_stay") return { key: "to_stay", label: "To Stay", cls: "bg-amber-500/20 text-amber-300" };
  if (o.staffUsername && o.diningOption === "to_go") return { key: "to_go", label: "To Go", cls: "bg-emerald-500/20 text-emerald-300" };
  return { key: "pickup", label: "Pickup", cls: "bg-cyan-500/20 text-cyan-300" };
}

/** Staff name should only be shown on counter (to_go/to_stay) tickets. */
export function shouldShowStaff(o: AdminOrder): boolean {
  return !!o.staffUsername && (o.diningOption === "to_go" || o.diningOption === "to_stay");
}
