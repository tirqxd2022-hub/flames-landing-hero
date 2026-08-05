import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  ChefHat,
  Clock,
  Flame,
  Leaf,
  Snowflake,
  Star,
  Truck,
  Utensils,
} from "lucide-react";
import { categories as fallbackCategories, products, testimonials as fallbackTestimonials, type Product, type Category } from "@/lib/mock-data";
import { fetchAllProducts, fetchCategories, fetchReviews, resolveAssetUrl, type PublicReview } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";
import { usePageImage } from "@/lib/page-images";
import { useSiteSettings, telHref } from "@/hooks/use-site-settings";

const fallbackFeatured = [
  products.find((p) => p.slug === "egg-bhurji-indian-style"),
  products.find((p) => p.slug === "paneer-tikka-thali"),
  products.find((p) => p.slug === "butter-chicken"),
  products.find((p) => p.slug === "hyderabadi-biryani"),
].filter(Boolean) as Product[];

export default function Home() {
  // Replaceable page images (admin → Page Images).
  const heroVideoUrl       = usePageImage("home.hero.video",            "/uploads/fire.mp4");
  const heroPosterUrl      = usePageImage("home.hero.video_poster",     "/uploads/fire-fallback.jpg");
  const heroForegroundUrl  = usePageImage("home.hero.foreground",       "/uploads/hero-foods.webp");
  const aboutStorefrontUrl = usePageImage("home.about.storefront",      "/uploads/store-front.jpg");
  const offerBgUrl         = usePageImage("home.offer.background",      "/uploads/happy-customers.jpg");
  const thaliUrl           = usePageImage("home.offer.thali",           "/products/thali-box.jpg");
  const deliveryUrl        = usePageImage("home.takeaway.delivery",     "/uploads/delivery-person.jpg");
  const premiumBgUrl       = usePageImage("home.premium.background",    "/products/thali-box.jpg");
  const customersUrl       = usePageImage("home.testimonials.customers","/uploads/happy-customers.jpg");
  const ctaBgUrl           = usePageImage("home.cta.background",        "/products/butter-chicken.jpg");
  const ctaBiryaniUrl      = usePageImage("home.cta.biryani",           "/products/biryani.avif");
  const settings = useSiteSettings();
  const sitePhone = settings.contact_phone || "+1 (905) 800-0000";
  const [featured, setFeatured] = useState<Product[]>(fallbackFeatured);
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [reviews, setReviews] = useState<PublicReview[]>(
    fallbackTestimonials.map((t, i) => ({ id: i, name: t.name, role: t.role, quote: t.quote, avatarUrl: "", rating: 5 }))
  );
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewFade, setReviewFade] = useState(true);

  useEffect(() => {
    fetchAllProducts()
      .then((all) => {
        const flagged = all.filter((p) => p.isFeatured);
        if (flagged.length > 0) setFeatured(flagged.slice(0, 8));
      })
      .catch(() => { /* keep fallback */ });
    fetchCategories()
      .then((cats) => { if (cats && cats.length) setCategories(cats as Category[]); })
      .catch(() => { /* keep fallback */ });
    fetchReviews()
      .then((rs) => { if (rs && rs.length) setReviews(rs); })
      .catch(() => { /* keep fallback */ });
  }, []);

  const reviewsPerPage = 3;
  const totalReviewPages = Math.max(1, Math.ceil(reviews.length / reviewsPerPage));

  useEffect(() => {
    if (totalReviewPages <= 1) return;
    const interval = setInterval(() => {
      setReviewFade(false);
      setTimeout(() => {
        setReviewPage((p) => (p + 1) % totalReviewPages);
        setReviewFade(true);
      }, 350);
    }, 6000);
    return () => clearInterval(interval);
  }, [totalReviewPages]);

  const visibleReviews = reviews.slice(reviewPage * reviewsPerPage, reviewPage * reviewsPerPage + reviewsPerPage);


  return (
    <>
      {/* HERO */}
      <section className="relative min-h-[100vh] flex items-center overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster={resolveAssetUrl(heroPosterUrl)}
        >
          <source src={resolveAssetUrl(heroVideoUrl)} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/40" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 grid lg:grid-cols-2 gap-10 items-center w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] text-white">
              Authentic Indian Spice,
              <br />
              <span className="text-flame-gradient">Gourmet Soul.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-white/80 max-w-xl">
              Every dish at Flames is an indulgence in fire, flavor and tradition. Crafted from family recipes and the
              freshest gourmet-quality ingredients.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/menu" className="btn-flame">
                Order Now <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#about"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 backdrop-blur text-white text-sm font-medium hover:bg-white/20 transition"
              >
                <ChefHat className="h-4 w-4" /> The New Standard
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="hidden lg:block relative"
          >
            <OptimizedImage src={heroForegroundUrl} alt="Indian dishes" width={720} height={720} priority sizes="(min-width: 1024px) 50vw, 100vw" className="w-full h-auto drop-shadow-2xl" />
          </motion.div>
        </div>

        {/* Stats strip */}
        <div className="absolute bottom-0 inset-x-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px rounded-2xl overflow-hidden bg-white/10 backdrop-blur border border-white/10">
              {[
                { n: "01", t: "Authentic Indian flavors", s: "with a gourmet touch." },
                { n: "02", t: "Freshly-sourced ingredients", s: "in every single bite." },
                { n: "03", t: "The widest A-la-Carte", s: "of any family of diners." },
              ].map((c) => (
                <div key={c.n} className="bg-black/60 p-5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full grid place-items-center bg-[color:var(--flame)]/15 text-[color:var(--flame-light)] font-bold">
                    {c.n}
                  </div>
                  <div className="text-sm">
                    <div className="text-white font-medium">{c.t}</div>
                    <div className="text-white/60">{c.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="section-pad" style={{ isolation: "isolate" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-white/5">
              <OptimizedImage
                src={aboutStorefrontUrl}
                alt="Flames Gourmet store"
                width={600}
                height={750}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 hidden md:flex flex-col items-center justify-center h-32 w-32 rounded-full bg-[color:var(--flame)] text-white shadow-xl">
              <span className="text-3xl font-bold">30+</span>
              <span className="text-xs uppercase tracking-wider">Indian dishes</span>
            </div>
          </div>
          <div>
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">
              <Flame className="h-3.5 w-3.5" /> About Flames Gourmet
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold">
              Bringing Premium Indian Flavors <span className="text-flame-gradient">to Your Neighborhood.</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Flames Gourmet was born from a passion for authentic Indian recipes and high-quality ingredients. We believe
              real food deserves more than just fuel — it should be an experience, from sourcing the freshest spices to
              hand-crafting every dish on the line.
            </p>
            <ul className="mt-6 space-y-3 text-sm" style={{ transform: "translateZ(0)", WebkitTransform: "translateZ(0)", isolation: "isolate" }}>
              {["Authentic recipes & traditional flavors", "Freshly seasoned, never mass-produced", "Locally sourced meats & vegetables", "Perfectly spiced to your preference"].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span
                    className="h-5 w-5 grid place-items-center rounded-full bg-[color:var(--flame)] text-white text-[10px] shrink-0"
                    style={{ transform: "translateZ(0)", WebkitTransform: "translateZ(0)", isolation: "isolate" }}
                  >✓</span>
                  <span style={{ transform: "translateZ(0)", WebkitTransform: "translateZ(0)" }}>{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 grid grid-cols-2 gap-4" style={{ transform: "translateZ(0)", WebkitTransform: "translateZ(0)", isolation: "isolate" }}>
              <div className="rounded-xl bg-[color:var(--card)] border border-white/5 p-4" style={{ transform: "translateZ(0)", WebkitTransform: "translateZ(0)", isolation: "isolate" }}>
                <div className="flex items-center gap-2 text-[color:var(--flame-light)] font-semibold">
                  <Award className="h-4 w-4" /> Our Mission
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  To redefine fast-casual dining by serving fresh, flavorful, high-quality Indian meals every day.
                </p>
              </div>
              <div className="rounded-xl bg-[color:var(--card)] border border-white/5 p-4" style={{ transform: "translateZ(0)", WebkitTransform: "translateZ(0)", isolation: "isolate" }}>
                <div className="flex items-center gap-2 text-[color:var(--flame-light)] font-semibold">
                  <ChefHat className="h-4 w-4" /> Our Vision
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  To be the most trusted name for authentic Indian take-away in Canada.
                </p>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-4 items-center">
              <Link to="/menu" className="btn-flame shrink-0">Read more <ArrowRight className="h-4 w-4" /></Link>
              <div className="text-xs text-muted-foreground min-w-0">
                <div className="font-semibold text-white">Phone</div>
                <a href={telHref(sitePhone)} className="break-all">{sitePhone}</a>
              </div>
            </div>
          </div>
        </div>

        {/* Three-pillar strip */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 grid sm:grid-cols-3 gap-4">
          {[
            { icon: Utensils, t: "Tasted India", s: "Real, traditional flavors crafted by our expert chefs." },
            { icon: Leaf, t: "Gourmet Quality", s: "We use premium ingredients for a superior dining experience." },
            { icon: Star, t: "Fast & Fresh", s: "Perpetual balance of gourmet taste and quick service." },
          ].map((c) => (
            <div key={c.t} className="flex items-center gap-4 rounded-2xl bg-[color:var(--card)] border border-white/5 p-5">
              <div className="h-12 w-12 grid place-items-center rounded-full bg-[color:var(--flame)]/15 text-[color:var(--flame-light)]">
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{c.t}</div>
                <div className="text-xs text-muted-foreground">{c.s}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SIGNATURE DISHES */}
      <section className="section-pad bg-[color:var(--card)]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">Our Menu</span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-bold">
                Authentic Recipes &<br /> <span className="text-flame-gradient">Signature Dishes.</span>
              </h2>
            </div>
            <Link to="/menu" className="text-sm text-[color:var(--flame-light)] hover:underline inline-flex items-center gap-1">
              View full menu <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {featured.map((p, i) => (
              <Link
                key={p.slug}
                to={`/product/${p.slug}`}
                className="group rounded-3xl overflow-hidden bg-[color:var(--background)] border border-white/5 flex hover:border-[color:var(--flame)]/50 transition"
              >
                <div className="flex-1 p-5">
                  <div className="text-xs text-[color:var(--gold)] uppercase tracking-wider">
                    {categories.find((c) => c.slug === p.categorySlug)?.name}
                  </div>
                  <h3 className="mt-1 text-xl font-bold">{p.name}</h3>
                  <div className="mt-2 text-2xl font-bold text-[color:var(--flame-light)]">${p.price.toFixed(2)}{p.productType === "variable" && <span className="text-muted-foreground font-normal text-sm"> onwards</span>}</div>
                  <div className="mt-2 flex items-center gap-1 text-[color:var(--gold)] text-xs">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="h-3 w-3 fill-current" />
                    ))}
                    <span className="text-muted-foreground ml-1">{p.rating}</span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-white bg-[color:var(--flame)] rounded-full px-3 py-1.5 group-hover:bg-[color:var(--flame-light)] transition">
                    Order Now <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
                <div className="relative w-40 sm:w-56 shrink-0">
                  <OptimizedImage
                    src={p.image}
                    alt={p.name}
                    width={224}
                    height={224}
                    sizes="(min-width: 640px) 224px, 160px"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 h-6 w-6 grid place-items-center rounded-full bg-[color:var(--flame)] text-white text-[10px] font-bold">
                    {i + 1}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* LIMITED OFFER */}
      <section className="relative section-pad overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: `url(${resolveAssetUrl(offerBgUrl)})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">Limited Time Offer</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold">
              Hearty Meals, Bold Flavors,<br />
              <span className="text-flame-gradient">Unbeatable Value.</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-md">
              Why wait for a new flavor when you can have them all? Our thali boxes are designed to give you a complete
              Indian dining experience. Perfect for a quick lunch or a satisfying dinner-on-the-go.
            </p>
            <Link to="/menu" className="btn-flame mt-6">
              Order Your Combo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative">
            <OptimizedImage src={thaliUrl} alt="Thali combo" width={700} height={525} sizes="(min-width: 1024px) 50vw, 100vw" className="rounded-2xl w-full object-cover aspect-[4/3]" />
            <div className="absolute -top-5 -right-5 h-24 w-24 rounded-full bg-[color:var(--gold)] text-black grid place-items-center font-bold text-xl shadow-xl">
              -30%
            </div>
          </div>
        </div>
      </section>

      {/* READY TO GO */}
      <section className="section-pad">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Fresh Gourmet Meals,<br />
              <span className="text-flame-gradient">Ready to Go.</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-md">
              Craving authentic Indian flavors on the move? Our take-away service is designed for your busy lifestyle —
              pick every meal with care to ensure the heat and aroma stay locked in until you're ready to eat.
            </p>

            <div className="mt-8 grid sm:grid-cols-3 gap-4">
              {[
                { icon: Clock, t: "Rapid Pickup", s: "Your order is ready in minutes, perfect for the on-the-go food court vibes." },
                { icon: Snowflake, t: "Just & Sealed", s: "We use premium, eco-friendly packaging to keep your meal fresh and hot." },
                { icon: Truck, t: "Easy Ordering", s: "Skip the line by ordering online through our seamless web portal." },
              ].map((b) => (
                <div key={b.t} className="rounded-2xl bg-[color:var(--card)] border border-white/5 p-5">
                  <div className="h-10 w-10 grid place-items-center rounded-full bg-[color:var(--flame)]/15 text-[color:var(--flame-light)] mb-3">
                    <b.icon className="h-4 w-4" />
                  </div>
                  <div className="font-semibold text-sm">{b.t}</div>
                  <p className="text-xs text-muted-foreground mt-1">{b.s}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link to="/menu" className="btn-flame">Order for Pickup <ArrowRight className="h-4 w-4" /></Link>
              <div className="text-sm text-muted-foreground">
                <div className="font-semibold text-white">Call us</div>
                <a href={telHref(sitePhone)}>{sitePhone}</a>
              </div>
            </div>
          </div>

          <div className="relative">
            <OptimizedImage src={deliveryUrl} alt="Take-away delivery" width={600} height={750} sizes="(min-width: 1024px) 50vw, 100vw" className="rounded-2xl w-full object-cover aspect-[4/5]" />
            <div className="absolute bottom-4 right-4 h-24 w-24 rounded-full bg-[color:var(--gold)] text-black grid place-items-center font-bold shadow-xl">
              <div className="text-center">
                <div className="text-xl leading-none">100%</div>
                <div className="text-[10px] uppercase">Fresh</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CUISINE GRID */}
      <section className="section-pad bg-[color:var(--card)]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">Our Cuisine</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold">
              A Glimpse Into Our <span className="text-flame-gradient">Kitchen Craft.</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
              Browse the artistry and authentic traditions behind every dish. From the tandoor to the pan, we prepare
              every gourmet meal with care.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(() => {
              const featuredCats = categories.filter((c) => c.isFeatured);
              const list = featuredCats.length > 0 ? featuredCats : categories;
              return list.slice(0, 6).map((c) => (
                <Link key={c.slug} to={`/category/${c.slug}`} className="group relative rounded-2xl overflow-hidden aspect-[4/3] block">
                  <OptimizedImage src={c.image} alt={c.name} width={480} height={360} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-5">
                    <div className="font-bold text-lg text-white">{c.name}</div>
                    <div className="text-xs text-white/70">{c.itemCount}+ item</div>
                  </div>
                </Link>
              ));
            })()}
          </div>
        </div>
      </section>

      {/* PREMIUM FLAVORS ON THE GO */}
      <section className="relative section-pad overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${resolveAssetUrl(premiumBgUrl)})` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/40" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Experience premium flavors<br />
              <span className="text-flame-gradient">On The Go.</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-md">
              Craving authentic Indian recipes? Order from our take-away menu and pick up at our counter — fresh, fast and
              full of soul.
            </p>
            <div className="mt-6 flex gap-3 flex-wrap">
              <Link to="/menu" className="btn-flame">Order Now</Link>
              <Link to="/category/dinner" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 backdrop-blur text-white text-sm font-medium hover:bg-white/20 transition">
                Book Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section-pad">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
          <OptimizedImage src={customersUrl} alt="Happy customers" width={700} height={525} sizes="(min-width: 1024px) 50vw, 100vw" className="rounded-2xl w-full object-cover aspect-[4/3]" />
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">Our Reviews</span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold">
              Hear from Our <span className="text-flame-gradient">Satisfied Clients.</span>
            </h2>
            <div
              className={`mt-6 space-y-4 transition-opacity duration-300 min-h-[512px] ${reviewFade ? "opacity-100" : "opacity-0"}`}
              key={reviewPage}
            >
              {visibleReviews.map((t) => (
                <div key={t.id} className="rounded-2xl bg-[color:var(--card)] border border-white/5 p-5 h-[160px] flex flex-col justify-between">
                  <div>
                  <div className="flex items-center gap-1 text-[color:var(--gold)]">
                    {Array.from({ length: t.rating || 5 }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-current" />
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground italic line-clamp-2">"{t.quote}"</p>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    {t.avatarUrl ? (
                      <OptimizedImage src={t.avatarUrl} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div
                        className="h-10 w-10 rounded-full grid place-items-center text-sm font-semibold text-white"
                        style={{ backgroundColor: `hsl(${(t.name.charCodeAt(0) * 47) % 360} 55% 45%)` }}
                        aria-hidden
                      >
                        {t.name.trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              {totalReviewPages > 1 ? (
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalReviewPages }).map((_, i) => (
                    <button key={i} aria-label={`Show reviews page ${i+1}`} onClick={() => {
                      setReviewFade(false);
                      setTimeout(() => { setReviewPage(i); setReviewFade(true); }, 300);
                    }}
                      className={`h-1.5 rounded-full transition-all ${i === reviewPage ? "w-6 bg-[color:var(--gold)]" : "w-1.5 bg-white/20 hover:bg-white/40"}`} />
                  ))}
                </div>
              ) : <span />}
              <a
                href="https://www.google.com/maps/place/FLAMES+GOURMET/@43.7770767,-79.2543026,17z/data=!4m8!3m7!1s0x89d4d184e2c8988b:0xb9ac232816810915!8m2!3d43.7770767!4d-79.2517277!9m1!1b1!16s%2Fg%2F11z2y274rj?entry=ttu&g_ep=EgoyMDI2MDYxNi4wIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition"
              >
                Read More Reviews
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="relative">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${resolveAssetUrl(ctaBgUrl)})` }} />
        <div className="absolute inset-0 bg-black/75" />
        <div className="relative max-w-3xl mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold">
            30+ Authentic Dishes to<br />
            <span className="text-flame-gradient">Satisfy Your Cravings.</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Discover a menu designed for every flavor profile and appetite, from signature butter chicken to fragrant
            biryani and beyond.
          </p>
          <Link to="/menu" className="btn-flame mt-6">Order Now <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <OptimizedImage src={ctaBiryaniUrl} alt="" width={176} height={176} className="absolute left-0 top-1/2 -translate-y-1/2 w-32 sm:w-44 opacity-80 hidden md:block" />
      </section>
    </>
  );
}
