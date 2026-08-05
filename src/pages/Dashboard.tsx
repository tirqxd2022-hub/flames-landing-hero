import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ClipboardList, PlusCircle, ShieldCheck, UserCog, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchMyOrders, fetchAdminOrders, ROLE_LABEL, type AdminOrder } from "@/lib/api";
import { formatCA } from "@/lib/datetime";

export default function Dashboard() {
  const { user, loading, isStaff, canAdminPanel } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  useEffect(() => {
    if (!user) return;
    const fn = isStaff ? fetchAdminOrders : fetchMyOrders;
    fn().then(setOrders).catch(() => {});
  }, [user, isStaff]);

  if (loading) return <section className="pt-32 pb-20 text-center text-muted-foreground">Loading…</section>;
  if (!user) return <Navigate to="/" replace />;

  const total = orders.reduce((s, o) => s + (o.subtotal || 0), 0);
  const recent = orders.slice(0, 6);

  return (
    <section className="pt-28 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-[color:var(--flame)] grid place-items-center text-white">
            <UserIcon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user.name}</h1>
            <p className="text-sm text-muted-foreground">{user.email} · <span className="uppercase tracking-wider text-[color:var(--gold)]">{ROLE_LABEL[user.is_super ? "super" : user.role] || user.role}</span></p>
          </div>
        </div>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          <Stat label="Orders" value={String(orders.length)} />
          <Stat label={isStaff ? "Revenue" : "Total spent"} value={`$${total.toFixed(2)}`} />
          <Stat label="Account type" value={ROLE_LABEL[user.is_super ? "super" : user.role] || user.role} />
        </div>

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickLink to="/orders" icon={ClipboardList} label="View orders" />
          {isStaff && <QuickLink to="/create-order" icon={PlusCircle} label="Create order" />}
          {canAdminPanel && <QuickLink to="/admin" icon={ShieldCheck} label="Admin panel" />}
          <QuickLink to="/profile" icon={UserCog} label="Your profile" />
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-bold mb-4">Recent orders</h2>
          <div className="rounded-2xl bg-[color:var(--card)] border border-white/5 overflow-hidden">
            {recent.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">No orders yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
                  <tr><th className="text-left px-4 py-3">Order</th><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Total</th></tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.orderNumber} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 font-bold">#{o.orderNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatCA(o.createdAt)}</td>
                      <td className="px-4 py-3 text-xs uppercase tracking-wider">{o.status.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-right font-bold text-[color:var(--flame-light)]">${o.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[color:var(--card)] border border-white/5 p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-bold text-white">{value}</div>
    </div>
  );
}
function QuickLink({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link to={to} className="rounded-xl bg-[color:var(--card)] border border-white/5 p-4 flex items-center gap-3 hover:border-[color:var(--flame)]/50 transition">
      <div className="h-10 w-10 rounded-full grid place-items-center bg-[color:var(--flame)]/15 text-[color:var(--flame-light)]"><Icon className="h-4 w-4" /></div>
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  );
}
