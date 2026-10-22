import { useState } from "react";
import { CalendarCheck, Check, MessageCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { BOOKING_LINK, CALL_STAGE_LABELS, REVIEW_CHECKLIST, callStage, waLink } from "../../lib/options";
import type { Consultation } from "../../lib/types";
import { Alert, Button } from "../../components/ui";

import { bookingMessage as bookingText, confirmAndNotify, googleEventUrl, maltaTime, toLocalInput } from "./calls";

/** Admin call workflow: review checklist, confirm a requested time, or reply on WhatsApp. */
export function CallPanel({ c, documents, onSaved }: { c: Consultation; documents: number; onSaved: () => void }) {
  const stage = callStage(c);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(c.review_checklist ?? {});
  const [otherAt, setOtherAt] = useState(toLocalInput(c.preferred_call_at));
  const [proposals, setProposals] = useState(["", ""]);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const first = c.full_name.split(" ")[0];
  const course = c.desired_course || "your studies";
  const checked = REVIEW_CHECKLIST.filter((i) => checklist[i.key]).length;

  const update = async (fields: Partial<Consultation>, success: string) => {
    const { error } = await supabase.from("consultations").update(fields).eq("id", c.id);
    if (error) return setMsg({ tone: "error", text: error.message });
    setMsg({ tone: "success", text: success });
    onSaved();
  };

  const toggleCheck = async (key: string) => {
    const next = { ...checklist, [key]: !checklist[key] };
    setChecklist(next);
    const { error } = await supabase.from("consultations").update({ review_checklist: next }).eq("id", c.id);
    if (error) setMsg({ tone: "error", text: error.message });
  };

  // One click: confirm, Google event + Meet (when connected), email the candidate, WhatsApp tab.
  const confirmAt = async (iso: string) => {
    const waTab = c.whatsapp ? window.open("about:blank", "_blank") : null;
    const r = await confirmAndNotify(c, iso, { google: true, waTab });
    if (r.error) return setMsg({ tone: "error", text: r.error });
    const google = r.meetUrl ? " · Meet link created" : r.googleError && r.googleError !== "google-not-configured" ? ` · Google: ${r.googleError}` : "";
    setMsg({
      tone: "success",
      text: `Confirmed for ${maltaTime(iso)} (Malta)${google}${r.emailed ? " · email sent" : ""}. The candidate sees it in their dashboard, and it is now in the online-session queue.`,
    });
    onSaved();
  };

  const bookingMessage = bookingText(c);

  const validProposals = proposals.filter(Boolean).map((v) => new Date(v).toISOString());
  const proposeMessage = `Hi ${first}, this is Outreach about your application for ${course}. Your requested times are not available, sorry! Would one of these work for you (Malta time)?\n${validProposals
    .map((iso, i) => `${i + 1}. ${maltaTime(iso)}`)
    .join("\n")}\nOr pick any free time here: ${BOOKING_LINK}`;

  const declineMessage =
    c.english_level === "below_b2"
      ? `Hi ${first}, thank you for your application with Outreach. We've reviewed your profile and suggest a different first step for you — our advisor will share the best English course options so you're ready for your goals in Malta. We'll be in touch soon!`
      : `Hi ${first}, thank you for your application for ${course} with Outreach. We've reviewed your profile and think the best next step is to start with an English course first, so you meet the B2 requirement. Our advisor will send you the options shortly!`;

  return (
    <div className="space-y-4 rounded-2xl bg-mist px-4 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-extrabold">
          <CalendarCheck className="h-4 w-4 text-brand" /> Call
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            stage === "confirmed"
              ? "bg-emerald-100 text-emerald-800"
              : stage === "declined"
                ? "bg-slate-200 text-slate-600"
                : stage === "none"
                  ? "bg-white text-slate-500"
                  : "bg-amber-100 text-amber-800"
          }`}
        >
          {CALL_STAGE_LABELS[stage]}
        </span>
      </div>

      {stage === "confirmed" && c.preferred_call_at && (
        <p>
          Confirmed: <strong>{maltaTime(c.preferred_call_at)}</strong> (Malta)
        </p>
      )}

      {c.requested_call_times.length > 0 && stage !== "confirmed" && (
        <div>
          <p className="mb-2 font-bold">Candidate’s preferred times (Malta)</p>
          <ul className="space-y-1.5">
            {c.requested_call_times.map((t, i) => (
              <li key={t} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
                <span>
                  <span className="text-slate-400">{i + 1}.</span> <strong>{maltaTime(t)}</strong>
                </span>
                <span className="flex gap-1.5">
                  <a href={googleEventUrl(c, t)} target="_blank" rel="noreferrer" title="Add to my Google Calendar">
                    <Button variant="ghost" className="min-h-9 px-3">
                      <CalendarCheck className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button variant="secondary" className="min-h-9 px-4" onClick={() => confirmAt(t)}>
                    Confirm
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stage !== "confirmed" && stage !== "declined" && (
        <fieldset className="rounded-xl bg-white px-3 py-3">
          <legend className="sr-only">Profile review</legend>
          <p className="mb-2 font-bold">
            Profile review <span className="font-normal text-slate-400">({checked}/{REVIEW_CHECKLIST.length})</span>
          </p>
          <div className="space-y-1.5">
            {REVIEW_CHECKLIST.map((item) => (
              <label key={item.key} className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={!!checklist[item.key]} onChange={() => toggleCheck(item.key)} />
                {item.label}
                {item.key === "documents" && <span className="text-xs text-slate-400">({documents} uploaded)</span>}
              </label>
            ))}
          </div>
          {c.call_reviewed_at ? (
            <p className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> Reviewed {new Date(c.call_reviewed_at).toLocaleDateString()} — candidate sees “Profile reviewed”
            </p>
          ) : (
            <Button
              variant="ghost"
              className="mt-2 min-h-9 px-3"
              disabled={checked < REVIEW_CHECKLIST.length}
              onClick={() => update({ call_reviewed_at: new Date().toISOString() }, "Profile marked as reviewed.")}
            >
              Mark profile reviewed
            </Button>
          )}
        </fieldset>
      )}

      {c.whatsapp && stage !== "declined" && (
        <div className="flex flex-wrap gap-2">
          <a href={waLink(c.whatsapp, bookingMessage)} target="_blank" rel="noreferrer">
            <Button variant="secondary">
              <MessageCircle className="h-4 w-4" /> Send booking link
            </Button>
          </a>
        </div>
      )}

      {c.whatsapp && stage !== "confirmed" && stage !== "declined" && (
        <details className="rounded-xl bg-white px-3 py-2">
          <summary className="cursor-pointer font-bold">Propose other times</summary>
          <div className="mt-2 space-y-2">
            {proposals.map((v, i) => (
              <input
                key={i}
                type="datetime-local"
                aria-label={`Alternative time ${i + 1}`}
                className="field"
                value={v}
                onChange={(e) => setProposals((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
            <a
              href={validProposals.length ? waLink(c.whatsapp, proposeMessage) : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!validProposals.length}
              className={validProposals.length ? "" : "pointer-events-none opacity-50"}
            >
              <Button variant="secondary">
                <MessageCircle className="h-4 w-4" /> Send on WhatsApp
              </Button>
            </a>
          </div>
        </details>
      )}

      <details className="rounded-xl bg-white px-3 py-2">
        <summary className="cursor-pointer font-bold">{stage === "confirmed" ? "Change confirmed time" : "Confirm another time"}</summary>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input type="datetime-local" aria-label="Call time" className="field" value={otherAt} onChange={(e) => setOtherAt(e.target.value)} />
          <Button onClick={() => (otherAt ? confirmAt(new Date(otherAt).toISOString()) : setMsg({ tone: "error", text: "Pick a date and time first." }))}>
            Confirm
          </Button>
        </div>
      </details>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
        {stage === "confirmed" && (
          <Button variant="ghost" onClick={() => update({ call_status: "requested", preferred_call_at: null }, "Confirmation undone.")}>
            Undo confirmation
          </Button>
        )}
        {stage === "declined" ? (
          <Button variant="ghost" onClick={() => update({ call_declined_at: null }, "Lead reopened.")}>
            Reopen
          </Button>
        ) : (
          c.whatsapp && (
            <a
              href={waLink(c.whatsapp, declineMessage)}
              target="_blank"
              rel="noreferrer"
              onClick={() => update({ call_declined_at: new Date().toISOString(), call_status: "requested", preferred_call_at: null }, "Marked as not a fit / later.")}
            >
              <Button variant="danger">Not a fit / later</Button>
            </a>
          )
        )}
      </div>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
