import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Toaster, toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Info, Loader2, Play, ShieldCheck, Sparkles, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { CHAPTERS, IMAGES, PROGRAMMES, findBestMatch } from "./data";
import { MaltaScene } from "./art";
import {
  DiscoverChapter,
  IntroChapter,
  OtherInfoChapter,
  PartnersChapter,
  ProgrammesChapter,
  ThankYouChapter,
  VisaChapter,
} from "./Chapters";
import { PresenterQueue, bucketize, queueOrder, type Candidate } from "./PresenterQueue";
import { CompleteDialog, type Outcome } from "./CompleteDialog";
import { buildPresentationPdf, pdfBase64, presentationFilename } from "./pdf";

const HIDDEN_ACTION = "hidden_from_presenter_queue";
const LOCAL_HIDDEN = "presenter_hidden_ids";

const isBooked = (c: Candidate) =>
  c.call_status === "confirmed" && !c.call_declined_at && !["interviewed", "no_longer_interested"].includes(c.session_outcome ?? "");

const OUTCOME_LABEL: Record<Outcome, string> = {
  interviewed: "Interviewed",
  no_attendance: "No Attendance",
  no_longer_interested: "No Longer Interested",
};

function readLocalHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_HIDDEN) ?? "[]");
  } catch {
    return [];
  }
}

