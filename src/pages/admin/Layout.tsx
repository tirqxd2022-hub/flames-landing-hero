import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BarChart3, Boxes, ExternalLink, FileImage, Gift, GripVertical, HelpCircle, Image as ImageIcon, Inbox, KeyRound, LayoutDashboard, LogOut, Mail, Megaphone, MessageSquare, Search, Settings as SettingsIcon, ShoppingBag, Star, Tag, User, Users as UsersIcon, UtensilsCrossed } from "lucide-react";
import { useSiteSettings } from "@/hooks/use-site-settings";
const LOGO_FALLBACK = "/uploads/flames-logo.png";
import { adminApi, resolveAssetUrl, type AdminMe } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";
import FeedbackModal from "@/components/FeedbackModal";
import AssistantBubble from "@/components/admin/AssistantBubble";
import LogoutChoiceModal from "@/components/auth/LogoutChoiceModal";
import { useAuth } from "@/lib/auth";
import { formatCA } from "@/lib/datetime";

const NAV: Array<{ to: string; label: string; key: string; icon: React.ComponentType<{ className?: string }> }> = [
  { to: "/admin/dashboard", label: "Dashboard", key: "dashboard", icon: LayoutDashboard },
  { to: "/admin/orders", label: "Orders", key: "orders", icon: ShoppingBag },
  { to: "/admin/menu", label: "Menu", key: "menu", icon: UtensilsCrossed },
  { to: "/admin/inventory", label: "Inventory", key: "inventory", icon: Boxes },
  { to: "/admin/reports", label: "Reports", key: "reports", icon: BarChart3 },
  { to: "/admin/media", label: "Media", key: "media", icon: ImageIcon },
  { to: "/admin/page-images", label: "Page Images", key: "page-images", icon: FileImage },
  { to: "/admin/newsletter", label: "Newsletter", key: "newsletter", icon: Mail },
  { to: "/admin/customers", label: "Customers", key: "customers", icon: User },
  { to: "/admin/reviews", label: "Reviews", key: "reviews", icon: Star },
  { to: "/admin/submissions", label: "Submissions", key: "submissions", icon: Inbox },
  { to: "/admin/coupons", label: "Coupons", key: "coupons", icon: Tag },
  { to: "/admin/promotions", label: "Promotions", key: "promotions", icon: Megaphone },
  { to: "/admin/offers", label: "Offers", key: "offers", icon: Gift },
  { to: "/admin/seo", label: "SEO Tools", key: "seo", icon: Search },
  { to: "/admin/settings", label: "Settings", key: "settings", icon: SettingsIcon },
  { to: "/admin/users", label: "Users", key: "users", icon: UsersIcon },
  { to: "/admin/account", label: "Change password", key: "account", icon: KeyRound },
];

function applyOrder<T extends { key: string }>(items: T[], order: string[] | null | undefined): T[] {
  if (!order || !order.length) return items;
  const byKey = new Map(items.map((i) => [i.key, i]));
  const out: T[] = [];
  for (const k of order) {
    const it = byKey.get(k);
    if (it) { out.push(it); byKey.delete(k); }
  }
  for (const it of items) if (byKey.has(it.key)) out.push(it);
  return out;
}

