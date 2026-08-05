/**
 * Shared 80mm thermal receipt template.
 *
 * Used by both `src/pages/admin/Orders.tsx` and `src/pages/ViewOrders.tsx`
 * (and any future surface) so a printed ticket is identical no matter who
 * clicked "Print". All conditional logic (delivery address vs staff line,
 * delivery fee, packaging fee, paid/unpaid, coupon lines, cash change) is
 * centralised here. Do not fork this file per page.
 */
import type { AdminOrder, SiteSettings } from "@/lib/api";
import { splitProductName } from "@/lib/utils";
import { formatCA } from "@/lib/datetime";
import { toast } from "sonner";
import { PAY_LABEL, computeOrderTotals, getOrderType, shouldShowStaff } from "@/lib/order-shared";

function esc(s: string | undefined | null): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function absUrl(u: string): string {
  if (!u) return "";
  if (/^https?:\/\//i.test(u) || u.startsWith("data:")) return u;
  try { return new URL(u, window.location.origin).href; } catch { return u; }
}

export function buildReceiptHTML(o: AdminOrder, s: SiteSettings): string {
  const addr = s.contact_address || s.address || "Ontario, Canada";
  const phone = s.contact_phone || "+1 (905) 800-0000";
  const email = s.contact_email || "info@flamesgourmet.ca";
  const website = "www.flamesgourmet.ca";
  const taxNumber = s.gst_number || s.tax_number || "";
  const logo = absUrl(s.logo_url || s.site_logo || "/uploads/flames-logo.png");
  const t = computeOrderTotals(o, s);
  const type = getOrderType(o);
  const qrTarget = `${window.location.origin}/o/${encodeURIComponent(o.orderNumber)}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrTarget)}`;
  const pmLabel = o.paymentMethod ? PAY_LABEL[o.paymentMethod] : "COD";

  return `<!doctype html><html><head><meta charset="utf-8"><title>#${esc(o.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 80mm; margin: 0; padding: 4mm; font-family: 'Courier New', monospace; color: #000; font-size: 12px; line-height: 1.35; }
  .c { text-align: center; }
  .r { text-align: right; }
  .b { font-weight: bold; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  .stamp { display: inline-block; border: 2px solid #1a7f1a; color: #1a7f1a; padding: 2px 10px; font-weight: bold; transform: rotate(-6deg); margin: 4px 0; }
  img.logo { max-width: 50mm; max-height: 18mm; margin-bottom: 4px; }
  img.qr { width: 28mm; height: 28mm; }
</style></head><body>
  <div class="c">
    ${logo ? `<img class="logo" src="${esc(logo)}" alt="">` : ""}
    <div>${esc(addr)}</div>
    <div>${esc(phone)}</div>
    <div>${esc(email)}</div>
    <div>${esc(website)}</div>
  </div>
  <hr>
  <div><span class="b">Order:</span> #${esc(o.orderNumber)}</div>
  <div><span class="b">Date/Time:</span> ${formatCA(o.createdAt)}</div>
  <div><span class="b">Order Type:</span> ${esc(type.label)}</div>
  <div><span class="b">Customer:</span> ${esc(o.customerName)}</div>
  <div><span class="b">Phone:</span> ${esc(o.customerPhone)}</div>
  ${t.isDelivery && o.deliveryAddress ? `<div><span class="b">Deliver to:</span> ${esc(o.deliveryAddress)}</div>` : ""}
  ${t.isDelivery && o.deliveryInstructions ? `<div><i>${esc(o.deliveryInstructions)}</i></div>` : ""}
  ${!t.isDelivery && o.pickupTime ? `<div><span class="b">Pickup:</span> ${esc(o.pickupTime)}</div>` : ""}
  ${shouldShowStaff(o) ? `<div><span class="b">Staff:</span> ${esc(o.staffUsername)}</div>` : ""}
  <hr>
  <table>
    <tr class="b"><td>Item</td><td class="r" style="width:14mm">Qty</td><td class="r" style="width:18mm">Amt</td></tr>
    ${o.items.map((it) => {
      const { title, addons } = splitProductName(it.productName);
      return `<tr><td>${esc(title)}${addons ? `<div style="font-size:10px">(${esc(addons)})</div>` : ""}</td><td class="r">${it.quantity}</td><td class="r">${it.lineTotal.toFixed(2)}</td></tr>`;
    }).join("")}
  </table>
  <hr>
  <table>
    <tr><td>Subtotal</td><td class="r">$${o.subtotal.toFixed(2)}</td></tr>
    ${o.couponCode && t.discount > 0 ? `<tr><td>Coupon (${esc(o.couponCode)})</td><td class="r">-$${t.discount.toFixed(2)}</td></tr>` : ""}
    ${o.couponCode && t.discount === 0 ? `<tr><td colspan="2">Coupon: ${esc(o.couponCode)} (free item)</td></tr>` : ""}
    ${t.taxRate ? `<tr><td>${esc(t.taxLabel)} (${t.taxRate}%)</td><td class="r">$${t.tax.toFixed(2)}</td></tr>` : ""}
    ${t.deliveryFee > 0 ? `<tr><td>Delivery</td><td class="r">$${t.deliveryFee.toFixed(2)}</td></tr>` : ""}
    ${t.packagingFee > 0 ? `<tr><td>Packaging</td><td class="r">$${t.packagingFee.toFixed(2)}</td></tr>` : ""}
    <tr class="b" style="font-size:13px"><td>TOTAL</td><td class="r">$${t.grand.toFixed(2)}</td></tr>
    <tr><td>Payment</td><td class="r">${esc(pmLabel)}</td></tr>
    ${o.paymentMethod === "cash" && o.cashReceived != null && Number(o.cashReceived) > 0 ? `
      <tr><td>Cash Received</td><td class="r">$${Number(o.cashReceived).toFixed(2)}</td></tr>
      <tr class="b"><td>Change</td><td class="r">$${Math.max(0, Number(o.cashReceived) - t.grand).toFixed(2)}</td></tr>
    ` : ""}
  </table>
  ${o.paidAt ? `<div class="c"><div class="stamp">PAID</div></div>` : `<div class="c">UNPAID (COD)</div>`}
  ${o.notes ? `<hr><div><i>Note: ${esc(o.notes)}</i></div>` : ""}
  <hr>
  <div class="c"><img class="qr" src="${qr}" alt=""></div>
  <div class="c" style="margin-top:6px">
    ${taxNumber ? `<div>Tax No: ${esc(taxNumber)}</div>` : ""}
    <div style="margin-top:4px">Thank you for your business!</div>
  </div>
  <script>window.onload = () => { window.focus(); window.print(); setTimeout(() => window.close(), 600); };</script>
</body></html>`;
}

export function printReceipt(o: AdminOrder, s: SiteSettings): void {
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) { toast.error("Pop-up blocked. Allow pop-ups to print."); return; }
  w.document.write(buildReceiptHTML(o, s));
  w.document.close();
}
