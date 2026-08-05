import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "./mock-data";

export type CartItem = { product: Product; quantity: number };

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (p: Product, qty?: number) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("fg_cart") || "[]"); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem("fg_cart", JSON.stringify(items)); }, [items]);

  const add = (p: Product, qty = 1) =>
    setItems((prev) => {
      const i = prev.findIndex((x) => x.product.slug === p.slug);
      if (i >= 0) {
        const c = [...prev];
        c[i] = { ...c[i], quantity: c[i].quantity + qty };
        return c;
      }
      return [...prev, { product: p, quantity: qty }];
    });
  const setQty = (slug: string, qty: number) =>
    setItems((prev) => prev.map((x) => (x.product.slug === slug ? { ...x, quantity: Math.max(1, qty) } : x)));
  const remove = (slug: string) => setItems((prev) => prev.filter((x) => x.product.slug !== slug));
  const clear = () => setItems([]);

  const count = items.reduce((s, x) => s + x.quantity, 0);
  const subtotal = Math.round(items.reduce((s, x) => s + x.product.price * x.quantity, 0) * 100) / 100;

  return <Ctx.Provider value={{ items, count, subtotal, add, setQty, remove, clear }}>{children}</Ctx.Provider>;
}

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart outside provider");
  return v;
}
