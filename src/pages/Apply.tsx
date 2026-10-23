import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, GraduationCap, Send } from "lucide-react";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { getTracking } from "../lib/tracking";
import { CountryPicker } from "../components/CountryPicker";
import { countriesFor, countryByCode, detectCountry, fetchGeoCountry } from "../lib/countries";
import { PROGRAMMES, parseCourseParam, parsePathParam } from "../lib/options";
import { Alert, Button, Card } from "../components/ui";
import { EmailCode } from "../components/EmailCode";
import { useI18n } from "../lib/i18n";

type Path = "english" | "higher_education";
type Stage = "choose" | "form" | "done";

interface Draft {
  stage: Stage;
  path: Path;
  name: string;
  email: string;
  country: string;
  dialCountry: string;
  phone: string;
  course: string;
  start: string;
  notes: string;
  countryTouched: boolean;
}

const DRAFT_KEY = "apply_draft_v1";
const INELIGIBLE_COUNTRIES = new Set(["PK"]);

function loadDraft(): Partial<Draft> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
  } catch {
    return {};
  }
}

// Initial state: saved draft, then pre-filled link (?path=b2&course=IT) on top.
function initialDraft(): Draft {
  const saved = loadDraft();
  const country = saved.country ?? detectCountry();
  const d: Draft = {
    stage: saved.stage === "form" ? "form" : "choose",
    path: saved.path ?? "english",
    name: saved.name ?? "",
    email: saved.email ?? "",
    country,
    dialCountry: saved.dialCountry ?? country,
    phone: saved.phone ?? "",
    course: saved.course ?? "",
    start: saved.start ?? "",
    notes: saved.notes ?? "",
    countryTouched: saved.countryTouched ?? false,
  };
  const params = new URLSearchParams(window.location.search);
  const course = parseCourseParam(params.get("course"));
  const path = parsePathParam(params.get("path")) ?? (course ? "higher_education" : undefined);
  const linkedEmail = params.get("email")?.trim().toLowerCase();
  if (linkedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkedEmail)) d.email = linkedEmail;
  if (path) {
    d.path = path;
    d.stage = "form";
    d.course = path === "english" ? "English Course" : course ?? (PROGRAMMES.includes(d.course) ? d.course : "");
  }
  return d;
}

