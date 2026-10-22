import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { CheckCircle2, Loader2, UserX, XCircle } from "lucide-react";

export type Outcome = "interviewed" | "no_attendance" | "no_longer_interested";

/**
 * "Complete session" dialog. `onOutcome` is called synchronously from the click so the
 * caller can open a WhatsApp tab before any await (pop-up blockers allow it then).
 */
export function CompleteDialog({
  open,
  onOpenChange,
  name,
  hasProgramme,
  busy,
  onOutcome,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  hasProgramme: boolean;
  busy: boolean;
  onOutcome: (outcome: Outcome, comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [confirming, setConfirming] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[#031128]/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[61] max-h-[90svh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl outline-none">
          <div>
            <Dialog.Title className="text-xl font-black text-[#092553]">Complete session with {name}</Dialog.Title>
            <Dialog.Description className="text-sm text-slate-600">Choose the real outcome of this booked call.</Dialog.Description>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="session-comment" className="text-sm font-bold text-[#092553]">
              Session comment
            </label>
            <textarea
              id="session-comment"
              rows={4}
              className="field"
              placeholder="Add the candidate's questions, decision, attendance note, or next steps…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <p className="text-xs text-slate-500">This comment will be saved with the candidate and shown in the destination admin table.</p>
          </div>

          <button
            disabled={busy}
            onClick={() => setConfirming(true)}
            className="flex w-full items-center gap-3 rounded-2xl bg-emerald-600 px-4 py-4 text-left text-white outline-none hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />}
            <span>
              <span className="block font-black">Interviewed</span>
              <span className="text-sm text-white/85">
                {hasProgramme ? "Move to document upload and email the presentation PDF" : "Move to document upload; programme can be selected later"}
              </span>
            </span>
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              disabled={busy}
              onClick={() => onOutcome("no_attendance", comment)}
              className="flex items-center gap-3 rounded-2xl border-2 border-amber-300 px-4 py-3 text-left text-amber-900 outline-none hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60"
            >
              <UserX className="h-5 w-5 shrink-0" />
              <span>
                <span className="block font-black">No Attendance</span>
                <span className="text-xs">Candidate did not join</span>
              </span>
            </button>
            <button
              disabled={busy}
              onClick={() => onOutcome("no_longer_interested", comment)}
              className="flex items-center gap-3 rounded-2xl border-2 border-rose-300 px-4 py-3 text-left text-rose-900 outline-none hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-60"
            >
              <XCircle className="h-5 w-5 shrink-0" />
              <span>
                <span className="block font-black">No Longer Interested</span>
                <span className="text-xs">Close this candidate's active journey</span>
              </span>
            </button>
          </div>

          <AlertDialog.Root open={confirming} onOpenChange={setConfirming}>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-[#031128]/50" />
              <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl bg-white p-6 shadow-2xl outline-none">
                <AlertDialog.Title className="text-lg font-black text-[#092553]">Move {name} to Interviewed?</AlertDialog.Title>
                <AlertDialog.Description className="text-sm text-slate-600">
                  {hasProgramme
                    ? "They move to document upload, and we email them their personalised presentation PDF with a dashboard link. WhatsApp opens with a ready message."
                    : "They move to document upload. No PDF is sent because no programme is selected — you can choose one later."}
                </AlertDialog.Description>
                <div className="flex justify-end gap-2">
                  <AlertDialog.Cancel className="rounded-full px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancel</AlertDialog.Cancel>
                  <AlertDialog.Action
                    onClick={() => onOutcome("interviewed", comment)}
                    className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    Move to Interviewed
                  </AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
