import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Alert, Button, Card, Spinner } from "../../../components/ui";
import { Preview } from "./Preview";
import { loadSettings, type Block, type MarketingSettings } from "./shared";

const SAMPLE: Block[] = [{ id: "f", type: "text", text: "This is how the footer of every marketing email looks." }];

/** Footer shown on every marketing email: grey logo, social icons, contact links, company + address, why-line, unsubscribe + preferences. */
export function FooterSettings() {
  const [s, setS] = useState<MarketingSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  useEffect(() => {
    loadSettings().then(setS);
  }, []);
  if (!s) return <Spinner />;

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("marketing_settings").upsert({ id: 1, ...s, updated_at: new Date().toISOString() });
    setBusy(false);
    setMsg(error ? { tone: "error", text: error.message } : { tone: "success", text: "Footer saved — used in every marketing email." });
  };
  const input = (key: keyof MarketingSettings, label: string, placeholder = "") => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="field" placeholder={placeholder} value={s[key]} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card>
        <div className="space-y-4 px-5 py-5">
          <h2 className="text-lg font-black">Email footer</h2>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <h3 className="pt-1 text-xs font-bold uppercase tracking-wide text-slate-400">Company & contact</h3>
          {input("company_name", "Company name", "Outreach — Study in Malta")}
          <label className="block">
            <span className="label">Office address (required for marketing email)</span>
            <textarea className="field" rows={2} placeholder="Outreach Ltd, Street, Town, Malta" value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {input("website_url", "Website", "https://outreachstudy.eu")}
            {input("contact_email", "Contact email", "study@…")}
            {input("phone", "Phone", "+356 …")}
            {input("whatsapp", "WhatsApp number", "35699728213")}
          </div>
          <h3 className="pt-1 text-xs font-bold uppercase tracking-wide text-slate-400">Social links</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {input("instagram_url", "Instagram", "https://instagram.com/…")}
            {input("facebook_url", "Facebook", "https://facebook.com/…")}
            {input("tiktok_url", "TikTok", "https://tiktok.com/@…")}
            {input("linkedin_url", "LinkedIn", "https://linkedin.com/company/…")}
            {input("youtube_url", "YouTube", "https://youtube.com/@…")}
          </div>
          <label className="block">
            <span className="label">“Why am I getting this?” line</span>
            <textarea className="field" rows={2} value={s.why_text} onChange={(e) => setS({ ...s, why_text: e.target.value })} />
          </label>
          <p className="text-xs text-slate-500">Empty fields are hidden. Unsubscribe and “Manage preferences” are always added.</p>
          <Button loading={busy} onClick={save}>
            Save footer
          </Button>
        </div>
      </Card>
      <Preview blocks={SAMPLE} preheader="" subject="Footer preview" settings={s} />
    </div>
  );
}
