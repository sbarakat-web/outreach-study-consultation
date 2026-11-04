import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarCheck, CalendarX2, RotateCcw, ThumbsUp, CalendarPlus, Check, CheckCircle2, ClipboardPaste, Clock, Copy, ExternalLink, FileText, MessageCircle, MessageSquare, Play, Plus, Presentation, Search, Star, UserRound, UsersRound, Video, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  BOOKING_EMBED,
  ENGLISH_LEVELS,
  documentTypesFor,
  waLink,
  STATUSES,
  STUDY_PATHS,
  formatSlot,
  labelFor,
  statusLabel,
  callStage,
  CALL_STAGE_LABELS,
  maltaDateTime,
  noReply24h,
} from "../../lib/options";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { CountryPicker } from "../../components/CountryPicker";
import { COUNTRIES, countryByCode, timeZonesOf } from "../../lib/countries";
import { AREAS, ENGLISH_COURSES, ENGLISH_PROVIDERS, PROGRAMMES, programmeValue } from "../sessions/data";
import { CallPanel, PickAnotherButton } from "./CallPanel";
import { candidateTime, confirmWithMeet, maltaTime, notifyCandidate, waitingWhatsApp } from "./calls";
import { SessionPanel, sessionHref } from "./SessionPanel";
import type { Consultation, DocumentRow, Status } from "../../lib/types";
import { Alert, Button, Card, Spinner, StatusBadge } from "../../components/ui";
import { MeetingCard, PageTitle, StatStrip } from "../../components/dash";

type Row = Consultation & { documents?: { created_at: string; review_status: string; doc_type: string }[] };

// Leads with at least one upload live in "Documents received" instead of "All leads".
const docCount = (c: Row) => c.documents?.length ?? 0;
const lastUpload = (c: Row) => (c.documents ?? []).reduce((latest, d) => (d.created_at > latest ? d.created_at : latest), "");


const PAGE_TITLE = {
  all: "Leads",
  new: "New leads",
  documents: "Documents received",
  not_interested: "No longer interested",
  awaiting: "Awaiting confirmation",
  waiting: "Waiting for candidate",
  upcoming: "Upcoming",
} as const;

/** Upcoming: confirmed calls whose session hasn't happened yet (until the call has ended). */
const isUpcoming = (c: Row) =>
  c.call_status === "confirmed" && !!c.preferred_call_at && !c.session_outcome && new Date(c.preferred_call_at).getTime() + 20 * 60_000 > Date.now();

/** The call time a lead is waiting on: their requested time, or the time we suggested. */
const pendingCallAt = (c: Row) => (callStage(c) === "suggested" ? c.suggested_call_at : c.preferred_call_at ?? c.requested_call_times[0]) ?? "";
// Sort key for leads without a call time (asked to pick another): after the dated ones.
const c9 = (c: Row) => `9${c.repick_requested_at ?? ""}`;
/** Call pages: requests to confirm (Meet link + Confirm & send) and times sent that the candidate hasn't accepted yet. */
const inCallPage = (mode: string, c: Row) =>
  c.status !== "not_interested" &&
  (mode === "awaiting"
    ? ["requested", "reviewed"].includes(callStage(c)) && !!pendingCallAt(c)
    : callStage(c) === "suggested" || (c.call_status === "none" && !!c.repick_requested_at));

/**
 * Lead list. `mode` gives "New leads", "Documents received", "No longer interested", "Awaiting confirmation" and
 * "Waiting for candidate" their own pages (/admin/new-leads, /admin/documents, /admin/not-interested,
 * /admin/awaiting-confirmation, /admin/waiting-for-candidate).
 */
