import { useEffect, useRef } from "react";
import { Delete, Check, X } from "lucide-react";

/**
 * Touch/click-friendly virtual number pad. Renders as a popover anchored to a
 * trigger element. The parent controls the value as a string (so partial
 * entries like "12." are preserved).
 */
export function NumPad({
  open,
  value,
  onChange,
  onClose,
  anchorRef,
  title = "Enter amount",
  allowDecimal = true,
  quickAdds,
}: {
  open: boolean;
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  title?: string;
  allowDecimal?: boolean;
  quickAdds?: number[];
}) {
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter") onClose();
      else if (e.key === "Backspace") { e.preventDefault(); press("back"); }
      else if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (allowDecimal && e.key === ".") { e.preventDefault(); press("."); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  function press(k: string) {
    if (k === "clear") return onChange("");
    if (k === "back") return onChange(value.slice(0, -1));
    if (k === ".") {
      if (!allowDecimal) return;
      if (value.includes(".")) return;
      return onChange((value || "0") + ".");
    }
    // digit
    // prevent leading zeros like "007"
    let next = value + k;
    if (/^0\d/.test(next)) next = next.replace(/^0+/, "");
    // limit 2 decimals
    if (next.includes(".")) {
      const [i, d = ""] = next.split(".");
      next = i + "." + d.slice(0, 2);
    }
    if (next.length > 10) return;
    onChange(next);
  }

  function quickAdd(n: number) {
    const cur = parseFloat(value || "0") || 0;
    const nv = Math.round((cur + n) * 100) / 100;
    onChange(nv.toFixed(2));
  }

  if (!open) return null;

  const btn =
    "h-12 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/10 text-lg font-semibold text-white select-none transition-colors";
  const KEYS: Array<{ label: string; k: string; cls?: string }> = [
    { label: "7", k: "7" }, { label: "8", k: "8" }, { label: "9", k: "9" },
    { label: "4", k: "4" }, { label: "5", k: "5" }, { label: "6", k: "6" },
    { label: "1", k: "1" }, { label: "2", k: "2" }, { label: "3", k: "3" },
    { label: allowDecimal ? "." : "", k: ".", cls: allowDecimal ? "" : "invisible" },
    { label: "0", k: "0" },
    { label: "⌫", k: "back" },
  ];

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label={title}
      className="absolute right-full top-0 mr-2 z-50 rounded-xl border border-white/10 bg-[color:var(--card)] shadow-2xl p-3 w-[280px]"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-white p-1"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>


      {quickAdds && quickAdds.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {quickAdds.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => quickAdd(n)}
              className="h-8 rounded-md bg-[color:var(--flame)]/10 hover:bg-[color:var(--flame)]/20 border border-[color:var(--flame)]/30 text-[color:var(--flame-light)] text-xs font-semibold"
            >
              +{n}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {KEYS.map((k, i) => (
          <button
            key={i}
            type="button"
            onClick={() => k.k && press(k.k)}
            className={`${btn} ${k.cls || ""} ${k.k === "back" ? "text-[color:var(--flame-light)]" : ""}`}
            aria-label={k.k === "back" ? "Backspace" : k.label}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onChange("")}
          className="h-10 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-sm font-semibold text-muted-foreground flex items-center justify-center gap-1"
        >
          <Delete className="h-4 w-4" /> Clear
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-lg bg-[color:var(--flame)] hover:brightness-110 text-white text-sm font-semibold flex items-center justify-center gap-1"
        >
          <Check className="h-4 w-4" /> Done
        </button>
      </div>
    </div>
  );
}
