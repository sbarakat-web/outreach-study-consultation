import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { BOOKING_LINK, CALL_MINUTES, formatSlot } from "../lib/options";
import { useI18n } from "../lib/i18n";
import { Alert, Button, Card, Spinner } from "../components/ui";

interface Suggestion {
  firstName: string;
  at: string | null;
  confirmed: boolean;
}

/** Public one-click page from the "please confirm your call" email / WhatsApp (no sign-in needed). */
export function ConfirmCall() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const [s, setS] = useState<Suggestion | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);

  useEffect(() => {
    supabase.functions.invoke("confirm-call", { body: { action: "get", token } }).then(({ data, error }) => {
      if (error || data?.error) setError(t("confirm.invalid"));
      else setS(data as Suggestion);
    });
  }, [token, t]);

  const confirm = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("confirm-call", { body: { action: "confirm", token } });
    setSaving(false);
    if (error || data?.error) return setError(data?.error === "expired" ? t("confirm.expired") : t("confirm.failed"));
    setS(data as Suggestion);
    setJustConfirmed(true);
  };

  if (!s && !error) return <Spinner />;
  const when = s?.at ? formatSlot(s.at, { weekday: "long", month: "long" }) : null;

  return (
    <div className="mx-auto max-w-md pt-4 sm:pt-10">
      <Card>
        <div className="space-y-5 px-6 py-8 text-center sm:px-8">
          {s?.confirmed ? (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h1 className="text-2xl font-black">{justConfirmed ? t("confirm.doneTitle") : t("confirm.alreadyTitle")}</h1>
              {when && (
                <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-lg font-black text-navy ring-1 ring-emerald-200">
                  {when}
                  <span className="block text-xs font-bold text-slate-500">{t("confirm.minutes", { min: CALL_MINUTES })}</span>
                </p>
              )}
              <p className="text-sm text-slate-600">{t("confirm.doneText")}</p>
              <Link to="/dashboard/documents">
                <Button className="w-full">{t("confirm.uploadDocs")}</Button>
              </Link>
            </>
          ) : s ? (
            <>
              <CalendarCheck className="mx-auto h-12 w-12 text-brand" />
              <h1 className="text-2xl font-black">{t("confirm.title", { name: s.firstName })}</h1>
              <p className="text-sm text-slate-600">{t("confirm.sub")}</p>
              {when && (
                <p className="rounded-2xl bg-brand/5 px-4 py-3 text-lg font-black text-navy ring-1 ring-brand/20">
                  {when}
                  <span className="block text-xs font-bold text-slate-500">{t("confirm.minutes", { min: CALL_MINUTES })}</span>
                </p>
              )}
              {error && <Alert>{error}</Alert>}
              <Button className="w-full" loading={saving} onClick={confirm} disabled={!s.at}>
                {t("confirm.yes")}
              </Button>
              <a href={BOOKING_LINK} target="_blank" rel="noreferrer" className="block text-sm font-bold text-brand hover:underline">
                {t("confirm.other")}
              </a>
            </>
          ) : (
            <Alert>{error}</Alert>
          )}
        </div>
      </Card>
    </div>
  );
}