export function Requests({ mode = "all" }: { mode?: keyof typeof PAGE_TITLE }) {
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const requestedStatus = params.get("status");
  const [status, setStatus] = useState<Status | "">(STATUSES.some((s) => s.value === requestedStatus) ? requestedStatus as Status : "");
  const [adding, setAdding] = useState(params.get("new") === "1");
  useEffect(() => {
    setQuery(params.get("q") ?? "");
    const next = params.get("status");
    setStatus(STATUSES.some((s) => s.value === next) ? next as Status : "");
    setAdding(params.get("new") === "1");
    setView(params.get("view"));
  }, [params]);
  const [openId, setOpenId] = useState<string | null>(params.get("lead"));
  const [view, setView] = useState(params.get("view"));
  const pageStatus = mode === "new" ? "new" : mode === "not_interested" ? "not_interested" : status;
  const pageView = mode === "documents" ? "documents" : view;

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("consultations")
      .select("*, documents(created_at, review_status, doc_type)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) setError(error.message);
    setItems((data as Row[]) ?? []);
  }, []);

  useEffect(() => {
    load();
    // Live updates: new requests, and Meet links filled in by the Google booking sync.
    const channel = supabase
      .channel("admin-leads-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (c: Row) => !q || [c.full_name, c.email, c.whatsapp, c.country, c.desired_course].some((v) => v?.toLowerCase().includes(q));
    // Call pages: every lead in that call state, soonest call first.
    if (mode === "upcoming") {
      return (items ?? []).filter((c) => isUpcoming(c) && matches(c)).sort((a, b) => a.preferred_call_at!.localeCompare(b.preferred_call_at!));
    }
    if (mode === "awaiting" || mode === "waiting") {
      return (items ?? [])
        .filter((c) => inCallPage(mode, c) && matches(c))
        .sort((a, b) => (pendingCallAt(a) || c9(a)).localeCompare(pendingCallAt(b) || c9(b)));
    }
    const rows = (items ?? []).filter(
      (c) =>
        (!pageStatus || c.status === pageStatus) &&
        (pageView !== "booked" || isBookedLead(c)) &&
        (pageView === "documents" ? docCount(c) > 0 : pageStatus || pageView ? true : docCount(c) === 0) &&
        // No longer interested leads live on their own page, not in All leads or Documents received.
        (pageStatus || (pageView && pageView !== "documents") || c.status !== "not_interested") &&
        (!q || [c.full_name, c.email, c.whatsapp, c.country, c.desired_course].some((v) => v?.toLowerCase().includes(q))),
    );
    return pageView === "documents" ? rows.sort((a, b) => lastUpload(b).localeCompare(lastUpload(a))) : rows;
  }, [items, query, pageStatus, pageView, mode]);

  const upcoming = useMemo(
    () =>
      (items ?? [])
        .map((c) => ({ c, at: callTimeOf(c) }))
        .filter((x): x is { c: Row; at: string } => !!x.at && new Date(x.at) > new Date())
        .sort((a, b) => a.at.localeCompare(b.at))
        .slice(0, 8),
    [items],
  );

  if (!items) return <Spinner />;
  const open = items.find((c) => c.id === openId);

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      <PageTitle
        actions={
          <span className="flex flex-wrap gap-2">
            <Button onClick={() => setParams({ new: "1" })}>
              <Plus className="h-4 w-4" /> Add new lead
            </Button>
            <Link to="/onlinesessions?present=1">
              <Button variant="secondary">
                <Presentation className="h-4 w-4" /> Online sessions
              </Button>
            </Link>
          </span>
        }
      >
        {PAGE_TITLE[mode]} {mode !== "all" && <span className="text-lg font-normal text-slate-400">· {filtered.length}</span>}
      </PageTitle>

      {mode === "all" && (
      <>
      <StatStrip
        items={[
          {
            icon: UsersRound,
            label: "Leads",
            value: items.length,
            sub: `+${items.filter((c) => new Date(c.created_at) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).length} this month`,
            onClick: () => setView(null),
          },
          {
            icon: Clock,
            label: "To confirm",
            value: items.filter((c) => ["requested", "reviewed", "suggested"].includes(callStage(c))).length,
            sub: "call requests",
            tone: "text-amber-500",
          },
          { icon: CalendarCheck, label: "Booked calls", value: items.filter(isBookedLead).length, sub: "confirmed", tone: "text-brand", onClick: () => setView("booked") },
          { icon: CheckCircle2, label: "Interviewed", value: items.filter((c) => c.session_outcome === "interviewed").length, sub: "online sessions", tone: "text-emerald-600" },
        ]}
      />

      <TodayCalls items={items} onOpen={setOpenId} />

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[15px] text-navy">Upcoming · {upcoming.length} calls</h2>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.map(({ c, at }) => (
              <MeetingCard
                key={c.id}
                name={c.full_name}
                title={c.full_name}
                subtitle={c.email}
                time={formatSlot(at)}
                status={
                  <>
                    <span className="truncate text-brand">{c.desired_course || labelFor(STUDY_PATHS, c.study_path)}</span>
                    <CallBadge c={c} />
                  </>
                }
                footer={
                  <>
                    <button onClick={() => setOpenId(c.id)} className="hover:bg-slate-50 hover:text-brand">
                      View details
                    </button>
                    {isBookedLead(c) && (
                      <Link to={sessionHref(c)} className="font-bold text-brand hover:bg-brand/5">
                        Start session
                      </Link>
                    )}
                  </>
                }
              />
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {view === "documents" ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">
            <FileText className="h-4 w-4" /> Documents received · newest upload first
            <button aria-label="Show all leads" onClick={() => setParams({})} className="rounded-full px-1 hover:bg-emerald-100">
              ×
            </button>
          </span>
        ) : view === "booked" ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-sm font-bold text-brand">
            Booked appointments only
            <button aria-label="Show all leads" onClick={() => setView(null)} className="rounded-full px-1 hover:bg-brand/10">
              ×
            </button>
          </span>
        ) : (
          <button onClick={() => setView("booked")} className="text-sm font-bold text-brand hover:underline">
            Show booked appointments
          </button>
        )}
      </div>
      </>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field pl-10"
            placeholder="Search name, email, phone, country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search requests"
          />
        </div>
        {mode === "all" && (
        <select
          className="field sm:w-64"
          value={status}
          onChange={(e) => {
            const next = e.target.value as Status | "";
            setStatus(next);
            setParams(next ? { status: next } : {});
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses ({items.length})</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} ({items.filter((c) => c.status === s.value).length})
            </option>
          ))}
        </select>
        )}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-slate-500">No requests match.</p>
        ) : mode === "documents" ? (
          <DocumentsTable rows={filtered} onOpen={setOpenId} onSaved={load} />
        ) : mode === "upcoming" ? (
          <UpcomingTable rows={filtered} onOpen={setOpenId} />
        ) : mode === "awaiting" || mode === "waiting" ? (
          <CallQueue rows={filtered} all={items} mode={mode} onOpen={setOpenId} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 font-bold">Candidate</th>
                  <th className="hidden px-3 py-3 font-bold md:table-cell">Course</th>
                  <th className="hidden px-3 py-3 font-bold sm:table-cell">Call</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="hidden px-5 py-3 font-bold lg:table-cell">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer hover:bg-mist">
                    <td className="px-5 py-3">
                      <button className="text-left font-bold hover:text-brand" onClick={() => setOpenId(c.id)}>
                        {c.full_name}
                      </button>
                      <div className="text-xs text-slate-500">{c.country ?? c.email}</div>
                      {docCount(c) > 0 && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          <FileText className="h-3 w-3" /> {docCount(c)} document{docCount(c) > 1 ? "s" : ""} · {formatSlot(lastUpload(c), { weekday: undefined })}
                        </div>
                      )}
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">{c.desired_course || labelFor(STUDY_PATHS, c.study_path)}</td>
                    <td className="hidden px-3 py-3 sm:table-cell">
                      {callTimeOf(c) ? (
                        <div className="space-y-1">
                          <div>{formatSlot(callTimeOf(c)!)}</div>
                          <CallBadge c={c} />
                          {isBookedLead(c) && <StartSessionLink c={c} />}
                        </div>
                      ) : (
                        <CallBadge c={c} />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge label={statusLabel(c.status)} muted={c.status === "not_interested"} />
                      {c.status === "not_interested" && c.not_interested_reason && (
                        <div className="mt-1 max-w-[14rem] text-[11px] font-bold leading-snug text-brand-red">Reason: {c.not_interested_reason}</div>
                      )}
                      {c.session_outcome && <div className="mt-1 text-[11px] font-bold text-slate-500">Session: {SESSION_LABEL[c.session_outcome]}</div>}
                    </td>
                    <td className="hidden px-5 py-3 text-slate-500 lg:table-cell">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <Detail
          key={open.id}
          c={open as Row}
          all={items}
          onClose={() => setOpenId(null)}
          onSaved={load}
          // Awaiting confirmation page: after confirming, open the next request in the queue.
          onNext={mode === "awaiting" ? () => setOpenId(filtered.find((x) => x.id !== open.id)?.id ?? null) : undefined}
        />
      )}
      {adding && (
        <AddLead
          onClose={() => { setAdding(false); setParams({}); }}
          onCreated={(id) => {
            setAdding(false);
            setParams({ lead: id });
            setOpenId(id);
            load();
          }}
        />
      )}
    </div>
  );
}

const SESSION_LABEL = { interviewed: "Interviewed", no_attendance: "No attendance", no_longer_interested: "No longer interested" } as const;

const ALL_ZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["Europe/Malta"];
  }
})();
const zoneTime = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone }).format(at);

