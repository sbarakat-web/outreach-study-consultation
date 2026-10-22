import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, EyeOff, MessageCircle, Play, Presentation } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { formatSlot, waLink } from "../../lib/options";
import type { Consultation } from "../../lib/types";
import { Button } from "../../components/ui";

const HIDDEN_ACTION = "hidden_from_presenter_queue";

const OUTCOME = {
  interviewed: { label: "Interviewed", style: "bg-emerald-100 text-emerald-800" },
  no_attendance: { label: "No attendance", style: "bg-amber-100 text-amber-800" },
  no_longer_interested: { label: "No longer interested", style: "bg-rose-100 text-rose-800" },
} as const;

export const isBookedForSession = (c: Consultation) =>
  c.call_status === "confirmed" && !c.call_declined_at && !["interviewed", "no_longer_interested"].includes(c.session_outcome ?? "");

export const sessionHref = (c: Consultation) => `/onlinesessions?present=1&candidate=${c.id}`;

/** Lead ↔ Online Study Session link: queue status, start button, outcome and session notes. */
export function SessionPanel({ c }: { c: Consultation }) {
  const [hiddenAt, setHiddenAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const booked = isBookedForSession(c);
  const notes = (c.admin_notes ?? "").split("\n").filter((l) => l.startsWith("[Online Session"));
  const studentLink = c.desired_course
    ? `${window.location.origin}/onlinesessions?stage=interviewed&programme=${encodeURIComponent(c.desired_course)}`
    : null;

  const loadHidden = useCallback(async () => {
    const { data } = await supabase
      .from("activity_log")
      .select("created_at")
      .eq("consultation_id", c.id)
      .eq("action", HIDDEN_ACTION)
      .order("created_at", { ascending: false })
      .limit(1);
    setHiddenAt(data?.[0]?.created_at ?? null);
  }, [c.id]);

  useEffect(() => {
    loadHidden();
  }, [loadHidden]);

  const restore = async () => {
    await supabase.from("activity_log").delete().eq("consultation_id", c.id).eq("action", HIDDEN_ACTION);
    loadHidden();
  };

  const copy = async () => {
    if (!studentLink) return;
    try {
      await navigator.clipboard.writeText(studentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-brand/15 bg-brand/[0.03] px-4 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-extrabold">
          <Presentation className="h-4 w-4 text-brand" /> Online session
        </span>
        {c.session_outcome ? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${OUTCOME[c.session_outcome].style}`}>
            {OUTCOME[c.session_outcome].label}
            {c.session_outcome_at && ` · ${formatSlot(c.session_outcome_at, { weekday: undefined })}`}
          </span>
        ) : booked ? (
          <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">In presenter queue</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">Not booked yet</span>
        )}
      </div>

      {booked ? (
        <>
          <p className="text-slate-600">
            {c.preferred_call_at ? (
              <>
                Call booked for <strong>{formatSlot(c.preferred_call_at, { weekday: "long", month: "long" })}</strong>. Start the guided session when the
                candidate joins.
              </>
            ) : (
              "Call confirmed. Start the guided session when the candidate joins."
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to={sessionHref(c)}>
              <Button>
                <Play className="h-4 w-4 fill-current" /> Start online session
              </Button>
            </Link>
          </div>
          {hiddenAt && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-amber-800">
              <EyeOff className="h-3.5 w-3.5" /> Removed from the presenter queue on {new Date(hiddenAt).toLocaleDateString()}.
              <button onClick={restore} className="font-bold underline">
                Restore to queue
              </button>
            </p>
          )}
        </>
      ) : (
        !c.session_outcome && <p className="text-slate-600">Confirm the call above to add this candidate to the online-session queue.</p>
      )}

      {c.session_outcome === "no_attendance" && !booked && (
        <p className="text-slate-600">The candidate missed the session and can pick a new time from their dashboard. Confirm the new time to re-queue them.</p>
      )}

      {notes.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-white px-3 py-2">
          {notes.map((n, i) => (
            <li key={i} className="text-xs text-slate-700">
              {n}
            </li>
          ))}
        </ul>
      )}

      {c.session_outcome === "interviewed" && studentLink && (
        <div className="space-y-2 rounded-xl bg-white px-3 py-2">
          <p className="text-xs font-bold text-slate-500">Student's personalised presentation link</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-9 px-4" onClick={copy}>
              <Copy className="h-4 w-4" /> {copied ? "Copied!" : "Copy link"}
            </Button>
            {c.whatsapp && (
              <a
                href={waLink(c.whatsapp, `Hi ${c.full_name.split(" ")[0]}, here is your Malta study presentation for ${c.desired_course}: ${studentLink}`)}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="secondary" className="min-h-9 px-4">
                  <MessageCircle className="h-4 w-4" /> Send on WhatsApp
                </Button>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
