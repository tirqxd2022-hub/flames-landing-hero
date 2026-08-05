import { useRef, useState, useSyncExternalStore } from "react";
import { Keyboard } from "lucide-react";
import { NumPad } from "./NumPad";
import { TextPad } from "./TextPad";

/**
 * Global toggle for the virtual keyboard. When disabled, VirtualInput behaves
 * like a plain input — the keyboard icon is hidden and pads don't open.
 * Persisted to localStorage so the choice survives reloads.
 */
const VK_KEY = "vk_enabled";
let vkEnabled = (() => {
  try { return localStorage.getItem(VK_KEY) === "1"; } catch { return false; }
})();
const vkListeners = new Set<() => void>();
export function setVirtualKeyboardEnabled(v: boolean) {
  vkEnabled = v;
  try { localStorage.setItem(VK_KEY, v ? "1" : "0"); } catch {}
  vkListeners.forEach((l) => l());
}
export function useVirtualKeyboardEnabled() {
  return useSyncExternalStore(
    (cb) => { vkListeners.add(cb); return () => vkListeners.delete(cb); },
    () => vkEnabled,
    () => false,
  );
}


type Common = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  padTitle?: string;
  autoOpenOnFocus?: boolean;
};

/**
 * A text/number input that pairs a physical <input> with a virtual on-screen
 * pad (QWERTY for text, digit pad for numbers). Click the keyboard icon on the
 * right (or focus the field when `autoOpenOnFocus` is set) to open the pad —
 * physical typing still works as normal.
 */
export function VirtualInput({
  kind,
  value,
  onChange,
  placeholder,
  className,
  padTitle,
  quickAdds,
  quickNotes,
  allowDecimal = true,
  uppercase,
  inputMode,
  autoOpenOnFocus,
  as = "input",
  rows,
}: Common & {
  kind: "text" | "number";
  quickAdds?: number[];
  quickNotes?: string[];
  allowDecimal?: boolean;
  uppercase?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  as?: "input" | "textarea";
  rows?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const enabledRaw = useVirtualKeyboardEnabled();
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const enabled = enabledRaw && !isMobile;
  const [openRaw, setOpen] = useState(false);
  const open = enabled && openRaw;

  const commonProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      onChange(uppercase && kind === "text" ? v.toUpperCase() : v);
    },
    placeholder,
    onFocus: () => { if (enabled && autoOpenOnFocus) setOpen(true); },
    className: `w-full ${enabled ? "pr-9" : ""} ${className || ""}`,
  };

  return (
    <div className="relative" ref={wrapRef}>
      {as === "textarea" ? (
        <textarea rows={rows ?? 2} {...(commonProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input
          type={kind === "number" ? "text" : "text"}
          inputMode={inputMode ?? (kind === "number" ? "decimal" : "text")}
          {...(commonProps as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {enabled && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
          aria-label="Open virtual keyboard"
          title="Virtual keyboard"
          className={`absolute right-2 top-2 h-6 w-6 grid place-items-center rounded ${open ? "text-[color:var(--flame-light)] bg-[color:var(--flame)]/10" : "text-muted-foreground hover:text-white"}`}
        >
          <Keyboard className="h-4 w-4" />
        </button>
      )}
      {kind === "number" ? (
        <NumPad
          open={open}
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
          anchorRef={wrapRef}
          title={padTitle || placeholder || "Enter number"}
          allowDecimal={allowDecimal}
          quickAdds={quickAdds}
        />
      ) : (
        <TextPad
          open={open}
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
          anchorRef={wrapRef}
          title={padTitle || placeholder || "Type"}
          uppercase={uppercase}
          multiline={as === "textarea"}
          quickNotes={quickNotes}
        />
      )}
    </div>
  );
}
