import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarCheck, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { CALL_MINUTES, formatSlot, waLink, whatsappNumber } from "../lib/options";
import { useFreeTimes } from "../lib/freeTimes";
import { currentLocale, useI18n } from "../lib/i18n";
import { Alert, Button, Card, Spinner } from "../components/ui";
import { SlotGrid } from "../components/SlotGrid";

interface Suggestion {
  firstName: string;
  at: string | null;
  confirmed: boolean;
  canReschedule: boolean;
}

const longWhen = (iso: string) => formatSlot(iso, { weekday: "long", month: "long" });

/**
 * Public page from the "please confirm your call" email / WhatsApp (no sign-in needed).
 * "Yes, confirm" books the suggested time; "Choose another time" shows the free slots from
 * the adviser's Google Calendar and confirms the picked one straight away.
 */
export function ConfirmCall() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [s, setS] = useState<Suggestion | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(params.get("pick") === "1");
  const [done, setDone] = useState<"confirmed" | "moved" | null>(null);

  useEffect(() => {
    supabase.functions.invoke("confirm-call", { body: { action: "get", token } }).then(({ data, error }) => {
      if (error || data?.error) setError(t("confirm.invalid"));
      else setS(data as Suggestion);
    });
  }, [token, t]);

  const errorText = (code?: string) =>
    code === "taken" ? t("confirm.taken") : code === "expired" ? t("confirm.expired") : code === "too-late" ? t("confirm.tooLate") : t("confirm.failed");

  const call = async (body: Record<string, unknown>, after: "confirmed" | "moved") => {
    setSaving(true);
    setError("");
    const { data, error } = await supabase.functions.invoke("confirm-call", { body: { token, ...body } });
    setSaving(false);
    // supabase-js puts non-2xx bodies on error.context
    const code: string | undefined = data?.error ?? (await (error as { context?: Response } | null)?.context?.json?.().catch(() => null))?.error;
    if (error || data?.error) {
      setError(errorText(code));
      if (code === "taken") setPicking(true);
      return;
    }
    setS(data as Suggestion);
    setPicking(false);
    setDone(after);
  };

  if (!s && !error) return <Spinner />;
  const when = s?.at ? longWhen(s.at) : null;

  return (
    <div className="mx-auto max-w-lg pt-4 sm:pt-10">
      <Card>
        <div className="space-y-5 px-6 py-8 sm:px-8">
          {!s ? (
            <Alert>{error}</Alert>
          ) : picking ? (
            <PickTime
              saving={saving}
              error={error}
              onBack={() => {
                setPicking(false);
                setError("");
              }}
              onPick={(at) => call({ action: "reschedule", at }, s.confirmed ? "moved" : "confirmed")}
            />
          ) : s.confirmed ? (
            <div className="space-y-5 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h1 className="text-2xl font-black">{done === "moved" ? t("confirm.movedTitle") : done ? t("confirm.doneTitle") : t("confirm.alreadyTitle")}</h1>
              {when && <TimeBox when={when} tone="emerald" />}
              <p className="text-sm text-slate-600">{t("confirm.doneText")}</p>
              <Link to="/dashboard/documents" className="block">
                <Button className="w-full">{t("confirm.uploadDocs")}</Button>
              </Link>
              {s.canReschedule && (
                <button onClick={() => setPicking(true)} className="text-sm font-bold text-brand hover:underline">
                  {t("confirm.change")}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5 text-center">
              <CalendarCheck className="mx-auto h-12 w-12 text-brand" />
              <h1 className="text-2xl font-black">{t("confirm.title", { name: s.firstName })}</h1>
              <p className="text-sm text-slate-600">{t("confirm.sub")}</p>
              {when && <TimeBox when={when} tone="brand" />}
              {error && <Alert>{error}</Alert>}
              <Button className="w-full" loading={saving} onClick={() => call({ action: "confirm" }, "confirmed")} disabled={!s.at}>
                {t("confirm.yes")}
              </Button>
              <button onClick={() => setPicking(true)} className="block w-full text-sm font-bold text-brand hover:underline">
                {t("confirm.other")}
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function TimeBox({ when, tone }: { when: string; tone: "brand" | "emerald" }) {
  const { t } = useI18n();
  return (
    <p className={`rounded-2xl px-4 py-3 text-lg font-black text-navy ring-1 ${tone === "emerald" ? "bg-emerald-50 ring-emerald-200" : "bg-brand/5 ring-brand/20"}`}>
      {when}
      <span className="block text-xs font-bold text-slate-500">{t("confirm.minutes", { min: CALL_MINUTES })}</span>
    </p>
  );
}

/** Free slots from the adviser's Google Calendar, in the candidate's own time zone and language. */
function PickTime({ saving, error, onBack, onPick }: { saving: boolean; error: string; onBack: () => void; onPick: (iso: string) => void }) {
  const { t } = useI18n();
  const { times, loading } = useFreeTimes();
  const [at, setAt] = useState("");

  return (
    <div className="space-y-4">
      <div className="text-center">
        <Clock className="mx-auto h-10 w-10 text-brand" />
        <h1 className="mt-2 text-2xl font-black">{t("confirm.pickTitle")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("confirm.pickSub")}</p>
      </div>
      {error && <Alert>{error}</Alert>}
      {loading ? (
        <Spinner />
      ) : times.length === 0 ? (
        <Alert tone="info">
          {t("confirm.noSlots")}{" "}
          {whatsappNumber && (
            <a href={waLink(whatsappNumber)} target="_blank" rel="noreferrer" className="font-bold underline">
              WhatsApp
            </a>
          )}
        </Alert>
      ) : (
        <>
          <p className="text-xs text-slate-400">{t("confirm.yourTz")}</p>
          <SlotGrid times={times} value={at} onChange={setAt} locale={currentLocale()} />
          <Button className="w-full" loading={saving} disabled={!at} onClick={() => onPick(at)}>
            {at ? t("confirm.confirmNew", { when: longWhen(at) }) : t("confirm.pickTitle")}
          </Button>
        </>
      )}
      <button onClick={onBack} className="block w-full text-sm font-bold text-slate-500 hover:text-navy">
        {t("confirm.back")}
      </button>
    </div>
  );
}
