import { createFileRoute, Link } from "@tanstack/react-router";

import heroImage from "../assets/hero-flames-gourmet.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Flames Gourmet — Fire-Grilled Fine Dining" },
      {
        name: "description",
        content:
          "Experience fire-grilled perfection at Flames Gourmet. Premium steaks, seasonal ingredients, and an unforgettable atmosphere.",
      },
      { property: "og:title", content: "Flames Gourmet — Fire-Grilled Fine Dining" },
      {
        property: "og:description",
        content:
          "Experience fire-grilled perfection at Flames Gourmet. Premium steaks, seasonal ingredients, and an unforgettable atmosphere.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Index() {
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-hero-background text-hero-foreground">
      {/* Decorative flame gradient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 70% 30%, oklch(0.55 0.18 55 / 0.25) 0%, transparent 45%), radial-gradient(circle at 30% 80%, oklch(0.45 0.14 40 / 0.2) 0%, transparent 40%)",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:px-8">
        {/* Text content */}
        <div className="flex flex-col items-start gap-6">
          <span className="rounded-full border border-hero-border bg-hero-card px-4 py-1.5 text-sm font-medium tracking-wide text-hero-accent uppercase">
            Est. 2024
          </span>

          <h1 className="max-w-xl text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            Where fire meets <span className="text-hero-accent">flavor</span>.
          </h1>

          <p className="max-w-md text-lg leading-relaxed text-hero-muted">
            Premium fire-grilled steaks, seasonal ingredients, and an atmosphere that turns every
            meal into an occasion.
          </p>

          <div className="mt-2 flex flex-wrap gap-4">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-lg bg-hero-accent px-6 py-3 text-base font-medium text-hero-accent-foreground transition hover:bg-hero-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hero-accent focus-visible:ring-offset-2 focus-visible:ring-offset-hero-background"
            >
              Reserve a Table
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-lg border border-hero-border bg-hero-card px-6 py-3 text-base font-medium text-hero-foreground transition hover:bg-hero-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hero-accent focus-visible:ring-offset-2 focus-visible:ring-offset-hero-background"
            >
              View Menu
            </Link>
          </div>

          <p className="mt-4 text-sm text-hero-muted">
            Open flame cooking · Locally sourced · Downtown location
          </p>
        </div>

        {/* Hero image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-hero-border lg:aspect-square">
          <img
            src={heroImage}
            alt="A perfectly grilled ribeye steak served on a dark slate plate in a warm, flame-lit restaurant"
            className="h-full w-full object-cover"
            width={1280}
            height={1024}
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-hero-background/60 via-transparent to-transparent" />
        </div>
      </div>
    </main>
  );
}
