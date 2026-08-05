import { HERO_BANNER } from "@/lib/mock-data";
import OptimizedImage from "@/components/OptimizedImage";
import { usePageImage } from "@/lib/page-images";

export default function About() {
  const heroImg = usePageImage("about.hero.image", HERO_BANNER);
  const storefront = usePageImage("about.story.storefront", "/uploads/store-front.jpg");
  const chef = usePageImage("about.story.chef", "/uploads/chef-portrait.jpg");

  return (
    <>
      <section className="relative h-[340px] sm:h-[420px] overflow-hidden">
        <OptimizedImage src={heroImg} alt="" width={1600} height={520} priority sizes="100vw" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative h-full grid place-items-center text-center px-4">
          <h1 className="text-4xl sm:text-6xl font-bold text-white drop-shadow-lg">About</h1>
        </div>
      </section>

      <section className="section-pad">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">About Us</span>
          <h2 className="mt-2 text-4xl sm:text-5xl font-bold">
            Our story is <span className="text-flame-gradient">flavor first.</span>
          </h2>
          <p className="mt-5 text-muted-foreground max-w-2xl">
            Flames Gourmet was founded with a simple idea: bring the warmth of an Indian kitchen to busy Canadian
            neighborhoods, without compromising on freshness, spice or soul.
          </p>

          <div className="mt-10 grid md:grid-cols-2 gap-6">
            <OptimizedImage src={storefront} alt="Flames storefront" width={640} height={480} sizes="(min-width: 768px) 50vw, 100vw" className="rounded-2xl w-full object-cover aspect-[4/3]" />
            <OptimizedImage src={chef} alt="Our head chef" width={640} height={480} sizes="(min-width: 768px) 50vw, 100vw" className="rounded-2xl w-full object-cover aspect-[4/3]" />
          </div>

          <div className="mt-10 grid sm:grid-cols-3 gap-5">
            {[
              { t: "Sourced fresh", s: "We work with local farmers and spice importers to keep every plate vibrant." },
              { t: "Hand-crafted", s: "From naan to biryani, everything is made in-house, the traditional way." },
              { t: "Counter-fresh", s: "Order online, pay cash at the counter — no surprises, just great food." },
            ].map((b) => (
              <div key={b.t} className="rounded-2xl bg-[color:var(--card)] border border-white/5 p-5">
                <div className="font-semibold">{b.t}</div>
                <p className="text-sm text-muted-foreground mt-2">{b.s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
