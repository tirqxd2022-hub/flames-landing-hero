import { useEffect, useRef, useState } from "react";
import { Delete, Check, X, ArrowBigUp, Space } from "lucide-react";

/**
 * Touch/click-friendly virtual QWERTY keyboard. Mirrors the NumPad UX: renders
 * as a popover anchored to a trigger element and mutates the parent value via
 * onChange for each keypress. Physical keyboard input still works because the
 * underlying <input> keeps focus semantics on the caller side.
 */
export function TextPad({
  open,
  value,
  onChange,
  onClose,
  anchorRef,
  title = "Type",
  uppercase,
  multiline,
  quickNotes,
}: {
  open: boolean;
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  title?: string;
  /** If true, all letters are forced uppercase (e.g. coupon code). */
  uppercase?: boolean;
  /** Show a return/newline key. */
  multiline?: boolean;
  /** Predefined chips appended to the current value on click. */
  quickNotes?: string[];
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(false);
  const [symbols, setSymbols] = useState(false);

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
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  function type(ch: string) {
    let out = ch;
    if (/[a-z]/i.test(ch)) {
      out = shift || uppercase ? ch.toUpperCase() : ch.toLowerCase();
      if (shift) setShift(false);
    }
    onChange(value + out);
  }

  const LETTERS = [
    ["q","w","e","r","t","y","u","i","o","p"],
    ["a","s","d","f","g","h","j","k","l"],
    ["z","x","c","v","b","n","m"],
  ];
  const SYMBOLS = [
    ["1","2","3","4","5","6","7","8","9","0"],
    ["-","/",":",";","(",")","$","&","@","\""],
    [".",",","?","!","'","+","*","#","%"],
  ];
  const rows = symbols ? SYMBOLS : LETTERS;

  if (!open) return null;

  const key =
    "h-10 min-w-[28px] flex-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/10 text-sm font-semibold text-white select-none transition-colors";

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label={title}
      className="absolute right-full top-0 mr-2 z-50 rounded-xl border border-white/10 bg-[color:var(--card)] shadow-2xl p-2.5 w-[440px]"
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

      {quickNotes && quickNotes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {quickNotes.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                const sep = value && !/\s$/.test(value) ? (value.endsWith(",") ? " " : ", ") : "";
                onChange(value + sep + n);
              }}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-[color:var(--flame)]/15 border border-[color:var(--flame)]/40 text-[color:var(--flame-light)] hover:bg-[color:var(--flame)]/25 transition-colors"
            >
              + {n}
            </button>
          ))}
        </div>
      )}




      <div className="space-y-1.5">
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-1.5">
            {ri === 2 && !symbols && (
              <button
                type="button"
                onClick={() => setShift((v) => !v)}
                className={`${key} !flex-none w-10 ${shift ? "bg-[color:var(--flame)]/30 border-[color:var(--flame)]/60" : ""}`}
                aria-label="Shift"
              >
                <ArrowBigUp className="h-4 w-4 mx-auto" />
              </button>
            )}
            {row.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => type(ch)}
                className={key}
              >
                {/[a-z]/i.test(ch) ? (shift || uppercase ? ch.toUpperCase() : ch) : ch}
              </button>
            ))}
            {ri === 2 && (
              <button
                type="button"
                onClick={() => onChange(value.slice(0, -1))}
                className={`${key} !flex-none w-12 text-[color:var(--flame-light)]`}
                aria-label="Backspace"
              >
                ⌫
              </button>
            )}
          </div>
        ))}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setSymbols((v) => !v)}
            className={`${key} !flex-none w-14 text-xs`}
          >
            {symbols ? "ABC" : "123"}
          </button>
          <button
            type="button"
            onClick={() => onChange(value + " ")}
            className={`${key} inline-flex items-center justify-center gap-1`}
            aria-label="Space"
          >
            <Space className="h-4 w-4" />
          </button>
          {multiline && (
            <button
              type="button"
              onClick={() => onChange(value + "\n")}
              className={`${key} !flex-none w-14 text-xs`}
            >
              ↵
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onChange("")}
          className="h-9 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1"
        >
          <Delete className="h-4 w-4" /> Clear
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-lg bg-[color:var(--flame)] hover:brightness-110 text-white text-xs font-semibold flex items-center justify-center gap-1"
        >
          <Check className="h-4 w-4" /> Done
        </button>
      </div>
    </div>
  );
}
