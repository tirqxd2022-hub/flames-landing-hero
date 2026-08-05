
import { useEffect, useMemo, useRef, useState } from "react";
import { NumPad } from "@/components/NumPad";
import { VirtualInput, useVirtualKeyboardEnabled, setVirtualKeyboardEnabled } from "@/components/VirtualInput";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Minus, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchCategories, fetchAllProducts, placeOrder, fetchActiveOffers, type PaymentMethod, type DiningOption, type Offer } from "@/lib/api";
import type { Category, Product, ProductVariant } from "@/lib/mock-data";
import { toast } from "sonner";
import { TimePicker } from "@/components/ui/time-picker";
import { useSiteSettings } from "@/hooks/use-site-settings";
import OptimizedImage from "@/components/OptimizedImage";
import { CouponInput, type AppliedCoupon } from "@/components/CouponInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LoginModal from "@/components/auth/LoginModal";
import { publishKioskDisplay } from "@/lib/kiosk-display";

type SortBy = "name-asc" | "name-desc" | "price-asc" | "price-desc" | "type";
type VegFilter = "all" | "veg" | "nonveg";

type CartLine = { product: Product; variant?: ProductVariant; quantity: number };

function baseVariantPrice(p: Product): number {
  if (p.productType !== "variable" || !p.variants?.length) return p.price;
  const base = p.variants.find((v) => v.isBase) || p.variants[0];
  return base.price;
}
function lineKey(p: Product, variantId?: number): string {
  return variantId ? `${p.slug}::v${variantId}` : p.slug;
}
function humanizeSlug(s: string): string {
  return s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isOfferCartKey(key: string): boolean {
  return key.startsWith("offer::");
}

function lineMatchesOfferTrigger(line: CartLine, triggerType: string, ids: string[]): boolean {
  if (!line?.product || ids.length === 0) return false;
  if (triggerType === "products") {
    const variantKey = line.variant ? `${line.product.slug}::v${line.variant.id}` : null;
    return ids.includes(line.product.slug) || (!!variantKey && ids.includes(variantKey));
  }
  return (
    (!!line.product.categorySlug && ids.includes(line.product.categorySlug)) ||
    (!!line.product.subcategorySlug && ids.includes(line.product.subcategorySlug))
  );
}

function versionedProductImage(url: string, version: number): string {
  if (!url) return url;
  const isLocalProductAsset = (pathname: string) =>
    pathname.startsWith("/uploads/") || pathname.startsWith("/products/") ||
    pathname.startsWith("/api/uploads/") || pathname.startsWith("/api/products/");

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (!isLocalProductAsset(parsed.pathname)) return url;
      parsed.searchParams.set("v", String(version));
      return parsed.toString();
    } catch {
      return url;
    }
  }

  const [withoutHash, hash = ""] = url.split("#");
  const [pathname, query = ""] = withoutHash.split("?");
  if (!isLocalProductAsset(pathname)) return url;
  const params = new URLSearchParams(query);
  params.set("v", String(version));
  return `${pathname}?${params.toString()}${hash ? `#${hash}` : ""}`;
}


