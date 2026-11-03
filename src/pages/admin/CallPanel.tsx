import { useState } from "react";
import { CalendarCheck, Check, CheckCircle2, Clock, Copy, Hand, Mail, MessageCircle, Send, Video } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { BOOKING_LINK, CALL_STAGE_LABELS, callStage, noReply24h, waLink } from "../../lib/options";
import type { Consultation } from "../../lib/types";
import { Alert, Button } from "../../components/ui";
import { bookingMessage, confirmWithMeet, holdTime, maltaTime, notifyCandidate, suggestTime, waitingWhatsApp } from "./calls";
import { SlotPicker } from "./SlotPicker";
import { useFreeTimes } from "../../lib/freeTimes";

const BOOKED_VIA = { google: "Google booking page", admin: "Picked by the team", dashboard: "Candidate dashboard", "confirm-link": "Candidate's confirm link" } as const;

const waitedFor = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 1 ? "just now" : h < 24 ? `waiting ${h}h` : `waiting ${Math.floor(h / 24)}d`;
};

/**
 * Admin call workflow. Every booking arrives as "Awaiting confirmation"; the team books it on the Google page (Confirmation
 * tab), then pastes the Meet link here and clicks Confirm & send (the "We're waiting for you" email). Or suggest another time for the candidate to accept.
 */
