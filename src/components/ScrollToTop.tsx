import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Scrolls to top of the page on every route change (ignores hash links). */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);
  return null;
}
