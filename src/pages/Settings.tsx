import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Camera, Globe2, KeyRound, LogOut, MessageCircle, UserRound, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { LANGS, useI18n, type Lang } from "../lib/i18n";
import { waLink, whatsappNumber } from "../lib/options";
import type { Consultation } from "../lib/types";
import { Alert, Button, Card } from "../components/ui";

/** Settings → My account. Candidates also edit their contact details (`c`). */
export function AccountSettings({ c, onSaved, staff }: { c?: Consultation; onSaved?: () => void; staff?: boolean }) {
  const { session, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">{t("set.title")}</h1>

      {c && <ProfileCard c={c} onSaved={onSaved} />}
      {staff && <AdvisorProfileCard />}

      <Card>
        <div className="space-y-4 px-5 py-5 sm:px-7">
          <SectionTitle icon={<KeyRound className="h-4 w-4" />} label={t("set.security")} />
          <div>
            <label className="label" htmlFor="acc-email">
              {t("set.email")}
            </label>
            <input id="acc-email" className="field bg-mist" readOnly value={session?.user.email ?? ""} />
            <p className="mt-1.5 text-xs text-slate-500">{t("set.emailHint")}</p>
          </div>
          <SetPassword />
          <Button
            variant="secondary"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            <LogOut className="h-4 w-4" /> {t("set.signOut")}
          </Button>
        </div>
      </Card>

      {!staff && (
        <Card>
          <div className="space-y-3 px-5 py-5 sm:px-7">
            <SectionTitle icon={<Globe2 className="h-4 w-4" />} label={t("set.language")} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code as Lang)}
                  aria-pressed={lang === l.code}
                  className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition ${
                    lang === l.code ? "border-brand bg-brand text-white" : "border-slate-200 bg-white hover:border-brand/40"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {staff && (
        <Card>
          <div className="grid gap-2 px-5 py-5 sm:grid-cols-2 sm:px-7">
            <Link to="/admin/team">
              <Button variant="secondary" className="w-full">
                <Users className="h-4 w-4" /> Team & roles
              </Button>
            </Link>
            <Link to="/admin/calendar">
              <Button variant="secondary" className="w-full">
                <CalendarDays className="h-4 w-4" /> Google Calendar connection
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {!staff && whatsappNumber && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7">
            <div>
              <p className="font-black">{t("set.help")}</p>
              <p className="text-sm text-slate-500">{t("set.helpText")}</p>
            </div>
            <a href={waLink(whatsappNumber)} target="_blank" rel="noreferrer">
              <Button className="bg-[#25D366] hover:bg-[#1fb857]">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}

/** Staff: name + photo shown to candidates in call emails ("Your call with …"). */
function AdvisorProfileCard() {
  const { session } = useAuth();
  const email = (session?.user.email ?? "").toLowerCase();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    supabase
      .from("staff_profiles")
      .select("display_name, photo_url")
      .eq("email", email)
      .maybeSingle()
      .then(({ data }) => {
        setName(data?.display_name ?? "");
        setPhoto(data?.photo_url ?? null);
      });
  }, [email]);

  const save = async (patch: { display_name?: string; photo_url?: string | null }) => {
    const { error } = await supabase
      .from("staff_profiles")
      .upsert({ email, display_name: name.trim() || null, photo_url: photo, ...patch, updated_at: new Date().toISOString() });
    return error;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const error = await save({});
    setBusy(false);
    setMsg(error ? { tone: "error", text: error.message } : { tone: "success", text: "Saved — candidates will see this in their call emails." });
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setMsg({ tone: "error", text: "Please use a photo under 2 MB." });
    setBusy(true);
    const path = `${email}/photo-${Date.now()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`;
    const up = await supabase.storage.from("staff-photos").upload(path, file, { contentType: file.type });
    if (up.error) {
      setBusy(false);
      return setMsg({ tone: "error", text: up.error.message });
    }
    const url = supabase.storage.from("staff-photos").getPublicUrl(path).data.publicUrl;
    const error = await save({ photo_url: url });
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: error.message });
    setPhoto(url);
    setMsg({ tone: "success", text: "Photo updated." });
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-7">
        <SectionTitle icon={<UserRound className="h-4 w-4" />} label="Advisor profile (shown in call emails)" />
        <div className="flex items-center gap-4">
          <label className="relative grid h-16 w-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-brand text-xl font-black text-white">
            {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : (name || email).slice(0, 1).toUpperCase()}
            <span className="absolute inset-x-0 bottom-0 grid place-items-center bg-black/40 py-0.5">
              <Camera className="h-3.5 w-3.5" />
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={upload} aria-label="Upload photo" />
          </label>
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="adv-name">
              Name candidates see
            </label>
            <input id="adv-name" className="field" placeholder="e.g. Sofyane" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-slate-500">Emails say “Your call with {name || "…"}” with this photo. Leave empty to sign as “Outreach”.</p>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Button type="submit" variant="secondary" loading={busy}>
          Save advisor profile
        </Button>
      </form>
    </Card>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-500">
      <span className="text-brand">{icon}</span> {label}
    </h2>
  );
}

function ProfileCard({ c, onSaved }: { c: Consultation; onSaved?: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(c.full_name);
  const [whatsapp, setWhatsapp] = useState(c.whatsapp ?? "");
  const [country, setCountry] = useState(c.country ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.rpc("update_my_profile", { p_full_name: name, p_whatsapp: whatsapp, p_country: country });
    setSaving(false);
    setMsg(error ? { tone: "error", text: error.message } : { tone: "success", text: t("set.saved") });
    if (!error) onSaved?.();
  };

  return (
    <Card>
      <form onSubmit={save} className="space-y-4 px-5 py-5 sm:px-7">
        <SectionTitle icon={<UserRound className="h-4 w-4" />} label={t("set.profile")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="acc-name">
              {t("set.fullName")}
            </label>
            <input id="acc-name" required autoComplete="name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="acc-wa">
              {t("set.whatsapp")}
            </label>
            <input id="acc-wa" type="tel" dir="ltr" autoComplete="tel" className="field" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="acc-country">
              {t("set.country")}
            </label>
            <input id="acc-country" autoComplete="country-name" className="field" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Button type="submit" loading={saving}>
          {t("set.save")}
        </Button>
      </form>
    </Card>
  );
}

// Optional: sign-in is by emailed code, but a password can be added for faster sign-in.
export function SetPassword() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setMsg({ tone: "error", text: t("pw.short") });
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setMsg({ tone: "error", text: error.message });
    setMsg({ tone: "success", text: t("pw.saved") });
    setPassword("");
    setOpen(false);
  };

  return (
    <div className="rounded-2xl bg-mist px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{t("pw.info")}</p>
        {!open && (
          <Button variant="ghost" onClick={() => setOpen(true)}>
            {t("pw.set")}
          </Button>
        )}
      </div>
      {open && (
        <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            aria-label={t("pw.label")}
            autoComplete="new-password"
            placeholder={t("pw.placeholder")}
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" loading={saving}>
            {t("pw.save")}
          </Button>
        </form>
      )}
      {msg && (
        <div className="mt-3">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}
    </div>
  );
}