export function OnlineSessions() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { session, isAdmin, isPresenter, loading } = useAuth();

  const programmeParam = params.get("programme");
  const personalLink = params.get("stage") === "interviewed" && !!programmeParam;
  const candidateParam = params.get("candidate");
  const presentRequested = params.get("present") === "1" || !!candidateParam;
  const staff = isAdmin || isPresenter;
  // Admins land in presenter mode on the plain page too (not on a student's personal link).
  const presenterMode = !personalLink && staff && (presentRequested || isAdmin);

  // ------------------------------------------------------------ presentation state
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [chapter, setChapter] = useState(0);
  const [visited, setVisited] = useState<Set<number>>(new Set([0]));
  const [area, setArea] = useState("english");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bestMatchId, setBestMatchId] = useState<string | undefined>();

  // ------------------------------------------------------------ queue state
  const [queue, setQueue] = useState<Candidate[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set(readLocalHidden()));
  const [now, setNow] = useState(() => new Date());
  const [done, setDone] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const loadQueue = useCallback(async () => {
    const [list, log] = await Promise.all([
      supabase.from("consultations").select("*").eq("call_status", "confirmed").is("call_declined_at", null).order("preferred_call_at"),
      supabase.from("activity_log").select("consultation_id").eq("action", HIDDEN_ACTION),
    ]);
    if (list.error) toast.error(list.error.message);
    setQueue(((list.data as Candidate[]) ?? []).filter(isBooked));
    setHidden(new Set([...readLocalHidden(), ...(log.data ?? []).map((r) => r.consultation_id as string)]));
  }, []);

  useEffect(() => {
    if (presenterMode) loadQueue();
  }, [presenterMode, loadQueue]);

  const visibleQueue = useMemo(() => queue.filter((c) => !hidden.has(c.id)), [queue, hidden]);
  const ordered = useMemo(() => queueOrder(bucketize(visibleQueue, now)), [visibleQueue, now]);

  // ------------------------------------------------------------ opening a presentation
  const openPresentation = useCallback((c: Candidate | null, programmeHint?: string | null) => {
    const match = findBestMatch(programmeHint ?? c?.desired_course, c?.desired_course);
    setCandidate(c);
    setBestMatchId(match?.id);
    setSelectedId(match?.id ?? null);
    setArea(match?.area ?? "english");
    setChapter(0);
    setVisited(new Set([0]));
    setUnavailable(null);
    setOpen(true);
  }, []);

  const startCandidate = (c: Candidate) => {
    setParams({ present: "1", candidate: c.id }, { replace: true });
    openPresentation(c);
  };

  // ?candidate=<id>: open that candidate straight away (must still be booked).
  useEffect(() => {
    if (!presenterMode || !candidateParam || open) return;
    let cancelled = false;
    supabase
      .from("consultations")
      .select("*")
      .eq("id", candidateParam)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        const c = data as Candidate | null;
        if (error || !c) setUnavailable("This candidate could not be found, or your account cannot read it.");
        else if (!isBooked(c)) setUnavailable(`${c.full_name} is not in the Booked Appointment stage anymore.`);
        else openPresentation(c);
      });
    return () => {
      cancelled = true;
    };
  }, [presenterMode, candidateParam]);

  const close = useCallback(() => {
    setOpen(false);
    if (candidateParam) setParams(presenterMode ? { present: "1" } : {}, { replace: true });
  }, [candidateParam, presenterMode, setParams]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !completeOpen && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, completeOpen, close]);

  const goTo = (i: number) => {
    setChapter(i);
    setVisited((v) => new Set(v).add(i));
  };

  // ------------------------------------------------------------ queue actions
  const hide = async (c: Candidate) => {
    setHidden((h) => new Set(h).add(c.id));
    const { error } = await supabase.from("activity_log").insert({ consultation_id: c.id, action: HIDDEN_ACTION });
    if (error) {
      // Not allowed to share it: remember in this browser only.
      try {
        localStorage.setItem(LOCAL_HIDDEN, JSON.stringify([...readLocalHidden(), c.id]));
      } catch {
        // storage unavailable
      }
      toast.message(`${c.full_name} hidden in this browser only`);
    } else toast.success(`${c.full_name} removed from the queue`);
  };

  const selectedProgramme = PROGRAMMES.find((p) => p.id === selectedId);

  const recordOutcome = (outcome: Outcome, comment: string) => {
    if (!candidate) return;
    const c = candidate;
    // Open the WhatsApp tab synchronously inside the click so pop-up blockers allow it.
    const waTab = outcome === "interviewed" && selectedProgramme ? window.open("about:blank", "_blank") : null;
    setBusy(true);
    (async () => {
      try {
        const { error } =
          outcome === "interviewed"
            ? await supabase.rpc("mark_candidate_interviewed", {
                _application_id: c.id,
                _comment: comment,
                _programme: selectedProgramme?.course ?? null,
              })
            : await supabase.rpc("mark_candidate_session_outcome", { _application_id: c.id, _outcome: outcome, _comment: comment });
        if (error) {
          waTab?.close();
          toast.error(error.message.includes("Booked Appointment") ? `${c.full_name} is no longer in the Booked Appointment stage.` : error.message);
          return;
        }

        if (outcome === "interviewed" && selectedProgramme) {
          try {
            const doc = buildPresentationPdf({ name: c.full_name, email: c.email }, selectedProgramme);
            const { data } = await supabase.functions.invoke("send-interview-recap", {
              body: {
                applicationId: c.id,
                programme: selectedProgramme.course,
                school: selectedProgramme.school,
                englishRequirement: selectedProgramme.english ?? "Confirm with school",
                presentationPdfBase64: pdfBase64(doc),
                presentationPdfFilename: presentationFilename(c.full_name),
              },
            });
            if (data?.waUrl && waTab) waTab.location.href = data.waUrl;
            else waTab?.close();
            if (data?.ok) toast.success(`Email sent to ${c.full_name}; WhatsApp is ready to send`);
            else toast.error("Candidate was interviewed, but the recap email failed");
          } catch {
            waTab?.close();
            toast.error("Candidate was interviewed, but the recap email failed");
          }
        } else {
          toast.success(`${c.full_name} moved to ${OUTCOME_LABEL[outcome]}`);
        }

        // Next candidate: the one after this in queue order.
        const idx = ordered.findIndex((x) => x.id === c.id);
        const next = ordered.filter((x) => x.id !== c.id)[Math.max(0, idx)] ?? null;
        setQueue((q) => q.filter((x) => x.id !== c.id));
        setDone((d) => d + 1);
        setSuccess(`${c.full_name} moved to ${OUTCOME_LABEL[outcome]}`);
        setCompleteOpen(false);
        setOpen(false);
        setParams({ present: "1" }, { replace: true });
        if (next) setTimeout(() => startCandidate(next), 1200);
      } finally {
        setBusy(false);
      }
    })();
  };

  // ------------------------------------------------------------ render
  const loginHref = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
  const checking = presentRequested && !personalLink && loading;
  const denied = presentRequested && !personalLink && !loading && !staff;
  const last = chapter === CHAPTERS.length - 1;
  const progress = Math.round(((chapter + 1) / CHAPTERS.length) * 100);

  return (
    <main className="relative h-[100svh] overflow-hidden bg-[#77c9f2]">
      <Toaster richColors position="top-center" />

      <Hero
        reduce={!!reduce}
        showButton={!presenterMode}
        label={personalLink ? "View my programme" : "Start presentation"}
        onStart={() => openPresentation(null, personalLink ? programmeParam : null)}
      />

      {presenterMode && !open && (
        <PresenterQueue
          candidates={visibleQueue}
          now={now}
          done={done}
          success={success}
          currentId={candidate?.id ?? null}
          onStart={startCandidate}
          onHide={hide}
        />
      )}

      {(checking || denied || unavailable) && (
        <div className="fixed inset-0 z-[55] grid place-items-center bg-[#031128]/90 p-6 text-center text-white backdrop-blur">
          <div className="max-w-md space-y-4">
            {checking ? (
              <>
                <Loader2 className="mx-auto h-10 w-10 animate-spin" />
                <h2 className="text-2xl font-black">Preparing the presentation</h2>
                <p className="text-white/75">Checking admin access and loading the selected candidate…</p>
              </>
            ) : denied ? (
              <>
                <ShieldCheck className="mx-auto h-12 w-12" />
                <h2 className="text-2xl font-black">Admin access required</h2>
                <p className="text-white/75">Sign in with an administrator or session-presenter account to open a candidate presentation.</p>
                <Link to={loginHref} className="inline-flex rounded-full bg-white px-6 py-3 font-extrabold text-[#092553] hover:bg-white/90">
                  Sign in and continue presentation
                </Link>
                {session && <p className="text-xs text-white/60">Signed in as {session.user.email} — this account has no presenter role.</p>}
              </>
            ) : (
              <>
                <Info className="mx-auto h-12 w-12" />
                <h2 className="text-2xl font-black">Presentation unavailable</h2>
                <p className="text-white/75">{unavailable}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => navigate("/admin?view=booked")}
                    className="rounded-full bg-white px-5 py-2.5 font-extrabold text-[#092553] hover:bg-white/90"
                  >
                    Back to Booked Appointments
                  </button>
                  <button
                    onClick={() => {
                      setUnavailable(null);
                      setParams({ present: "1" }, { replace: true });
                    }}
                    className="rounded-full px-5 py-2.5 font-extrabold text-white ring-2 ring-white/60 hover:bg-white/10"
                  >
                    Open presenter queue
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            key="presentation"
            className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#031128] sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.1 : 0.2 }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="chapter-title"
              className="relative flex w-full max-w-6xl flex-col overflow-hidden bg-white sm:rounded-3xl"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 45, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={reduce ? { duration: 0.1 } : { type: "spring", stiffness: 360, damping: 30 }}
            >
              <div aria-hidden className="h-2 shrink-0 bg-gradient-to-r from-[#d91c2b] via-[#8f2be8] to-[#078bc7]" />
              <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3 sm:px-8">
                {presenterMode ? (
                  <Link to="/admin?view=booked" className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">
                    <ArrowLeft className="h-3.5 w-3.5" /> Booked Appointments
                  </Link>
                ) : (
                  <span />
                )}
                <button
                  onClick={close}
                  aria-label="Close presentation"
                  className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 outline-none hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-[#5424c7]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 sm:px-8">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#078bc7]">
                  <Sparkles className="h-3.5 w-3.5" /> Your Malta journey
                </p>
                {presenterMode && candidate && (
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 ring-1 ring-emerald-200">
                    <span>
                      <strong>Full name:</strong> {candidate.full_name}
                    </span>
                    <span>
                      <strong>Email:</strong> {candidate.email}
                    </span>
                    <span>
                      <strong>Programme chosen:</strong> {selectedProgramme?.course ?? (candidate.desired_course || "Not selected")}
                    </span>
                  </div>
                )}
                <h1 id="chapter-title" className="mt-3 text-3xl font-black leading-tight text-[#092553] sm:text-4xl lg:text-5xl">
                  {CHAPTERS[chapter].title}
                </h1>
                <p className="mt-1 text-slate-600">{CHAPTERS[chapter].subtitle}</p>

                <div role="tablist" aria-label="Chapters" className="mt-5 flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1.5">
                  {CHAPTERS.map((c, i) => {
                    const active = i === chapter;
                    const finished = visited.has(i) && i < chapter;
                    return (
                      <button
                        key={c.title}
                        role="tab"
                        aria-selected={active}
                        onClick={() => goTo(i)}
                        className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-[#5424c7] ${
                          active ? "bg-white text-[#5424c7] shadow" : finished ? "text-emerald-600 hover:bg-white/60" : "text-slate-600 hover:bg-white/60"
                        }`}
                      >
                        {finished && "✓ "}
                        {c.title}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={chapter}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -18 }}
                      transition={{ duration: reduce ? 0.1 : 0.25 }}
                    >
                      {chapter === 0 && <IntroChapter welcomeName={presenterMode ? candidate?.full_name : undefined} />}
                      {chapter === 1 && <DiscoverChapter />}
                      {chapter === 2 && (
                        <ProgrammesChapter area={area} setArea={setArea} selectedId={selectedId} setSelectedId={setSelectedId} bestMatchId={bestMatchId} />
                      )}
                      {chapter === 3 && <VisaChapter />}
                      {chapter === 4 && <PartnersChapter />}
                      {chapter === 5 && <OtherInfoChapter />}
                      {chapter === 6 && <ThankYouChapter />}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
                <button
                  onClick={() => (chapter === 0 ? close() : goTo(chapter - 1))}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-slate-600 outline-none hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-[#5424c7]"
                >
                  <ArrowLeft className="h-4 w-4" /> {chapter === 0 ? "Back to Malta" : "Previous"}
                </button>
                <p className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 sm:block">Session progress {progress}%</p>
                <div className="flex gap-2">
                  {presenterMode && candidate && last && (
                    <button
                      onClick={() => setCompleteOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white outline-none hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    >
                      <Check className="h-4 w-4" /> Complete session
                    </button>
                  )}
                  <button
                    disabled={last}
                    onClick={() => goTo(chapter + 1)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#092553] px-5 py-2.5 text-sm font-extrabold text-white outline-none hover:bg-[#153d77] focus-visible:ring-2 focus-visible:ring-[#5424c7] focus-visible:ring-offset-2 disabled:opacity-40"
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {candidate && (
        <CompleteDialog
          key={candidate.id}
          open={completeOpen}
          onOpenChange={setCompleteOpen}
          name={candidate.full_name}
          hasProgramme={!!selectedProgramme}
          busy={busy}
          onOutcome={recordOutcome}
        />
      )}
    </main>
  );
}

function Hero({ reduce, showButton, label, onStart }: { reduce: boolean; showButton: boolean; label: string; onStart: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0, scale: reduce ? 1 : 1.035 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduce ? 0.2 : 1.2, ease: "easeOut" }}
      >
        {failed ? (
          <MaltaScene className="h-full w-full" />
        ) : (
          <picture>
            <source media="(max-width: 639px)" srcSet={IMAGES.heroMobile} />
            <img src={IMAGES.heroDesktop} alt="Study in Malta" className="h-full w-full object-cover object-center" onError={() => setFailed(true)} />
          </picture>
        )}
      </motion.div>
      {failed && (
        <div className="pointer-events-none absolute left-[8vw] top-[12svh] max-w-xl pr-6">
          <img src="/logo.png" alt="" className="mb-4 w-52 rounded-xl bg-white/90 p-2.5 shadow" />
          <h1 className="text-4xl font-black leading-tight text-[#092553] drop-shadow-sm sm:text-6xl">Your Malta study session</h1>
          <p className="mt-3 text-lg font-semibold text-[#092553]/80">Programmes, visa steps and life in Malta — explained in one guided session.</p>
        </div>
      )}
      {showButton && (
        <motion.button
          onClick={onStart}
          initial={{ opacity: 0, y: reduce ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: reduce ? 0.1 : 0.5 }}
          className="group absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 inline-flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border-2 border-white bg-[#092553] px-7 py-4 text-lg font-extrabold text-white shadow-[0_16px_40px_rgba(3,17,40,0.4)] outline-none transition-colors hover:bg-[#153d77] focus-visible:ring-4 focus-visible:ring-white/60 sm:bottom-10 sm:left-[8vw] sm:translate-x-0"
        >
          <Play className="h-5 w-5 fill-current" /> {label}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </motion.button>
      )}
    </>
  );
}
