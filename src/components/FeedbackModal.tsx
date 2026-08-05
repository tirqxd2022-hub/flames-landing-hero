import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bold, Italic, Underline, Image as ImageIcon, Link as LinkIcon, List, ListOrdered, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendFeedback } from "@/lib/api";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

const MAX_IMG_BYTES = 4 * 1024 * 1024; // 4 MB per pasted/uploaded image

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(String(fr.result || ""));
    fr.readAsDataURL(file);
  });
}

/**
 * Lightweight rich text editor for site feedback. Supports:
 *  - basic formatting (bold/italic/underline/list/link)
 *  - inserting images via toolbar button (file picker)
 *  - pasting images from the clipboard (Ctrl+V / right-click → Paste)
 *  - drag & drop image files
 * Images are inlined as base64 data URIs so the backend can forward them
 * without needing a separate upload pipeline.
 */
export default function FeedbackModal({ open, onOpenChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && editorRef.current) {
      editorRef.current.innerHTML = "";
      setTimeout(() => editorRef.current?.focus(), 50);
    }
  }, [open]);

  function exec(cmd: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
  }

  function insertImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_IMG_BYTES) {
      toast.error(`Image is too large (max ${Math.round(MAX_IMG_BYTES / 1024 / 1024)} MB)`);
      return;
    }
    fileToDataUrl(file).then((dataUrl) => {
      editorRef.current?.focus();
      document.execCommand("insertHTML", false, `<img src="${dataUrl}" style="max-width:100%;height:auto;border-radius:6px;margin:6px 0" />`);
    });
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(e.clipboardData?.items || []);
    const imgItem = items.find((it) => it.kind === "file" && it.type.startsWith("image/"));
    if (imgItem) {
      e.preventDefault();
      const file = imgItem.getAsFile();
      if (file) insertImageFile(file);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length) {
      e.preventDefault();
      files.forEach(insertImageFile);
    }
  }

  async function submit() {
    const html = editorRef.current?.innerHTML?.trim() || "";
    const text = editorRef.current?.innerText?.trim() || "";
    if (!html || !text) {
      toast.error("Please type your feedback before submitting.");
      return;
    }
    setSending(true);
    try {
      await sendFeedback({
        html,
        text,
        fromName: fromName.trim() || undefined,
        fromEmail: fromEmail.trim() || undefined,
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
      });
      toast.success("Thanks! Your feedback has been sent.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send feedback");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send feedback to the developer</DialogTitle>
          <DialogDescription>
            Type your message and attach screenshots (toolbar, paste with Ctrl+V, or drag-and-drop).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input placeholder="Your name (optional)" value={fromName} onChange={(e) => setFromName(e.target.value)} />
          <Input type="email" placeholder="Your email (optional)" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
        </div>

        <div className="rounded-md border border-white/10 bg-background overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-2 py-1.5">
            <ToolBtn title="Bold" onClick={() => exec("bold")}><Bold className="h-4 w-4" /></ToolBtn>
            <ToolBtn title="Italic" onClick={() => exec("italic")}><Italic className="h-4 w-4" /></ToolBtn>
            <ToolBtn title="Underline" onClick={() => exec("underline")}><Underline className="h-4 w-4" /></ToolBtn>
            <span className="mx-1 h-4 w-px bg-white/10" />
            <ToolBtn title="Bullet list" onClick={() => exec("insertUnorderedList")}><List className="h-4 w-4" /></ToolBtn>
            <ToolBtn title="Numbered list" onClick={() => exec("insertOrderedList")}><ListOrdered className="h-4 w-4" /></ToolBtn>
            <ToolBtn title="Insert link" onClick={() => { const url = window.prompt("Link URL"); if (url) exec("createLink", url); }}><LinkIcon className="h-4 w-4" /></ToolBtn>
            <ToolBtn title="Insert image" onClick={() => fileInputRef.current?.click()}><ImageIcon className="h-4 w-4" /></ToolBtn>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                Array.from(e.target.files || []).forEach(insertImageFile);
                e.target.value = "";
              }}
            />
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onPaste={onPaste}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="min-h-[220px] max-h-[420px] overflow-y-auto px-3 py-2 text-sm focus:outline-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_a]:underline [&_a]:text-[color:var(--flame)]"
            data-placeholder="Tell us what's on your mind…"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={submit} disabled={sending}>
            {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : "Send feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-white hover:bg-white/5"
    >
      {children}
    </button>
  );
}
