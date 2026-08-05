import { useEffect, useState } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { HERO_BANNER } from "@/lib/mock-data";
import { useSiteSettings, telHref } from "@/hooks/use-site-settings";
import { submitContact, fetchContactChallenge, type ContactChallenge } from "@/lib/api";
import OptimizedImage from "@/components/OptimizedImage";
import { toast } from "sonner";

export default function Contact() {
  const s = useSiteSettings();
  const phone = s.contact_phone || "+1 (905) 800-0000";
  const email = s.contact_email || "info@flamesgourmet.ca";
  const address = (s.contact_address || "Ontario, Canada").toLowerCase();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot — must stay empty
  const [mathAnswer, setMathAnswer] = useState("");
  const [challenge, setChallenge] = useState<ContactChallenge | null>(null);

  const loadChallenge = () => {
    fetchContactChallenge().then(setChallenge).catch(() => setChallenge(null));
  };
  useEffect(loadChallenge, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mathAnswer.trim()) { toast.error("Please solve the math question."); return; }
    setSubmitting(true);
    try {
      await submitContact({
        ...form,
        website,
        mathToken: challenge?.token,
        mathAnswer: mathAnswer.trim(),
      });
      toast.success("Thanks — we'll be in touch shortly.");
      setForm({ name: "", email: "", phone: "", message: "" });
      setMathAnswer("");
      loadChallenge();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send message");
      loadChallenge();
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <>
    <section className="relative h-[340px] sm:h-[420px] overflow-hidden">
      <OptimizedImage src={HERO_BANNER} alt="" width={1600} height={520} priority sizes="100vw" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative h-full grid place-items-center text-center px-4">
        <h1 className="text-4xl sm:text-6xl font-bold text-white drop-shadow-lg">Contact</h1>
      </div>
    </section>
    <section className="section-pad">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">Get in Touch</span>
        <h1 className="mt-2 text-4xl sm:text-5xl font-bold">
          We'd love to <span className="text-flame-gradient">hear from you.</span>
        </h1>

        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {[
            { icon: Phone, t: "Phone", v: phone, href: telHref(phone) },
            { icon: Mail, t: "Email", v: email, href: `mailto:${email}` },
            { icon: MapPin, t: "Address", v: address, href: "#" },
          ].map((c) => (
            <a key={c.t} href={c.href} className="rounded-2xl bg-[color:var(--card)] border border-white/5 p-5 hover:border-[color:var(--flame)]/40 transition block">
              <div className="h-10 w-10 grid place-items-center rounded-full bg-[color:var(--flame)]/15 text-[color:var(--flame-light)] mb-3">
                <c.icon className="h-4 w-4" />
              </div>
              <div className="font-semibold">{c.t}</div>
              <div className={`text-sm text-muted-foreground mt-1 ${c.t === "Address" ? "capitalize" : ""}`}>{c.v}</div>
            </a>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-10 rounded-2xl bg-[color:var(--card)] border border-white/5 p-6 grid gap-4 sm:grid-cols-2"
        >
          <input required maxLength={80} placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm" />
          <input required type="email" maxLength={120} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm" />
          <input maxLength={20} placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm sm:col-span-2" />
          <textarea required maxLength={1000} placeholder="How can we help?" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm sm:col-span-2" />
          {/* Honeypot: hidden from real users, irresistible to bots. */}
          <div aria-hidden="true" className="absolute left-[-10000px] top-auto w-px h-px overflow-hidden">
            <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <label className="text-sm text-muted-foreground whitespace-nowrap">
              Quick check: <span className="font-medium text-white">{challenge?.question ?? "…"} =</span>
            </label>
            <input
              required inputMode="numeric" pattern="-?\d+" maxLength={4}
              placeholder="?" value={mathAnswer} onChange={(e) => setMathAnswer(e.target.value)}
              className="w-20 bg-[color:var(--background)] border border-white/10 rounded-lg px-3 py-2.5 text-sm"
            />
            <button type="button" onClick={loadChallenge} className="text-xs text-muted-foreground hover:text-white underline">
              New question
            </button>
          </div>
          <button type="submit" disabled={submitting} className="btn-flame sm:col-span-2 justify-center disabled:opacity-60">{submitting ? "Sending…" : "Send Message"}</button>
        </form>
      </div>
    </section>
    <section className="pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6">
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--gold)]">Find Us</span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold">Visit Our Store</h2>
        </div>
        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2880.796802474994!2d-79.25430262381661!3d43.77707667109657!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89d4d184e2c8988b%3A0xb9ac232816810915!2sFLAMES%20GOURMET!5e0!3m2!1sen!2sin!4v1782027205048!5m2!1sen!2sin"
            title="Flames Gourmet location on Google Maps"
            width="100%" height="450" style={{ border: 0 }}
            allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
            className="block w-full"
          />
        </div>
      </div>
    </section>
    </>
  );
}

