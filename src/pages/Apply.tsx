import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarCheck, CheckCircle2, MessageCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { getTracking } from "../lib/tracking";
import {
  BUDGETS,
  CONTACT_TIMES,
  ENGLISH_LEVELS,
  START_DATES,
  STUDY_PATHS,
  VISA_OPTIONS,
  formatSlot,
  waLink,
  whatsappNumber,
} from "../lib/options";
import type { Slot } from "../lib/types";
import { Alert, Button, Card, ChoiceCard, Spinner } from "../components/ui";

const STEPS = [
  { label: "Welcome", title: "Choose your path", subtitle: "Tell us what you'd like to study in Malta." },
  { label: "English", title: "Your English level", subtitle: "So we can match you with the right course." },
  { label: "Details", title: "About you", subtitle: "Your advisor will use these details to prepare for your call." },
  { label: "Time", title: "Pick a consultation time", subtitle: "Free 30-minute call with a study advisor." },
  { label: "Confirm", title: "Confirm your request", subtitle: "Create your account to follow your request." },
];

const empty = {
  study_path: "",
  english_level: "",
  full_name: "",
  email: "",
  whatsapp: "",
  country: "",
  age: "",
  desired_course: "",
  start_date: "",
  budget: "",
  visa_support: "",
  preferred_contact_time: "",
  message: "",
};

type Form = typeof empty;

