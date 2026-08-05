/**
 * Best-effort deterrent against casual photo/video downloads:
 * - Blocks right-click context menu on <img> and <video>
 * - Blocks native drag-and-drop save
 * - Disables the default video controls' download button
 * Note: nothing client-side can fully prevent a determined user.
 */
export function installMediaDownloadGuard() {
  if (typeof window === "undefined") return;

  const isMedia = (el: EventTarget | null): el is HTMLElement => {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    return tag === "IMG" || tag === "VIDEO" || tag === "PICTURE" || tag === "SOURCE";
  };

  window.addEventListener("contextmenu", (e) => {
    if (isMedia(e.target)) e.preventDefault();
  });
  window.addEventListener("dragstart", (e) => {
    if (isMedia(e.target)) e.preventDefault();
  });

  // Strip the download button from any <video controls> elements as they appear.
  const harden = (root: ParentNode) => {
    root.querySelectorAll("video").forEach((v) => {
      v.setAttribute("controlsList", "nodownload noremoteplayback");
      v.setAttribute("disablePictureInPicture", "");
    });
    root.querySelectorAll("img").forEach((img) => {
      img.setAttribute("draggable", "false");
    });
  };
  harden(document);
  const mo = new MutationObserver((mut) => {
    for (const m of mut) m.addedNodes.forEach((n) => {
      if (n instanceof HTMLElement) harden(n);
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}
