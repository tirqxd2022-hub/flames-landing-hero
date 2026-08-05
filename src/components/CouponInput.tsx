import { useState } from "react";
import { Tag, X, Loader2 } from "lucide-react";
import { applyCoupon, type CouponApplyResult } from "@/lib/api";
import { toast } from "sonner";
import { VirtualInput } from "@/components/VirtualInput";

export type AppliedCoupon = CouponApplyResult;

export function CouponInput({
  subtotal, customerPhone, applied, onApplied, onCleared, compact,
}: {
  subtotal: number;
  customerPhone?: string;
  applied: AppliedCoupon | null;
  onApplied: (c: AppliedCoupon) => void;
  onCleared: () => void;
  compact?: boolean;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply() {
    const c = code.trim();
    if (!c) return;
    if (subtotal <= 0) return toast.error("Add items before applying a coupon");
    setBusy(true);
    try {
      const r = await applyCoupon({ code: c, subtotal, customerPhone });
      onApplied(r);
      setCode("");
      toast.success(`Coupon ${r.code} applied`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply coupon");
    } finally { setBusy(false); }
  }

  if (applied) {
    return (
      <div className={`flex items-center justify-between gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 ${compact ? "py-1.5" : "py-2"}`}>
        <div className="flex items-center gap-2 min-w-0 text-xs">
          <Tag className="h-3.5 w-3.5 text-green-400 shrink-0" />
          <span className="font-mono font-semibold text-green-300 truncate">{applied.code}</span>
          <span className="text-green-200/70 truncate">
            {applied.freeItem
              ? `Free ${applied.freeItem.name}`
              : `−$${applied.discount.toFixed(2)}`}
          </span>
        </div>
        <button onClick={onCleared} type="button" className="text-green-300/80 hover:text-white shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <div className={`flex gap-2 ${compact ? "" : ""}`}>
      <VirtualInput
        kind="text"
        uppercase
        value={code}
        onChange={setCode}
        placeholder="Coupon code"
        padTitle="Coupon code"
        className={`flex-1 bg-[color:var(--background)] border border-white/10 rounded-lg px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} uppercase`}
      />
      <button
        type="button"
        onClick={apply}
        disabled={busy || !code.trim()}
        className={`rounded-lg border border-[color:var(--flame)]/50 text-[color:var(--flame-light)] hover:bg-[color:var(--flame)]/10 ${compact ? "px-3 text-xs" : "px-4 text-sm"} font-semibold disabled:opacity-50`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
      </button>
    </div>
  );
}
