import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Mail, MapPin, Phone, Twitter } from "lucide-react";
import { useSiteSettings, telHref } from "@/hooks/use-site-settings";
import { fetchCategories, resolveAssetUrl } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";

import type { Category } from "@/lib/mock-data";

const LOGO_FALLBACK = "/uploads/flames-logo.png";

export default function Footer() {
  const s = useSiteSettings() as Record<string, string>;
  const phone = s.contact_phone || "+1 (905) 800-0000";
  const email = s.contact_email || "info@flamesgourmet.ca";
  const address = (s.contact_address || "Ontario, Canada").toLowerCase();
  const logoUrl = resolveAssetUrl(s.logo_url || LOGO_FALLBACK);
  const [cats, setCats] = useState<Category[]>([]);
  useEffect(() => {
    fetchCategories().then(setCats).catch(() => setCats([]));
  }, []);
  const featured = (cats.filter((c) => c.isFeatured).length ? cats.filter((c) => c.isFeatured) : cats).slice(0, 5);
  return (

    <footer className="bg-[color:var(--card)] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid gap-10 md:grid-cols-4">
        <div>
          <OptimizedImage src={logoUrl} alt="Flames Gourmet" width={216} height={58} fit="contain" className="h-14 w-auto object-contain" />
          <p className="mt-4 text-sm text-muted-foreground max-w-xs">
            Authentic Indian spice, gourmet soul. Hand-crafted recipes served fresh from our kitchen to your table.
          </p>
          <div className="flex gap-3 mt-5">
            {[Facebook, Instagram, Twitter].map((Icon, i) => (
              <a key={i} href="#" aria-label="Social" className="h-9 w-9 grid place-items-center rounded-full bg-white/5 hover:bg-[color:var(--flame)] transition">
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-4">Popular Categories</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {featured.map((c) => (
              <li key={c.slug}>
                <Link to={`/category/${c.slug}`} className="hover:text-[color:var(--flame-light)]">{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-4">Useful Links</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/about" className="hover:text-[color:var(--flame-light)]">About Us</Link></li>
            <li><Link to="/menu" className="hover:text-[color:var(--flame-light)]">Our Menu</Link></li>
            <li><Link to="/contact" className="hover:text-[color:var(--flame-light)]">Contact</Link></li>
            <li><Link to="/cart" className="hover:text-[color:var(--flame-light)]">Your Cart</Link></li>
            <li><Link to="/track" className="hover:text-[color:var(--flame-light)]">Track Order</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold mb-4">Contact Info</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><Phone className="h-4 w-4 mt-0.5 text-[color:var(--flame)]" /> <a href={telHref(phone)} className="hover:text-white">{phone}</a></li>
            <li className="flex items-start gap-2"><Mail className="h-4 w-4 mt-0.5 text-[color:var(--flame)]" /> <a href={`mailto:${email}`} className="hover:text-white">{email}</a></li>
            <li className="flex items-start gap-2"><MapPin className="h-5 w-5 shrink-0 text-[color:var(--flame)]" /> <span className="capitalize">{address}</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-5 px-4 sm:px-6 lg:px-8 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {s.business_name || "Flames Gourmet"}. All rights reserved.</p>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:justify-end">
            <li><Link to="/legal/privacy" className="hover:text-white">Privacy Policy</Link></li>
            <li><Link to="/legal/terms" className="hover:text-white">Terms of Service</Link></li>
            <li><Link to="/legal/cookies" className="hover:text-white">Cookie Policy</Link></li>
            <li><Link to="/legal/refund" className="hover:text-white">Refund Policy</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