export function Apply() {
  const { session } = useAuth();
  const { lang, t, tv } = useI18n();
  const countries = useMemo(() => countriesFor(lang), [lang]);
  const localName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;
  const navigate = useNavigate();
  const [d, setD] = useState<Draft>(initialDraft);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const geoDone = useRef(false);
  const countryIneligible = INELIGIBLE_COUNTRIES.has(d.country);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  // Autosave everything except the finished state.
  useEffect(() => {
    if (d.stage === "done") return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      // storage unavailable — autosave is best-effort
    }
  }, [d]);

  // Replace the time-zone guess with Vercel's IP country, unless the user already chose one.
  useEffect(() => {
    if (geoDone.current || d.countryTouched) return;
    geoDone.current = true;
    fetchGeoCountry().then((code) => {
      if (!code) return;
      setD((x) => (x.countryTouched ? x : { ...x, country: code, dialCountry: x.phone ? x.dialCountry : code }));
    });
  }, [d.countryTouched]);

  const sessionEmail = session?.user.email ?? "";
  useEffect(() => {
    if (sessionEmail) setD((x) => (x.email ? x : { ...x, email: sessionEmail }));
  }, [sessionEmail]);

  const phoneCheck = useMemo(() => {
    const raw = d.phone.trim();
    if (!raw) return null;
    const parsed = parsePhoneNumberFromString(raw, d.dialCountry as CountryCode);
    return parsed?.isValid() ? parsed : false;
  }, [d.phone, d.dialCountry]);

  const go = (stage: Stage) => {
    setError("");
    set("stage", stage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const choose = (path: Path) => {
    setD((x) => ({
      ...x,
      path,
      course: path === "english" ? "English Course" : PROGRAMMES.includes(x.course) ? x.course : "",
    }));
    go("form");
  };

  const changeCountry = (code: string) =>
    setD((x) => ({
      ...x,
      country: code,
      countryTouched: true,
      // Keep the dial code in step with the country unless the user picked a different one.
      dialCountry: x.dialCountry === x.country ? code : x.dialCountry,
    }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPhoneTouched(true);
    if (countryIneligible) return setError(t("apply.errCountryIneligible"));
    if (!d.course) return setError(t("apply.errProgramme"));
    if (!phoneCheck) return setError(t("apply.errPhone", { country: localName(d.dialCountry) }));
    if (!consent) return setError(t("apply.errConsent"));
    setError("");
    setSubmitting(true);
    const { data: id, error } = await supabase.rpc("book_consultation", {
      p_full_name: d.name,
      p_email: d.email,
      p_whatsapp: phoneCheck.formatInternational(),
      p_country: countryByCode(d.country)?.name ?? d.country,
      p_age: null,
      p_study_path: d.path,
      p_english_level: d.path === "english" ? "below_b2" : "b2_plus",
      p_desired_course: d.course,
      p_start_date: d.start || null,
      p_budget: null,
      p_visa_support: null,
      p_preferred_contact_time: null,
      p_message: d.notes,
      p_slot_id: null,
      p_tracking: { ...getTracking(), lang },
    });
    setSubmitting(false);
    if (error) {
      if (error.message.includes("INELIGIBLE_COUNTRY")) return setError(t("apply.errCountryIneligible"));
      return setError(error.message.includes("INVALID_INPUT") ? t("apply.errNameEmail") : error.message);
    }

    // Confirmation + admin alert are best-effort; the application is already saved.
    supabase.functions.invoke("send-confirmation", { body: { consultation_id: id } }).catch(() => {});
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    if (session) navigate("/dashboard", { state: { justApplied: true } });
    else go("done");
  };

  if (d.stage === "done") {
    return <Done name={d.name.split(" ")[0]} email={d.email.trim()} course={d.course} onSignedIn={() => navigate("/dashboard", { state: { justApplied: true } })} />;
  }

  const stepIndex = d.stage === "choose" ? 0 : 1;

  return (
    <div className="mx-auto max-w-3xl pt-2 sm:pt-4">
      <Card>
        <div className="px-5 pb-8 pt-6 sm:px-9 sm:pb-9 sm:pt-8">
          <div className="mb-7 text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand">{t("apply.step", { n: stepIndex + 1, total: 2 })}</p>
            <h1 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
              {d.stage === "choose" ? t("apply.chooseTitle") : t("apply.formTitle")}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
              {d.stage === "choose" ? t("apply.chooseSub") : t("apply.formSub")}
            </p>
            <ol className="mx-auto mt-5 grid max-w-xs grid-cols-2 gap-2">
              {[t("apply.stepLevel"), t("apply.stepDetails")].map((label, i) => (
                <li key={label} className="space-y-1">
                  <span className={`block h-1.5 rounded-full transition-colors ${i <= stepIndex ? "bg-brand" : "bg-slate-200"}`} />
                  <span
                    className={`block text-center text-[10px] font-medium ${i <= stepIndex ? "text-navy" : "text-slate-400"}`}
                    aria-current={i === stepIndex ? "step" : undefined}
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div key={d.stage} className="step-in min-h-[300px]">
            {d.stage === "choose" && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-mist p-5 text-center sm:p-6">
                  <span className="inline-grid h-12 w-12 place-items-center rounded-full bg-brand text-lg font-black text-white">B2</span>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
                    {t("apply.b2Before")} <strong className="text-navy">{t("apply.b2Strong")}</strong>
                    {t("apply.b2After")}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PathButton
                    icon={<BookOpen className="h-6 w-6" />}
                    title={t("apply.belowTitle")}
                    text={t("apply.belowText")}
                    cta={t("apply.continue")}
                    accent="red"
                    onClick={() => choose("english")}
                  />
                  <PathButton
                    icon={<GraduationCap className="h-6 w-6" />}
                    title={t("apply.aboveTitle")}
                    text={t("apply.aboveText")}
                    cta={t("apply.continue")}
                    accent="violet"
                    onClick={() => choose("higher_education")}
                  />
                </div>
              </div>
            )}

            {d.stage === "form" && (
              <form onSubmit={submit} className="space-y-4">
                {d.path === "higher_education" && (
                  <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm font-medium leading-relaxed sm:text-base">
                    {t("apply.haveLevel")}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("apply.fullName")} id="name">
                    <input id="name" required autoComplete="name" className="field" value={d.name} onChange={(e) => set("name", e.target.value)} />
                  </Field>
                  <Field label={t("apply.email")} id="email">
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      readOnly={!!session}
                      className="field"
                      value={d.email}
                      onChange={(e) => set("email", e.target.value)}
                    />
                  </Field>
                  <Field label={t("apply.country")} id="country" hint={t("apply.countryHint")}>
                    <CountryPicker id="country" value={d.country} onChange={changeCountry} countries={countries} searchPlaceholder={t("apply.searchCountry")} />
                  </Field>
                  <Field label={t("apply.whatsapp")} id="phone">
                    <div className="flex gap-2">
                      <CountryPicker
                        variant="dial"
                        className="w-32 shrink-0"
                        ariaLabel={t("apply.countryCode")}
                        value={d.dialCountry}
                        onChange={(code) => set("dialCountry", code)}
                        countries={countries}
                        searchPlaceholder={t("apply.searchCountry")}
                      />
                      <input
                        id="phone"
                        type="tel"
                        required
                        inputMode="tel"
                        autoComplete="tel-national"
                        placeholder={t("apply.yourNumber")}
                        dir="ltr"
                        aria-invalid={phoneTouched && phoneCheck === false}
                        aria-describedby="phone-hint"
                        className={`field ${phoneCheck ? "border-emerald-400" : phoneTouched && phoneCheck === false ? "border-brand-red" : ""}`}
                        value={d.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        onBlur={() => setPhoneTouched(true)}
                      />
                    </div>
                    <p id="phone-hint" className="mt-1.5 text-xs">
                      {phoneCheck ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {phoneCheck.formatInternational()}
                        </span>
                      ) : phoneTouched && phoneCheck === false ? (
                        <span className="font-semibold text-brand-red">
                          {t("apply.phoneInvalid", { country: localName(d.dialCountry) })}
                        </span>
                      ) : (
                        <span className="text-slate-500">{t("apply.phoneHint")}</span>
                      )}
                    </p>
                  </Field>
                </div>
                {countryIneligible && <Alert>{t("apply.errCountryIneligible")}</Alert>}
                <Field label={t("apply.course")} id="course">
                  {d.path === "english" ? (
                    <input id="course" readOnly className="field bg-mist font-bold text-brand" value={tv(d.course)} />
                  ) : (
                    <select id="course" required className="field" value={d.course} onChange={(e) => set("course", e.target.value)}>
                      <option value="">{t("apply.selectProgramme")}</option>
                      {PROGRAMMES.map((p) => (
                        <option key={p} value={p}>
                          {tv(p)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label={t("apply.notes")} id="notes">
                  <textarea
                    id="notes"
                    rows={3}
                    className="field"
                    placeholder={t("apply.notesPlaceholder")}
                    value={d.notes}
                    onChange={(e) => set("notes", e.target.value)}
                  />
                </Field>
                <div className="rounded-xl bg-brand/5 p-3 text-xs leading-relaxed text-navy">
                  <strong>{t("apply.nextTitle")}</strong> {t("apply.nextText")}
                </div>
                <label className="flex items-start gap-3 text-sm text-slate-600">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  {t("apply.consent")}
                </label>
                {error && <Alert>{error}</Alert>}
                <Button type="submit" loading={submitting} disabled={countryIneligible} className="min-h-12 w-full">
                  <Send className="h-4 w-4 rtl:-scale-x-100" /> {t("apply.submit")}
                </Button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button type="button" variant="ghost" onClick={() => go("choose")}>
                    <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("apply.changePath")}
                  </Button>
                  {!session && (
                    <Link to="/login?next=/dashboard" className="self-center text-sm font-bold text-brand hover:underline">
                      {t("apply.alreadyApplied")}
                    </Link>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function PathButton({
  icon,
  title,
  text,
  cta,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  cta: string;
  accent: "red" | "violet";
  onClick: () => void;
}) {
  const color = accent === "red" ? "text-brand-red bg-brand-red/10" : "text-brand bg-brand/10";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col items-start gap-3 rounded-2xl border-2 border-slate-100 bg-white p-5 text-start shadow-sm transition outline-none hover:-translate-y-0.5 hover:border-brand hover:shadow-lg focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${color}`}>{icon}</span>
      <span className="text-lg font-black text-navy">{title}</span>
      <span className="text-sm leading-relaxed text-slate-500">{text}</span>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-extrabold text-brand">
        {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
      </span>
    </button>
  );
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Done({ name, email, course, onSignedIn }: { name: string; email: string; course: string; onSignedIn: () => void }) {
  const { t, tv } = useI18n();
  return (
    <div className="mx-auto max-w-2xl pt-2 sm:pt-4">
      <Card>
        <div className="step-in space-y-6 px-6 py-9 sm:px-10">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h1 className="mt-4 text-2xl font-black sm:text-3xl">{name ? t("done.thanksName", { name }) : t("done.thanks")}</h1>
            <p className="mx-auto mt-2 max-w-md text-slate-600">
              {t("done.saved", { course: tv(course) })}
            </p>
          </div>
          <div className="rounded-2xl bg-mist p-5">
            <h2 className="mb-3 font-black">{t("done.openDashboard")}</h2>
            <EmailCode email={email} autoSend data={{ full_name: name, course }} onSignedIn={onSignedIn} />
          </div>
        </div>
      </Card>
    </div>
  );
}
