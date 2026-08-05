import { useEffect, useState } from "react";
import { evaluateOffers, type EvaluateOffersResult, type OfferAdjustment } from "@/lib/api";
import type { CartItem } from "@/lib/cart";

const EMPTY: EvaluateOffersResult = { adjustments: [], hints: [], totalDiscount: 0 };

export function useOfferEvaluation(items: CartItem[], diningOption?: string) {
  const [result, setResult] = useState<EvaluateOffersResult>(EMPTY);
  useEffect(() => {
    if (items.length === 0) { setResult(EMPTY); return; }
    const t = setTimeout(() => {
      evaluateOffers({
        items: items.map((it) => ({
          slug: it.product.slug,
          name: it.product.name,
          unitPrice: it.product.price,
          qty: it.quantity,
        })),
        diningOption,
      }).then(setResult).catch(() => setResult(EMPTY));
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items.map((i) => [i.product.slug, i.quantity, i.product.price])), diningOption]);
  return result;
}

export function OfferAdjustmentList({ adjustments, hints }: { adjustments: OfferAdjustment[]; hints?: OfferAdjustment[] }) {
  if (adjustments.length === 0 && (!hints || hints.length === 0)) return null;
  return (
    <>
      {adjustments.map((a) => (
        <div key={a.offerId} className="flex justify-between text-green-400">
          <span className="truncate pr-2">🎉 {a.name}{a.note ? ` (${a.note})` : ""}</span>
          <span className="whitespace-nowrap">−${a.amount.toFixed(2)}</span>
        </div>
      ))}
      {hints?.map((h) => (
        <div key={`hint-${h.offerId}`} className="text-xs text-[color:var(--flame-light)]">
          💡 {h.name}: {h.note}
        </div>
      ))}
    </>
  );
}
