import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import WhatsAppFab from "@/components/WhatsAppFab";
import CookieBanner from "@/components/CookieBanner";
import AnnouncementBar from "@/components/AnnouncementBar";

export default function SiteLayout() {
  const { pathname } = useLocation();
  const hideWhatsApp = pathname.startsWith("/create-order");
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <div className="relative flex-1 flex flex-col">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
      {!hideWhatsApp && <WhatsAppFab />}
      <CookieBanner />
    </div>
  );
}
