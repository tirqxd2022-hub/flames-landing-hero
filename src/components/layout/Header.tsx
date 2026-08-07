import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Menu as MenuIcon, Minus, Plus, Search, ShoppingBag, Trash2, User, UserCog, X, LayoutDashboard, ShieldCheck, ClipboardList, PlusCircle, ChefHat, Megaphone } from "lucide-react";
import SearchOverlay from "@/components/SearchOverlay";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import LoginModal from "@/components/auth/LoginModal";
import LogoutChoiceModal from "@/components/auth/LogoutChoiceModal";
import { fetchCategories, resolveAssetUrl } from "@/lib/api";
import { formatCA } from "@/lib/datetime";
import { toast } from "sonner";
import OptimizedImage from "@/components/OptimizedImage";
import type { Category } from "@/lib/mock-data";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { splitProductName } from "@/lib/utils";

const LOGO_FALLBACK = "/uploads/flames-logo.png";

const nav = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu", dropdown: true },
  { to: "/shop", label: "Shop" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedMobile, setExpandedMobile] = useState<Record<string, boolean>>({});
  const [subsByCat, setSubsByCat] = useState<Record<string, { slug: string; name: string }[]>>({});
  const { items, count, subtotal, setQty, remove } = useCart();
  const { user, isStaff, logout } = useAuth();
  // Controlled from Admin → Users → Role management ("User pages" section)
  const can = (key: string) => {
    if (!user) return false;
    if (user.is_super) return true;
    if (!isStaff) return true; // customers see the standard customer menu
    return !!user.permissions?.includes(key);
  };
  const showDashboard = can("user_dashboard");
  const showProfile = can("user_profile");
  const showAdminPanel = isStaff && can("user_admin_panel");
  const showCreateOrder = isStaff && can("user_create_order");
  const showCurrentOrders = isStaff && can("user_current_orders");
  const showViewOrders = can("user_orders");
  const showPromotions = can("user_promotions");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const settings = useSiteSettings() as Record<string, string>;
  const logoUrl = resolveAssetUrl(settings.logo_url || LOGO_FALLBACK);

  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "/api";
  const toggleMobileCat = async (slug: string) => {
    setExpandedMobile((m) => ({ ...m, [slug]: !m[slug] }));
    if (!subsByCat[slug]) {
      try {
        const r = await fetch(`${apiBase}/categories/${slug}/subcategories`);
        const data = await r.json().catch(() => []);
        const list = Array.isArray(data) ? data : (data.items ?? []);
        setSubsByCat((s) => ({ ...s, [slug]: list.map((x: { slug: string; name: string }) => ({ slug: x.slug, name: x.name })) }));
      } catch { setSubsByCat((s) => ({ ...s, [slug]: [] })); }
    }
  };

  useEffect(() => {
    fetchCategories()
      .then((rows) => setCategories(rows.filter((c) => (c.itemCount ?? 0) > 0 && c.slug !== "packaged-food")))
      .catch(() => {});
  }, []);

  const cartBtnRef = useRef<HTMLAnchorElement | null>(null);
  const [cartInView, setCartInView] = useState(true);
  useEffect(() => {
    const el = cartBtnRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setCartInView(entry.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);


  function handleLogoutClick() {
    if (isStaff && !user?.is_super) {
      setUserMenuOpen(false);
      setLogoutOpen(true);
    } else {
      void logout().then(() => navigate("/"));
    }
  }

  async function handleLogoutConfirm(checkOut: boolean) {
    try {
      const r = await logout({ checkOut });
      if (checkOut && r.attendance?.check_out_at) {
        toast.success(`Checked out at ${formatCA(r.attendance.check_out_at)}`);
      }
    } catch { /* ignore */ }
    setLogoutOpen(false);
    navigate("/");
  }

  return (
    <header className="absolute top-0 inset-x-0 z-30 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center" aria-label="Flames Gourmet home">
          <OptimizedImage src={logoUrl} alt="Flames Gourmet" width={216} height={58} priority fit="contain" className="h-12 sm:h-14 w-auto object-contain" />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {nav.map((n) =>
            n.dropdown ? (
              <div key={n.to} className="relative" onMouseEnter={() => setMenuOpen(true)} onMouseLeave={() => setMenuOpen(false)}>
                <button onClick={() => navigate(n.to)}
                  className={`inline-flex items-center gap-1 text-sm font-medium tracking-wide transition-colors ${menuOpen ? "text-[color:var(--flame)]" : "text-white/90 hover:text-[color:var(--flame-light)]"}`}>
                  {n.label}<ChevronDown className="h-3.5 w-3.5" />
                </button>
                {menuOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3">
                    <div
                      className="rounded-lg bg-white shadow-2xl ring-1 ring-black/5 p-4"
                      style={{ width: `min(90vw, ${Math.max(1, Math.ceil(categories.length / 3)) * 260 + 32}px)` }}
                    >
                      <div
                        className="grid grid-rows-3 grid-flow-col gap-2"
                        style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(categories.length / 3))}, minmax(0, 1fr))` }}
                      >
                        {categories.map((c) => (
                          <Link
                            key={c.slug}
                            to={`/category/${c.slug}`}
                            onClick={() => setMenuOpen(false)}
                            className="group flex items-start gap-3 rounded-md p-2 hover:bg-neutral-50 transition-colors"
                          >
                            <OptimizedImage
                              src={c.image}
                              alt={c.name}
                              width={56}
                              height={56}
                              className="h-14 w-14 rounded-md object-cover flex-shrink-0 bg-neutral-100"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-neutral-900 group-hover:text-[color:var(--flame)] leading-tight">
                                {c.name}
                              </div>
                              {c.description && (
                                <div className="mt-0.5 text-xs text-neutral-500 line-clamp-2 leading-snug">
                                  {c.description}
                                </div>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <NavLink key={n.to} to={n.to} end={n.to === "/"}
                className={({ isActive }) => `text-sm font-medium tracking-wide transition-colors ${isActive ? "text-[color:var(--flame)]" : "text-white/90 hover:text-[color:var(--flame-light)]"}`}>
                {n.label}
              </NavLink>
            )
          )}
        </nav>

        <div className="flex items-center gap-3">
          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white shadow-lg shadow-black/30 hover:bg-white/20 transition"
            aria-label="Search"
            title="Search"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* User icon + dropdown */}
          <div className="relative" onMouseEnter={() => user && setUserMenuOpen(true)} onMouseLeave={() => setUserMenuOpen(false)}>
            <button
              onClick={() => { if (!user) setLoginOpen(true); }}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white shadow-lg shadow-black/30 hover:bg-white/20 transition overflow-hidden"
              aria-label={user ? "Account menu" : "Sign in"}
              title={user ? user.name : "Sign in"}
            >
              {user?.avatar_url ? (
                <img
                  src={resolveAssetUrl(user.avatar_url)}
                  alt={user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-5 w-5" />
              )}
              {user && <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-400 border-2 border-black" />}
            </button>
            {user && userMenuOpen && (
              <div className="absolute right-0 top-full pt-3 w-60 z-40">
                <div className="rounded-xl bg-[color:var(--card)] border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5">
                    <div className="text-sm font-bold text-white truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[color:var(--gold)] mt-1">{user.role.replace("_", " ")}</div>
                  </div>
                  <div className="py-1">
                    {showDashboard && <MenuLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" />}
                    {showProfile && <MenuLink to="/profile" icon={UserCog} label="Your profile" />}
                    {showAdminPanel && <MenuLink to="/admin" icon={ShieldCheck} label="Admin panel" />}
                    {showCreateOrder && <MenuLink to="/create-order" icon={PlusCircle} label="Create orders" />}
                    {showCurrentOrders && <MenuLink to="/current-orders" icon={ChefHat} label="Current orders" />}
                    {showViewOrders && <MenuLink to="/orders" icon={ClipboardList} label="View orders" />}
                    {showPromotions && <MenuLink to="/promotions" icon={Megaphone} label="Promotions" />}
                    <button onClick={() => handleLogoutClick()} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5">
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="relative" onMouseEnter={() => { if (window.matchMedia('(hover: hover)').matches) setCartOpen(true); }} onMouseLeave={() => { if (window.matchMedia('(hover: hover)').matches) setCartOpen(false); }}>
            <Link to="/cart" ref={cartBtnRef}
              onClick={(e) => {
                if (!window.matchMedia('(hover: hover)').matches) {
                  e.preventDefault();
                  setCartOpen((v) => !v);
                }
              }}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--flame)] text-white shadow-lg shadow-black/30 hover:scale-105 transition"
              aria-label="Your cart">
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-[color:var(--gold)] text-[10px] font-bold text-black grid place-items-center">{count}</span>
              )}
            </Link>
            {cartOpen && (
              <div className="fixed left-1/2 -translate-x-1/2 top-[68px] w-[calc(100vw-1rem)] max-w-sm sm:absolute sm:left-auto sm:right-0 sm:translate-x-0 sm:top-full sm:pt-3 sm:w-96 z-40">
                <div className="rounded-xl bg-[color:var(--card)] border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-wider text-white">Your Cart</span>
                    <span className="text-xs text-muted-foreground">{count} item{count === 1 ? "" : "s"}</span>
                  </div>
                  {items.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">Your cart is empty.</div>
                  ) : (
                    <>
                      <ul className="max-h-80 overflow-auto divide-y divide-white/5">
                        {items.map((it) => (
                          <li key={it.product.slug} className="flex items-start gap-3 px-4 py-3">
                            {it.product.image ? (
                              <OptimizedImage src={it.product.image} alt="" width={48} height={48} className="h-12 w-12 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="h-12 w-12 rounded bg-white/5 grid place-items-center text-lg flex-shrink-0">🥤</div>
                            )}
                            <div className="flex-1 min-w-0">
                              {(() => { const { title, addons } = splitProductName(it.product.name); return (
                                <>
                                  <div className="text-xs font-semibold text-white truncate">{title}</div>
                                  {addons && <div className="text-[10px] text-muted-foreground truncate">({addons})</div>}
                                </>
                              ); })()}
                              <div className="text-[11px] text-muted-foreground mt-0.5">${it.product.price.toFixed(2)} · <span className="text-[color:var(--flame-light)] font-bold">${(it.product.price * it.quantity).toFixed(2)}</span></div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              <button onClick={() => remove(it.product.slug)} className="h-6 w-6 grid place-items-center rounded-full text-muted-foreground hover:text-red-400" aria-label="remove">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              <div className="inline-flex items-center rounded-full border border-white/10">
                                <button onClick={() => (it.quantity <= 1 ? remove(it.product.slug) : setQty(it.product.slug, it.quantity - 1))} className="h-6 w-6 grid place-items-center text-white/80 hover:text-[color:var(--flame-light)]" aria-label="decrease">
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-6 text-center text-[11px] font-semibold text-white">{it.quantity}</span>
                                <button onClick={() => setQty(it.product.slug, it.quantity + 1)} className="h-6 w-6 grid place-items-center text-white/80 hover:text-[color:var(--flame-light)]" aria-label="increase">
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-bold text-white">${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                        <Link to="/cart" onClick={() => setCartOpen(false)} className="text-center text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-md border border-white/15 text-white hover:border-[color:var(--flame)] hover:text-[color:var(--flame-light)] transition">View Cart</Link>
                        <Link to="/checkout" onClick={() => setCartOpen(false)} className="text-center text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-md bg-[color:var(--flame)] hover:bg-[color:var(--flame-light)] text-white transition">Checkout</Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-full bg-white/10 text-white" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
            {open ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-black/90 backdrop-blur border-t border-white/10">
          <div className="px-4 py-3 flex flex-col gap-1">
            {nav.map((n) =>
              n.dropdown ? (
                <div key={n.to} className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <NavLink to={n.to} onClick={() => setOpen(false)}
                      className={({ isActive }) => `flex-1 py-2 text-sm font-medium ${isActive ? "text-[color:var(--flame)]" : "text-white/90"}`}>
                      {n.label}
                    </NavLink>
                  </div>
                  <div className="pl-4 border-l border-white/10 flex flex-col">
                    {categories.map((c) => {
                      const isOpen = !!expandedMobile[c.slug];
                      const subs = subsByCat[c.slug] ?? [];
                      return (
                        <div key={c.slug} className="flex flex-col">
                          <div className="flex items-center justify-between gap-2">
                            <Link to={`/category/${c.slug}`} onClick={() => setOpen(false)} className="flex-1 py-2 text-sm text-white/80 hover:text-[color:var(--flame-light)]">{c.name}</Link>
                            <button onClick={() => toggleMobileCat(c.slug)} aria-label={isOpen ? `Collapse ${c.name}` : `Expand ${c.name}`}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-white/10 text-white/70 hover:bg-white/10">
                              {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          {isOpen && (
                            <div className="pl-4 border-l border-white/10 flex flex-col">
                              {subs.length === 0 ? (
                                <span className="py-2 text-xs text-white/40">No sub-categories</span>
                              ) : subs.map((s) => (
                                <Link key={s.slug} to={`/category/${c.slug}#${s.slug}`} onClick={() => setOpen(false)} className="py-1.5 text-xs text-white/60 hover:text-[color:var(--flame-light)]">{s.name}</Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <NavLink key={n.to} to={n.to} end={n.to === "/"} onClick={() => setOpen(false)}
                  className={({ isActive }) => `py-2 text-sm font-medium ${isActive ? "text-[color:var(--flame)]" : "text-white/90"}`}>
                  {n.label}
                </NavLink>
              )
            )}
            <Link to="/track" onClick={() => setOpen(false)} className="py-2 text-sm font-medium text-white/90">Track Order</Link>
            {user ? (
              <div className="mt-2 border-t border-white/10 pt-3 flex flex-col gap-0">
                {showDashboard && <Link to="/dashboard" onClick={() => setOpen(false)} className="py-2 text-sm text-white/90">Dashboard</Link>}
                {showAdminPanel && <Link to="/admin" onClick={() => setOpen(false)} className="py-2 text-sm text-white/90">Admin panel</Link>}
                {isStaff && <Link to="/create-order" onClick={() => setOpen(false)} className="py-2 text-sm text-white/90">Create orders</Link>}
                {isStaff && <Link to="/current-orders" onClick={() => setOpen(false)} className="py-2 text-sm text-white/90">Current orders</Link>}
                <Link to="/orders" onClick={() => setOpen(false)} className="py-2 text-sm text-white/90">View orders</Link>
                <Link to="/promotions" onClick={() => setOpen(false)} className="py-2 text-sm text-white/90">Promotions</Link>
                <button onClick={() => { setOpen(false); handleLogoutClick(); }} className="py-2 text-sm text-red-400 text-left">Log out</button>
              </div>
            ) : (
              <button onClick={() => { setOpen(false); setLoginOpen(true); }} className="py-2 text-sm text-[color:var(--flame-light)] text-left mt-2 border-t border-white/10 pt-3">Admin login</button>
            )}
          </div>
        </div>
      )}

      {!cartInView && count > 0 && pathname !== "/cart" && pathname !== "/checkout" && (
        <Link to="/cart" aria-label="Your cart"
          className="fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--flame)] text-white shadow-xl shadow-black/40 hover:scale-105 transition">
          <ShoppingBag className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-[color:var(--gold)] text-[10px] font-bold text-black grid place-items-center">{count}</span>
          )}
        </Link>
      )}

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <LogoutChoiceModal
        open={logoutOpen}
        userName={user?.name || "Admin"}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}

function MenuLink({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-2.5 text-sm text-white/90 hover:bg-white/5 hover:text-[color:var(--flame-light)]">
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
