import Lottie from "lottie-react";
import { useSiteSettings } from "@/hooks/use-site-settings";
import whatsappAnim from "@/assets/whatsapp-lottie.json";

export default function WhatsAppFab() {
  const s = useSiteSettings() as Record<string, string>;
  const raw = ((s.contact_whatsapp || "").trim() || (s.contact_phone || "").trim());
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const href = `https://wa.me/${digits}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 left-5 z-50 h-16 w-16 hover:scale-110 transition-transform drop-shadow-lg"
    >
      <Lottie animationData={whatsappAnim} loop autoplay />
    </a>
  );
}
