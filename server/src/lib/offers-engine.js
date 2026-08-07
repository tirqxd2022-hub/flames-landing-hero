/**
 * Offers engine — pure evaluator shared by /offers/evaluate (public) and the
 * order-creation path. Each evaluator returns one or more adjustments:
 *   { offerId, name, type, amount, freeItems[], note }
 *
 * Cart line shape passed in:
 *   { productId, slug, name, categorySlug, subcategorySlug, variantId, unitPrice, qty }
 */

import { pool } from "../db.js";

function parseHM(s) {
  if (s == null) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(s).trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function nowInToronto() {
  // process.TZ is already "America/Toronto" (set in src/index.js).
  return new Date();
}

function isOfferLive(o, diningOption) {
  if (!o.is_active) return false;
  const now = nowInToronto();
  if (o.starts_at && new Date(o.starts_at) > now) return false;
  if (o.expires_at && new Date(o.expires_at) < now) return false;
  const dow = now.getDay(); // 0=Sun..6=Sat
  if (o.days_of_week != null && !((Number(o.days_of_week) >> dow) & 1)) return false;
  const tFrom = parseHM(o.time_from);
  const tTo = parseHM(o.time_to);
  if (tFrom != null && tTo != null) {
    const cur = now.getHours() * 60 + now.getMinutes();
    if (tFrom <= tTo) {
      if (cur < tFrom || cur > tTo) return false;
    } else {
      // window wraps midnight
      if (cur < tFrom && cur > tTo) return false;
    }
  }
  if (o.dining_option && o.dining_option !== "any" && diningOption && diningOption !== o.dining_option) return false;
  return true;
}

function slugVariants(s) {
  const out = new Set();
  if (!s) return out;
  const parts = String(s).split("::");
  out.add(parts[0]);
  if (parts[1] && /^v\d+$/.test(parts[1])) out.add(`${parts[0]}::${parts[1]}`);
  return out;
}

function lineMatches(line, triggerType, triggerIds) {
  const ids = (triggerIds || []).map(String);
  if (!ids.length) return false;
  if (triggerType === "products") {
    const keys = slugVariants(line.slug);
    return ids.some((id) => keys.has(id));
  }
  if (triggerType === "categories") return ids.includes(String(line.categorySlug)) || ids.includes(String(line.subcategorySlug));
  return false;
}


function round2(n) {
  return Math.round(n * 100) / 100;
}

function evalCartPercent(offer, ctx) {
  const cfg = offer.config || {};
  const min = Number(cfg.minSubtotal || 0);
  if (ctx.subtotal < min) return null;
  const pct = Number(cfg.percent || 0);
  if (pct <= 0) return null;
  let amt = ctx.subtotal * (pct / 100);
  if (cfg.maxDiscount) amt = Math.min(amt, Number(cfg.maxDiscount));
  amt = Math.min(amt, ctx.subtotal);
  if (amt <= 0) return null;
  return {
    offerId: offer.id,
    name: offer.name,
    type: offer.type,
    amount: round2(amt),
    freeItems: [],
    note: `${pct}% off`,
  };
}

function evalCartAmount(offer, ctx) {
  const cfg = offer.config || {};
  const min = Number(cfg.minSubtotal || 0);
  if (ctx.subtotal < min) return null;
  const amt = Math.min(Number(cfg.amount || 0), ctx.subtotal);
  if (amt <= 0) return null;
  return {
    offerId: offer.id,
    name: offer.name,
    type: offer.type,
    amount: round2(amt),
    freeItems: [],
    note: `$${amt.toFixed(2)} off`,
  };
}

function evalBogo(offer, ctx) {
  // Buy 1 Get 1 (% off the cheaper one) across qualifying lines.
  const cfg = offer.config || {};
  const triggerType = cfg.triggerType || "categories";
  const ids = cfg.triggerIds || [];
  const discountPct = Number(cfg.discountPercent ?? 100); // default = free
  // Build a flat list of individual units (each qty=1 entry) with their unit price.
  const units = [];
  for (const l of ctx.items) {
    if (!lineMatches(l, triggerType, ids)) continue;
    for (let i = 0; i < l.qty; i++) units.push(l.unitPrice);
  }
  if (units.length < 2) return null;
  units.sort((a, b) => b - a); // descending — free ones are the cheaper halves
  let amt = 0;
  for (let i = 1; i < units.length; i += 2) {
    amt += units[i] * (discountPct / 100);
  }
  if (amt <= 0) return null;
  return {
    offerId: offer.id,
    name: offer.name,
    type: offer.type,
    amount: round2(amt),
    freeItems: [],
    note: discountPct >= 100 ? "Buy 1 Get 1 Free" : `Buy 1 Get 1 ${discountPct}% off`,
  };
}

function evalBuyXGetY(offer, ctx) {
  // Buy N qualifying items → entitled to reward unit(s) at rewardPrice.
  // Reward can be a specific product (rewardProductSlug) OR any item within
  // chosen categories/subcategories (rewardType=categories + rewardIds).
  const cfg = offer.config || {};
  const triggerType = cfg.triggerType || "categories";
  const ids = cfg.triggerIds || [];
  const minQty = Math.max(1, Number(cfg.minTriggerQty || 1));
  const rewardPrice = Number(cfg.rewardPrice || 0);
  const rewardType = cfg.rewardType || ((cfg.rewardSlugs?.length || cfg.rewardProductSlug) ? "product" : null);
  const rewardIds = cfg.rewardType === "category"
    ? (cfg.rewardIds || [])
    : (cfg.rewardSlugs?.length ? cfg.rewardSlugs : (cfg.rewardProductSlug ? [cfg.rewardProductSlug] : []));

  if (!rewardType || rewardIds.length === 0) return null;

  let triggerQty = 0;
  for (const l of ctx.items) {
    if (lineMatches(l, triggerType, ids)) triggerQty += l.qty;
  }
  const eligible = Math.floor(triggerQty / minQty);
  if (eligible <= 0) return null;

  // Find reward-qualifying units; exclude units already counted as trigger
  // when reward overlaps trigger (avoid discounting the items that triggered).
  const triggerUnits = [];
  const rewardUnits = [];
  for (const l of ctx.items) {
    const isTrigger = lineMatches(l, triggerType, ids);
    const isReward = rewardType === "product"
      ? (() => { const k = slugVariants(l.slug); return rewardIds.map(String).some((id) => k.has(id)); })()
      : lineMatches(l, "categories", rewardIds);

    for (let i = 0; i < l.qty; i++) {
      if (isReward) rewardUnits.push({ price: l.unitPrice, isTrigger });
      else if (isTrigger) triggerUnits.push(l.unitPrice);
    }
  }
  // Reserve trigger qty first from non-reward units, then from reward units.
  let needed = minQty * eligible;
  needed -= triggerUnits.length;
  if (needed > 0) {
    // Pull from reward units (cheapest first so the more expensive remain discountable).
    rewardUnits.sort((a, b) => a.price - b.price);
    for (const u of rewardUnits) {
      if (needed <= 0) break;
      if (u.isTrigger) { u._consumed = true; needed--; }
    }
  }
  const available = rewardUnits.filter((u) => !u._consumed);
  if (available.length === 0) {
    return {
      offerId: offer.id,
      name: offer.name,
      type: offer.type,
      amount: 0,
      freeItems: [],
      note: `Add ${cfg.rewardProductName || (rewardType === "category" ? "a qualifying item" : "the reward item")} for $${rewardPrice.toFixed(2)}`,
      pending: true,
    };
  }
  // Apply discount to up-to `eligible` reward units; pick the cheapest ones so
  // customers aren't surprised by a smaller-than-expected discount.
  available.sort((a, b) => a.price - b.price);
  const apply = Math.min(eligible, available.length);
  let amt = 0;
  for (let i = 0; i < apply; i++) {
    amt += Math.max(0, available[i].price - rewardPrice);
  }
  if (amt <= 0) return null;
  return {
    offerId: offer.id,
    name: offer.name,
    type: offer.type,
    amount: round2(amt),
    freeItems: [],
    note: `${cfg.rewardProductName || (rewardType === "category" ? "Qualifying item" : "Reward")} for $${rewardPrice.toFixed(2)}`,
  };
}

function evaluateOne(offer, ctx) {
  switch (offer.type) {
    case "cart_percent": return evalCartPercent(offer, ctx);
    case "cart_amount":  return evalCartAmount(offer, ctx);
    case "bogo":         return evalBogo(offer, ctx);
    case "buy_x_get_y":  return evalBuyXGetY(offer, ctx);
    default: return null;
  }
}

export async function loadActiveOffers() {
  const [rows] = await pool.query(
    `SELECT * FROM offers WHERE is_active = 1 ORDER BY priority DESC, sort_order ASC, id ASC`,
  );
  return rows.map((r) => ({
    ...r,
    is_active: !!r.is_active,
    stackable: !!r.stackable,
    config: safeJSON(r.config) || {},
  }));
}

export function safeJSON(s) {
  if (!s) return null;
  if (typeof s === "object") return s;
  try { return JSON.parse(s); } catch { return null; }
}

/**
 * Evaluate every active offer against a cart context.
 * Returns { adjustments: [...], totalDiscount, hints: [...] }
 */
export async function evaluateCart(ctx, opts = {}) {
  const offers = opts.offers || (await loadActiveOffers());
  const live = offers.filter((o) => isOfferLive(o, ctx.diningOption));
  // Sort: priority DESC, then non-stackable first (so they win conflicts).
  live.sort((a, b) => (b.priority - a.priority) || (Number(a.stackable) - Number(b.stackable)));

  const adjustments = [];
  const hints = [];
  let appliedNonStackable = false;

  for (const o of live) {
    if (appliedNonStackable && !o.stackable) continue;
    const r = evaluateOne(o, ctx);
    if (!r) continue;
    if (r.pending) { hints.push(r); continue; }
    adjustments.push(r);
    if (!o.stackable) appliedNonStackable = true;
  }
  const totalDiscount = round2(adjustments.reduce((s, a) => s + a.amount, 0));
  return { adjustments, hints, totalDiscount };
}
