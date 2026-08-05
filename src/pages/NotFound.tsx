import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Flame, Home, ArrowLeft, UtensilsCrossed, ShoppingBag, Search } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "404 — Off the Menu | Flames Gourmet";
  }, []);

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden px-4 py-20">
      {/* Ambient flame glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 35%, oklch(0.65 0.22 28 / 0.18), transparent 70%), radial-gradient(40% 40% at 80% 80%, oklch(0.78 0.2 45 / 0.10), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--flame), transparent)" }}
      />

      <div className="relative max-w-2xl w-full text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/60 backdrop-blur text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Flame className="w-3.5 h-3.5 text-[color:var(--flame)]" />
          Lost in the kitchen
        </div>

        <h1 className="mt-6 text-[clamp(5rem,18vw,11rem)] leading-none font-bold text-flame-gradient drop-shadow-[0_8px_30px_rgba(232,93,47,0.25)]">
          404
        </h1>

        <h2 className="mt-2 text-2xl sm:text-3xl font-semibold">
          This dish isn't on tonight's menu
        </h2>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto">
          The page you're looking for may have moved, been renamed, or simply
          burned in the tandoor. Let's get you back to something delicious.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="btn-flame">
            <Home className="w-4 h-4" />
            Back home
          </Link>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[color:var(--border)] bg-[color:var(--card)]/60 hover:bg-[color:var(--card)] transition font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </button>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          {[
            { to: "/menu", icon: UtensilsCrossed, title: "Menu", desc: "Today's specials" },
            { to: "/shop", icon: ShoppingBag, title: "Shop", desc: "Packaged food" },
            { to: "/search", icon: Search, title: "Search", desc: "Find a dish" },
          ].map(({ to, icon: Icon, title, desc }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/60 hover:bg-[color:var(--card)] hover:border-[color:var(--flame)]/50 transition p-4 flex items-center gap-3"
            >
              <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-[color:var(--flame)]/10 text-[color:var(--flame)] group-hover:bg-[color:var(--flame)]/20 transition">
                <Icon className="w-5 h-5" />
              </span>
              <span className="flex flex-col">
                <span className="font-semibold leading-tight">{title}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