export function CallPanel({ c, onSaved }: { c: Consultation; onSaved: () => void }) {
  const stage = callStage(c);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<"" | "suggest" | "hold" | "confirm" | "booking">("");
  const [copied, setCopied] = useState(false);
  const requested = c.requested_call_times[0];
  // The time awaiting confirmation (held on the candidate's request, or picked by the team).
  const pendingAt = stage === "requested" || stage === "reviewed" ? c.preferred_call_at ?? requested : null;
  const [meet, setMeet] = useState(c.meeting_url ?? "");
  // ISO time; the slot picker fills it with the best free time from Google Calendar.
  const [at, setAt] = useState("");
  const [editing, setEditing] = useState(false);
  // Changing the candidate's own time sends the "can we move your call?" version of the email.
  const reschedule = !!requested && !!at && Math.abs(new Date(at).getTime() - new Date(requested).getTime()) > 60_000;

  // The 3 nearest free times, for one-click suggestions.
  const { times: freeTimes } = useFreeTimes();
  const quick = freeTimes.filter((t) => t.getTime() !== new Date(c.preferred_call_at ?? 0).getTime()).slice(0, 3);

  const send = async (iso = at) => {
    if (!iso) return setMsg({ tone: "error", text: "Pick a time first." });
    const waTab = c.whatsapp ? window.open("about:blank", "_blank") : null;
    setBusy("suggest");
    const r = await suggestTime(c, iso, waTab);
    setBusy("");
    if (r.error) return setMsg({ tone: "error", text: r.error });
    setMsg({ tone: "success", text: `Sent${r.emailed ? " by email" : ""}${waTab ? " + WhatsApp" : ""}. Waiting for ${c.full_name.split(" ")[0]} to accept — you’ll get an email when they do.` });
    setEditing(false);
    onSaved();
  };

  // Time agreed (or the candidate replied YES): hold it, then confirm with the Meet link below.
  const hold = async (iso: string) => {
    if (!iso) return setMsg({ tone: "error", text: "Pick a time first." });
    setBusy("hold");
    const r = await holdTime(c, iso);
    setBusy("");
    if (r.error) return setMsg({ tone: "error", text: r.error });
    setMsg({ tone: "success", text: `${maltaTime(iso)} (Malta) held. Now add it to Google Calendar, paste the Meet link and confirm.` });
    setEditing(false);
    onSaved();
  };

  const confirm = async () => {
    const link = meet.trim();
    if (!link) return setMsg({ tone: "error", text: "Paste the Google Meet link first (step 2)." });
    if (!/^https:\/\/\S+$/.test(link)) return setMsg({ tone: "error", text: "The meeting link must start with https://" });
    const waTab = c.whatsapp ? window.open("about:blank", "_blank") : null;
    setBusy("confirm");
    const r = await confirmWithMeet(c, link, waTab);
    setBusy("");
    if (r.error) return setMsg({ tone: "error", text: r.error });
    setMsg({
      tone: "success",
      text: `Confirmed for ${maltaTime(pendingAt!)} (Malta)${r.emailed ? " · “We're waiting for you” email sent with the Meet link" : " · email not sent (check Resend)"}${waTab ? " · WhatsApp opened" : ""}.`,
    });
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
      {quick.length > 0 && (
        <div className="space-y-1.5 rounded-xl bg-white px-3 py-3 ring-1 ring-slate-200">
          <p className="text-xs font-bold text-slate-500">Quick reply · send one of the nearest free times (email + WhatsApp)</p>
          <div className="flex flex-wrap gap-2">
            {quick.map((t) => (
              <Button key={t.toISOString()} variant="secondary" className="min-h-9" loading={busy === "suggest"} onClick={() => send(t.toISOString())}>
                <Send className="h-3.5 w-3.5" /> {maltaTime(t.toISOString())}
              </Button>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs font-bold text-slate-500">Or pick any free time</p>
      <SlotPicker value={at} onChange={setAt} preferred={requested} />
      <div className="flex flex-wrap gap-2">
        <Button loading={busy === "suggest"} onClick={() => send()} disabled={!at}>
          <Send className="h-4 w-4" /> {reschedule ? "Send reschedule request" : "Send for confirmation"}
          {at && <span className="font-normal opacity-80">· {maltaTime(at)}</span>}
        </Button>
        <Button variant="secondary" loading={busy === "hold"} onClick={() => hold(at)} disabled={!at}>
          <Hand className="h-4 w-4" /> Agreed — hold this time
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        <strong>Send for confirmation:</strong>{" "}
        {reschedule ? "“Can we move your call?” with their time crossed out" : "“Good news, your time is available” with a “Yes” button"}.{" "}
        <strong>Agreed — hold this time:</strong> no email yet; you then confirm it with the Meet link.
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
              <Button loading={busy === "hold"} onClick={() => hold(at)} disabled={!at}>
                <Hand className="h-4 w-4" /> Hold the new time{at && <span className="font-normal opacity-80">· {maltaTime(at)}</span>}
              </Button>
              <p className="text-xs text-slate-500">The call goes back to “Awaiting confirmation”. Move the event in Google Calendar, then confirm — the candidate gets the email then.</p>
            </div>
          )}
        </>
      ) : pendingAt ? (
        <>
          <div className="space-y-3 rounded-xl bg-white px-3 py-3 ring-1 ring-amber-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p>
                <Clock className="mr-1 inline h-4 w-4 text-amber-600" />
                Requested: <strong>{maltaTime(pendingAt)}</strong> (Malta)
              </p>
              <span className="text-xs text-slate-500">
                {c.booked_via ? BOOKED_VIA[c.booked_via] : "Requested"}
                {c.call_requested_at && <> · <span className="font-bold text-amber-700">{waitedFor(c.call_requested_at)}</span></>}
              </span>
            </div>

            <ol className="space-y-3">
              <li className="flex gap-2.5">
                <Step n={1} />
                <label className="min-w-0 flex-1 space-y-1">
                  <span className="block text-xs font-bold">Google Meet link</span>
                  {c.booked_via !== "google" && <span className="block text-xs text-slate-500">Book it first in the Confirmation tab, then copy the Meet link from the event.</span>}
                  <input className="field py-2" type="url" placeholder="https://meet.google.com/abc-defg-hij" value={meet} onChange={(e) => setMeet(e.target.value)} />
                </label>
              </li>
              <li className="flex gap-2.5">
                <Step n={2} />
                <div className="min-w-0 flex-1 space-y-1">
                  <Button loading={busy === "confirm"} onClick={confirm} disabled={!meet.trim()}>
                    <CheckCircle2 className="h-4 w-4" /> Confirm &amp; send
                  </Button>
                  <p className="text-xs text-slate-500">Sends “We're waiting for you” with the Meet link (CC sbarakat@) and opens WhatsApp with the same message.</p>
                </div>
              </li>
            </ol>
          </div>
          <button onClick={() => setEditing((v) => !v)} className="text-xs font-bold text-brand hover:underline">
            {editing ? "Hide" : "Not possible? Suggest another time"}
          </button>
          {editing && picker}
        </>
      ) : stage === "suggested" && c.suggested_call_at ? (
        <>
          <div className="flex items-start gap-2 rounded-xl bg-white px-3 py-3 ring-1 ring-sky-200">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <p>
              Sent <strong>{maltaTime(c.suggested_call_at)}</strong> (Malta)
              {c.call_suggested_at && <span className="text-slate-500"> · {new Date(c.call_suggested_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>}
              <br />
              <span className="text-slate-500">Waiting for the candidate to accept.</span>
              {noReply24h(c) && (
                <span className="mt-1 block text-xs font-bold text-brand-red">
                  No reply for 24h+{c.suggest_reminder_at ? " · reminder email sent" : ""} — maybe message them on WhatsApp.
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={busy === "hold"} onClick={() => hold(c.suggested_call_at!)}>
              They replied YES — hold it
            </Button>
            <Button variant="ghost" onClick={() => setEditing((v) => !v)}>
              Change time / resend
            </Button>
          </div>
          {editing && picker}
        </>
      ) : (
        <>
          <p className="text-slate-500">The candidate hasn’t picked a time yet — you can suggest one or hold an agreed time.</p>
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

const Step = ({ n }: { n: number }) => (
  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-black text-white">{n}</span>
);
