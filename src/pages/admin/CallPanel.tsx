import { useState } from "react";
import { CalendarCheck, Mail, MessageCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { BOOKING_LINK, CALL_STAGE_LABELS, callStage, waLink } from "../../lib/options";
import type { Consultation } from "../../lib/types";
import { Alert, Button } from "../../components/ui";
import { bookingMessage, confirmAndNotify, maltaTime, notifyCandidate } from "./calls";

/**
 * Admin call workflow, kept simple: see the time the candidate asked for, send them the
 * real Google booking link (email or WhatsApp), then confirm once they have booked.
 */
export function CallPanel({ c, onSaved }: { c: Consultation; onSaved: () => void }) {
  const stage = callStage(c);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const requested = c.requested_call_times[0];

  const sendBookingEmail = async () => {
    setSending(true);
    const r = await notifyCandidate("booking-link", c.id);
    setSending(false);
    setMsg(r.data?.ok ? { tone: "success", text: `Booking link emailed to ${c.email}.` } : { tone: "error", text: "Email not sent — check the Resend key in Supabase." });
  };

  const confirm = async (iso: string) => {
    const waTab = c.whatsapp ? window.open("about:blank", "_blank") : null;
    const r = await confirmAndNotify(c, iso, { google: true, waTab });
    if (r.error) return setMsg({ tone: "error", text: r.error });
    setMsg({ tone: "success", text: `Confirmed for ${maltaTime(iso)} (Malta)${r.emailed ? " · email sent" : ""}. Now in the online-session queue.` });
    onSaved();
  };

  const undo = async () => {
    const { error } = await supabase.from("consultations").update({ call_status: "requested", preferred_call_at: null }).eq("id", c.id);
    if (error) return setMsg({ tone: "error", text: error.message });
    setMsg({ tone: "success", text: "Confirmation undone." });
    onSaved();
  };

  return (
    <div className="space-y-3 rounded-2xl bg-mist px-4 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-extrabold">
          <CalendarCheck className="h-4 w-4 text-brand" /> Call
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            stage === "confirmed" ? "bg-emerald-100 text-emerald-800" : stage === "none" || stage === "declined" ? "bg-white text-slate-500" : "bg-amber-100 text-amber-800"
          }`}
        >
          {CALL_STAGE_LABELS[stage]}
        </span>
      </div>

      {stage === "confirmed" && c.preferred_call_at ? (
        <p>
          Confirmed: <strong>{maltaTime(c.preferred_call_at)}</strong> (Malta)
        </p>
      ) : requested ? (
        <p>
          Candidate asked for <strong>{maltaTime(requested)}</strong> (Malta)
        </p>
      ) : (
        <p className="text-slate-500">The candidate hasn’t picked a time yet.</p>
      )}

      {stage !== "confirmed" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={sending} onClick={sendBookingEmail}>
              <Mail className="h-4 w-4" /> Email booking link
            </Button>
            {c.whatsapp && (
              <a href={waLink(c.whatsapp, bookingMessage(c))} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  <MessageCircle className="h-4 w-4" /> WhatsApp booking link
                </Button>
              </a>
            )}
            {requested && <Button onClick={() => confirm(requested)}>Confirm this time</Button>}
          </div>
          <p className="text-xs text-slate-500">
            The candidate books the real call on{" "}
            <a href={BOOKING_LINK} target="_blank" rel="noreferrer" className="font-bold text-brand hover:underline">
              your Google booking page
            </a>
            . Confirm here once it’s booked so they join the online-session queue.
          </p>
        </>
      )}

      {stage === "confirmed" && (
        <Button variant="ghost" onClick={undo}>
          Undo confirmation
        </Button>
      )}

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
