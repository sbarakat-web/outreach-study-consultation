import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, MailCheck, Send } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { getTracking } from "../lib/tracking";
import { COUNTRIES, countryByCode, detectCountry } from "../lib/countries";
import { PROGRAMMES } from "../lib/options";
import { Alert, Button, Card } from "../components/ui";

type Path = "english" | "higher_education";
type Stage = "choose" | "form" | "password" | "check_email";

const STEPS = ["English level", "Your details", "Password"];

export function Apply() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("choose");
  const [path, setPath] = useState<Path>("english");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState(detectCountry);
  const [dialCountry, setDialCountry] = useState(country);
  const [phone, setPhone] = useState("");
  const [course, setCourse] = useState("");
  const [notes, setNotes] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);

  const sessionEmail = session?.user.email ?? "";
  useEffect(() => {
    if (sessionEmail) setEmail((e) => e || sessionEmail);
  }, [sessionEmail]);

  const go = (s: Stage) => {
    setError("");
    setStage(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const choose = (p: Path) => {
    setPath(p);
    setCourse(p === "english" ? "English Course" : "");
    go("form");
  };

  const changeCountry = (code: string) => {
    // Keep the dial code in step with the country unless the user picked a different one.
    if (dialCountry === country) setDialCountry(code);
    setCountry(code);
  };

  const submitDetails = (e: FormEvent) => {
    e.preventDefault();
    if (!course) return setError("Please choose a programme.");
    if (phone.replace(/\D/g, "").length < 6) return setError("Please enter a valid WhatsApp number.");
    if (session) return createApplication();
    go("password");
  };

  const createApplication = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!consent) return setError("Please accept so we can contact you about your application.");
    setError("");
    setSubmitting(true);
    try {
      let signedIn = !!session;
      if (!session) {
        if (password.length < 8) throw new Error("Your password needs at least 8 characters.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: name } },
        });
        if (error) throw error;
        if (data.user && data.user.identities?.length === 0) {
          throw new Error("An account with this email already exists. Please open your dashboard and sign in.");
        }
        signedIn = !!data.session;
      }

      const dial = countryByCode(dialCountry)?.dial ?? "";
      const { data: id, error } = await supabase.rpc("book_consultation", {
        p_full_name: name,
        p_email: email,
        p_whatsapp: `+${dial} ${phone.trim()}`,
        p_country: countryByCode(country)?.name ?? country,
        p_age: null,
        p_study_path: path,
        p_english_level: path === "english" ? "below_b2" : "b2_plus",
        p_desired_course: course,
        p_start_date: null,
        p_budget: null,
        p_visa_support: null,
        p_preferred_contact_time: null,
        p_message: notes,
        p_slot_id: null,
        p_tracking: getTracking(),
      });
      if (error) throw error;

      // Confirmation email is best-effort; the application is already saved.
      supabase.functions.invoke("send-confirmation", { body: { consultation_id: id } }).catch(() => {});

      if (signedIn) navigate("/dashboard", { state: { justApplied: true } });
      else go("check_email");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === "check_email") return <CheckEmail email={email} />;

  const stepIndex = stage === "choose" ? 0 : stage === "form" ? 1 : 2;
  const steps = session ? STEPS.slice(0, 2) : STEPS;

  return (
    <div className="mx-auto max-w-3xl pt-2 sm:pt-4">
      <Card>
        <div className="px-5 pb-8 pt-6 sm:px-9 sm:pb-9 sm:pt-8">
          <div className="mb-7 text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-blue">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <h1 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
              {stage === "choose" ? "Choose your English path" : stage === "form" ? "Tell us about you" : "Create your password"}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
              {stage === "choose"
                ? "Select one option and we’ll open the correct application form immediately."
                : stage === "form"
                  ? "It only takes a minute. Our team will guide you from here."
                  : "You’ll use it to open your personal dashboard anytime."}
            </p>
            <ol className={`mx-auto mt-5 grid max-w-sm gap-2 ${steps.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {steps.map((label, i) => (
                <li key={label} className="space-y-1">
                  <span className={`block h-1.5 rounded-full transition-colors ${i <= stepIndex ? "bg-navy" : "bg-slate-200"}`} />
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

          <div key={stage} className="step-in min-h-[300px]">
            {stage === "choose" && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-mist p-5 text-center sm:p-6">
                  <span className="inline-grid h-12 w-12 place-items-center rounded-full bg-brand-violet text-lg font-black text-white">B2</span>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
                    Diploma, Bachelor’s and Master’s programmes require <strong className="text-navy">B2 English</strong>. If you are
                    not at B2 yet, we’ll help you begin with an English course.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PathButton
                    icon={<BookOpen className="h-6 w-6" />}
                    title="My level is below B2"
                    text="Start with an English course. We’ll guide you every step of the way."
                    accent="red"
                    onClick={() => choose("english")}
                  />
                  <PathButton
                    icon={<GraduationCap className="h-6 w-6" />}
                    title="I have B2 or above"
                    text="Continue directly to the programmes we offer and choose your course."
                    accent="violet"
                    onClick={() => choose("higher_education")}
                  />
                </div>
              </div>
            )}

            {stage === "form" && (
              <form onSubmit={submitDetails} className="space-y-4">
                {path === "higher_education" && (
                  <div className="rounded-xl border border-brand-violet/20 bg-brand-violet/5 p-4 text-sm font-medium leading-relaxed sm:text-base">
                    You already have the required English level — these are the programmes we offer.
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name *" id="name">
                    <input id="name" required autoComplete="name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label="Email *" id="email">
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      readOnly={!!session}
                      className="field"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                  <Field label="Country *" id="country" hint="Detected automatically. Type a country name to change it.">
                    <select id="country" required className="field" value={country} onChange={(e) => changeCountry(e.target.value)}>
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="WhatsApp number *" id="phone" hint="Choose the code if your number is from another country.">
                    <div className="flex gap-2">
                      <select
                        aria-label="Country code"
                        className="field w-28 shrink-0 px-2"
                        value={dialCountry}
                        onChange={(e) => setDialCountry(e.target.value)}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} +{c.dial}
                          </option>
                        ))}
                      </select>
                      <input
                        id="phone"
                        type="tel"
                        required
                        inputMode="tel"
                        autoComplete="tel-national"
                        placeholder="1234 5678"
                        className="field"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </Field>
                </div>
                <Field label="Course *" id="course">
                  {path === "english" ? (
                    <input id="course" readOnly className="field bg-mist font-bold text-brand-blue" value={course} />
                  ) : (
                    <select id="course" required className="field" value={course} onChange={(e) => setCourse(e.target.value)}>
                      <option value="">Select a programme</option>
                      {PROGRAMMES.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Notes" id="notes">
                  <textarea
                    id="notes"
                    rows={3}
                    className="field"
                    placeholder="Tell us anything that will help our team guide you."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Field>
                <div className="rounded-xl bg-brand-blue/5 p-3 text-xs leading-relaxed text-navy">
                  <strong>What happens next?</strong> We’ll create your application, let you choose a password, and then open your
                  personal dashboard. You can return anytime using your email and password.
                </div>
                {session && <Consent consent={consent} setConsent={setConsent} />}
                {error && <Alert>{error}</Alert>}
                <Button type="submit" loading={submitting} className="min-h-12 w-full">
                  <Send className="h-4 w-4" /> Submit my interest
                </Button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button type="button" variant="ghost" onClick={() => go("choose")}>
                    <ArrowLeft className="h-4 w-4" /> Change English path
                  </Button>
                  {!session && (
                    <Link to="/login?next=/dashboard" className="self-center text-sm font-bold text-brand-blue hover:underline">
                      Already have an account? Open Dashboard
                    </Link>
                  )}
                </div>
              </form>
            )}

            {stage === "password" && (
              <form onSubmit={createApplication} className="space-y-4">
                <div className="rounded-2xl bg-mist px-5 py-4 text-sm">
                  <p className="text-slate-500">Your account email</p>
                  <p className="font-extrabold">{email}</p>
                </div>
                <Field label="Password *" id="password" hint="At least 8 characters.">
                  <input
                    id="password"
                    type="password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    className="field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Consent consent={consent} setConsent={setConsent} />
                {error && <Alert>{error}</Alert>}
                <Button type="submit" loading={submitting} className="min-h-12 w-full">
                  Create my application <ArrowRight className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" onClick={() => go("form")}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
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
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  accent: "red" | "violet";
  onClick: () => void;
}) {
  const color = accent === "red" ? "text-brand-red bg-brand-red/10" : "text-brand-violet bg-brand-violet/10";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col items-start gap-3 rounded-2xl border-2 border-slate-100 bg-white p-5 text-left shadow-sm transition outline-none hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-lg focus-visible:ring-2 focus-visible:ring-brand-blue"
    >
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${color}`}>{icon}</span>
      <span className="text-lg font-black text-navy">{title}</span>
      <span className="text-sm leading-relaxed text-slate-500">{text}</span>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-extrabold text-brand-blue">
        Continue <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
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

function Consent({ consent, setConsent }: { consent: boolean; setConsent: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 text-sm text-slate-600">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-navy" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
      I agree that Outreach can contact me by email and WhatsApp about my application.
    </label>
  );
}

function CheckEmail({ email }: { email: string }) {
  return (
    <div className="mx-auto max-w-2xl pt-2 sm:pt-4">
      <Card>
        <div className="step-in px-6 py-10 text-center sm:px-10">
          <MailCheck className="mx-auto h-14 w-14 text-brand-blue" />
          <h1 className="mt-4 text-2xl font-black sm:text-3xl">Your application is created!</h1>
          <p className="mx-auto mt-3 max-w-md text-slate-600">
            We sent an email to <strong className="text-navy">{email}</strong>. Click the link in it to activate your account and open
            your personal dashboard, where you can book your free call and upload documents.
          </p>
          <p className="mx-auto mt-4 max-w-md text-xs text-slate-500">Can’t find it? Check your spam or promotions folder.</p>
        </div>
      </Card>
    </div>
  );
}