export default function AdminLayout() {
  const nav = useNavigate();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [orderedNav, setOrderedNav] = useState(NAV);
  const dragKey = useRef<string | null>(null);
  const settings = useSiteSettings() as Record<string, string>;
  const logoUrl = resolveAssetUrl(settings.logo_url || LOGO_FALLBACK);
  const { logout, user } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  async function handleLogout(checkOut: boolean) {
    try {
      const r = await logout({ checkOut });
      if (checkOut && r.attendance?.check_out_at) {
        toast.success(`Checked out at ${formatCA(r.attendance.check_out_at)}`);
      }
    } catch { /* ignore */ }
    setLogoutOpen(false);
    nav("/admin/login");
  }

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      nav("/admin/login", { replace: true });
      return;
    }
    adminApi.me()
      .then((r) => {
        setMe(r.user);
        setOrderedNav(applyOrder(NAV, r.user.navOrder));
      })
      .catch(() => {
        localStorage.removeItem("admin_token");
        nav("/admin/login", { replace: true });
      });
  }, [nav]);

  const visibleNav = orderedNav.filter((n) => {
    if (!me) return false; // wait until role loads to avoid flashing unauthorized items
    if (me.is_super) return true;
    if (n.key === "dashboard") return true;
    if (n.key === "account") return false; // change password is super-admin only
    return me.permissions.includes(n.key);
  });

  const canReorder = !!me && me.is_super;



  function onDragStart(key: string) { dragKey.current = key; }
  function onDragOver(e: React.DragEvent) { if (canReorder) e.preventDefault(); }
  function onDrop(targetKey: string) {
    const src = dragKey.current;
    dragKey.current = null;
    if (!src || src === targetKey || !canReorder) return;
    const next = orderedNav.slice();
    const from = next.findIndex((n) => n.key === src);
    const to = next.findIndex((n) => n.key === targetKey);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrderedNav(next);
    adminApi.updateNavOrder(next.map((n) => n.key))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to save order"));
  }


  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[240px_1fr] bg-[color:var(--background)]">
      <aside className="border-r border-white/5 bg-[color:var(--card)] p-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] flex flex-col lg:sticky lg:top-0 lg:h-screen min-h-0">
        <Link to="/" className="flex items-center justify-center w-full">
          <OptimizedImage src={settings.logo_url || LOGO_FALLBACK} alt="Flames Gourmet" width={240} height={72} fit="contain" priority className="h-16 w-full max-w-[200px] object-contain" />
        </Link>
        {me && (() => {
          const firstName = (me.full_name?.trim().split(/\s+/)[0]) || me.username;
          const roleLabel = me.is_super
            ? "Super Admin"
            : ({ admin: "Admin", kitchen_manager: "Kitchen Manager", counter_sales: "Counter Sales", store_manager: "Store Manager", seo_manager: "SEO Manager", guest: "Guest (Read-only)" } as Record<string, string>)[me.role] || me.role;
          const hr = new Date().getHours();
          const greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
          return (
            <div className="mt-4 rounded-md border border-white/10 bg-background/40 p-3 text-xs">
              <div className="text-muted-foreground">{greet},</div>
              <div className="font-semibold text-white truncate">{firstName}</div>
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--gold)] mt-0.5">{roleLabel}</div>
            </div>
          );
        })()}
        <nav className="mt-6 flex flex-col gap-1 text-sm flex-1 min-h-0 lg:overflow-y-auto">
          {visibleNav.map((n) => (
            <div
              key={n.to}
              draggable={canReorder}
              onDragStart={() => onDragStart(n.key)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(n.key)}
              className={canReorder ? "group relative" : undefined}
            >
              <NavLink to={n.to}
                className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-lg ${isActive ? "bg-[color:var(--flame)] text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}>
                {canReorder && (
                  <GripVertical className="h-3.5 w-3.5 opacity-40 cursor-grab active:cursor-grabbing" aria-hidden="true" />
                )}
                <n.icon className="h-4 w-4" /> {n.label}
              </NavLink>
            </div>
          ))}
          {canReorder && (
            <p className="mt-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground/60">Drag to reorder</p>
          )}
        </nav>
        <BottomActions onSignOut={() => {
          if (user?.is_super) { void handleLogout(false); }
          else { setLogoutOpen(true); }
        }} />
      </aside>
      <main className="relative p-6 sm:p-10 lg:pr-10">
        <div className="sticky top-0 z-40 -mx-6 sm:-mx-10 mb-4 flex items-center justify-end gap-2 border-b border-white/5 bg-[color:var(--background)]/85 backdrop-blur px-4 sm:px-6 py-2">
          <Link
            to="/help"
            target="_blank"
            rel="noreferrer"
            title="Help & User Manual"
            aria-label="Help"
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[color:var(--card)]/90 px-3 py-1.5 text-xs text-muted-foreground hover:text-[color:var(--flame)] hover:border-[color:var(--flame)]/40 shadow-sm"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Help</span>
          </Link>
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            title="Send feedback to the developer"
            aria-label="Feedback"
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[color:var(--card)]/90 px-3 py-1.5 text-xs text-muted-foreground hover:text-[color:var(--flame)] hover:border-[color:var(--flame)]/40 shadow-sm"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Feedback</span>
          </button>
        </div>
        <Outlet />
        <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
        <AssistantBubble visible={!!me && (me.is_super || me.role === "admin")} />
        <LogoutChoiceModal
          open={logoutOpen}
          userName={user?.name || me?.username || "Admin"}
          onCancel={() => setLogoutOpen(false)}
          onConfirm={handleLogout}
        />
      </main>
    </div>
  );
}

function BottomActions({ onSignOut }: { onSignOut: () => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [iconOnly, setIconOnly] = useState(false);

  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const check = () => {
      // Temporarily show full labels to measure natural width
      setIconOnly(false);
      requestAnimationFrame(() => {
        if (!rowRef.current) return;
        setIconOnly(rowRef.current.scrollWidth > rowRef.current.clientWidth + 1);
      });
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={rowRef}
      className="mt-2 flex items-stretch divide-x divide-white/10 rounded-md border border-white/10 bg-background/40 overflow-hidden"
    >
      <a
        href="/" target="_blank" rel="noreferrer"
        title="View Site"
        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-white hover:bg-white/5 whitespace-nowrap"
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
        {!iconOnly && <span>View Site</span>}
      </a>
      <button
        onClick={onSignOut}
        title="Sign out"
        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-white hover:bg-white/5 whitespace-nowrap"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {!iconOnly && <span>Sign out</span>}
      </button>
    </div>
  );
}