export function Apply() {
  const { session } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(empty);
  const [slotId, setSlotId] = useState<string | null | undefined>(undefined); // undefined = not chosen, null = "none work"
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ slot: Slot | null; needsEmailConfirm: boolean } | null>(null);

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const sessionEmail = session?.user.email ?? "";
  useEffect(() => {
    if (sessionEmail) setForm((f) => (f.email ? f : { ...f, email: sessionEmail }));
  }, [sessionEmail]);

  const loadSlots = async () => {
    setSlots(null);
    const { data } = await supabase
      .from("slots")
      .select("id, starts_at, duration_minutes, consultation_id")
      .is("consultation_id", null)
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(200);
    setSlots(data ?? []);
  };

  useEffect(() => {
    if (step === 3 && slots === null) loadSlots();
  }, [step, slots]);

  const go = (n: number) => {
    setError("");
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = (e?: FormEvent) => {
    e?.preventDefault();
    if (step === 0 && !form.study_path) return setError("Please choose a path.");
    if (step === 1 && !form.english_level) return setError("Please choose your English level.");
    if (step === 3 && slotId === undefined) return setError("Please pick a time, or tell us none of them work.");
    go(step + 1);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!consent) return setError("Please accept so we can contact you about your request.");
    setError("");
    setSubmitting(true);
    try {
      let needsEmailConfirm = false;
      if (!session) {
        if (password.length < 8) throw new Error("Your password needs at least 8 characters.");
        const { data, error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: form.full_name } },
        });
        if (error) throw error;
        if (data.user && data.user.identities?.length === 0) {
          throw new Error("An account with this email already exists. Please sign in first, then come back to this page.");
        }
        needsEmailConfirm = !data.session;
      }

      const { data: id, error } = await supabase.rpc("book_consultation", {
        p_full_name: form.full_name,
        p_email: form.email,
        p_whatsapp: form.whatsapp,
        p_country: form.country,
        p_age: form.age ? Number(form.age) : null,
        p_study_path: form.study_path,
        p_english_level: form.english_level,
        p_desired_course: form.desired_course,
        p_start_date: form.start_date || null,
        p_budget: form.budget || null,
        p_visa_support: form.visa_support || null,
        p_preferred_contact_time: form.preferred_contact_time || null,
        p_message: form.message,
        p_slot_id: slotId ?? null,
        p_tracking: getTracking(),
      });
      if (error) {
        if (error.message.includes("SLOT_TAKEN")) {
          setSlotId(undefined);
          setSlots(null);
          setStep(3);
          throw new Error("Sorry, that time was just taken. Please pick another one.");
        }
        throw error;
      }

      // Confirmation email/WhatsApp is best-effort; the booking is already saved.
      supabase.functions.invoke("send-confirmation", { body: { consultation_id: id } }).catch(() => {});

      setDone({ slot: slots?.find((s) => s.id === slotId) ?? null, needsEmailConfirm });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return <Success {...done} name={form.full_name.split(" ")[0]} loggedIn={!!session} />;

  const s = STEPS[step];

  return (
    <div className="mx-auto max-w-3xl pt-2 sm:pt-6">
      <Card>
        <div className="px-5 pb-8 pt-6 sm:px-9 sm:pb-9 sm:pt-8">
          <div className="mb-7 text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-blue">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">{s.title}</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{s.subtitle}</p>
            <ol className="mx-auto mt-5 grid max-w-lg grid-cols-5 gap-2" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((x, i) => (
                <li key={x.label} className="space-y-1">
                  <span className={`block h-1.5 rounded-full transition-colors ${i <= step ? "bg-navy" : "bg-slate-200"}`} />
                  <span
                    className={`block text-center text-[10px] font-medium ${i <= step ? "text-navy" : "text-slate-400"}`}
                    aria-current={i === step ? "step" : undefined}
                  >
                    {x.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <form key={step} className="step-in min-h-[300px] space-y-4" onSubmit={step === 4 ? submit : next} noValidate={step !== 2}>
            {step === 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {STUDY_PATHS.map((p) => (
                  <ChoiceCard
                    key={p.value}
                    label={p.label}
                    hint={p.hint}
                    selected={form.study_path === p.value}
                    onClick={() => set("study_path")(p.value)}
                  />
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-3">
                {ENGLISH_LEVELS.map((p) => (
                  <ChoiceCard
                    key={p.value}
                    label={p.label}
                    hint={p.hint}
                    selected={form.english_level === p.value}
                    onClick={() => set("english_level")(p.value)}
                  />
                ))}
              </div>
            )}

            {step === 2 && <DetailsStep form={form} set={set} emailLocked={!!session} />}

            {step === 3 && <SlotStep slots={slots} slotId={slotId} setSlotId={setSlotId} />}

            {step === 4 && (
              <ConfirmStep
                form={form}
                slot={slots?.find((x) => x.id === slotId) ?? null}
                loggedIn={!!session}
                password={password}
                setPassword={setPassword}
                consent={consent}
                setConsent={setConsent}
              />
            )}

            {error && <Alert>{error}</Alert>}

            <div className="flex items-center justify-between gap-3 pt-4">
              {step > 0 ? (
                <Button type="button" variant="ghost" onClick={() => go(step - 1)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" loading={submitting} className="min-h-12 px-8">
                {step === 4 ? "Confirm request" : "Continue"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </Card>
      {!session && (
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-brand-blue hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}

function DetailsStep({ form, set, emailLocked }: { form: Form; set: (k: keyof Form) => (v: string) => void; emailLocked: boolean }) {
  const input = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={k}>
        {label}
      </label>
      <input id={k} className="field" value={form[k]} onChange={(e) => set(k)(e.target.value)} {...props} />
    </div>
  );
  const select = (k: keyof Form, label: string, options: string[]) => (
    <div>
      <label className="label" htmlFor={k}>
        {label}
      </label>
      <select id={k} className="field" value={form[k]} onChange={(e) => set(k)(e.target.value)}>
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {input("full_name", "Full name *", { required: true, autoComplete: "name" })}
      {input("email", "Email *", { required: true, type: "email", autoComplete: "email", readOnly: emailLocked })}
      {input("whatsapp", "WhatsApp number *", { required: true, type: "tel", autoComplete: "tel", placeholder: "+44 7700 900123" })}
      {input("country", "Country *", { required: true, autoComplete: "country-name" })}
      {input("age", "Age", { type: "number", min: 12, max: 99, inputMode: "numeric" })}
      {input("desired_course", "Course you're interested in", { placeholder: "e.g. General English, MBA" })}
      {select("start_date", "When do you want to start?", START_DATES)}
      {select("budget", "Budget range", BUDGETS)}
      {select("visa_support", "Do you need visa support?", VISA_OPTIONS)}
      {select("preferred_contact_time", "Best time to contact you", CONTACT_TIMES)}
      <div className="sm:col-span-2">
        <label className="label" htmlFor="message">
          Anything else we should know?
        </label>
        <textarea id="message" rows={3} className="field" value={form.message} onChange={(e) => set("message")(e.target.value)} />
      </div>
    </div>
  );
}

function SlotStep({
  slots,
  slotId,
  setSlotId,
}: {
  slots: Slot[] | null;
  slotId: string | null | undefined;
  setSlotId: (v: string | null) => void;
}) {
  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const key = new Date(s.starts_at).toDateString();
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.values()];
  }, [slots]);

  if (!slots) return <Spinner />;

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="space-y-5">
      {days.length === 0 ? (
        <Alert tone="info">No times are open right now. Continue and an advisor will contact you to arrange a call.</Alert>
      ) : (
        <>
          <p className="text-center text-xs text-slate-500">Times shown in your time zone ({tz})</p>
          {days.map((daySlots) => (
            <div key={daySlots[0].id}>
              <h3 className="mb-2 text-sm font-extrabold">
                {formatSlot(daySlots[0].starts_at, { hour: undefined, minute: undefined, weekday: "long" })}
              </h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {daySlots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={slotId === s.id}
                    onClick={() => setSlotId(s.id)}
                    className={`rounded-xl border-2 py-2.5 text-sm font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${
                      slotId === s.id ? "border-brand-blue bg-brand-blue text-white" : "border-slate-100 bg-mist hover:border-slate-200"
                    }`}
                  >
                    {new Date(s.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      <ChoiceCard
        selected={slotId === null}
        label={days.length ? "None of these times work for me" : "Contact me to arrange a time"}
        hint="An advisor will reach out on WhatsApp or by email."
        onClick={() => setSlotId(null)}
      />
    </div>
  );
}

function ConfirmStep({
  form,
  slot,
  loggedIn,
  password,
  setPassword,
  consent,
  setConsent,
}: {
  form: Form;
  slot: Slot | null;
  loggedIn: boolean;
  password: string;
  setPassword: (v: string) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
}) {
  const rows: [string, string][] = [
    ["Path", STUDY_PATHS.find((x) => x.value === form.study_path)?.label ?? "—"],
    ["English", ENGLISH_LEVELS.find((x) => x.value === form.english_level)?.label ?? "—"],
    ["Name", form.full_name],
    ["Email", form.email],
    ["WhatsApp", form.whatsapp],
    ["Consultation", slot ? formatSlot(slot.starts_at) : "Advisor will contact you"],
  ];
  return (
    <div className="space-y-5">
      <dl className="divide-y divide-slate-200/70 rounded-2xl bg-mist px-5 py-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5 text-sm">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-right font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      {!loggedIn && (
        <div>
          <label className="label" htmlFor="password">
            Create a password *
          </label>
          <input
            id="password"
            type="password"
            className="field"
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            At least 8 characters. You'll use it to follow your request and upload documents.
          </p>
        </div>
      )}
      <label className="flex items-start gap-3 text-sm text-slate-600">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-navy"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I agree that Outreach Recruitment can contact me by email and WhatsApp about my study request.
      </label>
    </div>
  );
}

function Success({
  slot,
  needsEmailConfirm,
  name,
  loggedIn,
}: {
  slot: Slot | null;
  needsEmailConfirm: boolean;
  name: string;
  loggedIn: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl pt-2 sm:pt-6">
      <Card>
        <div className="step-in px-6 py-10 text-center sm:px-10">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-black sm:text-3xl">Thank you{name ? `, ${name}` : ""}!</h1>
          {slot ? (
            <div className="mx-auto mt-5 inline-flex items-center gap-3 rounded-2xl bg-mist px-5 py-3 text-left">
              <CalendarCheck className="h-6 w-6 shrink-0 text-brand-blue" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Your consultation</p>
                <p className="font-extrabold">{formatSlot(slot.starts_at, { weekday: "long", month: "long" })}</p>
              </div>
            </div>
          ) : (
            <p className="mx-auto mt-3 max-w-md text-slate-600">An advisor will contact you shortly to arrange your consultation.</p>
          )}
          <p className="mx-auto mt-5 max-w-md text-sm text-slate-500">
            {needsEmailConfirm
              ? "We've sent you an email. Click the link in it to activate your account, then you can follow your request and upload documents."
              : "We've sent a confirmation to your email."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {loggedIn && (
              <Link to="/dashboard">
                <Button>View my requests</Button>
              </Link>
            )}
            {whatsappNumber && (
              <a href={waLink(whatsappNumber, "Hi! I just booked a consultation on your website.")} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
                </Button>
              </a>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
