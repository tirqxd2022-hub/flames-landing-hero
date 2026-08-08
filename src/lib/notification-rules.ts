import { useMemo } from "react";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { playTone, TONE_IDS, type ToneId } from "@/lib/notification-sounds";

export const NOTIFICATION_RULES_KEY = "notification_rules";

export type TriggerId =
  | "order_new_online"
  | "order_new_counter"
  | "order_preparing"
  | "order_ready"
  | "order_completed"
  | "order_cancelled";

export const TRIGGERS: Array<{ id: TriggerId; label: string; help?: string }> = [
  { id: "order_new_online", label: "New online order received", help: "Fires when a customer order arrives from the website." },
  { id: "order_new_counter", label: "New counter order received", help: "Fires when staff create an order at the counter." },
  { id: "order_preparing", label: "Order marked preparing" },
  { id: "order_ready", label: "Order marked ready" },
  { id: "order_completed", label: "Order completed", help: "Order picked up." },
  { id: "order_cancelled", label: "Order cancelled" },
];

export function triggerLabel(id: string): string {
  return TRIGGERS.find((t) => t.id === id)?.label || id;
}

/** Order status → trigger for a status transition. */
export const STATUS_TRIGGER: Record<string, TriggerId> = {
  preparing: "order_preparing",
  ready: "order_ready",
  picked_up: "order_completed",
  cancelled: "order_cancelled",
};

/** Legacy rule ids stored before online/counter split. */
const LEGACY_TRIGGERS: Record<string, TriggerId> = { order_new: "order_new_online" };

export type NotificationRule = { trigger: TriggerId; tone: ToneId };

export function parseRules(raw: string | undefined | null): NotificationRule[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const seen = new Set<string>();
    const out: NotificationRule[] = [];
    for (const r of arr) {
      const trigger = (LEGACY_TRIGGERS[r?.trigger] ?? r?.trigger) as TriggerId;
      const tone = r?.tone as ToneId;
      if (!TRIGGERS.some((t) => t.id === trigger)) continue;
      if (!TONE_IDS.includes(tone)) continue;
      if (seen.has(trigger)) continue;
      seen.add(trigger);
      out.push({ trigger, tone });
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeRules(rules: NotificationRule[]): string {
  return JSON.stringify(rules);
}

/** Rules configured in Admin → Settings → Notifications. */
export function useNotificationRules() {
  const settings = useSiteSettings() as Record<string, string>;
  const raw = settings[NOTIFICATION_RULES_KEY];
  const rules = useMemo(() => parseRules(raw), [raw]);
  return useMemo(
    () => ({
      rules,
      play(trigger: TriggerId) {
        const rule = rules.find((r) => r.trigger === trigger);
        if (rule) playTone(rule.tone);
      },
    }),
    [rules],
  );
}

export type OrderSnapshot = { orderNumber: string; status: string; staffUsername?: string | null };

/**
 * Diff two order lists and return the triggers that should fire.
 * `prev === null` (first load) never fires anything.
 */
export function detectOrderTriggers(
  prev: Map<string, string> | null,
  next: OrderSnapshot[],
): TriggerId[] {
  if (!prev) return [];
  const fired = new Set<TriggerId>();
  for (const o of next) {
    const before = prev.get(o.orderNumber);
    if (before === undefined) {
      fired.add(o.staffUsername ? "order_new_counter" : "order_new_online");
    } else if (before !== o.status) {
      const t = STATUS_TRIGGER[o.status];
      if (t) fired.add(t);
    }
  }
  return [...fired];
}

export function snapshotOrders(orders: OrderSnapshot[]): Map<string, string> {
  return new Map(orders.map((o) => [o.orderNumber, o.status]));
}