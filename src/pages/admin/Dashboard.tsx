import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Boxes, DollarSign, Inbox, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchAdminOrders, menuApi, submissionsApi, type AdminOrder, type AdminProduct } from "@/lib/api";
import { loadInventory, type InventoryItem } from "@/lib/inventory";

// Start of "today" in America/Toronto, returned as a UTC epoch ms.
function startOfDay(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((a, p) => { if (p.type !== "literal") a[p.type] = p.value; return a; }, {});
  const y = Number(parts.year), m = Number(parts.month), day = Number(parts.day);
  const h = Number(parts.hour) % 24, mi = Number(parts.minute), s = Number(parts.second);
  // Offset between Toronto wall clock and UTC for this instant, in ms.
  const offsetMs = Date.UTC(y, m - 1, day, h, mi, s) - d.getTime();
  // Midnight in Toronto (as UTC epoch) = UTC midnight of that date - offset.
  return Date.UTC(y, m - 1, day) - offsetMs;
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [inv, setInv] = useState<InventoryItem[]>([]);
  const [subs, setSubs] = useState<{ today: number; total: number }>({ today: 0, total: 0 });

  useEffect(() => {
    fetchAdminOrders().then(setOrders).catch(() => setOrders([]));
    menuApi.listProducts().then(setProducts).catch(() => setProducts([]));
    setInv(loadInventory());
    submissionsApi.list({ page: 1, limit: 200, filter: "all" })
      .then((r) => {
        const today = startOfDay();
        const todayCount = r.items.filter((s) => new Date(s.createdAt).getTime() >= today).length;
        setSubs({ today: todayCount, total: r.total });
      })
      .catch(() => setSubs({ today: 0, total: 0 }));
  }, []);

  const stats = useMemo(() => {
    const today = startOfDay();
    const monthAgo = today - 29 * 86400000;
    const todays = orders.filter((o) => new Date(o.createdAt).getTime() >= today);
    const month = orders.filter((o) => new Date(o.createdAt).getTime() >= monthAgo);
    const pending = todays.filter((o) => o.status === "new" || o.status === "preparing");
    const revenueToday = todays.reduce((s, o) => s + (o.subtotal || 0), 0);
    const revenueMonth = month.reduce((s, o) => s + (o.subtotal || 0), 0);
    const lowStock = inv.filter((i) => typeof i.reorderLevel === "number" && i.quantity <= (i.reorderLevel || 0));
    const featured = products.filter((p) => p.is_featured).length;
    return { todayCount: todays.length, monthCount: month.length, pending: pending.length, revenueToday, revenueMonth, lowStock, featured, productCount: products.length };
  }, [orders, products, inv]);

  const recent = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
    [orders],
  );

  const cards = [
    { label: "Orders today", value: stats.todayCount, icon: ShoppingBag, hint: `${stats.pending} pending` },
    { label: "Revenue today", value: `$${stats.revenueToday.toFixed(2)}`, icon: DollarSign, hint: `30d: $${stats.revenueMonth.toFixed(2)}` },
    { label: "Menu items", value: stats.productCount, icon: UtensilsCrossed, hint: `${stats.featured} featured` },
    { label: "Low stock", value: stats.lowStock.length, icon: Boxes, hint: stats.lowStock.length ? "Reorder required" : "All good" },
    { label: "Submissions today", value: subs.today, icon: Inbox, hint: `${subs.total} total` },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of orders, menu and inventory.</p>
        </div>
        <Link to="/admin/reports" className="inline-flex items-center gap-2 text-sm text-[color:var(--gold)] hover:underline">
          <BarChart3 className="h-4 w-4" /> View reports
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{c.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent orders</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((o) => (
                    <TableRow key={o.orderNumber}>
                      <TableCell className="font-mono text-xs">
                        <Link to="/admin/orders" className="hover:underline">#{o.orderNumber}</Link>
                      </TableCell>
                      <TableCell>{o.customerName}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{o.status}</Badge></TableCell>
                      <TableCell className="text-right">${o.subtotal.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Low stock items</CardTitle></CardHeader>
          <CardContent>
            {stats.lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing below reorder level.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Reorder at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.lowStock.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.name}</TableCell>
                      <TableCell>{i.quantity} {i.unit}</TableCell>
                      <TableCell>{i.reorderLevel} {i.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
