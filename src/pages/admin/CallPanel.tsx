import { useState } from "react";
import { CalendarCheck, Clock, Mail, MessageCircle, Send } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { BOOKING_LINK, CALL_STAGE_LABELS, callStage, noReply24h, waLink } from "../../lib/options";
import type { Consultation } from "../../lib/types";
import { Alert, Button } from "../../components/ui";
import { bookingMessage, confirmAndNotify, maltaTime, notifyCandidate, suggestTime } from "./calls";
import { SlotPicker } from "./SlotPicker";

/**
 * Admin call workflow, kept simple: suggest a time (the candidate's own choice by default),
 * send it by email + WhatsApp, and wait for the candidate's one-click confirmation.
 */
export function CallPanel({ c, onSaved }: { c: Consultation; onSaved: () => void }) {
  const stage = callStage(c);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<"" | "suggest" | "confirm" | "booking">("");
  const requested = c.requested_call_times[0];
  // ISO time; the slot picker fills it with the best free time from Google Calendar.
  const [at, setAt] = useState("");
  const [editing, setEditing] = useState(false);
  // Changing the candidate's own time sends the "can we move your call?" version of the email.
  const reschedule = !!requested && !!at && Math.abs(new Date(at).getTime() - new Date(requested).getTime()) > 60_000;

  const send = async () => {
    if (!at) return setMsg({ tone: "error", text: "Pick a time first." });
    const waTab = c.whatsapp ? window.open("about:blank", "_blank") : null;
    setBusy("suggest");
    const r = await suggestTime(c, at, waTab);
    setBusy("");
    if (r.error) return setMsg({ tone: "error", text: r.error });
    setMsg({ tone: "success", text: `Sent${r.emailed ? " by email" : ""}${waTab ? " + WhatsApp" : ""}. Waiting for ${c.full_name.split(" ")[0]} to confirm — you’ll get an email when they do.` });
    setEditing(false);
    onSaved();
  };

  const markConfirmed = async (iso: string) => {
    const waTab = c.whatsapp ? window.open("about:blank", "_blank") : null;
    setBusy("confirm");
    const r = await confirmAndNotify(c, iso, { google: true, waTab });
    setBusy("");
    if (r.error) return setMsg({ tone: "error", text: r.error });
    setMsg({ tone: "success", text: `Confirmed for ${maltaTime(iso)} (Malta)${r.emailed ? " · email sent" : ""}. Now in the online-session queue.` });
    onSaved();
  };

  const sendBookingEmail = async () => {
    setBusy("booking");
    const r = await notifyCandidate("booking-link", c.id);
    setBusy("");
    setMsg(r.data?.ok ? { tone: "success", text: `Booking link emailed to ${c.email}.` } : { tone: "error", text: "Email not sent — check the Resend key in Supabase." });
  };

  const undo = async () => {
    const { error } = await supabase.from("consultations").update({ call_status: "requested", preferred_call_at: null, suggested_call_at: null }).eq("id", c.id);
    if (error) return setMsg({ tone: "error", text: error.message });
    setMsg({ tone: "success", text: "Confirmation undone." });
    onSaved();
  };

  const picker = (
    <div className="space-y-2">
      <SlotPicker value={at} onChange={setAt} preferred={requested} />
      <Button loading={busy === "suggest"} onClick={send} disabled={!at}>
        <Send className="h-4 w-4" /> {reschedule ? "Send reschedule request" : "Send for confirmation"}
        {at && <span className="font-normal opacity-80">· {maltaTime(at)}</span>}
      </Button>
      <p className="text-xs text-slate-500">
        {reschedule
          ? "Email + WhatsApp: “Can we move your call?” — shows their time crossed out and the new one."
          : "Email + WhatsApp: “Good news, your time is available” with a “Yes, confirm” button."}{" "}
        In their language.
      </p>
    </div>
  );

  return (
    <div className="space-y-3 rounded-2xl bg-mist px-4 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-extrabold">
          <CalendarCheck className="h-4 w-4 text-brand" /> Call
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            stage === "confirmed"
              ? "bg-emerald-100 text-emerald-800"
              : stage === "suggested"
                ? "bg-sky-100 text-sky-800"
                : stage === "none" || stage === "declined"
                  ? "bg-white text-slate-500"
                  : "bg-amber-100 text-amber-800"
          }`}
        >
          {CALL_STAGE_LABELS[stage]}
        </span>
      </div>

      {stage === "confirmed" && c.preferred_call_at ? (
        <>
          <p>
            Confirmed: <strong>{maltaTime(c.preferred_call_at)}</strong> (Malta)
          </p>
          <Button variant="ghost" onClick={undo}>
            Undo confirmation
          </Button>
        </>
      ) : stage === "suggested" && c.suggested_call_at ? (
        <>
          <div className="flex items-start gap-2 rounded-xl bg-white px-3 py-3 ring-1 ring-sky-200">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <p>
              Sent <strong>{maltaTime(c.suggested_call_at)}</strong> (Malta)
              {c.call_suggested_at && <span className="text-slate-500"> · {new Date(c.call_suggested_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>}
              <br />
              <span className="text-slate-500">Waiting for the candidate to confirm.</span>
              {noReply24h(c) && (
                <span className="mt-1 block text-xs font-bold text-brand-red">
                  No reply for 24h+{c.suggest_reminder_at ? " · reminder email sent" : ""} — maybe message them on WhatsApp.
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={busy === "confirm"} onClick={() => markConfirmed(c.suggested_call_at!)}>
              Mark confirmed (replied YES)
            </Button>
            <Button variant="ghost" onClick={() => setEditing((v) => !v)}>
              Change time / resend
            </Button>
          </div>
          {editing && picker}
        </>
      ) : (
        <>
          {requested ? (
            <p>
              Candidate asked for <strong>{maltaTime(requested)}</strong> (Malta)
            </p>
          ) : (
            <p className="text-slate-500">The candidate hasn’t picked a time yet — you can still suggest one.</p>
          )}
          {picker}
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer font-bold">Or send the Google booking page</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" className="min-h-9" loading={busy === "booking"} onClick={sendBookingEmail}>
                <Mail className="h-4 w-4" /> Email booking link
              </Button>
              {c.whatsapp && (
                <a href={waLink(c.whatsapp, bookingMessage(c))} target="_blank" rel="noreferrer">
                  <Button variant="secondary" className="min-h-9">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                </a>
              )}
              <a href={BOOKING_LINK} target="_blank" rel="noreferrer" className="self-center font-bold text-brand hover:underline">
                Open booking page
              </a>
            </div>
          </details>
        </>
      )}

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
