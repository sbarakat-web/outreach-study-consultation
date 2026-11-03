import { useState } from "react";
import { CalendarCheck, CalendarPlus, Check, Clock, Copy, Mail, MessageCircle, Send, Video, Zap } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { BOOKING_LINK, CALL_STAGE_LABELS, callStage, noReply24h, waLink } from "../../lib/options";
import type { Consultation } from "../../lib/types";
import { Alert, Button } from "../../components/ui";
import { bookNow, bookingMessage, googleEventUrl, maltaTime, notifyCandidate, suggestTime, waitingWhatsApp } from "./calls";
import { SlotPicker } from "./SlotPicker";

const BOOKED_VIA = { google: "Booked via Google ✓", admin: "Booked by the team", dashboard: "Booked from the dashboard", "confirm-link": "Confirmed by the candidate" } as const;

/**
 * Admin call workflow: pick a free time from the Google Calendar, then either send it for confirmation
 * (email + WhatsApp, slot held as tentative) or book it straight away when the time is already agreed.
 */
export function CallPanel({ c, onSaved }: { c: Consultation; onSaved: () => void }) {
  const stage = callStage(c);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<"" | "suggest" | "confirm" | "booking" | "book">("");
  const [copied, setCopied] = useState(false);
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

  // Confirm now (time agreed, or the candidate replied YES): calendar event + "We're waiting for you" email.
  const book = async (iso: string, kind: "book" | "confirm") => {
    if (!iso) return setMsg({ tone: "error", text: "Pick a time first." });
    const waTab = c.whatsapp ? window.open("about:blank", "_blank") : null;
    setBusy(kind);
    const r = await bookNow(c, iso, waTab);
    setBusy("");
    if (r.error) return setMsg({ tone: "error", text: r.error });
    setMsg({ tone: "success", text: `Booked for ${maltaTime(iso)} (Malta)${r.emailed ? " · “We're waiting for you” email sent" : ""}. Now in the online-session queue.` });
    setEditing(false);
    onSaved();
  };

  const copyWhatsApp = async () => {
    await navigator.clipboard.writeText(waitingWhatsApp(c)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
      <div className="flex flex-wrap gap-2">
        <Button loading={busy === "suggest"} onClick={send} disabled={!at}>
          <Send className="h-4 w-4" /> {reschedule ? "Send reschedule request" : "Send for confirmation"}
          {at && <span className="font-normal opacity-80">· {maltaTime(at)}</span>}
        </Button>
        <Button variant="secondary" loading={busy === "book"} onClick={() => book(at, "book")} disabled={!at}>
          <Zap className="h-4 w-4" /> Book now (already agreed)
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        <strong>Send for confirmation:</strong>{" "}
        {reschedule ? "“Can we move your call?” with their time crossed out" : "“Good news, your time is available” with a “Yes, confirm” button"}; the slot is held in the
        calendar meanwhile. <strong>Book now:</strong> confirmed immediately with the “We're waiting for you” email.
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
          <div className="space-y-1.5 rounded-xl bg-white px-3 py-3 ring-1 ring-emerald-200">
            <p>
              Confirmed: <strong>{maltaTime(c.preferred_call_at)}</strong> (Malta)
            </p>
            {c.booked_via && <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{BOOKED_VIA[c.booked_via]}</span>}
            {c.meeting_url && (
              <a href={c.meeting_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 break-all text-xs font-bold text-brand hover:underline">
                <Video className="h-3.5 w-3.5 shrink-0" /> {c.meeting_url}
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-9" onClick={copyWhatsApp}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy WhatsApp message"}
            </Button>
            {c.whatsapp && (
              <a href={waLink(c.whatsapp, waitingWhatsApp(c))} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="min-h-9">
                  <MessageCircle className="h-4 w-4" /> Open WhatsApp
                </Button>
              </a>
            )}
            {/* Booked in the app: put it in the real Google Calendar by hand (Google bookings are already there). */}
            {c.booked_via !== "google" && c.preferred_call_at && (
              <a href={googleEventUrl(c, c.preferred_call_at)} target="_blank" rel="noreferrer" title="Opens Google Calendar with the call filled in — add Meet and click Save">
                <Button variant="secondary" className="min-h-9">
                  <CalendarPlus className="h-4 w-4" /> Add to Google Calendar
                </Button>
              </a>
            )}
            <Button variant="ghost" className="min-h-9" onClick={() => setEditing((v) => !v)}>
              Change time
            </Button>
            <Button variant="ghost" className="min-h-9" onClick={undo}>
              Undo confirmation
            </Button>
          </div>
          {editing && (
            <div className="space-y-2">
              <SlotPicker value={at} onChange={setAt} />
              <Button loading={busy === "book"} onClick={() => book(at, "book")} disabled={!at}>
                <Zap className="h-4 w-4" /> Move the call{at && <span className="font-normal opacity-80">· {maltaTime(at)}</span>}
              </Button>
              <p className="text-xs text-slate-500">Moves the calendar event and sends the “new time” email.</p>
            </div>
          )}
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
            <Button variant="secondary" loading={busy === "confirm"} onClick={() => book(c.suggested_call_at!, "confirm")}>
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
