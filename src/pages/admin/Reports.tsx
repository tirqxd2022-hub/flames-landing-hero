import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAdminOrders, fetchSiteSettings, type AdminOrder, type SiteSettings } from "@/lib/api";
import { loadInventory, type InventoryItem } from "@/lib/inventory";
import { formatCA } from "@/lib/datetime";
import AdminAttendance from "./Attendance";


function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminReports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [preset, setPreset] = useState<string>("custom");
  const [fromDraft, setFromDraft] = useState(monthAgo);
  const [toDraft, setToDraft] = useState(today);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  function fmt(d: Date) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function applyPreset(p: string) {
    setPreset(p);
    if (p === "custom") return;
    const now = new Date();
    let f = new Date(now), t = new Date(now);
    if (p === "today") { /* both = today */ }
    else if (p === "yesterday") { f.setDate(now.getDate() - 1); t = new Date(f); }
    else if (p === "last7") { f.setDate(now.getDate() - 6); }
    else if (p === "last30") { f.setDate(now.getDate() - 29); }
    else if (p === "lastMonth") {
      f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      t = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (p === "lastYear") {
      f = new Date(now.getFullYear() - 1, 0, 1);
      t = new Date(now.getFullYear() - 1, 11, 31);
    }
    const fs = fmt(f), ts = fmt(t);
    setFromDraft(fs); setToDraft(ts); setFrom(fs); setTo(ts);
  }

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [inv, setInv] = useState<InventoryItem[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({});
  const [costPct, setCostPct] = useState(35); // assumed COGS % until inventory is linked
  const [expenses, setExpenses] = useState(0);

  useEffect(() => {
    fetchAdminOrders().then(setOrders).catch(() => setOrders([]));
    fetchSiteSettings().then(setSettings).catch(() => {});
    setInv(loadInventory());
  }, []);


  const filteredOrders = useMemo(() => {
    const f = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
    const t = to ? new Date(to + "T23:59:59").getTime() : Infinity;
    return orders.filter((o) => {
      const ts = new Date(o.createdAt).getTime();
      // Only paid, non-cancelled orders count as actual sales.
      return ts >= f && ts <= t && o.status !== "cancelled" && !!o.paidAt;
    });
  }, [orders, from, to]);

  const sales = filteredOrders.reduce((s, o) => s + Number(o.subtotal || 0), 0);
  const orderCount = filteredOrders.length;
  const avgOrder = orderCount ? sales / orderCount : 0;
  const stockValue = inv.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const cogs = (sales * costPct) / 100;
  const grossProfit = sales - cogs;
  const netProfit = grossProfit - expenses;

  // Sales by day
  const byDay = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    filteredOrders.forEach((o) => {
      const d = new Date(o.createdAt).toISOString().slice(0, 10);
      const cur = map.get(d) || { count: 0, total: 0 };
      cur.count += 1; cur.total += Number(o.subtotal || 0);
      map.set(d, cur);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredOrders]);

  // Top products
  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; total: number }>();
    filteredOrders.forEach((o) => o.items.forEach((it) => {
      const cur = map.get(it.productName) || { qty: 0, total: 0 };
      cur.qty += it.quantity; cur.total += Number(it.lineTotal || 0);
      map.set(it.productName, cur);
    }));
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total).slice(0, 20);
  }, [filteredOrders]);

  // Tax calculations
  const taxRate = parseFloat(settings.gst_rate_percent || settings.tax_rate || "0") || 0;
  const taxLabel = settings.tax_label || (taxRate ? "GST/HST" : "Tax");
  const taxNumber = settings.gst_number || settings.tax_number || "";
  const packagingFeeSetting = parseFloat(settings.delivery_packaging_fee || "0") || 0;

  const taxRows = useMemo(() => {
    return filteredOrders.map((o) => {
      const sub = Number(o.subtotal || 0);
      const disc = Number(o.discount || 0);
      const base = Math.max(0, sub - disc);
      const tax = Math.round(base * (taxRate / 100) * 100) / 100;
      const isDel = (o.diningOption as string) === "delivery";
      const delFee = isDel ? Number(o.deliveryFee || 0) : 0;
      const pkgFee = isDel ? packagingFeeSetting : 0;
      const total = Math.round((base + tax + delFee + pkgFee) * 100) / 100;
      return {
        orderNumber: o.orderNumber,
        date: o.createdAt,
        customer: o.customerName,
        payment: o.paidAt ? (o.paymentMethod || "cash") : "unpaid",
        subtotal: sub, discount: disc, taxable: base, tax,
        deliveryFee: delFee, packagingFee: pkgFee, total,
      };
    });
  }, [filteredOrders, taxRate, packagingFeeSetting]);

  const taxTotals = useMemo(() => taxRows.reduce((a, r) => ({
    subtotal: a.subtotal + r.subtotal, discount: a.discount + r.discount,
    taxable: a.taxable + r.taxable, tax: a.tax + r.tax, total: a.total + r.total,
  }), { subtotal: 0, discount: 0, taxable: 0, tax: 0, total: 0 }), [taxRows]);

  const taxByDay = useMemo(() => {
    const m = new Map<string, { count: number; taxable: number; tax: number; total: number }>();
    taxRows.forEach((r) => {
      const d = new Date(r.date).toISOString().slice(0, 10);
      const cur = m.get(d) || { count: 0, taxable: 0, tax: 0, total: 0 };
      cur.count++; cur.taxable += r.taxable; cur.tax += r.tax; cur.total += r.total;
      m.set(d, cur);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [taxRows]);

  const taxByPayment = useMemo(() => {
    const m = new Map<string, { count: number; taxable: number; tax: number; total: number }>();
    taxRows.forEach((r) => {
      const cur = m.get(r.payment) || { count: 0, taxable: 0, tax: 0, total: 0 };
      cur.count++; cur.taxable += r.taxable; cur.tax += r.tax; cur.total += r.total;
      m.set(r.payment, cur);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [taxRows]);

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Sales, stock, costing and P&amp;L summaries.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Range</Label>
          <select
            value={preset}
            onChange={(e) => applyPreset(e.target.value)}
            className="h-9 rounded-md border border-input bg-card text-foreground px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring [&>option]:bg-card [&>option]:text-foreground"
            style={{ colorScheme: "dark" }}
          >
            <option value="custom">Custom</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="lastMonth">Last Month</option>
            <option value="lastYear">Last Year</option>
          </select>
        </div>
        <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={fromDraft} onChange={(e) => { setFromDraft(e.target.value); setPreset("custom"); }} /></div>
        <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={toDraft} onChange={(e) => { setToDraft(e.target.value); setPreset("custom"); }} /></div>
        <Button onClick={() => { setFrom(fromDraft); setTo(toDraft); }}>Apply</Button>
      </div>

      <Tabs defaultValue={new URLSearchParams(window.location.search).get("tab") || "sales"}>
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="costing">Costing</TabsTrigger>
          <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Total sales" value={`$${sales.toFixed(2)}`} />
            <Stat label="Orders" value={String(orderCount)} />
            <Stat label="Average order" value={`$${avgOrder.toFixed(2)}`} />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Sales by day</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCsv("sales-by-day.csv", [["Date","Orders","Total"], ...byDay.map(([d,v]) => [d, v.count, v.total.toFixed(2)])])}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {byDay.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No sales in range.</TableCell></TableRow>}
                  {byDay.map(([d, v]) => (
                    <TableRow key={d}><TableCell>{d}</TableCell><TableCell className="text-right">{v.count}</TableCell><TableCell className="text-right">${v.total.toFixed(2)}</TableCell></TableRow>
                  ))}
                  {byDay.length > 0 && (
                    <TableRow className="font-semibold bg-white/5"><TableCell>Total</TableCell><TableCell className="text-right">{byDay.reduce((s, [, v]) => s + v.count, 0)}</TableCell><TableCell className="text-right">${byDay.reduce((s, [, v]) => s + v.total, 0).toFixed(2)}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Top products</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCsv("top-products.csv", [["Product","Qty","Total"], ...topProducts.map((p) => [p.name, p.qty, p.total.toFixed(2)])])}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {topProducts.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No data.</TableCell></TableRow>}
                  {topProducts.map((p) => (
                    <TableRow key={p.name}><TableCell>{p.name}</TableCell><TableCell className="text-right">{p.qty}</TableCell><TableCell className="text-right">${p.total.toFixed(2)}</TableCell></TableRow>
                  ))}
                  {topProducts.length > 0 && (
                    <TableRow className="font-semibold bg-white/5"><TableCell>Total</TableCell><TableCell className="text-right">{topProducts.reduce((s, p) => s + p.qty, 0)}</TableCell><TableCell className="text-right">${topProducts.reduce((s, p) => s + p.total, 0).toFixed(2)}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="SKUs" value={String(inv.length)} />
            <Stat label="Stock value" value={`$${stockValue.toFixed(2)}`} />
            <Stat label="Low-stock items" value={String(inv.filter((i) => i.reorderLevel != null && i.quantity <= (i.reorderLevel || 0)).length)} />
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Stock report</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCsv("stock-report.csv", [["Name","SKU","Unit","Qty","Unit cost","Value","Reorder","Supplier"], ...inv.map((i) => [i.name, i.sku || "", i.unit, i.quantity, i.unitCost.toFixed(2), (i.quantity * i.unitCost).toFixed(2), i.reorderLevel ?? "", i.supplier || ""])])}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit cost</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                <TableBody>
                  {inv.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No inventory yet.</TableCell></TableRow>}
                  {inv.map((i) => (
                    <TableRow key={i.id}><TableCell>{i.name}</TableCell><TableCell>{i.unit}</TableCell><TableCell className="text-right">{i.quantity}</TableCell><TableCell className="text-right">${i.unitCost.toFixed(2)}</TableCell><TableCell className="text-right">${(i.quantity * i.unitCost).toFixed(2)}</TableCell></TableRow>
                  ))}
                  {inv.length > 0 && (
                    <TableRow className="font-semibold bg-white/5"><TableCell colSpan={2}>Total</TableCell><TableCell className="text-right">{inv.reduce((s, i) => s + i.quantity, 0)}</TableCell><TableCell className="text-right">—</TableCell><TableCell className="text-right">${stockValue.toFixed(2)}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costing" className="space-y-4">
          <p className="text-sm text-muted-foreground">Inventory is not linked to products yet. Use assumed COGS % to estimate cost of goods sold for the selected period.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div><Label className="text-xs text-muted-foreground">Assumed COGS %</Label><Input type="number" value={costPct} onChange={(e) => setCostPct(Number(e.target.value))} className="w-32" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Sales" value={`$${sales.toFixed(2)}`} />
            <Stat label="Estimated COGS" value={`$${cogs.toFixed(2)}`} />
            <Stat label="Gross profit" value={`$${grossProfit.toFixed(2)}`} />
          </div>
          <Button variant="outline" size="sm" onClick={() => downloadCsv("costing-report.csv", [["Metric","Value"], ["Sales", sales.toFixed(2)], ["COGS %", costPct], ["COGS", cogs.toFixed(2)], ["Gross profit", grossProfit.toFixed(2)]])}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </TabsContent>

        <TabsContent value="pnl" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div><Label className="text-xs text-muted-foreground">COGS %</Label><Input type="number" value={costPct} onChange={(e) => setCostPct(Number(e.target.value))} className="w-28" /></div>
            <div><Label className="text-xs text-muted-foreground">Other expenses (CAD)</Label><Input type="number" value={expenses} onChange={(e) => setExpenses(Number(e.target.value))} className="w-40" /></div>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Profit &amp; Loss · {from} → {to}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <Row label="Revenue (sales)" value={sales} />
                  <Row label={`Cost of goods sold (${costPct}%)`} value={-cogs} />
                  <Row label="Gross profit" value={grossProfit} bold />
                  <Row label="Operating expenses" value={-expenses} />
                  <Row label="Net profit" value={netProfit} bold />
                </TableBody>
              </Table>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => downloadCsv("pnl.csv", [["Item","Amount"], ["Revenue", sales.toFixed(2)], ["COGS", (-cogs).toFixed(2)], ["Gross profit", grossProfit.toFixed(2)], ["Expenses", (-expenses).toFixed(2)], ["Net profit", netProfit.toFixed(2)]])}>
                  <Download className="h-4 w-4" /> Export
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          {taxRate <= 0 && (
            <p className="text-sm text-amber-400">No tax rate configured. Set it under Settings → Tax to enable tax reports.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Stat label={`${taxLabel} rate`} value={`${taxRate.toFixed(2)}%`} />
            <Stat label="Taxable sales" value={`$${taxTotals.taxable.toFixed(2)}`} />
            <Stat label={`${taxLabel} collected`} value={`$${taxTotals.tax.toFixed(2)}`} />
            <Stat label="Gross total" value={`$${taxTotals.total.toFixed(2)}`} />
          </div>
          {taxNumber && <p className="text-xs text-muted-foreground">Tax No: {taxNumber}</p>}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Tax summary by day</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCsv(`tax-by-day-${from}_${to}.csv`, [
                ["Date", "Orders", "Taxable", `${taxLabel} (${taxRate}%)`, "Total"],
                ...taxByDay.map(([d, v]) => [d, v.count, v.taxable.toFixed(2), v.tax.toFixed(2), v.total.toFixed(2)]),
                ["TOTAL", taxRows.length, taxTotals.taxable.toFixed(2), taxTotals.tax.toFixed(2), taxTotals.total.toFixed(2)],
              ])}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">{taxLabel}</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {taxByDay.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No taxable sales in range.</TableCell></TableRow>}
                  {taxByDay.map(([d, v]) => (
                    <TableRow key={d}>
                      <TableCell>{d}</TableCell>
                      <TableCell className="text-right">{v.count}</TableCell>
                      <TableCell className="text-right">${v.taxable.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${v.tax.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${v.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {taxByDay.length > 0 && (
                    <TableRow className="font-semibold bg-white/5">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{taxRows.length}</TableCell>
                      <TableCell className="text-right">${taxTotals.taxable.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${taxTotals.tax.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${taxTotals.total.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Tax by payment method</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCsv(`tax-by-payment-${from}_${to}.csv`, [
                ["Payment", "Orders", "Taxable", `${taxLabel} (${taxRate}%)`, "Total"],
                ...taxByPayment.map(([p, v]) => [p, v.count, v.taxable.toFixed(2), v.tax.toFixed(2), v.total.toFixed(2)]),
              ])}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Payment</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">{taxLabel}</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {taxByPayment.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No data.</TableCell></TableRow>}
                  {taxByPayment.map(([p, v]) => (
                    <TableRow key={p}>
                      <TableCell className="capitalize">{p}</TableCell>
                      <TableCell className="text-right">{v.count}</TableCell>
                      <TableCell className="text-right">${v.taxable.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${v.tax.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${v.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {taxByPayment.length > 0 && (
                    <TableRow className="font-semibold bg-white/5">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{taxRows.length}</TableCell>
                      <TableCell className="text-right">${taxTotals.taxable.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${taxTotals.tax.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${taxTotals.total.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Detailed tax report (per order)</CardTitle>
              <Button variant="outline" size="sm" onClick={() => downloadCsv(`tax-detailed-${from}_${to}.csv`, [
                ["Order #", "Date", "Customer", "Payment", "Subtotal", "Discount", "Taxable", `${taxLabel} (${taxRate}%)`, "Total"],
                ...taxRows.map((r) => [r.orderNumber, formatCA(r.date), r.customer, r.payment, r.subtotal.toFixed(2), r.discount.toFixed(2), r.taxable.toFixed(2), r.tax.toFixed(2), r.total.toFixed(2)]),
                ["TOTAL", "", "", "", taxTotals.subtotal.toFixed(2), taxTotals.discount.toFixed(2), taxTotals.taxable.toFixed(2), taxTotals.tax.toFixed(2), taxTotals.total.toFixed(2)],
              ])}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Order #</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">{taxLabel}</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {taxRows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No orders in range.</TableCell></TableRow>}
                  {taxRows.map((r) => (
                    <TableRow key={r.orderNumber}>
                      <TableCell className="font-medium">#{r.orderNumber}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatCA(r.date)}</TableCell>
                      <TableCell>{r.customer}</TableCell>
                      <TableCell className="capitalize text-xs">{r.payment}</TableCell>
                      <TableCell className="text-right">${r.subtotal.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${r.taxable.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${r.tax.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${r.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {taxRows.length > 0 && (
                    <TableRow className="font-semibold bg-white/5">
                      <TableCell colSpan={4}>Total ({taxRows.length})</TableCell>
                      <TableCell className="text-right">${taxTotals.subtotal.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${taxTotals.taxable.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${taxTotals.tax.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${taxTotals.total.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <AdminAttendance from={from} to={to} />
        </TabsContent>
      </Tabs>

    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <TableRow>
      <TableCell className={bold ? "font-semibold" : ""}>{label}</TableCell>
      <TableCell className={`text-right ${bold ? "font-semibold" : ""} ${value < 0 ? "text-red-400" : ""}`}>
        {value < 0 ? "-" : ""}${Math.abs(value).toFixed(2)}
      </TableCell>
    </TableRow>
  );
}