function CreateOrderInner() {
  const { user, isStaff, loading } = useAuth();
  const nav = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [hiddenSubs, setHiddenSubs] = useState<Set<string>>(new Set()); // "catSlug::subSlug" — unchecked subs (checked by default)
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // categorySlug
  const [veg, setVeg] = useState<VegFilter>("all");
  const [sort, setSort] = useState<SortBy>("name-asc");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartHydrated, setCartHydrated] = useState(false);
  const cartStorageKey = user ? `fg_staff_cart_${user.id}` : null;

  // Hydrate cart from sessionStorage once we know the staff user. Gated so the
  // empty initial state never overwrites the saved cart (the race that caused
  // items to "reappear" the next time something was added after a refresh).
  useEffect(() => {
    if (!cartStorageKey) return;
    try {
      const raw = sessionStorage.getItem(cartStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CartLine>;
        if (parsed && typeof parsed === "object") {
          // Drop any malformed/legacy entries (e.g. product missing) so a
          // corrupt cart can never blank the page during render.
          const clean: Record<string, CartLine> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (v && v.product && typeof v.product.slug === "string" && typeof v.product.name === "string" && Number(v.quantity) > 0) {
              clean[k] = v;
            }
          }
          setCart(clean);
        }
      }
    } catch { /* ignore */ }
    setCartHydrated(true);
  }, [cartStorageKey]);

  // Persist after hydration only.
  useEffect(() => {
    if (!cartHydrated || !cartStorageKey) return;
    try {
      if (Object.keys(cart).length === 0) sessionStorage.removeItem(cartStorageKey);
      else sessionStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch { /* ignore quota */ }
  }, [cart, cartHydrated, cartStorageKey]);

  const [form, setForm] = useState({ customerName: "", customerPhone: "", pickupTime: "", notes: "" });
  const [paid, setPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [cashPadOpen, setCashPadOpen] = useState(false);
  const cashAnchorRef = useRef<HTMLDivElement>(null);
  const [diningOption, setDiningOption] = useState<DiningOption>("to_go");
  const [submitting, setSubmitting] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [variantPick, setVariantPick] = useState<Product | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => { fetchActiveOffers().then(setOffers).catch(() => setOffers([])); }, []);

  // Auto-remove offer rewards from the cart once their trigger items are gone
  // (e.g. staff deletes X, replaces with a non-qualifying item). Without this
  // sweep the Y reward stays billed even after the offer no longer applies,
  // and orphaned offer keys whose underlying product disappeared could break
  // later renders.
  useEffect(() => {
    if (!cartHydrated) return;
    const offerKeysInCart = Object.keys(cart).filter(isOfferCartKey);
    if (offerKeysInCart.length === 0) return;
    const toRemove = new Set<string>();
    for (const o of offers) {
      if (o.type !== "buy_x_get_y") continue;
      const c = (o.config || {}) as Record<string, unknown>;
      const triggerType = (c.triggerType as string) || "categories";
      const ids = ((c.triggerIds as unknown[]) || []).map(String);
      const minQty = Math.max(1, Number(c.minTriggerQty || 1));
      let qty = 0;
      for (const [k, l] of Object.entries(cart)) {
        if (isOfferCartKey(k)) continue;
        if (lineMatchesOfferTrigger(l, triggerType, ids)) qty += l.quantity;
      }
      if (qty < minQty) {
        for (const k of offerKeysInCart) {
          if (k.startsWith(`offer::${o.id}::`)) toRemove.add(k);
        }
      }
    }
    // Also drop offer keys whose offer no longer exists / inactive.
    const liveOfferIds = new Set(offers.map((o) => `offer::${o.id}::`));
    for (const k of offerKeysInCart) {
      if (![...liveOfferIds].some((p) => k.startsWith(p))) toRemove.add(k);
    }
    if (toRemove.size) {
      setCart((prev) => {
        const next = { ...prev };
        for (const k of toRemove) delete next[k];
        return next;
      });
    }
  }, [cart, offers, cartHydrated]);

  useEffect(() => {
    if (!user || !isStaff) return;
    let lastLoadAt = 0;
    let inFlight = false;
    const load = () => {
      // Throttle to avoid stampedes from focus + visibilitychange + interval
      // all firing within milliseconds of tab activation.
      const now = Date.now();
      if (inFlight || now - lastLoadAt < 3000) return;
      lastLoadAt = now;
      inFlight = true;
      const v = now;
      try {
        Promise.allSettled([
          fetchCategories()
            .then((rows) => { if (Array.isArray(rows)) setCategories(rows); })
            .catch(() => {}),
          fetchAllProducts({ fresh: true })
            .then((rows) => {
              // Never clobber the current list with a non-array or empty
              // response — a transient network hiccup was blanking the screen
              // when the tab regained focus.
              if (!Array.isArray(rows) || rows.length === 0) return;
              try {
                setProducts(rows.map((p) => ({ ...p, image: versionedProductImage(p.image, v) })));
              } catch (err) {
                console.error("[CreateOrder] setProducts failed", err);
              }
            })
            .catch((e) => {
              // Silent on background refreshes; toast only on initial load.
              if (lastLoadAt === now && products.length === 0) {
                toast.error(e instanceof Error ? e.message : "Failed to load products");
              }
            }),
        ]).finally(() => { inFlight = false; });
      } catch (err) {
        inFlight = false;
        console.error("[CreateOrder] load() threw", err);
      }
    };

    load();
    // Refresh when tab regains focus so admin edits to product images/details
    // show up without a hard reload. Use visibilitychange only (focus fires
    // too, causing duplicate loads that occasionally blanked the screen).
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    const refreshTimer = window.setInterval(load, 30000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(refreshTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isStaff]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products;
    if (active.size > 0) list = list.filter((p) => active.has(p.categorySlug));
    // Per-category subcategory filter: subs are checked by default; products in
    // unchecked (hidden) subs are filtered out. Items without a sub always pass.
    const hiddenByCat = new Map<string, Set<string>>();
    for (const key of hiddenSubs) {
      const [c, s] = key.split("::");
      if (!c || !s) continue;
      if (!hiddenByCat.has(c)) hiddenByCat.set(c, new Set());
      hiddenByCat.get(c)!.add(s);
    }
    if (hiddenByCat.size > 0) {
      list = list.filter((p) => {
        const hidden = hiddenByCat.get(p.categorySlug);
        if (!hidden || !p.subcategorySlug) return true;
        return !hidden.has(p.subcategorySlug);
      });
    }
    if (veg !== "all") list = list.filter((p) => (veg === "veg" ? p.isVeg : !p.isVeg));
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      const ap = baseVariantPrice(a), bp = baseVariantPrice(b);
      if (sort === "type") {
        const as = a.subcategorySlug || "\uffff", bs = b.subcategorySlug || "\uffff";
        return as.localeCompare(bs) || a.name.localeCompare(b.name);
      }
      return sort === "name-asc" ? a.name.localeCompare(b.name) :
        sort === "name-desc" ? b.name.localeCompare(a.name) :
        sort === "price-asc" ? ap - bp : bp - ap;
    });
    return list;
  }, [products, active, hiddenSubs, veg, search, sort]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.categorySlug, (m.get(p.categorySlug) || 0) + 1);
    return m;
  }, [products]);

  // Map: categorySlug -> [{ slug, count }] for subcategories present in products.
  const subsByCategory = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const p of products) {
      if (!p.subcategorySlug) continue;
      if (!m.has(p.categorySlug)) m.set(p.categorySlug, new Map());
      const sm = m.get(p.categorySlug)!;
      sm.set(p.subcategorySlug, (sm.get(p.subcategorySlug) || 0) + 1);
    }
    const out = new Map<string, { slug: string; name: string; count: number }[]>();
    for (const [cat, sm] of m) {
      const arr = Array.from(sm.entries())
        .map(([slug, count]) => ({ slug, name: humanizeSlug(slug), count }))
        .sort((a, b) => a.name.localeCompare(b.name));
      out.set(cat, arr);
    }
    return out;
  }, [products]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => (categoryCounts.get(c.slug) || 0) > 0),
    [categories, categoryCounts]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filteredProducts) {
      const arr = map.get(p.categorySlug) || [];
      arr.push(p); map.set(p.categorySlug, arr);
    }
    return visibleCategories
      .filter((c) => map.has(c.slug))
      .map((c) => ({ category: c, items: map.get(c.slug)! }));
  }, [filteredProducts, visibleCategories]);

  const lines = useMemo(() => Object.values(cart).filter((l) => l.quantity > 0), [cart]);

  const s = useSiteSettings();
  const virtualKeyboardEnabled = useVirtualKeyboardEnabled();
  const taxRate = parseFloat(s.tax_rate || s.gst_rate_percent || "0") || 0;
  const taxLabel = s.tax_label || (taxRate ? "GST/HST" : "Tax");

  type OfferReward = { offerId: number; offerName: string; key: string; image: string; name: string; price: number };
  const offerRewards: OfferReward[] = useMemo(() => {
    const out: OfferReward[] = [];
    for (const o of offers) {
      if (o.type !== "buy_x_get_y") continue;
      const c = (o.config || {}) as Record<string, unknown>;
      const triggerType = (c.triggerType as string) || "categories";
      const triggerIds = ((c.triggerIds as unknown[]) || []).map(String);
      const minQty = Math.max(1, Number(c.minTriggerQty || 1));
      const triggerQty = Object.entries(cart).reduce((sum, [key, line]) => {
        if (isOfferCartKey(key)) return sum;
        return sum + (lineMatchesOfferTrigger(line, triggerType, triggerIds) ? line.quantity : 0);
      }, 0);
      if (triggerQty < minQty) continue;

      const slugs = Array.isArray(c.rewardSlugs) && (c.rewardSlugs as string[]).length
        ? (c.rewardSlugs as string[])
        : (typeof c.rewardProductSlug === "string" ? [c.rewardProductSlug as string] : []);
      const offerPrice = Number(c.rewardPrice || 0);
      for (const rs of slugs) {
        const baseSlug = rs.split("::v")[0];
        const variantIdStr = rs.includes("::v") ? rs.split("::v")[1] : null;
        const p = products.find((x) => x.slug === baseSlug);
        if (!p) continue;
        let label = p.name;
        if (variantIdStr && p.variants) {
          const v = p.variants.find((x) => String(x.id) === variantIdStr);
          if (v) label = `${p.name} — ${v.name}`;
        }
        out.push({
          offerId: o.id,
          offerName: o.name,
          key: `offer::${o.id}::${rs}`,
          image: p.image,
          name: label,
          price: offerPrice,
        });
      }
    }
    return out;
  }, [cart, offers, products]);

  // Auto-add free "Buy X Get Y" reward (only when the offer has exactly one
  // reward option). The sweep above auto-removes it once the trigger fails.
  useEffect(() => {
    if (!cartHydrated) return;
    const byOffer = new Map<number, OfferReward[]>();
    for (const r of offerRewards) {
      const arr = byOffer.get(r.offerId) || [];
      arr.push(r);
      byOffer.set(r.offerId, arr);
    }
    const toAdd: OfferReward[] = [];
    for (const [offerId, list] of byOffer) {
      if (list.length !== 1) continue;
      const r = list[0];
      if (r.price !== 0) continue;
      // skip if any reward variant from this offer is already in cart
      const claimed = Object.keys(cart).some((k) => k.startsWith(`offer::${offerId}::`));
      if (claimed) continue;
      toAdd.push(r);
    }
    if (toAdd.length === 0) return;
    setCart((prev) => {
      const next = { ...prev };
      for (const r of toAdd) {
        const baseSlug = r.key.split("::")[2].split("::v")[0];
        const baseProd = products.find((x) => x.slug === baseSlug);
        if (!baseProd) continue;
        const synth: Product = {
          ...baseProd,
          slug: r.key,
          name: `${r.name} (Offer: ${r.offerName})`,
          price: 0,
          productType: "simple",
          variants: undefined,
        };
        next[r.key] = { product: synth, quantity: 1 };
      }
      return next;
    });
  }, [offerRewards, cart, cartHydrated, products]);

  // Publish a read-only snapshot of the running order to the customer-facing
  // /promotions screen. Runs on every cart/coupon/dining/tax change and is
  // cleared on unmount so leaving the page hides the panel.
  useEffect(() => {
    if (!cartHydrated || !user) return;
    const _linePrice = (l: CartLine) => (l.variant ? l.variant.price : l.product.price);
    const items = lines.map((l) => {
      const unit = _linePrice(l);
      const isOffer = lineKey(l.product, l.variant?.id).startsWith("offer::");
      // Strip the "(Offer: ...)" suffix that gets baked into synthetic offer products.
      const cleanName = isOffer ? l.product.name.replace(/\s*\(Offer:[^)]+\)\s*$/, "") : l.product.name;
      return {
        name: cleanName,
        variantName: l.variant?.name,
        unit,
        qty: l.quantity,
        lineTotal: Math.round(unit * l.quantity * 100) / 100,
        isOffer,
      };
    });
    const _sub = lines.reduce((sum, l) => sum + _linePrice(l) * l.quantity, 0);
    const _disc = coupon ? Math.min(coupon.discount, _sub) : 0;
    const _base = Math.max(0, _sub - _disc);
    const _tax = Math.round(_base * (taxRate / 100) * 100) / 100;
    const _total = Math.round((_base + _tax) * 100) / 100;
    const claimedOfferIds = new Set<number>();
    for (const r of offerRewards) if (cart[r.key]) claimedOfferIds.add(r.offerId);
    const seenOfferKeys = new Set<string>();
    const displayOffers = offerRewards
      .filter((r) => {
        if (seenOfferKeys.has(r.key)) return false;
        seenOfferKeys.add(r.key);
        return true;
      })
      .map((r) => {
        const [title, variantName] = r.name.includes(" — ")
          ? r.name.split(" — ", 2)
          : [r.name, undefined];
        return {
          name: title,
          variantName,
          price: r.price,
          offerName: r.offerName,
          image: r.image,
          claimed: !!cart[r.key] || (claimedOfferIds.has(r.offerId) && !cart[r.key]),
        };
      });

    publishKioskDisplay({
      ownerId: String(user.id),
      items,
      offers: displayOffers,
      subtotal: Math.round(_sub * 100) / 100,
      discount: Math.round(_disc * 100) / 100,
      couponCode: coupon?.code,
      freeItemName: coupon?.freeItem?.name,
      taxLabel,
      taxRate,
      tax: _tax,
      total: _total,
      diningOption,
      updatedAt: Date.now(),
    });
  }, [lines, coupon, taxRate, taxLabel, diningOption, cartHydrated, user, offerRewards, cart]);

  useEffect(() => () => { publishKioskDisplay(null); }, []);



  if (loading) return <section className="pt-32 pb-20 text-center text-muted-foreground">Loading…</section>;
  if (!user) return (
    <section className="pt-32 pb-20 text-center max-w-md mx-auto px-4">
      <h1 className="text-2xl font-bold">Sign in required</h1>
      <p className="text-sm text-muted-foreground mt-2">Please sign in with a staff account to create orders.</p>
      <Link to="/" className="btn-flame mt-6 inline-flex">Go to home</Link>
      <LoginModal open onClose={() => nav("/")} />
    </section>
  );
  if (!isStaff) return <section className="pt-32 pb-20 text-center"><h1 className="text-2xl font-bold">Staff only</h1></section>;

  const linePrice = (l: CartLine) => (l.variant ? l.variant.price : l.product.price);
  const subtotal = lines.reduce((sum, l) => sum + linePrice(l) * l.quantity, 0);
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const taxableBase = Math.max(0, subtotal - discount);
  const tax = Math.round(taxableBase * (taxRate / 100) * 100) / 100;
  const total = Math.round((taxableBase + tax) * 100) / 100;

  function setLineQty(product: Product, n: number, variant?: ProductVariant) {
    const key = lineKey(product, variant?.id);
    setCart((prev) => {
      const c = { ...prev };
      if (n <= 0) delete c[key];
      else c[key] = { product, variant, quantity: n };
      return c;
    });
  }

  function handleAdd(p: Product) {
    if (p.productType === "variable" && p.variants && p.variants.length > 0) {
      setVariantPick(p);
    } else {
      setLineQty(p, 1);
    }
  }

  function addOfferReward(r: OfferReward) {
    const synth: Product = {
      // minimal product clone; engine pricing is overridden by the staff-set offer price
      ...(products.find((x) => x.slug === r.key.split("::")[2].split("::v")[0]) || ({} as Product)),
      slug: r.key,
      name: `${r.name} (Offer: ${r.offerName})`,
      price: r.price,
      productType: "simple",
      variants: undefined,
    };
    setCart((prev) => ({ ...prev, [r.key]: { product: synth, quantity: 1 } }));
  }
  function removeOfferReward(r: OfferReward) {
    setCart((prev) => { const c = { ...prev }; delete c[r.key]; return c; });
  }


  async function submit() {
    if (lines.length === 0) return toast.error("Add at least one item");
    setSubmitting(true);
    try {
      const order = await placeOrder({
        customerName: form.customerName.trim() || "Guest",
        customerPhone: form.customerPhone.trim() || "-",
        pickupTime: form.pickupTime || undefined,
        notes: form.notes || undefined,

        paid, paymentMethod: paid ? paymentMethod : null, diningOption,
        cashReceived: paid && paymentMethod === "cash" && cashReceived !== "" && !isNaN(parseFloat(cashReceived))
          ? Math.round(parseFloat(cashReceived) * 100) / 100
          : undefined,
        couponCode: coupon?.code,
        items: lines.map((l) => ({
          productSlug: lineKey(l.product, l.variant?.id),
          quantity: l.quantity,
          name: l.variant ? `${l.product.name} — ${l.variant.name}` : l.product.name,
          unitPrice: linePrice(l),
        })),
      });
      toast.success(`Order #${order.orderNumber} created`);
      setCart({});
      setForm({ customerName: "", customerPhone: "", pickupTime: "", notes: "" });
      setPaid(false);
      setDiningOption("to_go");
      setCoupon(null);
      setCashReceived("");
      nav(`/orders`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to create order"); }
    finally { setSubmitting(false); }
  }

  const PAY_LABEL: Record<PaymentMethod, string> = { cash: "Cash", debit: "Debit Card", credit: "Credit Card" };
  const subKey = (categorySlug: string, subSlug: string) => `${categorySlug}::${subSlug}`;

  function setCategoryFilter(categorySlug: string, checked: boolean) {
    setActive((prev) => {
      const n = new Set(prev);
      if (checked) n.add(categorySlug); else n.delete(categorySlug);
      return n;
    });
    setHiddenSubs((prev) => {
      const n = new Set(prev);
      for (const key of n) {
        if (key.startsWith(`${categorySlug}::`)) n.delete(key);
      }
      return n;
    });
  }

  const vegBtn = (v: VegFilter, label: string, dot: string) => (
    <button onClick={() => setVeg(v)} className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-2 ${veg === v ? "bg-[color:var(--flame)]/15 text-white" : "text-muted-foreground hover:text-white"}`}>
      <span className={`inline-block h-2.5 w-2.5 rounded-sm border ${dot}`} />
      {label}
    </button>
  );

  return (
    <section className="pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold">Create order</h1>
        <p className="text-sm text-muted-foreground mt-1">POS-style direct billing for counter staff.</p>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[220px_1fr_360px] gap-6">
          {/* Sidebar */}
          <aside className="rounded-2xl bg-[color:var(--card)] border border-white/5 p-4 h-fit sticky top-24">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Diet</h3>
            <div className="space-y-1 mb-4">
              {vegBtn("all", "All items", "border-white/30 bg-white/20")}
              {vegBtn("veg", "Veg only", "border-green-600 bg-green-500")}
              {vegBtn("nonveg", "Non-veg only", "border-red-600 bg-red-500")}
            </div>

            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Sort by</h3>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortBy)} className="w-full h-9 rounded-md border border-white/10 bg-[color:var(--background)] text-sm px-2 mb-4">
              <option value="name-asc">Name A→Z</option><option value="name-desc">Name Z→A</option>
              <option value="price-asc">Price low→high</option><option value="price-desc">Price high→low</option>
              <option value="type">Type</option>
            </select>

            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Categories</h3>
            <div className="space-y-0.5">
              {visibleCategories.map((c) => {
                const subs = subsByCategory.get(c.slug) || [];
                const hasSubs = subs.length > 0;
                const isOpen = expanded.has(c.slug);
                return (
                  <div key={c.slug}>
                    <div className="flex items-center justify-between gap-1 text-sm py-1 hover:text-white">
                      <span className="flex items-center gap-1 min-w-0 flex-1">
                        {hasSubs ? (
                          <button
                            type="button"
                            aria-label={isOpen ? "Collapse" : "Expand"}
                            onClick={() => setExpanded((prev) => {
                              const n = new Set(prev);
                              if (n.has(c.slug)) n.delete(c.slug); else n.add(c.slug);
                              return n;
                            })}
                            className="h-5 w-5 grid place-items-center text-muted-foreground hover:text-white shrink-0"
                          >
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        ) : (
                          <span className="h-5 w-5 shrink-0" />
                        )}
                        <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                          <input type="checkbox" checked={active.has(c.slug)}
                            onChange={(e) => setCategoryFilter(c.slug, e.target.checked)}
                            className="accent-[color:var(--flame)]" />
                          <span className="truncate">{c.name}</span>
                        </label>
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">({categoryCounts.get(c.slug) || 0})</span>
                    </div>
                    {hasSubs && isOpen && (
                      <div className="ml-7 space-y-0.5 mt-0.5 mb-1 border-l border-white/5 pl-2">
                        {subs.map((sub) => {
                          const key = subKey(c.slug, sub.slug);
                          const parentActive = active.has(c.slug);
                          const checked = parentActive && !hiddenSubs.has(key);
                          return (
                            <label key={key} className="flex items-center justify-between gap-2 text-xs py-0.5 cursor-pointer text-muted-foreground hover:text-white">
                              <span className="flex items-center gap-2 min-w-0">
                                <input type="checkbox" checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked;
                                    if (next) {
                                      if (!parentActive) {
                                        // Activating one sub fresh: hide all other subs so only this one shows
                                        setActive((prev) => new Set(prev).add(c.slug));
                                        setHiddenSubs((prev) => {
                                          const n = new Set(prev);
                                          for (const s of subs) {
                                            if (s.slug !== sub.slug) n.add(subKey(c.slug, s.slug));
                                          }
                                          n.delete(key);
                                          return n;
                                        });
                                      } else {
                                        setHiddenSubs((prev) => { const n = new Set(prev); n.delete(key); return n; });
                                      }
                                    } else {
                                      setHiddenSubs((prev) => {
                                        const n = new Set(prev); n.add(key);
                                        // If all subs now hidden, deactivate parent and clear hidden entries
                                        const allHidden = subs.every((s) => n.has(subKey(c.slug, s.slug)));
                                        if (allHidden) {
                                          for (const s of subs) n.delete(subKey(c.slug, s.slug));
                                          setActive((prevA) => { const na = new Set(prevA); na.delete(c.slug); return na; });
                                        }
                                        return n;
                                      });
                                    }
                                  }}
                                  className="accent-[color:var(--flame)]" />
                                <span className="truncate">{sub.name}</span>
                              </span>
                              <span className="shrink-0">({sub.count})</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                  </div>
                );
              })}
              {visibleCategories.length === 0 && (
                <div className="text-xs text-muted-foreground">Loading categories…</div>
              )}
              {(active.size > 0 || hiddenSubs.size > 0 || veg !== "all") && (
                <button onClick={() => { setActive(new Set()); setHiddenSubs(new Set()); setVeg("all"); }} className="text-xs text-[color:var(--flame-light)] hover:underline mt-2">Clear filters</button>
              )}
            </div>
          </aside>

          {/* Menu grid grouped by category */}
          <div className="flex flex-col lg:h-[calc(100vh-8rem)] lg:sticky lg:top-24 min-h-0">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <VirtualInput
                kind="text"
                value={search}
                onChange={setSearch}
                placeholder="Search food items…"
                padTitle="Search"
                className="pl-9 h-10 rounded-lg bg-[color:var(--card)] border border-white/10 text-sm focus:outline-none focus:border-[color:var(--flame)]/60"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white text-xs" aria-label="Clear">✕</button>
              )}
            </div>
            <div className="flex-1 lg:overflow-y-auto mt-4 lg:pr-2 space-y-8 min-h-0 flame-scroll">

            {grouped.length === 0 && <div className="text-sm text-muted-foreground">No products match.</div>}
            {grouped.map(({ category, items }) => (
              <div key={category.slug}>
                <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                  <span className="text-flame-gradient">{category.name}</span>
                  <span className="text-xs text-muted-foreground font-normal">({items.length})</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((p) => {
                    const isVar = p.productType === "variable" && (p.variants?.length ?? 0) > 0;
                    const base = baseVariantPrice(p);
                    const totalQty = Object.values(cart).filter((l) => l.product.slug === p.slug).reduce((s, l) => s + l.quantity, 0);
                    const simpleQ = !isVar ? (cart[p.slug]?.quantity ?? 0) : 0;
                    return (
                      <div key={p.slug} className="rounded-xl bg-[color:var(--card)] border border-white/5 p-2.5 flex flex-col">
                        <OptimizedImage key={p.image} src={p.image} alt={p.name} width={300} height={225} sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw" className="w-full aspect-[4/3] rounded-md object-cover" />
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className={`inline-block h-2 w-2 rounded-sm border ${p.isVeg ? "border-green-600 bg-green-500" : "border-red-600 bg-red-500"}`} />
                          <div className="font-semibold text-xs text-white truncate">{p.name}</div>
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                          {isVar ? `Select from ${(p.variants ?? []).map((v) => v.name).join("/")}` : p.description}
                        </div>
                        <div className="mt-1 text-xs font-bold text-[color:var(--flame-light)]">
                          ${base.toFixed(2)}{isVar && <span className="text-muted-foreground font-normal"> onwards</span>}
                        </div>
                        <div className="mt-2 pt-1 mt-auto">
                          {isVar ? (
                            <button onClick={() => handleAdd(p)} className="w-full h-7 rounded-md bg-[color:var(--flame)] text-white text-xs font-semibold hover:opacity-90 inline-flex items-center justify-center gap-1">
                              <Plus className="h-3 w-3" /> Choose{totalQty > 0 ? ` (${totalQty})` : ""}
                            </button>
                          ) : simpleQ === 0 ? (
                            <button onClick={() => handleAdd(p)} className="w-full h-7 rounded-md bg-[color:var(--flame)] text-white text-xs font-semibold hover:opacity-90">
                              Add
                            </button>
                          ) : (
                            <div className="inline-flex w-full items-center justify-between rounded-md border border-[color:var(--flame)]/50 bg-[color:var(--flame)]/10 h-7 px-1">
                              <button onClick={() => setLineQty(p, simpleQ - 1)} className="h-6 w-6 grid place-items-center text-[color:var(--flame)] hover:bg-white/5 rounded">
                                {simpleQ === 1 ? <Trash2 className="h-3 w-3" /> : <Minus className="h-3.5 w-3.5" />}
                              </button>
                              <span className="text-xs font-semibold">{simpleQ}</span>
                              <button onClick={() => setLineQty(p, simpleQ + 1)} className="h-6 w-6 grid place-items-center text-[color:var(--flame)] hover:bg-white/5 rounded">
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            </div>
          </div>

          {/* Cart panel */}
          <aside className="rounded-2xl bg-[color:var(--card)] border border-white/5 p-5 h-fit sticky top-24">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-lg">Order</h2>
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={virtualKeyboardEnabled}
                  onChange={(e) => setVirtualKeyboardEnabled(e.target.checked)}
                  className="accent-[color:var(--flame)] h-3.5 w-3.5"
                />
                Virtual Keyboard
              </label>
            </div>
            {lines.length === 0 && offerRewards.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">Click <strong>Add</strong> on items to bill them.</p>
            ) : (
              <ul className="mt-3 space-y-2 max-h-64 overflow-auto pr-1 border-y border-white/5 py-3">
                {lines.filter((l) => !lineKey(l.product, l.variant?.id).startsWith("offer::")).map((l) => {
                  const key = lineKey(l.product, l.variant?.id);
                  const unit = linePrice(l);
                  return (
                    <li key={key} className="flex items-center gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs leading-tight">
                          {l.product.name}{l.variant ? <span className="text-muted-foreground"> — {l.variant.name}</span> : null}
                        </div>
                        <div className="text-[10px] text-muted-foreground">${unit.toFixed(2)} each</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="text-xs font-bold text-[color:var(--flame-light)] tabular-nums">${(unit * l.quantity).toFixed(2)}</div>
                        <div className="inline-flex items-center rounded-full border border-white/10 h-6">
                          <button
                            onClick={() => setLineQty(l.product, l.quantity - 1, l.variant)}
                            className="h-6 w-6 grid place-items-center text-muted-foreground hover:text-white"
                            aria-label="decrease"
                            title={l.quantity === 1 ? "Remove" : "Decrease"}
                          >
                            {l.quantity === 1 ? <Trash2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          </button>
                          <span className="w-5 text-center text-xs tabular-nums">{l.quantity}</span>
                          <button
                            onClick={() => setLineQty(l.product, l.quantity + 1, l.variant)}
                            className="h-6 w-6 grid place-items-center text-muted-foreground hover:text-white"
                            aria-label="increase"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </li>

                  );
                })}
                {offerRewards.length > 0 && (
                  <li className="pt-2 mt-1 border-t border-white/5 text-[10px] uppercase tracking-widest text-[color:var(--gold)]">Offers</li>
                )}
                {(() => {
                  // For each offer, only one reward variant may be active at a time.
                  // Once one is added, the siblings render disabled until removed.
                  const claimedOfferIds = new Set<number>();
                  for (const r of offerRewards) if (cart[r.key]) claimedOfferIds.add(r.offerId);
                  return offerRewards.map((r) => {
                    const added = !!cart[r.key];
                    const disabled = !added && claimedOfferIds.has(r.offerId);
                    return (
                      <li key={r.key} className={`flex items-center gap-2 text-sm ${disabled ? "opacity-40" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-xs leading-tight truncate">🎉 {r.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{r.offerName}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="text-xs font-bold text-[color:var(--flame-light)] tabular-nums">${r.price.toFixed(2)}</div>
                          {added ? (
                            <div className="inline-flex items-center rounded-full border border-white/10 h-6">
                              <span className="w-6 text-center text-xs tabular-nums">1</span>
                              <button
                                onClick={() => removeOfferReward(r)}
                                className="h-6 w-6 grid place-items-center text-muted-foreground hover:text-red-400"
                                aria-label="remove"
                                title="Remove"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => !disabled && addOfferReward(r)}
                              disabled={disabled}
                              title={disabled ? "Remove the selected offer item first" : "Add"}
                              className="h-6 px-2.5 rounded-full bg-[color:var(--flame)] hover:bg-[color:var(--flame-light)] text-white text-[10px] font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:hover:bg-[color:var(--flame)]"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  });
                })()}
              </ul>
            )}


            <div className="mt-3 space-y-2">
              <VirtualInput kind="text" value={form.customerName} onChange={(v) => setForm({ ...form, customerName: v })} placeholder="Customer name (optional)" padTitle="Customer name" className={inp} />
              <VirtualInput kind="number" allowDecimal={false} value={form.customerPhone} onChange={(v) => setForm({ ...form, customerPhone: v })} placeholder="Phone (optional)" padTitle="Phone number" inputMode="tel" className={inp} />

              <TimePicker value={form.pickupTime} onChange={(v) => setForm({ ...form, pickupTime: v })} placeholder="Pickup time (optional)" />
              <VirtualInput as="textarea" rows={2} kind="text" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Notes" padTitle="Notes" className={inp} quickNotes={["Spicy", "Medium spicy", "Mild", "Non-spicy", "Extra spicy", "Less oil", "No onion", "No garlic", "No ice", "Extra sauce", "On the side", "Well done", "To share", "Allergy - nuts", "Gluten free"]} />
            </div>

            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="accent-green-500" />
                  <span className="font-semibold">Mark as paid</span>
                </label>
                <div className="inline-flex items-center gap-3 ml-auto text-xs">
                  {(["to_go", "to_stay"] as DiningOption[]).map((d) => (
                    <label key={d} className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="dining"
                        checked={diningOption === d}
                        onChange={() => setDiningOption(d)}
                        className="accent-[color:var(--flame)]"
                      />
                      <span className={diningOption === d ? "text-white font-semibold" : "text-muted-foreground"}>
                        {d === "to_go" ? "To go" : "To stay"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {paid && (
                <>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {(["cash", "debit", "credit"] as PaymentMethod[]).map((m) => (
                      <label key={m} className={`px-3 py-1.5 rounded-full border cursor-pointer text-xs ${paymentMethod === m ? "bg-[color:var(--flame)] border-[color:var(--flame)] text-white" : "border-white/10 text-muted-foreground"}`}>
                        <input type="radio" name="pm" className="hidden" checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} />
                        {PAY_LABEL[m]}
                      </label>
                    ))}
                  </div>
                  {paymentMethod === "cash" && (
                    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                      <label className="block text-xs text-muted-foreground mb-1">Cash Received</label>
                      <div className="relative" ref={cashAnchorRef}>
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm z-10 pointer-events-none">$</span>
                        <button
                          type="button"
                          onClick={() => setCashPadOpen((v) => !v)}
                          className={`w-full pl-6 pr-2 py-1.5 rounded-md bg-black/40 border text-sm text-left text-white focus:outline-none transition-colors ${cashPadOpen ? "border-[color:var(--flame)]" : "border-white/10 hover:border-white/20"}`}
                          aria-haspopup="dialog"
                          aria-expanded={cashPadOpen}
                        >
                          {cashReceived === "" ? <span className="text-muted-foreground">0.00</span> : cashReceived}
                        </button>
                        <NumPad
                          open={cashPadOpen}
                          value={cashReceived}
                          onChange={setCashReceived}
                          onClose={() => setCashPadOpen(false)}
                          anchorRef={cashAnchorRef}
                          title="Cash received"
                          quickAdds={[5, 10, 20, 50]}
                        />
                      </div>
                      {cashReceived !== "" && !isNaN(parseFloat(cashReceived)) && (
                        <div className="mt-2 flex justify-between text-sm">
                          <span className="text-muted-foreground">Balance to return</span>
                          <span className={`font-semibold ${parseFloat(cashReceived) - total >= 0 ? "text-green-400" : "text-red-400"}`}>
                            ${(parseFloat(cashReceived) - total).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-4 border-t border-white/10 pt-3">
              <CouponInput
                subtotal={subtotal}
                customerPhone={form.customerPhone.trim() || undefined}
                applied={coupon}
                onApplied={setCoupon}
                onCleared={() => setCoupon(null)}
                compact
              />
            </div>
            <div className="mt-3 border-t border-white/10 pt-3 text-sm space-y-1.5">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              {coupon && (
                <div className="flex justify-between text-green-400">
                  <span>Coupon ({coupon.code})</span>
                  <span>{coupon.freeItem ? `Free ${coupon.freeItem.name}` : `−$${discount.toFixed(2)}`}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between text-muted-foreground"><span>{taxLabel} ({taxRate}%)</span><span>${tax.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base pt-1.5 border-t border-white/10">
                <span>Total</span><span className="text-[color:var(--flame-light)]">${total.toFixed(2)}</span>
              </div>
            </div>
            <button onClick={submit} disabled={submitting || lines.length === 0} className="btn-flame w-full justify-center mt-4 disabled:opacity-60">
              {submitting ? "Creating…" : "Create order"}
            </button>
          </aside>
        </div>
      </div>

      {/* Variant picker modal */}
      <Dialog open={!!variantPick} onOpenChange={(o) => !o && setVariantPick(null)}>
        <DialogContent className="bg-[color:var(--card)] border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle>{variantPick?.name}</DialogTitle>
          </DialogHeader>
          {variantPick && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Pick a variety to add to the order.</p>
              {variantPick.variants?.map((v) => {
                const key = lineKey(variantPick, v.id);
                const q = cart[key]?.quantity ?? 0;
                return (
                  <div key={v.id} className="flex items-center gap-2 rounded-md border border-white/10 p-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{v.name}</div>
                      <div className="text-xs text-muted-foreground">${v.price.toFixed(2)}</div>
                    </div>
                    {q === 0 ? (
                      <button onClick={() => setLineQty(variantPick, 1, v)} className="h-7 px-3 rounded-md bg-[color:var(--flame)] text-white text-xs font-semibold hover:opacity-90">Add</button>
                    ) : (
                      <div className="inline-flex items-center gap-1 rounded-md border border-[color:var(--flame)]/50 bg-[color:var(--flame)]/10 h-7 px-1">
                        <button onClick={() => setLineQty(variantPick, q - 1, v)} className="h-6 w-6 grid place-items-center text-[color:var(--flame)] hover:bg-white/5 rounded">
                          {q === 1 ? <Trash2 className="h-3 w-3" /> : <Minus className="h-3.5 w-3.5" />}
                        </button>
                        <span className="text-xs font-semibold w-5 text-center">{q}</span>
                        <button onClick={() => setLineQty(variantPick, q + 1, v)} className="h-6 w-6 grid place-items-center text-[color:var(--flame)] hover:bg-white/5 rounded">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex justify-end pt-2">
                <button onClick={() => setVariantPick(null)} className="px-4 py-2 text-sm rounded-md bg-[color:var(--flame)] text-white font-semibold">Done</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

const inp = "w-full bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2 text-sm";

import { ErrorBoundary } from "@/components/ErrorBoundary";
export default function CreateOrder() {
  return (
    <ErrorBoundary label="CreateOrder">
      <CreateOrderInner />
    </ErrorBoundary>
  );
}

