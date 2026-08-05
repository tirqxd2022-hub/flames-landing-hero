import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

/**
 * Small modal asking a staff user whether they want to just log out or also
 * clock out for the day. Customers should never see this — bypass it.
 */
export default function LogoutChoiceModal({
  open, userName, onCancel, onConfirm,
}: {
  open: boolean;
  userName: string;
  onCancel: () => void;
  onConfirm: (checkOut: boolean) => Promise<void> | void;
}) {
  const [choice, setChoice] = useState<"logout" | "checkout">("checkout");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try { await onConfirm(choice === "checkout"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="max-w-md bg-[color:var(--card)] border-white/10">
        <DialogHeader><DialogTitle>End your session</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">You're signed in as <span className="text-white font-medium">{userName}</span>.</p>
        <div className="mt-3 space-y-2">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-white/10 cursor-pointer hover:bg-white/5">
            <input type="radio" name="logout-choice" className="mt-0.5" checked={choice === "checkout"} onChange={() => setChoice("checkout")} />
            <span>
              <span className="block text-sm font-medium text-white">Log out and check out</span>
              <span className="block text-xs text-muted-foreground">Ends your shift and records the time in Staff Attendance.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-white/10 cursor-pointer hover:bg-white/5">
            <input type="radio" name="logout-choice" className="mt-0.5" checked={choice === "logout"} onChange={() => setChoice("logout")} />
            <span>
              <span className="block text-sm font-medium text-white">Log out only</span>
              <span className="block text-xs text-muted-foreground">Signs you out but keeps your shift open.</span>
            </span>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-3 py-2 text-sm rounded-md border border-white/10 text-muted-foreground hover:text-white disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={busy}
            className="btn-flame px-4 py-2 text-sm justify-center disabled:opacity-60">
            {busy ? "…" : "Confirm"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
