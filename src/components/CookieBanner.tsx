import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const KEY = "fg_cookie_consent_v1";

type Choice = "accepted" | "rejected";

function read(): Choice | null {
  try { return (localStorage.getItem(KEY) as Choice) || null; } catch { return null; }
}
function write(v: Choice) {
  try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
  try {
    document.cookie = `${KEY}=${v}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${
      window.location.protocol === "https:" ? "; Secure" : ""
    }`;
  } catch { /* ignore */ }
}

export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!read()) setOpen(true); }, []);
  if (!open) return null;

  const decide = (v: Choice) => { write(v); setOpen(false); };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6"
    >
      <div className="mx-auto max-w-5xl rounded-xl border border-white/10 bg-[color:var(--card)]/95 p-4 shadow-2xl backdrop-blur sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground sm:max-w-2xl">
            We use strictly necessary cookies to run this site and, with your consent, optional cookies
            for analytics to improve your experience. You can change your choice at any time. See our{" "}
            <Link to="/legal/cookies" className="text-[color:var(--flame-light)] underline">Cookie Policy</Link>{" "}
            and{" "}
            <Link to="/legal/privacy" className="text-[color:var(--flame-light)] underline">Privacy Policy</Link>{" "}
            (PIPEDA &amp; CASL compliant).
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => decide("rejected")}
              className="rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
            >
              Reject optional
            </button>
            <button
              type="button"
              onClick={() => decide("accepted")}
              className="rounded-md bg-[color:var(--flame)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
