import { useEffect, useRef, useState } from "react";
import { Bot, X, Send, Trash2, Check, XCircle, Loader2, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { request } from "@/lib/api";

type ApprovalCard = {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "running";
  result?: unknown;
  error?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  approvals?: ApprovalCard[];
};

const STORAGE_KEY = "admin_assistant_messages_v1";
const MAX_HISTORY = 40;

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(-MAX_HISTORY);
  } catch { return []; }
}

function saveHistory(messages: ChatMessage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY))); } catch { /* ignore */ }
}

function newId() { return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

function humanToolName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanFieldName(key: string) {
  const map: Record<string, string> = {
    percent: "Discount",
    amount: "Discount amount",
    min_subtotal: "Minimum order",
    starts_at: "Starts",
    expires_at: "Expires",
    time_from: "From time",
    time_to: "To time",
    days_of_week: "Days",
    dining_option: "Dining option",
    trigger_product_ids: "Buy these items",
    reward_product_ids: "Get these items",
    reward_category_ids: "Reward from categories",
    image_url: "Image",
    long_description: "Long description",
    is_featured: "Featured",
    is_active: "Active",
    category_id: "Category",
    subcategory_id: "Subcategory",
  };
  return map[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanFieldValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.map((x) => humanFieldValue(x)).join(", ") : "—";
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${humanFieldName(k)}: ${humanFieldValue(val)}`)
      .join("; ");
  }
  return String(v);
}


export default function AssistantBubble({ visible }: { visible: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { saveHistory(messages); }, [messages]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Voice dictation via Web Speech API (free, browser-native; Chrome/Edge/Safari)
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const voiceSupported = typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const baseInputRef = useRef("");
  const toggleVoice = () => {
    if (!voiceSupported) { toast.error("Voice input not supported in this browser. Try Chrome or Edge."); return; }
    if (listening) { try { recognitionRef.current?.stop(); } catch { /* ignore */ } return; }
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    baseInputRef.current = input ? input.trim() + " " : "";
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setInput((baseInputRef.current + txt).trimStart());
    };
    rec.onerror = (e: any) => { setListening(false); if (e?.error && e.error !== "no-speech" && e.error !== "aborted") toast.error(`Voice: ${e.error}`); };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  };
  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch { /* ignore */ } }, []);


  if (!visible) return null;

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const userMsg: ChatMessage = { id: newId(), role: "user", text };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);
    try {
      const apiMessages = next.map((m) => ({ role: m.role, content: m.text }));
      const res = await request<{ text: string; pendingApprovals: ApprovalCard[] }>(
        "/admin/assistant/chat",
        { method: "POST", body: JSON.stringify({ messages: apiMessages }) },
      );
      const approvals: ApprovalCard[] = (res.pendingApprovals || []).map((a) => ({
        ...a, status: "pending" as const,
      }));
      setMessages((m) => [...m, {
        id: newId(),
        role: "assistant",
        text: res.text || (approvals.length ? "I've prepared the action below. Please review and approve." : ""),
        approvals: approvals.length ? approvals : undefined,
      }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assistant failed");
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function approve(msgId: string, card: ApprovalCard) {
    setMessages((arr) => arr.map((m) => m.id !== msgId ? m : ({
      ...m, approvals: m.approvals?.map((a) => a.id === card.id ? { ...a, status: "running" } : a),
    })));
    try {
      const res = await request<{ ok: boolean; result: unknown }>(
        "/admin/assistant/execute",
        { method: "POST", body: JSON.stringify({ toolName: card.toolName, args: card.args }) },
      );
      setMessages((arr) => arr.map((m) => m.id !== msgId ? m : ({
        ...m, approvals: m.approvals?.map((a) => a.id === card.id ? { ...a, status: "approved", result: res.result } : a),
      })));
      toast.success(`${humanToolName(card.toolName)} done`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Execution failed";
      setMessages((arr) => arr.map((m) => m.id !== msgId ? m : ({
        ...m, approvals: m.approvals?.map((a) => a.id === card.id ? { ...a, status: "pending", error: msg } : a),
      })));
      toast.error(msg);
    }
  }

  function reject(msgId: string, card: ApprovalCard) {
    setMessages((arr) => arr.map((m) => m.id !== msgId ? m : ({
      ...m, approvals: m.approvals?.map((a) => a.id === card.id ? { ...a, status: "rejected" } : a),
    })));
  }

  function clearChat() {
    if (!confirm("Clear all chat history?")) return;
    setMessages([]);
  }

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[color:var(--flame)] text-white shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[min(420px,calc(100vw-2rem))] h-[min(640px,calc(100vh-3rem))] rounded-2xl border border-white/10 bg-[color:var(--card)] shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-background/60">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[color:var(--flame)]/15 text-[color:var(--flame)] grid place-items-center">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Xpert</div>
                <div className="text-[10px] text-muted-foreground">Your friendly System Expert · here to chat & guide you</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={clearChat} title="Clear chat" className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-white">
                <Trash2 className="h-4 w-4" />
              </button>
              <button onClick={() => setOpen(false)} title="Close" className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-10">
                Hi, I'm <span className="text-[color:var(--gold)] font-semibold">Xpert</span> 👋<br />
                Happy to chat or walk you step-by-step through creating orders,<br />
                coupons, offers and more. What's on your mind?
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[color:var(--flame)] text-white px-3 py-2 text-sm whitespace-pre-wrap">
                    {m.text}
                  </div>
                ) : (
                  <div className="max-w-full space-y-2">
                    {m.text && (
                      <div className="text-sm text-white/90 prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                        <ReactMarkdown>{m.text}</ReactMarkdown>
                      </div>
                    )}
                    {m.approvals?.map((card) => (
                      <div key={card.id} className="rounded-lg border border-[color:var(--flame)]/30 bg-background/40 p-3 text-xs">
                        <div className="font-semibold text-[color:var(--gold)] mb-1">{humanToolName(card.toolName)}</div>
                        <dl className="text-[11px] grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 bg-black/20 rounded p-2 max-h-48 overflow-auto">
                          {Object.entries(card.args || {}).map(([k, v]) => (
                            <>
                              <dt key={`k-${k}`} className="text-muted-foreground">{humanFieldName(k)}</dt>
                              <dd key={`v-${k}`} className="text-white/90 break-words">{humanFieldValue(v)}</dd>
                            </>
                          ))}
                        </dl>

                        {card.error && <div className="mt-2 text-red-400">{card.error}</div>}
                        <div className="mt-2 flex gap-2">
                          {card.status === "pending" && (
                            <>
                              <button onClick={() => approve(m.id, card)} className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
                                <Check className="h-3 w-3" /> Approve
                              </button>
                              <button onClick={() => reject(m.id, card)} className="flex items-center gap-1 px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-muted-foreground text-xs">
                                <XCircle className="h-3 w-3" /> Reject
                              </button>
                            </>
                          )}
                          {card.status === "running" && (
                            <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Running…</span>
                          )}
                          {card.status === "approved" && (
                            <span className="text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Done</span>
                          )}
                          {card.status === "rejected" && (
                            <span className="text-muted-foreground">Rejected</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-2 bg-background/40">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                rows={2}
                placeholder="Chat with Xpert… e.g. walk me through creating a coupon"
                className="flex-1 resize-none rounded-md bg-background/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-[color:var(--flame)]/50"
              />
              <button
                type="button"
                onClick={toggleVoice}
                disabled={busy}
                aria-label={listening ? "Stop voice input" : "Start voice input"}
                title={voiceSupported ? (listening ? "Stop listening" : "Speak your message") : "Voice input not supported in this browser"}
                className={`h-9 w-9 grid place-items-center rounded-md border border-white/10 disabled:opacity-40 ${listening ? "bg-red-600 text-white animate-pulse" : "bg-background/60 text-white hover:bg-white/10"}`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={send}
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="h-9 w-9 grid place-items-center rounded-md bg-[color:var(--flame)] text-white disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
