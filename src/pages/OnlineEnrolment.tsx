import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, FileText, Send } from "lucide-react";
import { supabase } from "../lib/supabase";
import { COUNTRIES } from "../lib/countries";
import type { Consultation } from "../lib/types";
import { Alert, Button } from "../components/ui";
import { ONE_TO_ONE_LESSONS, ONLINE_ENGLISH, ONLINE_ENGLISH_WEEKS, activeOffer, lessonPrice, type OnlineEnglishProgramme } from "./sessions/data";

/** What the candidate sent, kept on the lead (tracking.online_enrolment) for the team. */
export interface OnlineEnrolment {
  full_name: string;
  email: string;
  date_of_birth: string;
  phone: string;
  nationality: string;
  programme: string;
  class?: string;
  weeks?: number;
  extra_weeks?: number;
  lessons?: number;
  start_week: string;
  estimate?: string;
  submitted_at?: string;
}

export const readEnrolment = (c: Consultation): OnlineEnrolment | null => {
  try {
    return c.tracking?.online_enrolment ? (JSON.parse(c.tracking.online_enrolment) as OnlineEnrolment) : null;
  } catch {
    return null;
  }
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const weekLabel = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** The next 10 start dates on the class day (Monday when the programme has no fixed class day). */
function startWeeks(day: number) {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 3); // leave a few days to confirm the booking
  while (d.getDay() !== day) d.setDate(d.getDate() + 1);
  for (let i = 0; i < 10; i++) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

/** Estimated invoice lines (what the student pays). Null total = price confirmed by the adviser. */
function estimate(p: OnlineEnglishProgramme, weeks: number, lessons: number) {
  const lines: [string, string][] = [];
  let total: number | null = 0;
  let extra = 0;
  if (p.booking === "lessons") {
    const price = lessons ? lessonPrice(p, lessons) : undefined;
    if (!price) return { lines, total: null, extra };
    lines.push([`${lessons} lesson${lessons > 1 ? "s" : ""} × ${gbp(price)} / lesson`, gbp(lessons * price)]);
    total = lessons * price;
  } else {
    const rate = weeks ? p.weeklyRates?.[weeks] : undefined;
    if (!rate) return { lines, total: null, extra };
    lines.push([`${weeks} weeks × ${gbp(rate)} / week`, gbp(weeks * rate)]);
    total = weeks * rate;
    const offer = activeOffer(p);
    if (offer && weeks === 12) {
      extra = 4;
      lines.push([`${offer.title}: +4 weeks of lessons`, gbp(0)]);
    }
  }
  if (p.registrationFee) {
    lines.push(["Registration fee", `+ ${gbp(p.registrationFee)}`]);
    total += p.registrationFee;
  }
  return { lines, total, extra };
}

/**
 * "Study English Online": the candidate chooses the programme, class, weeks and start week and sends an enrolment
 * request. Name, email, phone and nationality come from the application. The team confirms and sends the invoice.
 */
export function OnlineEnrolmentForm({ c, onSaved }: { c: Consultation; onSaved: () => void }) {
  const sent = readEnrolment(c);
  const [editing, setEditing] = useState(!sent);
  const [dob, setDob] = useState(() => {
    const [y = "", m = "", d = ""] = (sent?.date_of_birth ?? "").split("-");
    return { d, m, y };
  });
  const [phone, setPhone] = useState(sent?.phone ?? c.whatsapp ?? "");
  const [nationality, setNationality] = useState(sent?.nationality ?? c.country ?? "");
  const [programmeName, setProgrammeName] = useState(sent?.programme ?? "");
  const [cls, setCls] = useState(sent?.class ?? "");
  const [weeks, setWeeks] = useState(sent?.weeks ? String(sent.weeks) : "");
  const [lessons, setLessons] = useState(sent?.lessons ? String(sent.lessons) : "");
  const [startWeek, setStartWeek] = useState(sent?.start_week ?? "");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const p = ONLINE_ENGLISH.find((x) => x.name === programmeName);
  const classDay = p?.classes?.find((x) => x.label === cls)?.day ?? 1;
  const weeksOptions = useMemo(() => startWeeks(classDay), [classDay]);
  const weeksN = p?.booking === "fixed" ? 12 : Number(weeks) || 0;
  const est = p ? estimate(p, weeksN, Number(lessons) || 0) : null;
  const offer = p ? activeOffer(p) : undefined;
  const years = useMemo(() => Array.from({ length: 70 }, (_, i) => String(new Date().getFullYear() - 10 - i)), []);

  const pickProgramme = (name: string) => {
    setProgrammeName(name);
    setCls("");
    setStartWeek("");
    setWeeks(ONLINE_ENGLISH.find((x) => x.name === name)?.booking === "weeks" ? "12" : "");
    setLessons("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!dob.d || !dob.m || !dob.y) return setError("Please enter your date of birth.");
    if (phone.replace(/\D/g, "").length < 6) return setError("Please enter your mobile / WhatsApp number.");
    if (!nationality) return setError("Please choose your nationality.");
    if (!p) return setError("Please choose a programme.");
    if (p.classes?.length && !cls) return setError("Please choose a class.");
    if (p.booking === "weeks" && (weeksN < 2 || weeksN > 50)) return setError("Please choose between 2 and 50 weeks.");
    if (p.booking === "lessons" && !Number(lessons)) return setError("Please choose the number of lessons.");
    if (!startWeek) return setError("Please choose your start week.");
    if (!terms || !privacy) return setError("Please accept the Terms and the Privacy Policy.");
    const enrolment: OnlineEnrolment = {
      full_name: c.full_name,
      email: c.email,
      date_of_birth: `${dob.y}-${dob.m}-${dob.d}`,
      phone: phone.trim(),
      nationality,
      programme: p.name,
      ...(cls ? { class: cls } : {}),
      ...(p.booking !== "lessons" ? { weeks: weeksN } : {}),
      ...(est?.extra ? { extra_weeks: est.extra } : {}),
      ...(p.booking === "lessons" ? { lessons: Number(lessons) } : {}),
      start_week: startWeek,
      ...(est?.total != null ? { estimate: gbp(est.total) } : {}),
    };
    setBusy(true);
    const { data, error: fnError } = await supabase.functions.invoke("book-call", { body: { consultationId: c.id, enrol: enrolment } });
    setBusy(false);
    if (fnError || data?.error) return setError(data?.error ?? "Could not send your enrolment. Please try again or message us on WhatsApp.");
    setEditing(false);
    onSaved();
  };

  if (sent && !editing) {
    return (
      <section className="space-y-4 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <h2 className="text-lg font-black text-emerald-900">Enrolment request sent</h2>
            <p className="text-sm text-emerald-900/80">
              {sent.submitted_at && `Sent ${new Date(sent.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. `}
              Your adviser will confirm your place and send you the invoice.
            </p>
          </div>
        </div>
        <dl className="grid gap-2 sm:grid-cols-2">
          {[
            ["Programme", sent.programme],
            ["Class", sent.class],
            ["Weeks", sent.weeks ? `${sent.weeks}${sent.extra_weeks ? ` + ${sent.extra_weeks} extra` : ""}` : undefined],
            ["Lessons", sent.lessons ? String(sent.lessons) : undefined],
            ["Start week", sent.start_week ? weekLabel(new Date(`${sent.start_week}T12:00:00`)) : undefined],
            ["Estimated total", sent.estimate ?? "Confirmed by your adviser"],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white px-3 py-2">
                <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">{k}</dt>
                <dd className="font-bold text-navy">{v}</dd>
              </div>
            ))}
        </dl>
        <button type="button" onClick={() => setEditing(true)} className="text-sm font-bold text-brand hover:underline">
          Change my request
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border-2 border-violet-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-brand">Join a programme</p>
        <h2 className="mt-1 text-xl font-black text-navy">Enrol in Study English Online</h2>
        <p className="mt-1 text-sm text-slate-500">Choose your programme and start week. Your adviser confirms your place and sends the invoice.</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-[11px] font-black uppercase tracking-wider text-slate-400">Personal details</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Full name</span>
            <input className="field bg-slate-50" value={c.full_name} readOnly />
          </label>
          <label className="block">
            <span className="label">Email address</span>
            <input className="field bg-slate-50" value={c.email} readOnly />
          </label>
        </div>
        <div>
          <span className="label">Date of birth *</span>
          <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2">
            <select aria-label="Day" className="field" value={dob.d} onChange={(e) => setDob({ ...dob, d: e.target.value })}>
              <option value="">DD</option>
              {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select aria-label="Month" className="field" value={dob.m} onChange={(e) => setDob({ ...dob, m: e.target.value })}>
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1).padStart(2, "0")}>
                  {m}
                </option>
              ))}
            </select>
            <select aria-label="Year" className="field" value={dob.y} onChange={(e) => setDob({ ...dob, y: e.target.value })}>
              <option value="">YYYY</option>
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Mobile / WhatsApp number *</span>
            <input className="field" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Nationality *</span>
            <select className="field" value={nationality} onChange={(e) => setNationality(e.target.value)}>
              <option value="">Select…</option>
              {COUNTRIES.map((x) => (
                <option key={x.code} value={x.name}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-[11px] font-black uppercase tracking-wider text-slate-400">Course details</legend>
        <label className="block">
          <span className="label">Programme interested in *</span>
          <select className="field" value={programmeName} onChange={(e) => pickProgramme(e.target.value)}>
            <option value="">Select a programme…</option>
            {ONLINE_ENGLISH.map((x) => (
              <option key={x.name} value={x.name}>
                {[x.name, x.duration, x.level, x.schedule].filter(Boolean).join(" — ")}
              </option>
            ))}
          </select>
        </label>

        {p?.classes && (
          <label className="block">
            <span className="label">Class *</span>
            <select
              className="field"
              value={cls}
              onChange={(e) => {
                setCls(e.target.value);
                setStartWeek("");
              }}
            >
              <option value="">Select a class…</option>
              {p.classes.map((x) => (
                <option key={x.label}>{x.label}</option>
              ))}
            </select>
            {p.schedule && <span className="mt-1 block text-xs text-slate-500">{p.schedule}, London time.</span>}
          </label>
        )}

        {p?.booking === "weeks" && (
          <div>
            <label className="block">
              <span className="label">Number of weeks *</span>
              <input className="field" type="number" min={2} max={50} inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ONLINE_ENGLISH_WEEKS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeeks(String(w))}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold ring-1 ${weeksN === w ? "bg-brand text-white ring-brand" : "bg-white text-navy ring-slate-200 hover:bg-slate-50"}`}
                >
                  {w}w
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">The rate per week depends on how many weeks are booked in one go.</p>
            {offer && (
              <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
                <strong>{offer.title}</strong>
                <br />
                {offer.text}
              </p>
            )}
          </div>
        )}

        {p?.booking === "fixed" && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">This programme runs for 12 weeks.</p>}

        {p?.booking === "lessons" && (
          <label className="block">
            <span className="label">Number of lessons *</span>
            <select className="field" value={lessons} onChange={(e) => setLessons(e.target.value)}>
              <option value="">Select lessons…</option>
              {ONE_TO_ONE_LESSONS.map((n) => (
                <option key={n} value={n}>
                  {n} lesson{n > 1 ? "s" : ""} — {gbp(n * (lessonPrice(p, n) ?? 0))}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">£65/lesson · 1–4 lessons | £60/lesson · 5–9 lessons | £55/lesson · 10+ lessons</span>
          </label>
        )}

        {p && est && (
          <div className="rounded-2xl bg-mist p-4">
            <p className="flex items-center gap-1.5 text-sm font-black text-navy">
              <FileText className="h-4 w-4 text-brand" /> Estimated invoice
            </p>
            <p className="mt-0.5 text-xs font-bold text-slate-500">
              {p.name}
              {p.booking !== "lessons" && weeksN ? ` · ${weeksN} weeks${est.extra ? ` + ${est.extra} extra weeks` : ""}` : ""}
              {p.booking === "lessons" && Number(lessons) ? ` · ${lessons} lessons` : ""}
            </p>
            {est.total != null ? (
              <div className="mt-3 space-y-1.5 text-sm">
                {est.lines.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-bold">{value}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base font-black">
                  <span>Total</span>
                  <span>{gbp(est.total)}</span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Your adviser will confirm the price for this choice{p.registrationFee ? ` (plus a ${gbp(p.registrationFee)} registration fee)` : ""}.</p>
            )}
            <p className="mt-2 text-[11px] text-slate-500">Estimate only — the final amount is on the invoice from your adviser.</p>
          </div>
        )}

        {p && (
          <label className="block">
            <span className="label">Start week *</span>
            <select className="field" value={startWeek} onChange={(e) => setStartWeek(e.target.value)} disabled={!!p.classes && !cls}>
              <option value="">{p.classes && !cls ? "Choose a class first…" : "Select a start week…"}</option>
              {weeksOptions.map((d) => {
                const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                return (
                  <option key={value} value={value}>
                    {weekLabel(d)}
                  </option>
                );
              })}
            </select>
          </label>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-[11px] font-black uppercase tracking-wider text-slate-400">Consent</legend>
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" className="mt-1 accent-brand" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          I agree to the Terms and Conditions of Kensington English.
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" className="mt-1 accent-brand" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
          I agree to the Privacy Policy and GDPR statement. I consent to my data being processed for enrolment purposes.
        </label>
      </fieldset>

      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} disabled={busy}>
          <Send className="h-4 w-4" /> Send my enrolment request
        </Button>
        {sent && (
          <button type="button" onClick={() => setEditing(false)} className="text-sm font-bold text-slate-500 hover:text-navy">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
