import { useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useSiteSettings } from "@/hooks/use-site-settings";

type Doc = { slug: string; title: string; render: (ctx: Ctx) => React.ReactNode };
type Ctx = {
  business: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  effective: string;
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 mb-3 text-2xl font-semibold">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">{children}</ul>;
}

const DOCS: Doc[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    render: (c) => (
      <>
        <P>
          This Privacy Policy explains how <strong>{c.business}</strong> ("we", "us", "our") collects, uses, and
          discloses personal information in accordance with Canada's <em>Personal Information Protection and
          Electronic Documents Act</em> (PIPEDA) and applicable provincial privacy laws.
        </P>
        <H2>1. Information we collect</H2>
        <UL>
          <li>Contact details you provide (name, email, phone, delivery address).</li>
          <li>Order details, items purchased, and payment confirmation (we do not store card numbers).</li>
          <li>Account credentials when you register (passwords are stored hashed).</li>
          <li>Technical data: IP address, device/browser type, pages visited, and cookies (see Cookie Policy).</li>
        </UL>
        <H2>2. Why we collect it</H2>
        <UL>
          <li>To process and deliver your orders and provide customer support.</li>
          <li>To operate, secure, and improve our website.</li>
          <li>To send you order updates and, with consent, marketing messages (CASL compliant — you may unsubscribe at any time).</li>
          <li>To meet legal, tax, and accounting obligations.</li>
        </UL>
        <H2>3. Consent</H2>
        <P>
          By using this website, placing an order, or creating an account, you consent to the collection and use of
          your information as described. You may withdraw consent at any time, subject to legal or contractual
          restrictions, by contacting us at {c.email}.
        </P>
        <H2>4. Sharing &amp; subprocessors</H2>
        <P>
          We share information only with service providers necessary to operate the site (hosting, email, payment
          processing, delivery). These providers are bound to handle information with comparable safeguards. We do
          not sell personal information.
        </P>
        <H2>5. Storage &amp; safeguards</H2>
        <P>
          Data is stored on servers located in Canada or, where applicable, with reputable providers that protect
          information to a comparable standard. We use TLS in transit, hashed passwords, role-based access, and
          regular backups.
        </P>
        <H2>6. Retention</H2>
        <P>
          We retain personal information only as long as needed to fulfil the purposes outlined above and to comply
          with legal obligations (typically up to 7 years for transaction records).
        </P>
        <H2>7. Your rights</H2>
        <UL>
          <li>Access the personal information we hold about you.</li>
          <li>Request correction of inaccurate information.</li>
          <li>Request deletion of your account and associated data, subject to legal retention.</li>
          <li>Withdraw consent to marketing communications.</li>
          <li>File a complaint with the Office of the Privacy Commissioner of Canada (priv.gc.ca).</li>
        </UL>
        <H2>8. Contact our Privacy Officer</H2>
        <P>
          Email: <a className="text-[color:var(--flame-light)] underline" href={`mailto:${c.email}`}>{c.email}</a><br />
          Phone: {c.phone}<br />
          Address: <span className="capitalize">{c.address}</span>
        </P>
      </>
    ),
  },
  {
    slug: "terms",
    title: "Terms of Service",
    render: (c) => (
      <>
        <P>
          These Terms govern your use of {c.website} and any orders placed with <strong>{c.business}</strong>. By
          using the site you agree to these Terms.
        </P>
        <H2>1. Orders &amp; pricing</H2>
        <P>
          All prices are in Canadian dollars (CAD) and exclude applicable taxes unless stated. We reserve the right
          to refuse or cancel any order, including for product errors or unavailability.
        </P>
        <H2>2. Payment</H2>
        <P>Payment is due at checkout (or upon delivery for Cash on Delivery orders, where offered).</P>
        <H2>3. Delivery &amp; pickup</H2>
        <P>
          Estimated times are not guarantees. Risk of loss passes once the order leaves our premises with the
          courier or is collected by you.
        </P>
        <H2>4. Food safety &amp; allergens</H2>
        <P>
          Our kitchen handles common allergens (dairy, nuts, gluten, eggs, sesame, soy, shellfish). We cannot
          guarantee a 100% allergen-free environment — please contact us before ordering if you have severe
          allergies.
        </P>
        <H2>5. Accounts</H2>
        <P>You are responsible for safeguarding your login credentials and for activity under your account.</P>
        <H2>6. Acceptable use</H2>
        <P>You agree not to misuse the site, attempt to disrupt it, or use it for unlawful purposes.</P>
        <H2>7. Limitation of liability</H2>
        <P>
          To the maximum extent permitted by law, our total liability for any claim arising from the site or an
          order is limited to the amount paid for the order in question.
        </P>
        <H2>8. Governing law</H2>
        <P>
          These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada applicable
          therein.
        </P>
        <H2>9. Contact</H2>
        <P>{c.business} — {c.email} — {c.phone}</P>
      </>
    ),
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    render: (c) => (
      <>
        <P>
          This Cookie Policy explains how <strong>{c.business}</strong> uses cookies and similar technologies on
          {" "}{c.website}.
        </P>
        <H2>What are cookies?</H2>
        <P>
          Cookies are small text files stored on your device when you visit a website. They help the site remember
          your session, preferences, and how you use it.
        </P>
        <H2>Categories we use</H2>
        <UL>
          <li><strong>Strictly necessary</strong> — required to log in, hold a cart, and complete checkout. These cannot be disabled.</li>
          <li><strong>Functional</strong> — remember your preferences (e.g. cookie consent choice).</li>
          <li><strong>Analytics (optional)</strong> — set only with your consent to understand aggregated usage.</li>
        </UL>
        <H2>Your choices</H2>
        <P>
          When you first visit the site, you can <em>Accept all</em> or <em>Reject optional</em> cookies. You can
          change your choice at any time by clearing the cookie named <code>fg_cookie_consent_v1</code> in your
          browser and refreshing the page, or by adjusting your browser cookie settings.
        </P>
        <H2>Compliance</H2>
        <P>
          We follow Canadian guidance from the Office of the Privacy Commissioner regarding meaningful consent for
          online tracking. Strictly necessary cookies are processed under our legitimate interest to operate the
          site; analytics cookies are set only on explicit consent.
        </P>
        <H2>Contact</H2>
        <P>Questions? Email {c.email}.</P>
      </>
    ),
  },
  {
    slug: "refund",
    title: "Refund & Cancellation Policy",
    render: (c) => (
      <>
        <P>
          Because we prepare food fresh to order, our refund policy reflects food-safety best practice.
        </P>
        <H2>Cancellations</H2>
        <P>
          You may cancel an order without charge before we have started preparation. Once preparation begins, the
          order is non-refundable.
        </P>
        <H2>Issues with your order</H2>
        <P>
          If something is wrong with your order (incorrect item, missing item, or quality concern), please contact
          us within 2 hours of delivery or pickup at {c.phone} or {c.email} with your order number and a brief
          description. We will, at our discretion, offer a replacement, store credit, or refund.
        </P>
        <H2>Refund method &amp; timing</H2>
        <P>
          Approved refunds are issued to the original payment method within 5–10 business days. Cash on Delivery
          refunds are issued by e-transfer.
        </P>
        <H2>Contact</H2>
        <P>{c.business} — {c.email} — {c.phone}</P>
      </>
    ),
  },
];