function AddLead({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("new");
  const [country, setCountry] = useState("");
  const [dialCountry, setDialCountry] = useState("MA");
  const [phone, setPhone] = useState("");
  const [course, setCourse] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [zone, setZone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);
  const booked = status === "consultation_booked";

  const changeCountry = (code: string) => {
    setCountry(code);
    if (!phone.trim()) setDialCountry(code);
    setZone(timeZonesOf(code)[0] ?? "");
  };
  const zones = country ? timeZonesOf(country) : [];
  const phoneCheck = useMemo(() => {
    if (!phone.trim()) return null;
    const parsed = parsePhoneNumberFromString(phone.trim(), dialCountry as CountryCode);
    return parsed?.isValid() ? parsed : false;
  }, [phone, dialCountry]);
  const callAt = booked && date && time ? maltaDateTime(date, time) : null;
  const studyPath = ENGLISH_COURSES.some((c) => c.value === course) ? "english" : "higher_education";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (phoneCheck === false) return setError(`This WhatsApp number is not valid for ${countryByCode(dialCountry)?.name ?? dialCountry}.`);
    if (booked) {
      if (!callAt || callAt.getTime() < Date.now()) return setError("Choose a meeting date and time in the future (Malta time).");
      if (!/^https:\/\/\S+$/.test(meetingUrl.trim())) return setError("Paste the meeting link (it must start with https://).");
    }
    setSaving(true);
    setError("");
    const details = {
      country: country ? countryByCode(country)?.name ?? country : null,
      whatsapp: phoneCheck ? phoneCheck.formatInternational() : null,
      desired_course: course || null,
      study_path: course ? studyPath : null,
      ...(booked && callAt ? { call_at: callAt.toISOString(), meeting_url: meetingUrl.trim(), tz: zone || "Europe/Malta" } : {}),
    };
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error: invokeError } = await supabase.functions.invoke("admin-create-lead", {
        body: { full_name: name.trim(), email: normalizedEmail, status, ...details },
      });
      if (!invokeError && !data?.error) {
        if (!data?.id) throw new Error("Lead was created, but no lead ID was returned");
        onCreated(data.id);
        return;
      }
      if (data?.id && data.error) {
        setCreatedLeadId(data.id);
        throw new Error(data.error);
      }

      const functionStatus = (invokeError as { context?: Response } | null)?.context?.status;
      const isTransportError = invokeError?.name === "FunctionsFetchError";
      if (functionStatus !== 404 && !isTransportError) {
        throw new Error(data?.error ?? invokeError?.message ?? "Could not add the lead");
      }

      // Use the secured RPC if the Edge Function is unavailable or its CORS preflight fails.
      const { data: existing, error: lookupError } = await supabase
        .from("consultations")
        .select("id, full_name")
        .eq("email", normalizedEmail)
        .limit(1)
        .maybeSingle();
      if (lookupError) throw new Error(`Could not check whether this email already exists: ${lookupError.message}`);
      if (existing) throw new Error(`This email already belongs to ${existing.full_name}`);

      const { data: id, error: createError } = await supabase.rpc("book_consultation", {
        p_full_name: name.trim(),
        p_email: normalizedEmail,
        p_whatsapp: details.whatsapp ?? "",
        p_country: details.country,
        p_age: null,
        p_study_path: details.study_path ?? "higher_education",
        p_english_level: "b2_plus",
        p_desired_course: details.desired_course,
        p_start_date: null,
        p_budget: null,
        p_visa_support: null,
        p_preferred_contact_time: null,
        p_message: null,
        p_slot_id: null,
        p_tracking: { source: "admin", ...(booked ? { tz: zone || "Europe/Malta" } : {}) },
      });
      if (createError || !id) throw new Error(createError?.message ?? "Could not save the lead");

      const interviewed = status === "interviewed";
      const { error: statusError } = await supabase.from("consultations").update({
        user_id: null,
        status,
        session_outcome: interviewed ? "interviewed" : null,
        session_outcome_at: interviewed ? new Date().toISOString() : null,
        documents_due_at: interviewed ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null,
        ...(booked && callAt ? { call_status: "confirmed", preferred_call_at: callAt.toISOString(), meeting_url: meetingUrl.trim() } : {}),
      }).eq("id", id);
      if (statusError) {
        setCreatedLeadId(id);
        throw new Error(`Lead was created, but its status could not be set: ${statusError.message}`);
      }

      const { error: emailError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: name.trim(), status },
        },
      });
      if (emailError) {
        setCreatedLeadId(id);
        throw new Error(`Lead was created, but the dashboard email could not be sent: ${emailError.message}`);
      }

      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the lead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/45 p-4" onClick={onClose}>
      <Card>
        <form onSubmit={submit} className="w-[min(36rem,calc(100vw-2rem))] space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Add new lead</h2>
              <p className="mt-1 text-sm text-slate-500">The candidate receives an email for the selected status with a secure dashboard button.</p>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-2 hover:bg-mist"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="new-lead-name">Full name</label>
              <input id="new-lead-name" className="field" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="new-lead-email">Email</label>
              <input id="new-lead-email" type="email" className="field" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="new-lead-country">Country</label>
              <CountryPicker id="new-lead-country" value={country} onChange={changeCountry} countries={COUNTRIES} searchPlaceholder="Search country" />
            </div>
            <div>
              <label className="label" htmlFor="new-lead-phone">WhatsApp number</label>
              <div className="flex gap-2">
                <CountryPicker variant="dial" value={dialCountry} onChange={setDialCountry} countries={COUNTRIES} searchPlaceholder="Search country or +code" ariaLabel="Dial code" className="w-28 shrink-0" />
                <input id="new-lead-phone" type="tel" inputMode="tel" className="field min-w-0" placeholder="600 000 000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              {phoneCheck && <p className="mt-1 text-xs font-bold text-emerald-700">✓ {phoneCheck.formatInternational()}</p>}
              {phoneCheck === false && <p className="mt-1 text-xs font-bold text-brand-red">Not a valid number for {countryByCode(dialCountry)?.name ?? dialCountry}</p>}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="new-lead-course">Programme</label>
            <select id="new-lead-course" className="field" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">Not chosen yet</option>
              {ENGLISH_PROVIDERS.map((provider) => (
                <optgroup key={provider.name} label={`English · ${provider.name}`}>
                  {ENGLISH_COURSES.filter((c) => c.provider === provider.name).map((c) => (
                    <option key={c.id} value={c.value}>{c.label} · {c.price}</option>
                  ))}
                </optgroup>
              ))}
              {AREAS.filter((area) => area.key !== "english").map((area) => (
                <optgroup key={area.key} label={area.name}>
                  {PROGRAMMES.filter((p) => p.area === area.key).map((p) => (
                    <option key={p.id} value={programmeValue(p)}>{p.course} — {p.school} · {p.totalFee}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="new-lead-status">Status</label>
            <select id="new-lead-status" className="field" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          {booked && (
            <div className="space-y-4 rounded-xl bg-brand/[0.04] p-4 ring-1 ring-brand/15">
              <p className="flex items-center gap-2 text-sm font-black text-navy"><CalendarCheck className="h-4 w-4 text-brand" /> Meeting already booked</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="new-lead-date">Date (Malta) *</label>
                  <input id="new-lead-date" type="date" className="field" required value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="new-lead-time">Time (Malta) *</label>
                  <input id="new-lead-time" type="time" step={300} className="field" required value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="new-lead-meet">Meeting link *</label>
                <input id="new-lead-meet" type="url" className="field" required placeholder="https://meet.google.com/…" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} />
              </div>
              {country && (zones.length !== 1) && (
                <div>
                  <label className="label" htmlFor="new-lead-zone">Candidate's time zone</label>
                  <select id="new-lead-zone" className="field" value={zone} onChange={(e) => setZone(e.target.value)}>
                    {(zones.length ? zones : ALL_ZONES).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
              )}
              {callAt && (
                <p className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                  <strong>Malta:</strong> {zoneTime(callAt, "Europe/Malta")}
                  {zone && zone !== "Europe/Malta" && <><br /><strong>Candidate ({countryByCode(country)?.name}):</strong> {zoneTime(callAt, zone)}</>}
                </p>
              )}
              <p className="text-xs text-slate-500">The email shows the meeting in the candidate's local time when a country is chosen (otherwise Malta time), with the link, the programme, a dashboard button and a calendar invite. Presenters get their 10-minute email automatically.</p>
            </div>
          )}
          {error && (
            <Alert>
              <span>{error}</span>
              {createdLeadId && (
                <button type="button" onClick={() => onCreated(createdLeadId)} className="ml-2 font-bold underline">
                  Open created lead
                </button>
              )}
            </Alert>
          )}
          <Button type="submit" loading={saving} className="w-full"><Plus className="h-4 w-4" /> {booked ? "Add lead and send meeting email" : "Add lead and send email"}</Button>
        </form>
      </Card>
    </div>
  );
}

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `${Math.max(1, min)} min ago`;
  if (min < 24 * 60) return `${Math.round(min / 60)} h ago`;
  if (min < 7 * 24 * 60) return `${Math.round(min / 1440)} d ago`;
  return formatSlot(iso, { weekday: undefined, hour: undefined, minute: undefined });
};

/** Documents received: one clean row per candidate — who, required-document progress, last upload, comment. */
function DocumentsTable({ rows, onOpen, onSaved }: { rows: Row[]; onOpen: (id: string) => void; onSaved: () => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="px-5 py-3 font-bold">Candidate</th>
            <th className="px-3 py-3 font-bold">Documents</th>
            <th className="hidden px-3 py-3 font-bold sm:table-cell">Last upload</th>
            <th className="px-5 py-3 font-bold">Comments</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((c) => {
            const docs = c.documents ?? [];
            const required = documentTypesFor(c.study_path).filter((t) => t.required);
            const done = required.filter((t) => docs.some((d) => d.doc_type === t.key && d.review_status !== "rejected")).length;
            const complete = done === required.length;
            return (
              <tr key={c.id} onClick={() => onOpen(c.id)} className="cursor-pointer align-top hover:bg-mist">
                <td className="px-5 py-3">
                  <p className="font-bold text-navy">{c.full_name}</p>
                  <p className="text-xs text-slate-500">{c.email}</p>
                </td>
                <td className="w-44 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className={`block h-full rounded-full ${complete ? "bg-emerald-500" : "bg-brand"}`} style={{ width: `${(done / Math.max(1, required.length)) * 100}%` }} />
                    </span>
                    <span className="text-xs font-bold text-navy">{done}/{required.length}</span>
                  </div>
                  <p className={`mt-1 text-[11px] font-bold ${complete ? "text-emerald-700" : "text-slate-400"}`}>
                    {complete ? "✓ All required uploaded" : `${required.length - done} still missing`}
                  </p>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-3 text-slate-500 sm:table-cell">{ago(lastUpload(c))}</td>
                <td className="min-w-[14rem] px-5 py-3" onClick={(e) => e.stopPropagation()}>
                  <CommentCell c={c} onSaved={onSaved} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Inline staff comment on a lead (stored in admin_notes). */
function CommentCell({ c, onSaved }: { c: Row; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.admin_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("consultations").update({ admin_notes: text.trim() || null }).eq("id", c.id);
    setSaving(false);
    if (error) return setError(error.message);
    setEditing(false);
    onSaved();
  };

  if (!editing)
    return (
      <button onClick={() => { setText(c.admin_notes ?? ""); setEditing(true); }} className="block w-full text-left">
        {c.admin_notes ? (
          <span className="line-clamp-3 whitespace-pre-line text-slate-600 hover:text-navy">{c.admin_notes}</span>
        ) : (
          <span className="text-xs font-bold text-brand hover:underline">+ Add comment</span>
        )}
      </button>
    );
  return (
    <div className="space-y-2">
      <textarea autoFocus rows={3} className="field text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Comment for the team…" />
      {error && <p className="text-xs font-bold text-brand-red">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" loading={saving} onClick={save} className="min-h-8 px-4 text-xs">Save</Button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs font-bold text-slate-500 hover:text-navy">Cancel</button>
      </div>
    </div>
  );
}

function StartSessionLink({ c }: { c: Row }) {
  return (
    <Link
      to={sessionHref(c)}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white hover:bg-brand/90"
    >
      <Play className="h-3 w-3 fill-current" /> Start session
    </Link>
  );
}

const isBookedLead = (c: Row) =>
  c.call_status === "confirmed" && !c.call_declined_at && !["interviewed", "no_longer_interested"].includes(c.session_outcome ?? "");

// Confirmed time, otherwise the suggested time, otherwise the candidate's first choice.
const callTimeOf = (c: Row) => (c.call_status === "confirmed" ? c.preferred_call_at : c.suggested_call_at ?? c.requested_call_times[0]) ?? null;

const STAGE_BADGE = {
  requested: ["Requested", "bg-amber-100 text-amber-800"],
  reviewed: ["Reviewed", "bg-amber-100 text-amber-800"],
  suggested: ["Awaiting confirm", "bg-sky-100 text-sky-800"],
  confirmed: ["Confirmed", "bg-emerald-100 text-emerald-800"],
  declined: ["Not a fit", "bg-slate-100 text-slate-500"],
} as const;

function CallBadge({ c }: { c: Row }) {
  const stage = callStage(c);
  if (stage === "none") return <span className="text-slate-400">—</span>;
  const [label, style] = noReply24h(c) ? (["No reply 24h+", "bg-brand-red/10 text-brand-red"] as const) : STAGE_BADGE[stage];
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${style}`}>{label}</span>;
}

type DetailTab = "call" | "confirmation" | "profile" | "documents" | "comments";

function Detail({ c, all, onClose, onSaved, onNext }: { c: Row; all: Row[]; onClose: () => void; onSaved: () => void; onNext?: () => void }) {
  // Opens on Confirmation while the call awaits it (book on the Google page first), otherwise on Call.
  const awaiting = ["requested", "reviewed"].includes(callStage(c)) && !!(c.preferred_call_at ?? c.requested_call_times[0]);
  const [tab, setTab] = useState<DetailTab>(awaiting ? "confirmation" : "call");
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [askReason, setAskReason] = useState(false);

  const loadDocs = useCallback(() => {
    supabase
      .from("documents")
      .select("*")
      .eq("consultation_id", c.id)
      .order("created_at")
      .then(({ data }) => setDocs(data ?? []));
  }, [c.id]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const quickUpdate = async (fields: Partial<Row>) => {
    const { error } = await supabase.from("consultations").update(fields).eq("id", c.id);
    if (error) return setMsg({ tone: "error", text: error.message });
    onSaved();
  };

  const remove = async () => {
    if (!confirm(`Permanently delete all leads for ${c.email}, all uploaded documents and email records, and their login account? This cannot be undone.`)) return;
    setDeleting(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-lead", {
        body: { consultationId: c.id },
      });
      if (error || data?.error) {
        const functionStatus = (error as { context?: Response } | null)?.context?.status;
        if (functionStatus === 404 || error?.name === "FunctionsFetchError") {
          throw new Error(
            "The delete service is unavailable. The Supabase admin must deploy the admin-delete-lead Edge Function to project qkcdjqrtwzqflrrxdgqw before deleting leads.",
          );
        }
        throw new Error(data?.error ?? error?.message ?? "Could not delete the lead");
      }
      onClose();
      onSaved();
    } catch (error) {
      setMsg({ tone: "error", text: error instanceof Error ? error.message : "Could not delete the lead" });
    } finally {
      setDeleting(false);
    }
  };

  // Short-lived signed links: open in a new tab, or download under the original file name.
  const openDoc = async (d: DocumentRow, download = false) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(d.file_path, 60, download ? { download: d.file_name } : undefined);
    if (data) window.open(data.signedUrl, "_blank", "noopener");
  };

  const requiredDocs = documentTypesFor(c.study_path).filter((t) => t.required);
  const hasDoc = (key: string) => docs.some((d) => d.doc_type === key && d.review_status !== "rejected");
  const referredBy = c.tracking.ref ? all.find((x) => x.referral_code === c.tracking.ref && x.id !== c.id) : undefined;
  const referrals = all.filter((x) => x.tracking.ref === c.referral_code && x.id !== c.id);
  const rows: [string, string | null | undefined][] = [
    ["Email", c.email],
    ["WhatsApp", c.whatsapp],
    ["Country", c.country],
    ["Age", c.age?.toString()],
    ["Path", labelFor(STUDY_PATHS, c.study_path)],
    ["English level", labelFor(ENGLISH_LEVELS, c.english_level)],
    ["Course", c.desired_course],
    ["Contact time", c.preferred_contact_time],
    ["Message", c.message],
    ["Source", [c.tracking.utm_source, c.tracking.utm_medium, c.tracking.utm_campaign].filter(Boolean).join(" / ") || c.tracking.referrer],
    ["Received", new Date(c.created_at).toLocaleString()],
    ["Referred by", referredBy ? `${referredBy.full_name} (${referredBy.email})` : c.tracking.ref ? `Code ${c.tracking.ref}` : null],
    ["Referrals", referrals.length ? `${referrals.length}: ${referrals.map((x) => x.full_name).join(", ")}` : null],
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white">
          <div className="flex items-start justify-between gap-3 px-6 pt-5">
            <div className="min-w-0">
              <h2 id="detail-title" className="flex items-center gap-2 text-xl font-black">
                <span className="truncate">{c.full_name}</span>
                <button
                  aria-label={c.is_starred ? "Unstar" : "Star (shown first in the presenter queue)"}
                  aria-pressed={c.is_starred}
                  onClick={() => quickUpdate({ is_starred: !c.is_starred })}
                  className="rounded-full p-1 hover:bg-amber-50"
                >
                  <Star className={`h-5 w-5 ${c.is_starred ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                </button>
              </h2>
              <p className="truncate text-sm text-slate-500">
                {c.email}
                {c.whatsapp && <> · {c.whatsapp}</>}
              </p>
            </div>
            <button aria-label="Close" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/5 hover:bg-brand/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-6 pt-3">
            <label htmlFor="lead-status" className="sr-only">Lead status</label>
            <select id="lead-status" className="field w-auto py-1.5 text-sm font-bold" value={c.status}
              onChange={(e) => (e.target.value === "not_interested" ? setAskReason(true) : quickUpdate({ status: e.target.value as Status }))}
            >
              {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <span className="text-xs text-slate-500">{c.user_id ? "Has an account" : "No account yet"}</span>
            <a href={`/dashboard?preview=${encodeURIComponent(c.id)}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Candidate dashboard
            </a>
          </div>
          {askReason && (
            <ReasonPicker
              initial={c.not_interested_reason}
              onCancel={() => setAskReason(false)}
              onSave={(reason) => {
                setAskReason(false);
                quickUpdate({ status: "not_interested", not_interested_reason: reason, not_interested_at: c.status === "not_interested" ? c.not_interested_at : new Date().toISOString() });
              }}
            />
          )}
          {c.status === "not_interested" && !askReason && <NotInterestedBanner c={c} onEdit={() => setAskReason(true)} onSaved={onSaved} />}
          <LeadProgress c={c} />
          <div role="tablist" aria-label="Lead details" className="mt-3 flex gap-1 overflow-x-auto px-4">
            {(
              [
                ["confirmation", "Confirmation", CalendarPlus, awaiting ? "To book" : null],
                ["call", "Call", CalendarCheck, callStage(c) === "none" ? null : CALL_STAGE_LABELS[callStage(c)]],
                ["profile", "Profile", UserRound, null],
                ["documents", "Documents", FileText, `${requiredDocs.filter((t) => hasDoc(t.key)).length}/${requiredDocs.length}`],
                ["comments", "Comments", MessageSquare, c.admin_notes ? "•" : null],
              ] as const
            ).map(([key, label, Icon, badge]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-bold transition ${
                  tab === key ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-navy"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
                {badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                      key === "call" && callStage(c) === "confirmed"
                        ? "bg-emerald-100 text-emerald-800"
                        : key === "call" || key === "confirmation"
                          ? "bg-amber-100 text-amber-800"
                          : key === "comments"
                            ? "text-brand"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6 px-6 py-5" role="tabpanel">
          {tab === "call" && (
            <>
              {callStage(c) === "confirmed" && <AttendanceBox c={c} onSave={quickUpdate} />}
              <CallPanel c={c} onSaved={onSaved} />
              <SessionPanel c={c} />
              {callStage(c) === "confirmed" && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label htmlFor="meet-link" className="flex shrink-0 items-center gap-1.5 text-sm font-bold">
                    <Video className="h-4 w-4 text-brand" /> Meet link
                  </label>
                  <input
                    id="meet-link"
                    type="url"
                    placeholder="https://meet.google.com/…"
                    className="field py-2"
                    defaultValue={c.meeting_url ?? ""}
                    onBlur={(e) => e.target.value.trim() !== (c.meeting_url ?? "") && quickUpdate({ meeting_url: e.target.value.trim() || null })}
                  />
                </div>
              )}
            </>
          )}

          {tab === "confirmation" && <BookingTab c={c} all={all} onSaved={onSaved} onNext={onNext} />}

          {tab === "profile" && (
            <>
              <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm sm:grid-cols-[8rem_1fr] sm:gap-x-4">
                {rows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="whitespace-pre-wrap break-words font-medium">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
              <div className="space-y-3 border-t border-slate-100 pt-5">
                <p className="text-xs text-slate-500">Permanently removes all leads for this email, their uploaded documents and email records, and the linked login account.</p>
                <Button variant="danger" onClick={remove} loading={deleting} disabled={deleting}>
                  Delete lead and account
                </Button>
              </div>
            </>
          )}

          {tab === "documents" && (
            <div>
              <ul className="mb-4 grid gap-1.5 text-sm">
                {requiredDocs.map((t) => (
                  <li key={t.key} className={`flex items-center gap-2 ${hasDoc(t.key) ? "text-emerald-700" : "text-slate-500"}`}>
                    {hasDoc(t.key) ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />} {t.label}
                  </li>
                ))}
              </ul>
              {docs.length === 0 ? (
                <p className="text-sm text-slate-500">No documents uploaded.</p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d) => (
                    <li key={d.id} className="rounded-xl bg-mist px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button onClick={() => openDoc(d)} className="flex min-w-0 items-center gap-2 text-sm hover:underline">
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" /> <span className="truncate">{d.file_name}</span>
                          {d.doc_type && (
                            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">
                              {documentTypesFor(c.study_path).find((t) => t.key === d.doc_type)?.label ?? d.doc_type}
                            </span>
                          )}
                        </button>
                        <span className="flex items-center gap-1.5">
                          <button onClick={() => openDoc(d)} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-navy ring-1 ring-slate-200 hover:bg-slate-50">
                            View
                          </button>
                          <button onClick={() => openDoc(d, true)} className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white hover:bg-brand/90">
                            Download
                          </button>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "comments" && <NotesEditor key={c.id} c={c} onSave={(text) => quickUpdate({ admin_notes: text || null })} />}

          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        </div>
      </aside>
    </div>
  );
}

/** Staff comments on the lead (admin_notes), shared with the Documents received table. */
function NotesEditor({ c, onSave }: { c: Row; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState(c.admin_notes ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = text.trim() !== (c.admin_notes ?? "").trim();
  const save = async () => {
    setSaving(true);
    await onSave(text.trim());
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="space-y-2">
      <label htmlFor="lead-notes" className="label">Comments for the team</label>
      <textarea
        id="lead-notes"
        className="field min-h-48"
        placeholder="Call outcome, what the candidate needs, next steps…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!dirty}>
          Save comment
        </Button>
        {saved && <span className="flex items-center gap-1 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
      </div>
    </div>
  );
}

/** Other leads holding (or confirmed at) the same call time — e.g. one from the dashboard and one from the Google page. */
const clashesOf = (c: Row, all: Row[]) => {
  const at = c.preferred_call_at ?? c.requested_call_times[0];
  if (!at) return [];
  const t = new Date(at).getTime();
  return all.filter(
    (x) => x.id !== c.id && !x.call_declined_at && ["requested", "confirmed"].includes(x.call_status) && x.preferred_call_at && Math.abs(new Date(x.preferred_call_at).getTime() - t) < 20 * 60_000,
  );
};

function ClashWarning({ c, all }: { c: Row; all: Row[] }) {
  const clash = clashesOf(c, all);
  if (!clash.length) return null;
  return (
    <p className="flex items-start gap-2 rounded-xl bg-brand-red/5 px-3 py-2 text-sm font-bold text-brand-red">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      Clash: {clash.map((x) => `${x.full_name} (${x.call_status === "confirmed" ? "confirmed" : "awaiting"})`).join(", ")} at the same time.
    </p>
  );
}

/** Where the lead is: Requested → Booked in Google → Meet link → Confirmed → Session done. */
function LeadProgress({ c }: { c: Row }) {
  const stage = callStage(c);
  const steps: [string, boolean][] = [
    ["Requested", stage !== "none" || !!c.preferred_call_at],
    ["Booked in Google", !!c.google_event_id || !!c.meeting_url || stage === "confirmed"],
    ["Meet link", !!c.meeting_url],
    ["Confirmed", stage === "confirmed" || c.session_outcome === "interviewed"],
    ["Will attend", !!c.attendance_confirmed_at || c.session_outcome === "interviewed"],
    ["Session done", c.session_outcome === "interviewed"],
  ];
  return (
    <ol className="mt-3 flex items-center gap-1 overflow-x-auto px-6 text-[11px] font-bold" aria-label="Progress">
      {steps.map(([label, done], i) => (
        <li key={label} className="flex shrink-0 items-center gap-1">
          {i > 0 && <span className={`h-px w-3 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />}
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${done ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400"}`}>
            {done && <Check className="h-3 w-3" />} {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Confirm a call in one place: copy the candidate's details, book them on the real Google booking page (embedded),
 * paste the Meet link Google created, Confirm & send. On the Awaiting confirmation page, "Confirm & next" moves on.
 */
function BookingTab({ c, all, onSaved, onNext }: { c: Row; all: Row[]; onSaved: () => void; onNext?: () => void }) {
  const at = c.preferred_call_at ?? c.suggested_call_at ?? c.requested_call_times[0] ?? null;
  const confirmed = callStage(c) === "confirmed";
  const [meet, setMeet] = useState(c.meeting_url ?? "");
  // Meet link found by the Google booking sync while this tab is open.
  useEffect(() => {
    if (c.meeting_url) setMeet((m) => m || c.meeting_url!);
  }, [c.meeting_url]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const paste = async () => {
    const text = (await navigator.clipboard.readText().catch(() => "")).trim();
    const link = /https:\/\/meet\.google\.com\/[a-z0-9-]+/i.exec(text)?.[0] ?? (text.startsWith("https://") ? text : "");
    if (link) setMeet(link);
    else setMsg({ tone: "error", text: "No meeting link in the clipboard — copy it from the Google Calendar event first." });
  };

  const confirm = async (next: boolean) => {
    const link = meet.trim();
    if (!/^https:\/\/\S+$/.test(link)) return setMsg({ tone: "error", text: "Paste the Google Meet link first (step 3)." });
    const waTab = c.whatsapp ? window.open("about:blank", "_blank") : null;
    setBusy(true);
    setMsg(null);
    const r = await confirmWithMeet(c, link, waTab);
    setBusy(false);
    if (r.error) return setMsg({ tone: "error", text: r.error });
    onSaved();
    if (next && onNext) return onNext();
    setMsg({ tone: "success", text: `Confirmed${r.emailed ? " · “We're waiting for you” sent with the Meet link" : " · email not sent (check Resend)"}${waTab ? " · WhatsApp opened" : ""}.` });
  };

  const copyWhatsApp = async () => {
    await navigator.clipboard.writeText(waitingWhatsApp(c)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <ClashWarning c={c} all={all} />
      {!confirmed && at && <PickAnotherButton c={c} onDone={onSaved} />}

      <Section n={1} title="Copy into the booking form">
        <CopyField label="Full name" value={c.full_name} />
        <CopyField label="Email" value={c.email} />
        {c.whatsapp && <CopyField label="Phone" value={c.whatsapp} />}
        <CopyField label="Date & time" value={at ? `${maltaTime(at)} (Malta)` : "No time requested yet"} copy={!!at} />
        {at && candidateTime(c, at) && <CopyField label="Candidate's time" value={candidateTime(c, at)!} copy={false} />}
      </Section>

      <Section n={2} title={c.booked_via === "google" ? "Already booked on the Google page ✓" : "Book the same day and time on the Google page"}>
        {c.booked_via !== "google" && !confirmed && (
          <>
            <iframe title="Google booking page" src={BOOKING_EMBED} className="h-[640px] w-full rounded-2xl border border-slate-200 bg-white" />
            <a href={BOOKING_EMBED.replace("?gv=true", "")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Open the booking page in a new tab
            </a>
          </>
        )}
      </Section>

      <Section n={3} title="Google Meet link">
        <p className="text-xs text-slate-500">
          {c.meeting_url && c.booked_via === "google"
            ? "Found automatically from the Google booking ✓"
            : "Open the new event in Google Calendar, copy its Meet link, then click Paste."}
        </p>
        <div className="flex gap-2">
          <input className="field py-2" type="url" placeholder="https://meet.google.com/abc-defg-hij" value={meet} onChange={(e) => setMeet(e.target.value)} />
          <Button variant="secondary" className="min-h-10 shrink-0" onClick={paste}>
            <ClipboardPaste className="h-4 w-4" /> Paste
          </Button>
        </div>
      </Section>

      <Section n={4} title={confirmed ? "Confirmed ✓" : "Confirm & send"}>
        {confirmed ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-9" onClick={copyWhatsApp}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <MessageCircle className="h-4 w-4" />} {copied ? "Copied" : "Copy WhatsApp message"}
            </Button>
            {c.whatsapp && (
              <a href={waLink(c.whatsapp, waitingWhatsApp(c))} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="min-h-9">Open WhatsApp</Button>
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button loading={busy} onClick={() => confirm(false)} disabled={!meet.trim() || !at}>
                <CheckCircle2 className="h-4 w-4" /> Confirm &amp; send
              </Button>
              {onNext && (
                <Button variant="secondary" loading={busy} onClick={() => confirm(true)} disabled={!meet.trim() || !at}>
                  Confirm &amp; next →
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500">Sends “We're waiting for you” with the Meet link (CC sbarakat@) and opens WhatsApp with the same message.</p>
          </>
        )}
      </Section>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-extrabold">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-black text-white">{n}</span> {title}
      </h3>
      {children && <div className="space-y-2 ps-8">{children}</div>}
    </section>
  );
}

function CopyField({ label, value, copy = true }: { label: string; value: string; copy?: boolean }) {
  const [done, setDone] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(value).catch(() => {});
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
      <span className="w-24 shrink-0 text-xs text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold">{value}</span>
      {copy && (
        <button onClick={onCopy} aria-label={`Copy ${label}`} className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-brand hover:bg-brand/5">
          {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {done ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = { google: "Google booking page", admin: "Team", dashboard: "Dashboard", "confirm-link": "Confirm link" };

const since = (iso: string | null | undefined) => {
  if (!iso) return "";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

/** Awaiting confirmation / Waiting for candidate: soonest call first, with where it came from and how long it has waited. */
function CallQueue({ rows, all, mode, onOpen }: { rows: Row[]; all: Row[]; mode: "awaiting" | "waiting"; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
        {mode === "awaiting"
          ? "Open a lead → Confirmation tab to book it on the Google page (or Add to Google Calendar), then paste the Meet link and Confirm & send in the Call tab."
          : "We sent these candidates a time, or asked them to pick another one; they haven't answered yet. Resend, or message them on WhatsApp."}
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="px-5 py-3 font-bold">Candidate</th>
            <th className="px-3 py-3 font-bold">{mode === "awaiting" ? "Requested time" : "Time sent"} (Malta)</th>
            <th className="hidden px-3 py-3 font-bold md:table-cell">{mode === "awaiting" ? "From" : "Sent"}</th>
            <th className="px-5 py-3 text-right font-bold"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((c) => {
            const at = pendingCallAt(c);
            return (
              <tr key={c.id} onClick={() => onOpen(c.id)} className="cursor-pointer hover:bg-mist">
                <td className="px-5 py-3">
                  <div className="font-bold">{c.full_name}</div>
                  <div className="text-xs text-slate-500">{c.email}{c.whatsapp ? ` · ${c.whatsapp}` : ""}</div>
                </td>
                <td className="px-3 py-3">
                  {at ? (
                    <>
                      <div className="font-bold">{maltaTime(at)}</div>
                      {candidateTime(c, at) && <div className="text-xs text-slate-500">Candidate: {candidateTime(c, at, { weekday: "short", month: "short" })}</div>}
                      {new Date(at).getTime() < Date.now() && <div className="text-xs font-bold text-brand-red">Time has passed</div>}
                    </>
                  ) : (
                    <div className="font-bold text-sky-700">Asked to pick another time</div>
                  )}
                  {mode === "awaiting" && clashesOf(c, all).length > 0 && (
                    <div className="flex items-center gap-1 text-xs font-bold text-brand-red">
                      <AlertTriangle className="h-3 w-3" /> Clash with {clashesOf(c, all).map((x) => x.full_name).join(", ")}
                    </div>
                  )}
                </td>
                <td className="hidden px-3 py-3 text-xs text-slate-500 md:table-cell">
                  {mode === "awaiting" ? (
                    <>
                      {c.booked_via ? SOURCE_LABEL[c.booked_via] : "Application form"}
                      {c.call_requested_at && <div className="font-bold text-amber-700">waiting {since(c.call_requested_at).replace(" ago", "")}</div>}
                    </>
                  ) : (
                    <>
                      {since(at ? c.call_suggested_at : c.repick_requested_at)}
                      {noReply24h(c) && <div className="font-bold text-brand-red">No reply 24h+</div>}
                    </>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${mode === "awaiting" ? "bg-brand text-white" : "bg-white text-navy ring-1 ring-slate-200"}`}>
                    {mode === "awaiting" ? "Confirm →" : "Open →"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const maltaDay = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Malta" }).format(new Date(d));
const maltaClock = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Malta", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Reminder the team sends on WhatsApp shortly before the call. */
const reminderWhatsApp = (c: Row) =>
  [
    `Hi ${c.full_name.split(" ")[0]} 👋 just a friendly reminder: your free consultation with Outreach starts today at ${maltaClock(c.preferred_call_at!)} (Malta time).`,
    c.meeting_url ? `🎥 Join here: ${c.meeting_url}` : "",
    "See you soon! 😊",
  ]
    .filter(Boolean)
    .join("\n");

/** Confirmed calls today (Malta date): time, name, Join Meet, Start session and the WhatsApp reminder to copy. */
function TodayCalls({ items, onOpen }: { items: Row[]; onOpen: (id: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const today = maltaDay(new Date());
  const calls = items
    .filter((c) => c.call_status === "confirmed" && c.preferred_call_at && maltaDay(c.preferred_call_at) === today && c.session_outcome !== "interviewed")
    .sort((a, b) => a.preferred_call_at!.localeCompare(b.preferred_call_at!));
  if (!calls.length) return null;
  const copy = async (c: Row) => {
    await navigator.clipboard.writeText(reminderWhatsApp(c)).catch(() => {});
    setCopied(c.id);
    setTimeout(() => setCopied(null), 2000);
  };
  return (
    <Card>
      <div className="space-y-3 px-5 py-5 sm:px-6">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <CalendarCheck className="h-5 w-5 text-brand" /> Today's calls · {calls.length}
        </h2>
        <ul className="divide-y divide-slate-100">
          {calls.map((c) => {
            const past = new Date(c.preferred_call_at!).getTime() + 20 * 60_000 < Date.now();
            return (
              <li key={c.id} className={`flex flex-wrap items-center gap-3 py-2.5 ${past ? "opacity-50" : ""}`}>
                <span className="w-14 shrink-0 text-lg font-black text-brand">{maltaClock(c.preferred_call_at!)}</span>
                <button onClick={() => onOpen(c.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-bold hover:text-brand">{c.full_name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {candidateTime(c, c.preferred_call_at!, { weekday: undefined, day: undefined, month: undefined }) && <>Their time {candidateTime(c, c.preferred_call_at!, { weekday: undefined, day: undefined, month: undefined })} · </>}
                    {c.desired_course || c.email}
                  </span>
                  <span className={`text-[11px] font-bold ${c.attendance_confirmed_at ? "text-emerald-700" : "text-amber-700"}`}>
                    {c.attendance_confirmed_at ? "✓ Will attend" : "Attendance not confirmed yet"}
                  </span>
                </button>
                <span className="flex flex-wrap gap-1.5">
                  {c.meeting_url && (
                    <a href={c.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700">
                      <Video className="h-3.5 w-3.5" /> Join Meet
                    </a>
                  )}
                  <Link to={sessionHref(c)} className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white hover:bg-brand/90">
                    <Play className="h-3.5 w-3.5 fill-current" /> Start session
                  </Link>
                  <button onClick={() => copy(c)} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-navy ring-1 ring-slate-200 hover:bg-slate-50">
                    {copied === c.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <MessageCircle className="h-3.5 w-3.5" />} {copied === c.id ? "Copied" : "Reminder"}
                  </button>
                  {c.whatsapp && (
                    <a href={waLink(c.whatsapp, reminderWhatsApp(c))} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-navy ring-1 ring-slate-200 hover:bg-slate-50">
                      WhatsApp
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

const NOT_INTERESTED_REASONS = [
  "Too expensive / budget",
  "Chose another country",
  "Went with another agency",
  "Not ready yet — later intake",
  "Visa concerns",
  "Course not available",
  "No reply / unreachable",
];

/** Moving a lead to "No longer interested" asks why (kept on the lead and shown in the lists). */
function ReasonPicker({ initial, onCancel, onSave }: { initial?: string | null; onCancel: () => void; onSave: (reason: string) => void }) {
  const preset = NOT_INTERESTED_REASONS.includes(initial ?? "") ? initial! : initial ? "Other" : "";
  const [choice, setChoice] = useState(preset);
  const [other, setOther] = useState(preset === "Other" ? initial ?? "" : "");
  const reason = choice === "Other" ? other.trim() : choice;
  return (
    <div className="mx-6 mt-3 space-y-3 rounded-2xl border-2 border-brand-red/30 bg-red-50 p-4">
      <p className="text-sm font-black text-brand-red">Why is this candidate no longer interested?</p>
      <div className="flex flex-wrap gap-1.5">
        {[...NOT_INTERESTED_REASONS, "Other"].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setChoice(r)}
            className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${choice === r ? "bg-brand-red text-white ring-brand-red" : "bg-white text-navy ring-slate-200 hover:bg-slate-50"}`}
          >
            {r}
          </button>
        ))}
      </div>
      {choice === "Other" && (
        <input autoFocus className="field py-2 text-sm" placeholder="Write the reason…" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Reason" />
      )}
      <p className="text-xs text-slate-600">Their account is kept. They get a short "thank you — our door is open" email, and you can invite them to book again any time.</p>
      <div className="flex gap-2">
        <Button onClick={() => reason && onSave(reason)} disabled={!reason}>
          Save reason
        </Button>
        <button type="button" onClick={onCancel} className="rounded-full px-4 text-sm font-bold text-slate-500 hover:text-navy">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Lead header while "No longer interested": the reason, and a button inviting them to book a new call. */
function NotInterestedBanner({ c, onEdit, onSaved }: { c: Row; onEdit: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string; waUrl?: string | null } | null>(null);
  const reinvite = async () => {
    if (!confirm(`Invite ${c.full_name} to book a new call? Their status goes back to New and they get an email with a booking link.`)) return;
    setBusy(true);
    const { data, error } = await notifyCandidate("reinvite", c.id);
    setBusy(false);
    if (error || data?.error) return setMsg({ tone: "error", text: data?.error ?? error?.message ?? "Could not send the invitation" });
    setMsg({ tone: "success", text: data?.email === "sent" ? "Invitation emailed — status is New again." : "Status is New again, but the email failed.", waUrl: data?.waUrl });
    onSaved();
  };
  return (
    <div className="mx-6 mt-3 space-y-2 rounded-2xl border-2 border-brand-red/30 bg-red-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-brand-red">
            <CalendarX2 className="h-4 w-4" /> No longer interested{c.not_interested_at && ` · ${new Date(c.not_interested_at).toLocaleDateString()}`}
          </p>
          <p className="mt-1 text-base font-black text-navy">{c.not_interested_reason || "No reason recorded"}</p>
        </div>
        <button type="button" onClick={onEdit} className="text-xs font-bold text-brand hover:underline">
          {c.not_interested_reason ? "Edit reason" : "Add reason"}
        </button>
      </div>
      <Button onClick={reinvite} loading={busy} disabled={busy}>
        <RotateCcw className="h-4 w-4" /> Invite to book again
      </Button>
      {msg && (
        <Alert tone={msg.tone}>
          {msg.text}
          {msg.waUrl && (
            <a href={msg.waUrl} target="_blank" rel="noreferrer" className="ml-2 font-bold underline">
              Send on WhatsApp
            </a>
          )}
        </Alert>
      )}
    </div>
  );
}

/** Confirmed call: has the candidate confirmed they'll attend (email link or WhatsApp YES)? */
function AttendanceBox({ c, onSave }: { c: Row; onSave: (fields: Partial<Row>) => Promise<void> }) {
  if (c.attendance_confirmed_at) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <span className="flex items-center gap-1.5 font-bold">
          <ThumbsUp className="h-4 w-4" /> Will attend — confirmed {new Date(c.attendance_confirmed_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
        <button type="button" onClick={() => onSave({ attendance_confirmed_at: null })} className="text-xs font-bold text-slate-500 hover:text-navy">
          Undo
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-black">⚠️ Attendance not confirmed yet</p>
      <p className="text-xs">
        {c.attendance_deadline
          ? <>If they don't confirm by <strong>{maltaTime(c.attendance_deadline)} (Malta)</strong>, the booking is cancelled automatically and they get a link to choose a new time.</>
          : "No automatic cancellation for this booking (booked too close to the call)."}
      </p>
      <Button onClick={() => onSave({ attendance_confirmed_at: new Date().toISOString() })}>
        <Check className="h-4 w-4" /> Mark confirmed (replied YES on WhatsApp)
      </Button>
    </div>
  );
}

/** Confirmed calls still to come, soonest first: time (Malta + candidate), attendance, Join Meet and Start session. */
function UpcomingTable({ rows, onOpen }: { rows: Row[]; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="px-5 py-3 font-bold">Call (Malta)</th>
            <th className="px-3 py-3 font-bold">Candidate</th>
            <th className="hidden px-3 py-3 font-bold md:table-cell">Attendance</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((c) => {
            const at = c.preferred_call_at!;
            const soon = new Date(at).getTime() - Date.now() < 60 * 60_000;
            return (
              <tr key={c.id} onClick={() => onOpen(c.id)} className="cursor-pointer hover:bg-mist">
                <td className="px-5 py-3">
                  <div className={`font-bold ${soon ? "text-brand" : ""}`}>{maltaTime(at)}</div>
                  {candidateTime(c, at, { weekday: "short", month: "short" }) && (
                    <div className="text-xs text-slate-500">Candidate: {candidateTime(c, at, { weekday: "short", month: "short" })}</div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="font-bold">{c.full_name}</div>
                  <div className="text-xs text-slate-500">{c.desired_course || c.email}</div>
                </td>
                <td className="hidden px-3 py-3 md:table-cell">
                  {c.attendance_confirmed_at ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">✓ Will attend</span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">Not confirmed yet</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <span className="inline-flex flex-wrap justify-end gap-1.5">
                    {c.meeting_url && (
                      <a href={c.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700">
                        <Video className="h-3.5 w-3.5" /> Meet
                      </a>
                    )}
                    <Link to={sessionHref(c)} className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white hover:bg-brand/90">
                      <Play className="h-3.5 w-3.5 fill-current" /> Start session
                    </Link>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
