import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, Link as LinkIcon, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Image as ImageIcon, Undo, Redo, Code, Eye } from "lucide-react";
import { MediaLibraryModal } from "@/components/admin/MediaPickerButton";
import { resolveAssetUrl } from "@/lib/api";

type Props = {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
};

/**
 * Lightweight WYSIWYG with an HTML source toggle. Uses contentEditable +
 * document.execCommand — good enough for newsletter HTML editing without
 * pulling in a heavy editor dependency. Images can be inserted from the
 * media library and resized by dragging their bottom-right corner.
 */
export default function RichTextEditor({ value, onChange, minHeight = 420 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [mediaOpen, setMediaOpen] = useState(false);

  // Sync external value -> editor when switching to visual or value changes externally.
  useEffect(() => {
    if (mode === "visual" && ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value, mode]);

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection() {
    ref.current?.focus();
    if (savedRange.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRange.current);
    }
  }

  function exec(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }
  function onInput() {
    if (ref.current) onChange(ref.current.innerHTML);
  }
  function addLink() {
    const sel = window.getSelection();
    const existing = sel?.anchorNode?.parentElement?.closest("a")?.getAttribute("href") || "https://";
    const url = prompt("Link URL", existing);
    if (url) exec("createLink", url);
  }
  function insertImageUrl(url: string) {
    const abs = resolveAssetUrl(url);
    restoreSelection();
    document.execCommand("insertHTML", false,
      `<img src="${abs}" alt="" style="max-width:100%;height:auto;" />`);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  // Drag-to-resize images by their bottom-right corner.
  useEffect(() => {
    const el = ref.current;
    if (!el || mode !== "visual") return;
    let target: HTMLImageElement | null = null;
    let startX = 0, startW = 0, ratio = 1;

    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!(t instanceof HTMLImageElement)) return;
      const rect = t.getBoundingClientRect();
      // Bottom-right 16x16 zone = resize handle.
      if (e.clientX > rect.right - 16 && e.clientY > rect.bottom - 16) {
        e.preventDefault();
        target = t;
        startX = e.clientX;
        startW = rect.width;
        ratio = rect.height / rect.width;
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      }
    };
    const onMove = (e: MouseEvent) => {
      if (!target) return;
      const w = Math.max(40, startW + (e.clientX - startX));
      target.style.width = `${Math.round(w)}px`;
      target.style.height = `${Math.round(w * ratio)}px`;
      target.style.maxWidth = "100%";
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      target = null;
      if (ref.current) onChange(ref.current.innerHTML);
    };
    el.addEventListener("mousedown", onDown);
    return () => {
      el.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [mode, onChange]);

  const btn = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background hover:bg-secondary text-foreground";

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-1.5">
        <button type="button" className={btn} title="Bold" onClick={() => exec("bold")}><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Italic" onClick={() => exec("italic")}><Italic className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Underline" onClick={() => exec("underline")}><Underline className="h-3.5 w-3.5" /></button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button type="button" className={btn} title="Heading 1" onClick={() => exec("formatBlock", "<h1>")}><Heading1 className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Heading 2" onClick={() => exec("formatBlock", "<h2>")}><Heading2 className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Paragraph" onClick={() => exec("formatBlock", "<p>")}>P</button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button type="button" className={btn} title="Bulleted list" onClick={() => exec("insertUnorderedList")}><List className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Numbered list" onClick={() => exec("insertOrderedList")}><ListOrdered className="h-3.5 w-3.5" /></button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button type="button" className={btn} title="Align left" onClick={() => exec("justifyLeft")}><AlignLeft className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Align center" onClick={() => exec("justifyCenter")}><AlignCenter className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Align right" onClick={() => exec("justifyRight")}><AlignRight className="h-3.5 w-3.5" /></button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button type="button" className={btn} title="Insert link" onClick={addLink}><LinkIcon className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Insert image from media library"
          onClick={() => { saveSelection(); setMediaOpen(true); }}>
          <ImageIcon className="h-3.5 w-3.5" />
        </button>
        <span className="mx-1 h-5 w-px bg-border" />
        <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          Color
          <input type="color" onChange={(e) => exec("foreColor", e.target.value)} className="h-7 w-7 cursor-pointer rounded border border-border bg-background" />
        </label>
        <span className="mx-1 h-5 w-px bg-border" />
        <button type="button" className={btn} title="Undo" onClick={() => exec("undo")}><Undo className="h-3.5 w-3.5" /></button>
        <button type="button" className={btn} title="Redo" onClick={() => exec("redo")}><Redo className="h-3.5 w-3.5" /></button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setMode("visual")}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${mode === "visual" ? "bg-secondary text-white" : "text-muted-foreground hover:text-white"}`}>
            <Eye className="h-3.5 w-3.5" /> Visual
          </button>
          <button type="button" onClick={() => setMode("html")}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${mode === "html" ? "bg-secondary text-white" : "text-muted-foreground hover:text-white"}`}>
            <Code className="h-3.5 w-3.5" /> HTML
          </button>
        </div>
      </div>

      {mode === "visual" ? (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          style={{ minHeight }}
          className="rte-surface prose prose-invert max-w-none overflow-auto bg-white p-4 text-sm text-black focus:outline-none"
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ minHeight }}
          className="block w-full resize-y bg-background p-3 font-mono text-xs text-foreground focus:outline-none"
        />
      )}

      {/* Scoped styles: link affordance + resize cursor hint on images. */}
      <style>{`
        .rte-surface a { cursor: pointer; }
        .rte-surface a[href]:hover { position: relative; }
        .rte-surface a[href]:hover::after {
          content: attr(href);
          position: absolute;
          left: 0;
          top: 100%;
          margin-top: 4px;
          z-index: 10;
          background: #111827;
          color: #fff;
          font: 11px/1.4 ui-sans-serif, system-ui, sans-serif;
          padding: 4px 8px;
          border-radius: 4px;
          white-space: nowrap;
          max-width: 360px;
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
        }
        .rte-surface img {
          display: inline-block;
          outline: 1px dashed transparent;
        }
        .rte-surface img:hover { outline-color: rgba(37,99,235,0.5); }
      `}</style>

      {mediaOpen && (
        <MediaLibraryModal
          initialTab="page"
          onClose={() => setMediaOpen(false)}
          onSelect={(url) => { setMediaOpen(false); insertImageUrl(url); }}
        />
      )}
    </div>
  );
}