export default function Legal() {
  const { slug = "" } = useParams();
  const s = useSiteSettings();
  const doc = useMemo(() => DOCS.find((d) => d.slug === slug), [slug]);

  if (!doc) return <Navigate to="/legal/privacy" replace />;

  const ctx: Ctx = {
    business: s.business_name || "Flames Gourmet",
    email: s.contact_email || "info@flamesgourmet.ca",
    phone: s.contact_phone || "+1 (905) 800-0000",
    address: s.contact_address || "Ontario, Canada",
    website: typeof window !== "undefined" ? window.location.host : "flamesgourmet.ca",
    effective: new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }),
  };

  return (
    <section className="pt-32 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="text-xs text-muted-foreground">
          <Link to="/" className="hover:text-white">Home</Link> / <span>Legal</span> /{" "}
          <span className="text-white">{doc.title}</span>
        </nav>
        <h1 className="mt-3 text-4xl font-bold">{doc.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">Effective: {ctx.effective}</p>

        <div className="mt-8 flex flex-wrap gap-2">
          {DOCS.map((d) => (
            <Link
              key={d.slug}
              to={`/legal/${d.slug}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                d.slug === doc.slug
                  ? "border-[color:var(--flame)] bg-[color:var(--flame)]/10 text-white"
                  : "border-white/10 text-muted-foreground hover:text-white"
              }`}
            >
              {d.title}
            </Link>
          ))}
        </div>

        <article className="mt-8">{doc.render(ctx)}</article>
      </div>
    </section>
  );
}
