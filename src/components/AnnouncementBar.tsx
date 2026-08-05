import { useSiteSettings } from "@/hooks/use-site-settings";

export default function AnnouncementBar() {
  const settings = useSiteSettings() as Record<string, string>;
  const text = (settings.announcement_text || "").trim();
  if (!text) return null;
  const speedRaw = parseFloat(String(settings.announcement_speed || ""));
  const speed = Number.isFinite(speedRaw) && speedRaw > 0 ? speedRaw : 18;

  // Split by | or newline for multiple messages, fallback to single
  const parts = text.split(/\s*[|\n]\s*/).filter(Boolean);
  const items = parts.length > 1 ? parts : [text];
  // Repeat enough times to fill the marquee smoothly
  const repeated = Array.from({ length: 8 }, () => items).flat();

  return (
    <div className="relative z-50 w-full bg-[color:var(--flame)] text-white overflow-hidden">
      <div className="flex whitespace-nowrap py-2 announcement-marquee">
        {repeated.map((t, i) => (
          <span key={i} className="mx-8 text-xs sm:text-sm font-medium tracking-wide inline-flex items-center gap-8">
            {t}
            <span className="opacity-60">★</span>
          </span>
        ))}
      </div>
      <style>{`
        .announcement-marquee {
          animation: announcement-scroll ${speed}s linear infinite;
          width: max-content;
        }
        @keyframes announcement-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
